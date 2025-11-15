import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (!session || session.user.role !== 'OWNER') {
    return res.status(403).json({ error: 'Unauthorized' })
  }

  if (req.method === 'GET') {
    try {
      const search =
        typeof req.query.search === 'string'
          ? req.query.search.trim()
          : ''

      const users = await prisma.user.findMany({
        where: search
          ? {
              username: {
                contains: search,
                mode: 'insensitive'
              }
            }
          : undefined,
        include: {
          plan: true,
          _count: {
            select: {
              generatedAccounts: true,
              payments: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      })

      return res.json(users)
    } catch (error: any) {
      console.error('Error fetching users:', error)
      return res.status(500).json({ error: 'Internal server error', details: error.message })
    }
  }

  if (req.method === 'PUT') {
    const { userId, planId, planExpiresAt, isBanned, newPassword } = req.body

    if (!userId) {
      return res.status(400).json({ error: 'UserId is required' })
    }

    let computedPlanExpiresAt: Date | null | undefined

    try {
      const updateData: any = {}

      if (planId !== undefined) {
        updateData.planId = planId || null

        const shouldAutoComputeExpiration =
          planExpiresAt === undefined || planExpiresAt === null || planExpiresAt === ''

        if (shouldAutoComputeExpiration && planId) {
          const plan = await prisma.plan.findUnique({
            where: { id: planId }
          })

          if (plan) {
            if (plan.duration > 0) {
              const expiresAt = new Date()
              expiresAt.setDate(expiresAt.getDate() + plan.duration)
              computedPlanExpiresAt = expiresAt
            } else {
              computedPlanExpiresAt = null
            }
          }
        }

        if (!planId) {
          computedPlanExpiresAt = null
        }
      }

      if (planExpiresAt !== undefined) {
        computedPlanExpiresAt = planExpiresAt ? new Date(planExpiresAt) : null
      }

      if (computedPlanExpiresAt !== undefined) {
        updateData.planExpiresAt = computedPlanExpiresAt
      }

      if (typeof newPassword === 'string' && newPassword.trim().length > 0) {
        if (newPassword.length < 6) {
          return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres' })
        }
        updateData.password = await hashPassword(newPassword.trim())
        updateData.passwordResetToken = null
        updateData.passwordResetExpires = null
      }

      if (isBanned !== undefined) {
        updateData.isBanned = isBanned
        if (isBanned) {
          updateData.bannedAt = new Date()
          updateData.bannedBy = session.user.id
        } else {
          updateData.bannedAt = null
          updateData.bannedBy = null
        }
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        include: {
          plan: true
        }
      })

      return res.json(updatedUser)
    } catch (error: any) {
      console.error('Error updating user:', error)
      return res.status(500).json({ error: 'Internal server error', details: error.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

