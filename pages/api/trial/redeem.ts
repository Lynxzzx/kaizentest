import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import { addDays, getPremiumTrialConfig } from '@/lib/premium-trial'
import { isUserPlanActive } from '@/lib/plan-utils'
import { getClientIp, getUserAgent } from '@/lib/security'
import { filterSitePlansForPublicStore } from '@/lib/plan-filters'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      username: true,
      planId: true,
      planExpiresAt: true,
      isBanned: true,
      deviceFingerprint: true,
      registrationIp: true
    }
  })

  if (!user) {
    return res.status(404).json({ error: 'User not found' })
  }

  if (user.isBanned) {
    return res.status(403).json({ error: 'Usuário banido. Trial indisponível.' })
  }

  const config = await getPremiumTrialConfig()
  if (!config.enabled || !config.planId) {
    return res.status(400).json({ error: 'Trial premium não está disponível no momento.' })
  }

  if (isUserPlanActive(user.planId, user.planExpiresAt)) {
    return res.status(409).json({ error: 'Você já possui um plano ativo.' })
  }

  const plan = await prisma.plan.findFirst({
    where: {
      id: config.planId,
      isActive: true
    }
  })

  if (!plan || filterSitePlansForPublicStore([plan]).length === 0) {
    return res.status(400).json({ error: 'Plano do trial não está disponível.' })
  }

  const existingRedemption = await prisma.premiumTrialRedemption.findUnique({
    where: { userId: user.id }
  })

  if (existingRedemption) {
    return res.status(409).json({ error: 'Você já resgatou o trial premium nesta conta.' })
  }

  const ip = getClientIp(req)
  const authorizedIp = ip !== 'unknown'
    ? await prisma.authorizedIp.findUnique({ where: { ip } })
    : null

  const abuseChecks = [
    user.deviceFingerprint ? { deviceFingerprint: user.deviceFingerprint } : null,
    user.registrationIp && !authorizedIp ? { registrationIp: user.registrationIp } : null,
    ip !== 'unknown' && !authorizedIp ? { redeemedIp: ip } : null
  ].filter(Boolean) as Array<{ deviceFingerprint?: string; registrationIp?: string; redeemedIp?: string }>

  if (abuseChecks.length > 0) {
    const previousTrial = await prisma.premiumTrialRedemption.findFirst({
      where: {
        userId: { not: user.id },
        OR: abuseChecks
      },
      select: { id: true }
    })

    if (previousTrial) {
      return res.status(409).json({
        error: 'Este dispositivo ou IP já resgatou um trial premium.'
      })
    }
  }

  const startsAt = new Date()
  const expiresAt = addDays(startsAt, config.durationDays)

  try {
    await prisma.$transaction([
      prisma.premiumTrialRedemption.create({
        data: {
          userId: user.id,
          planId: plan.id,
          planName: plan.name,
          durationDays: config.durationDays,
          startsAt,
          expiresAt,
          deviceFingerprint: user.deviceFingerprint || null,
          registrationIp: user.registrationIp || null,
          redeemedIp: ip,
          userAgent: getUserAgent(req).slice(0, 300)
        }
      }),
      prisma.user.update({
        where: { id: user.id },
        data: {
          planId: plan.id,
          planExpiresAt: expiresAt
        }
      })
    ])
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return res.status(409).json({ error: 'Você já resgatou o trial premium.' })
    }

    console.error('Erro ao resgatar trial premium:', error)
    return res.status(500).json({ error: 'Erro interno ao resgatar trial premium.' })
  }

  return res.json({
    success: true,
    plan: {
      id: plan.id,
      name: plan.name,
      maxGenerations: plan.maxGenerations,
      generationCooldownSeconds: plan.generationCooldownSeconds
    },
    planExpiresAt: expiresAt
  })
}
