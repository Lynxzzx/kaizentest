import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import { getPremiumTrialConfig } from '@/lib/premium-trial'
import { isUserPlanActive } from '@/lib/plan-utils'
import { filterSitePlansForPublicStore } from '@/lib/plan-filters'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const [config, user] = await Promise.all([
    getPremiumTrialConfig(),
    prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        plan: true,
        premiumTrialRedemptions: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    })
  ])

  if (!user) {
    return res.status(404).json({ error: 'User not found' })
  }

  const trialPlan = config.planId
    ? await prisma.plan.findFirst({
        where: {
          id: config.planId,
          isActive: true
        },
        select: {
          id: true,
          name: true,
          description: true,
          maxGenerations: true,
          generationCooldownSeconds: true,
          type: true
        }
      })
    : null
  const availableTrialPlan = trialPlan && filterSitePlansForPublicStore([trialPlan]).length > 0
    ? trialPlan
    : null

  const hasActivePlan = isUserPlanActive(user.planId, user.planExpiresAt)
  const redemption = user.premiumTrialRedemptions[0] || null
  const canOffer = Boolean(config.enabled && availableTrialPlan && !redemption && !hasActivePlan && !user.isBanned)

  return res.json({
    enabled: config.enabled,
    shouldOffer: canOffer,
    redeemed: Boolean(redemption),
    hasActivePlan,
    config: {
      durationDays: config.durationDays,
      title: config.title,
      description: config.description,
      buttonText: config.buttonText
    },
    plan: availableTrialPlan,
    redemption: redemption
      ? {
          startsAt: redemption.startsAt,
          expiresAt: redemption.expiresAt,
          planName: redemption.planName
        }
      : null
  })
}
