import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import { isUserPlanActive, checkAndCleanUserPlan } from '@/lib/plan-utils'
import {
  checkGenerationAllowed,
  startGeneration,
  completeGeneration,
  cancelGeneration,
  logGeneration,
  getCooldownRemaining,
  GENERATION_PROTECTION
} from '@/lib/generation-protection'
import { verifyRecaptchaV2 } from '@/lib/security'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // ===========================================
  // 🛡️ VERIFICAÇÕES INICIAIS
  // ===========================================
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const session = await getServerSession(req, res, authOptions)

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const userId = session.user.id
  const { serviceId, recaptchaToken } = req.body

  if (!serviceId) {
    return res.status(400).json({ error: 'ServiceId is required' })
  }

  // ===========================================
  // 🛡️ VERIFICAR CAPTCHA
  // ===========================================
  
  // Verificar se reCAPTCHA está configurado
  const recaptchaSecretKey = process.env.RECAPTCHA_V2_SECRET_KEY || process.env.RECAPTCHA_SECRET_KEY
  
  if (recaptchaSecretKey) {
    if (!recaptchaToken) {
      return res.status(400).json({ error: 'Complete a verificação de segurança (CAPTCHA)' })
    }

    const ip = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
               req.headers['x-real-ip']?.toString() ||
               req.socket?.remoteAddress || 'unknown'

    const captchaValid = await verifyRecaptchaV2(recaptchaToken, ip)
    
    if (!captchaValid) {
      // Registrar tentativa suspeita
      try {
        await prisma.securityLog.create({
          data: {
            type: 'bot_detected',
            ip,
            username: userId,
            success: false,
            reason: 'CAPTCHA inválido na geração',
            metadata: JSON.stringify({
              action: 'generation_captcha_fail'
            })
          }
        })
      } catch (e) {}
      
      return res.status(400).json({ error: 'Verificação de segurança falhou. Tente novamente.' })
    }
  }

  // ===========================================
  // 🛡️ PROTEÇÃO CONTRA AUTOMAÇÃO
  // ===========================================
  
  const protectionCheck = await checkGenerationAllowed(req, userId)
  
  if (!protectionCheck.allowed) {
    // Retornar informações de cooldown se aplicável
    const response: any = { 
      error: protectionCheck.reason,
      blocked: true
    }
    
    if (protectionCheck.cooldownRemaining) {
      response.cooldownRemaining = protectionCheck.cooldownRemaining
      response.cooldownTotal = GENERATION_PROTECTION.COOLDOWN_SECONDS
    }
    
    // Se deve banir, banir o IP
    if (protectionCheck.shouldBan) {
      const ip = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
                 req.headers['x-real-ip']?.toString() ||
                 req.socket?.remoteAddress || 'unknown'
      
      try {
        await prisma.bannedIp.create({
          data: {
            ip,
            reason: 'Automação detectada na geração de contas',
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 horas
          }
        }).catch(() => {}) // Ignorar se já existe
      } catch (e) {
        // Ignorar
      }
    }
    
    return res.status(429).json(response)
  }

  // ===========================================
  // 🔒 MARCAR INÍCIO DO PROCESSAMENTO
  // ===========================================
  
  startGeneration(userId)

  try {
    // ===========================================
    // 👤 VERIFICAR USUÁRIO
    // ===========================================
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { plan: true }
    })

    if (!user) {
      cancelGeneration(userId)
      return res.status(404).json({ error: 'User not found' })
    }

    // Verificar se usuário está banido
    if (user.isBanned) {
      cancelGeneration(userId)
      return res.status(403).json({ error: 'Usuário banido. Entre em contato com o suporte.' })
    }

    // ===========================================
    // 📅 VERIFICAR GERAÇÕES GRÁTIS DIÁRIAS
    // ===========================================
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const lastFreeGenDate = user.lastFreeGenerationDate ? new Date(user.lastFreeGenerationDate) : null
    const lastFreeGenDateStart = lastFreeGenDate ? new Date(lastFreeGenDate) : null
    if (lastFreeGenDateStart) {
      lastFreeGenDateStart.setHours(0, 0, 0, 0)
    }

    let useFreeGeneration = false
    
    // Se é um novo dia, resetar contador
    if (!lastFreeGenDateStart || lastFreeGenDateStart.getTime() !== today.getTime()) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          dailyFreeGenerations: 0,
          lastFreeGenerationDate: today
        }
      })
      user.dailyFreeGenerations = 0
    }

    // Verificar se pode usar geração grátis (máximo 2 por dia)
    if (user.dailyFreeGenerations < 2) {
      useFreeGeneration = true
    }

    // ===========================================
    // 🛠️ VERIFICAR SERVIÇO
    // ===========================================
    
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      include: {
        allowedPlans: true
      }
    })

    if (!service || !service.isActive) {
      cancelGeneration(userId)
      return res.status(404).json({ error: 'Serviço indisponível no momento.' })
    }

    // ===========================================
    // 📋 VERIFICAR PLANO
    // ===========================================
    
    // Limpar plano expirado automaticamente se necessário
    await checkAndCleanUserPlan(user.id)

    // Verificar se tem plano ativo usando a função utilitária
    const hasActivePlan = isUserPlanActive(user.planId, user.planExpiresAt)
    
    // Verificar se tem gerações bonus disponíveis
    const hasBonusGenerations = user.bonusGenerations > 0
    
    // Se não tem plano ativo, só pode usar gerações grátis diárias ou bonus
    if (!hasActivePlan && !useFreeGeneration && !hasBonusGenerations) {
      cancelGeneration(userId)
      return res.status(400).json({ error: 'Você não possui um plano ativo e já usou suas 2 gerações grátis de hoje. Adquira um plano ou aguarde até amanhã.' })
    }

    const allowedPlanIds = service.allowedPlans?.map((access) => access.planId) ?? []
    const requiresPaidPlan = allowedPlanIds.length > 0
    const userPlanAllowed = hasActivePlan && user.planId ? allowedPlanIds.includes(user.planId) : false

    if (requiresPaidPlan && !userPlanAllowed) {
      cancelGeneration(userId)
      return res.status(403).json({
        error: 'Este serviço é exclusivo para assinantes de planos pagos. Faça um upgrade para gerar este serviço.'
      })
    }

    // Se está usando geração grátis diária, não precisa verificar limites do plano
    if (useFreeGeneration) {
      // Já será tratado abaixo, apenas incrementar contador
    } else if (hasActivePlan && user.planId) {
      // Check max generations (considerando gerações bonus)
      const generatedCount = await prisma.generatedAccount.count({
        where: { userId: session.user.id }
      })

      // Total de gerações permitidas = maxGenerations do plano + bonusGenerations
      const totalAllowed = user.plan!.maxGenerations === 0 
        ? Infinity 
        : user.plan!.maxGenerations + user.bonusGenerations

      if (user.plan!.maxGenerations > 0 && generatedCount >= totalAllowed) {
        // Verificar se ainda tem gerações bonus disponíveis
        if (generatedCount >= user.plan!.maxGenerations) {
          // Se já usou todas do plano, usar bonus
          if (user.bonusGenerations > 0) {
            // Decrementar bonus
            await prisma.user.update({
              where: { id: user.id },
              data: {
                bonusGenerations: {
                  decrement: 1
                }
              }
            })
          } else {
            cancelGeneration(userId)
            return res.status(400).json({ error: 'Max generations reached' })
          }
        }
      }
    } else if (hasBonusGenerations) {
      // Usuário sem plano ativo, mas tem gerações bonus - usar uma
      await prisma.user.update({
        where: { id: user.id },
        data: {
          bonusGenerations: {
            decrement: 1
          }
        }
      })
    }

    // ===========================================
    // 📦 BUSCAR ESTOQUE DISPONÍVEL
    // ===========================================
    
    const stock = await prisma.stock.findFirst({
      where: {
        serviceId,
        isUsed: false
      }
    })

    if (!stock) {
      cancelGeneration(userId)
      return res.status(404).json({ error: 'No stock available for this service' })
    }

    // ===========================================
    // ✅ GERAR CONTA
    // ===========================================
    
    // Mark stock as used
    await prisma.stock.update({
      where: { id: stock.id },
      data: {
        isUsed: true,
        usedAt: new Date(),
        usedBy: session.user.id
      }
    })

    // Create generated account
    const generatedAccount = await prisma.generatedAccount.create({
      data: {
        userId: session.user.id,
        stockId: stock.id
      },
      include: {
        stock: true
      }
    })

    // Atualizar contador de gerações grátis se necessário
    if (useFreeGeneration) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          dailyFreeGenerations: {
            increment: 1
          },
          lastFreeGenerationDate: today
        }
      })
    }

    // ===========================================
    // 🛡️ REGISTRAR GERAÇÃO E COMPLETAR
    // ===========================================
    
    const ip = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
               req.headers['x-real-ip']?.toString() ||
               req.socket?.remoteAddress || 'unknown'
    
    await logGeneration(userId, ip, serviceId, service.name)
    completeGeneration(userId)

    // ===========================================
    // 📤 RETORNAR RESPOSTA
    // ===========================================
    
    // Calcular próximo cooldown
    const nextCooldown = GENERATION_PROTECTION.COOLDOWN_SECONDS

    return res.json({
      id: generatedAccount.id,
      username: stock.username,
      password: stock.password,
      email: stock.email,
      extraData: stock.extraData ? JSON.parse(stock.extraData) : null,
      createdAt: generatedAccount.createdAt,
      isFreeGeneration: useFreeGeneration,
      // Informações de cooldown
      cooldown: {
        seconds: nextCooldown,
        message: `Aguarde ${Math.floor(nextCooldown / 60)} minutos e ${nextCooldown % 60} segundos antes da próxima geração.`
      }
    })
  } catch (error: any) {
    cancelGeneration(userId)
    console.error('Erro na geração:', error)
    return res.status(500).json({ error: 'Erro interno ao gerar conta.' })
  }
}
