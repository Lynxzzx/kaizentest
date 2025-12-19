import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import { activateUserPlan } from '@/lib/payment-utils'
import { checkRateLimit, recordSuccess, getClientIp } from '@/lib/api-protection'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // 🛡️ PROTEÇÃO CONTRA BRUTE FORCE
  const rateCheck = await checkRateLimit(req, 'key_redeem', session.user.id)
  
  if (!rateCheck.allowed) {
    return res.status(429).json({ 
      error: rateCheck.reason,
      retryAfter: rateCheck.retryAfter
    })
  }

  const { key } = req.body

  if (!key) {
    return res.status(400).json({ error: 'Key is required' })
  }

  // Limpar e normalizar a key
  const normalizedKey = key.trim().toUpperCase()
  
  // Validar formato básico da key para evitar queries desnecessárias
  if (normalizedKey.length < 5 || normalizedKey.length > 50) {
    return res.status(400).json({ error: 'Invalid key format' })
  }

  const keyRecord = await prisma.key.findUnique({
    where: { key: normalizedKey },
    include: { plan: true }
  })

  if (!keyRecord) {
    // Log tentativa inválida
    try {
      await prisma.securityLog.create({
        data: {
          type: 'login_attempt',
          ip: getClientIp(req),
          username: session.user.id,
          success: false,
          reason: 'Key inválida',
          metadata: JSON.stringify({
            action: 'key_redeem',
            keyAttempt: normalizedKey.substring(0, 4) + '****'
          })
        }
      })
    } catch (e) {}
    
    return res.status(404).json({ error: 'Invalid key' })
  }

  if (keyRecord.isUsed) {
    return res.status(400).json({ error: 'Key already used' })
  }

  if (keyRecord.expiresAt && new Date() > keyRecord.expiresAt) {
    return res.status(400).json({ error: 'Key expired' })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id }
  })

  if (!user) {
    return res.status(404).json({ error: 'User not found' })
  }

  // Verificar se usuário está banido
  if (user.isBanned) {
    return res.status(403).json({ error: 'Usuário banido.' })
  }

  // Mark key as used
  await prisma.key.update({
    where: { id: keyRecord.id },
    data: {
      isUsed: true,
      usedAt: new Date(),
      usedBy: session.user.id
    }
  })

  // Create redeemed key record
  await prisma.redeemedKey.create({
    data: {
      keyId: keyRecord.id,
      userId: session.user.id
    }
  })

  // Ativar/renovar plano usando a função utilitária
  const expiresAt = await activateUserPlan(
    session.user.id,
    keyRecord.planId,
    keyRecord.plan.duration
  )

  // Registrar sucesso para reduzir score de suspeita
  recordSuccess('key_redeem', session.user.id)

  // Log sucesso
  try {
    await prisma.securityLog.create({
      data: {
        type: 'login_attempt',
        ip: getClientIp(req),
        username: session.user.id,
        success: true,
        reason: 'Key resgatada com sucesso',
        metadata: JSON.stringify({
          action: 'key_redeem',
          planName: keyRecord.plan.name
        })
      }
    })
  } catch (e) {}

  return res.json({ 
    success: true, 
    plan: keyRecord.plan,
    expiresAt 
  })
}
