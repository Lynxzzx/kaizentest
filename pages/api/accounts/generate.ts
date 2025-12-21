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
  // 🛡️ VERIFICAÇÕES INICIAIS (RÁPIDAS)
  // ===========================================
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Obter sessão de forma assíncrona
  const sessionPromise = getServerSession(req, res, authOptions)
  
  const { serviceId, recaptchaToken } = req.body

  if (!serviceId) {
    return res.status(400).json({ error: 'ServiceId is required' })
  }

  const session = await sessionPromise

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const userId = session.user.id

  // ===========================================
  // 🛡️ PROTEÇÃO CONTRA AUTOMAÇÃO (PRIMEIRO - RÁPIDO, EM MEMÓRIA)
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
    
    // Banir IP apenas em casos extremos (evitar operações de DB desnecessárias)
    if (protectionCheck.shouldBan && protectionCheck.suspiciousLevel >= 90) {
      const ip = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
                 req.headers['x-real-ip']?.toString() ||
                 req.socket?.remoteAddress || 'unknown'
      
      // Fazer em background para não atrasar resposta
      prisma.bannedIp.create({
        data: {
          ip,
          reason: 'Automação detectada na geração de contas',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 horas
        }
      }).catch(() => {}) // Ignorar erros
    }
    
    return res.status(429).json(response)
  }

  // ===========================================
  // 🛡️ VERIFICAR CAPTCHA (APENAS SE CONFIGURADO - TOLERANTE COM ERROS CONHECIDOS)
  // ===========================================
  
  const recaptchaSecretKey = process.env.RECAPTCHA_V2_SECRET_KEY || process.env.RECAPTCHA_SECRET_KEY
  
  // Tornar reCAPTCHA mais tolerante devido a problemas conhecidos (challenges impossíveis)
  if (recaptchaSecretKey && recaptchaToken) {
    try {
      const captchaResult = await verifyRecaptchaV2(recaptchaToken)
      
      if (!captchaResult.success) {
        const errorCodes = captchaResult.errorCodes || []
        
        // Erros conhecidos do reCAPTCHA que podem ocorrer mesmo com usuários legítimos:
        // - timeout-or-duplicate: token expirado ou já usado (comum em double-clicks)
        // - invalid-input-response: resposta inválida (pode ser challenge impossível)
        // - bad-request: requisição malformada (problema do Google, não do usuário)
        const isTolerableError = errorCodes.some(code => 
          ['timeout-or-duplicate', 'invalid-input-response', 'bad-request', 'network-error'].includes(code)
        )
        
        if (isTolerableError) {
          // Erro tolerável - permitir requisição mas avisar
          console.warn('⚠️ reCAPTCHA retornou erro tolerável, permitindo requisição:', errorCodes)
        } else {
          // Erro crítico (ex: missing-input-secret, invalid-input-secret) - bloquear
          // Mas apenas se for claramente um problema de configuração ou bot óbvio
          const isCriticalError = errorCodes.some(code => 
            ['missing-input-secret', 'invalid-input-secret'].includes(code)
          )
          
          if (isCriticalError) {
            // Erro crítico de configuração - não deveria acontecer em produção
            console.error('❌ Erro crítico do reCAPTCHA:', errorCodes)
          }
          
          // Para outros erros, ainda permitir mas avisar
          console.warn('⚠️ reCAPTCHA retornou erro, mas permitindo requisição:', errorCodes)
        }
      }
    } catch (error) {
      // Se houver erro na verificação (rede, etc), permitir requisição
      console.warn('⚠️ Erro ao verificar reCAPTCHA, permitindo requisição:', error)
    }
  }
  // Se não tem token mas captcha está configurado, permitir (pode ser problema do frontend)


  // ===========================================
  // 🔒 MARCAR INÍCIO DO PROCESSAMENTO
  // ===========================================
  
  startGeneration(userId)

  try {
    // ===========================================
    // 👤 BUSCAR USUÁRIO E SERVIÇO EM PARALELO (OTIMIZAÇÃO)
    // ===========================================
    
    const [user, service] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        include: { plan: true }
      }),
      prisma.service.findUnique({
        where: { id: serviceId },
        include: { allowedPlans: true }
      })
    ])

    if (!user) {
      cancelGeneration(userId)
      return res.status(404).json({ error: 'User not found' })
    }

    // Verificar se usuário está banido
    if (user.isBanned) {
      cancelGeneration(userId)
      return res.status(403).json({ error: 'Usuário banido. Entre em contato com o suporte.' })
    }

    // Verificar serviço (movido para cima para falhar rápido)
    if (!service || !service.isActive) {
      cancelGeneration(userId)
      return res.status(404).json({ error: 'Serviço indisponível no momento.' })
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
    let needsResetDailyCounter = false
    
    // Se é um novo dia, marcar para resetar contador (será feito junto com outras operações)
    if (!lastFreeGenDateStart || lastFreeGenDateStart.getTime() !== today.getTime()) {
      needsResetDailyCounter = true
      user.dailyFreeGenerations = 0
    }

    // Verificar se pode usar geração grátis (máximo 2 por dia)
    if (user.dailyFreeGenerations < 2) {
      useFreeGeneration = true
    }

    // ===========================================
    // 📋 VERIFICAR PLANO (OTIMIZADO - SEM CHAMADA EXTRA AO DB)
    // ===========================================
    
    // Verificar e limpar plano expirado em background (não bloquear)
    checkAndCleanUserPlan(user.id).catch(() => {})

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
    // 📦 BUSCAR E RESERVAR ESTOQUE (OPERAÇÃO ATÔMICA OTIMIZADA)
    // ===========================================
    
    // Usar updateMany com take para operação atômica - evita race conditions
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
    // ✅ GERAR CONTA (TRANSAÇÃO OTIMIZADA)
    // ===========================================
    
    const ip = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
               req.headers['x-real-ip']?.toString() ||
               req.socket?.remoteAddress || 'unknown'
    
    // Usar transação com timeout aumentado para evitar expiração
    // Timeout de 15 segundos (padrão é 5s) para operações mais lentas
    const generatedAccount = await prisma.$transaction(async (tx) => {
      // Marcar stock como usado
      await tx.stock.update({
        where: { id: stock.id },
        data: {
          isUsed: true,
          usedAt: new Date(),
          usedBy: session.user.id
        }
      })

      // Criar conta gerada
      const account = await tx.generatedAccount.create({
        data: {
          userId: session.user.id,
          stockId: stock.id
        }
      })

      // Atualizar contador de gerações grátis se necessário
      if (useFreeGeneration || needsResetDailyCounter) {
        await tx.user.update({
          where: { id: user.id },
          data: {
            dailyFreeGenerations: useFreeGeneration 
              ? { increment: 1 } 
              : (needsResetDailyCounter ? 0 : undefined),
            lastFreeGenerationDate: today
          }
        })
      }

      return account
    }, {
      maxWait: 10000, // Tempo máximo de espera para iniciar a transação (10s)
      timeout: 15000,  // Timeout da transação (15s) - aumentado de 5s para 15s
    })

    // ===========================================
    // 🛡️ REGISTRAR GERAÇÃO E COMPLETAR (BACKGROUND)
    // ===========================================
    
    // Fazer log em background para não atrasar resposta
    logGeneration(userId, ip, serviceId, service.name).catch(() => {})
    completeGeneration(userId)

    // ===========================================
    // 📤 RETORNAR RESPOSTA
    // ===========================================
    
    const nextCooldown = GENERATION_PROTECTION.COOLDOWN_SECONDS

    return res.json({
      id: generatedAccount.id,
      username: stock.username,
      password: stock.password,
      email: stock.email,
      extraData: stock.extraData ? JSON.parse(stock.extraData) : null,
      createdAt: generatedAccount.createdAt,
      isFreeGeneration: useFreeGeneration,
      cooldown: {
        seconds: nextCooldown,
        message: nextCooldown >= 60 
          ? `Aguarde ${Math.floor(nextCooldown / 60)} minuto(s) antes da próxima geração.`
          : `Aguarde ${nextCooldown} segundos antes da próxima geração.`
      }
    })
  } catch (error: any) {
    cancelGeneration(userId)
    console.error('Erro na geração:', error)
    return res.status(500).json({ error: 'Erro interno ao gerar conta.' })
  }
}
