import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, recordSuccess, getClientIp } from '@/lib/api-protection'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // 🛡️ PROTEÇÃO CONTRA ABUSO
  const rateCheck = await checkRateLimit(req, 'affiliate_redeem', session.user.id)
  
  if (!rateCheck.allowed) {
    return res.status(429).json({ 
      error: rateCheck.reason,
      retryAfter: rateCheck.retryAfter
    })
  }

  const { code } = req.body

  if (!code || !code.trim()) {
    return res.status(400).json({ error: 'Code is required' })
  }

  try {
    const normalizedCode = code.trim().toUpperCase()
    
    // Validar formato do código
    if (normalizedCode.length < 3 || normalizedCode.length > 20) {
      return res.status(400).json({ error: 'Formato de código inválido' })
    }
    
    // Buscar usuário que possui o código
    const referrer = await prisma.user.findFirst({
      where: { affiliateCode: normalizedCode }
    })

    if (!referrer) {
      // Log tentativa inválida
      try {
        await prisma.securityLog.create({
          data: {
            type: 'login_attempt',
            ip: getClientIp(req),
            username: session.user.id,
            success: false,
            reason: 'Código de afiliado inválido',
            metadata: JSON.stringify({
              action: 'affiliate_redeem',
              codeAttempt: normalizedCode
            })
          }
        })
      } catch (e) {}
      
      return res.status(404).json({ error: 'Código de afiliado inválido' })
    }

    // Verificar se o usuário atual já foi referenciado
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Verificar se usuário está banido
    if (currentUser.isBanned) {
      return res.status(403).json({ error: 'Usuário banido.' })
    }

    if (currentUser.referredBy) {
      return res.status(400).json({ error: 'Você já utilizou um código de afiliado' })
    }

    // VALIDAÇÃO DE SEGURANÇA: Prevenir auto-resgate
    if (currentUser.id === referrer.id) {
      await prisma.securityLog.create({
        data: {
          type: 'bot_detected',
          ip: getClientIp(req),
          username: session.user.id,
          success: false,
          reason: 'Tentativa de auto-resgate de afiliado',
          metadata: JSON.stringify({
            action: 'affiliate_self_redeem',
            code: normalizedCode
          })
        }
      }).catch(() => {})
      
      return res.status(400).json({ error: 'Você não pode usar seu próprio código' })
    }

    // VALIDAÇÃO: Verificar se são do mesmo dispositivo
    if (currentUser.deviceFingerprint && referrer.deviceFingerprint) {
      if (currentUser.deviceFingerprint === referrer.deviceFingerprint) {
        await prisma.securityLog.create({
          data: {
            type: 'bot_detected',
            ip: getClientIp(req),
            username: session.user.id,
            success: false,
            reason: 'Mesmo dispositivo detectado em afiliado',
            metadata: JSON.stringify({
              action: 'affiliate_same_device',
              referrerId: referrer.id
            })
          }
        }).catch(() => {})
        
        return res.status(403).json({ 
          error: 'Não é permitido resgatar código de afiliado do mesmo dispositivo por questões de segurança.' 
        })
      }
    }

    // VALIDAÇÃO: Verificar mesmo IP
    const ip = getClientIp(req)
    if (referrer.lastLoginIp === ip) {
      await prisma.securityLog.create({
        data: {
          type: 'bot_detected',
          ip,
          username: session.user.id,
          success: false,
          reason: 'Mesmo IP detectado em afiliado',
          metadata: JSON.stringify({
            action: 'affiliate_same_ip',
            referrerId: referrer.id
          })
        }
      }).catch(() => {})
      
      return res.status(403).json({ 
        error: 'Não é permitido resgatar código de afiliado do mesmo IP por questões de segurança.' 
      })
    }

    // Verificar se já existe recompensa para este usuário
    const existingReward = await prisma.affiliateReward.findFirst({
      where: { referredUserId: currentUser.id }
    })

    if (existingReward) {
      return res.status(400).json({ error: 'Você já foi referenciado anteriormente' })
    }

    // Verificar se o referrer já referenciou muitos usuários do mesmo IP/device
    const suspiciousReferrals = await prisma.affiliateReward.count({
      where: {
        userId: referrer.id,
        referredUser: {
          OR: [
            { lastLoginIp: ip },
            currentUser.deviceFingerprint ? { deviceFingerprint: currentUser.deviceFingerprint } : {}
          ]
        }
      }
    })

    if (suspiciousReferrals >= 2) {
      await prisma.securityLog.create({
        data: {
          type: 'bot_detected',
          ip,
          username: session.user.id,
          success: false,
          reason: 'Muitos referrals suspeitos',
          metadata: JSON.stringify({
            action: 'affiliate_suspicious_pattern',
            referrerId: referrer.id,
            suspiciousCount: suspiciousReferrals
          })
        }
      }).catch(() => {})
      
      return res.status(403).json({ 
        error: 'Atividade suspeita detectada. Contate o suporte.' 
      })
    }

    // Criar recompensa
    await prisma.affiliateReward.create({
      data: {
        userId: referrer.id,
        referredUserId: currentUser.id,
        rewardedGenerations: 2
      }
    })

    // Atualizar usuário referido
    await prisma.user.update({
      where: { id: currentUser.id },
      data: { referredBy: referrer.id }
    })

    // Adicionar gerações bonus ao referenciador
    await prisma.user.update({
      where: { id: referrer.id },
      data: {
        bonusGenerations: {
          increment: 2
        }
      }
    })

    // Registrar sucesso
    recordSuccess('affiliate_redeem', session.user.id)

    // Log sucesso
    await prisma.securityLog.create({
      data: {
        type: 'login_attempt',
        ip,
        username: session.user.id,
        success: true,
        reason: 'Código de afiliado resgatado',
        metadata: JSON.stringify({
          action: 'affiliate_redeem',
          referrerId: referrer.id
        })
      }
    }).catch(() => {})

    return res.json({ 
      success: true,
      message: 'Código de afiliado resgatado! Você ganhou 2 gerações grátis.',
      rewardedGenerations: 2
    })
  } catch (error: any) {
    console.error('Error redeeming affiliate code:', error)
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    })
  }
}
