import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import {
  DEFAULT_PREMIUM_TRIAL_CONFIG,
  PREMIUM_TRIAL_CONFIG_KEY,
  normalizePremiumTrialConfig,
  parsePremiumTrialConfig
} from '@/lib/premium-trial'
import { logAdminAction, getIpFromRequest } from '@/lib/admin-log'

async function requireOwner(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id || session.user.role !== 'OWNER') {
    return null
  }
  return session
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireOwner(req, res)
  if (!session) {
    return res.status(403).json({ error: 'Unauthorized' })
  }

  if (req.method === 'GET') {
    const [configRow, plans, totalRedemptions] = await Promise.all([
      prisma.systemConfig.findUnique({ where: { key: PREMIUM_TRIAL_CONFIG_KEY } }),
      prisma.plan.findMany({
        where: {
          isActive: true,
          type: 'SITE'
        },
        orderBy: { price: 'asc' },
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          duration: true,
          maxGenerations: true,
          generationCooldownSeconds: true
        }
      }),
      prisma.premiumTrialRedemption.count()
    ])

    return res.json({
      config: parsePremiumTrialConfig(configRow?.value),
      plans,
      totalRedemptions
    })
  }

  if (req.method === 'POST') {
    const config = normalizePremiumTrialConfig({
      ...DEFAULT_PREMIUM_TRIAL_CONFIG,
      ...req.body
    })

    if (config.enabled) {
      if (!config.planId) {
        return res.status(400).json({ error: 'Selecione um plano para ativar o trial.' })
      }

      const plan = await prisma.plan.findFirst({
        where: {
          id: config.planId,
          isActive: true,
          type: 'SITE'
        },
        select: { id: true }
      })

      if (!plan) {
        return res.status(400).json({ error: 'Plano do trial inválido ou inativo.' })
      }
    }

    await prisma.systemConfig.upsert({
      where: { key: PREMIUM_TRIAL_CONFIG_KEY },
      update: {
        value: JSON.stringify(config),
        description: 'Configuração do trial premium para novos usuários',
        updatedById: session.user.id
      },
      create: {
        key: PREMIUM_TRIAL_CONFIG_KEY,
        value: JSON.stringify(config),
        description: 'Configuração do trial premium para novos usuários',
        updatedById: session.user.id
      }
    })

    await logAdminAction({
      userId: session.user.id,
      action: 'CONFIG_UPDATE',
      targetType: 'SystemConfig',
      targetId: PREMIUM_TRIAL_CONFIG_KEY,
      targetName: PREMIUM_TRIAL_CONFIG_KEY,
      details: config,
      ipAddress: getIpFromRequest(req)
    }).catch(() => {})

    return res.json({ success: true, config })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
