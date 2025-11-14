import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!session || (session.user.role !== 'OWNER' && session.user.role !== 'ADMIN')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    await finalizeExpiredRaffles()

    const raffles = await prisma.raffle.findMany({
      include: {
        prizePlan: {
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            duration: true
          }
        },
        createdBy: {
          select: {
            id: true,
            username: true
          }
        },
        winner: {
          select: {
            id: true,
            username: true,
            email: true
          }
        },
        _count: {
          select: {
            participants: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return res.status(200).json(raffles)
  } catch (error: any) {
    console.error('Error fetching raffles:', error)
    return res.status(500).json({ error: 'Error fetching raffles', details: error.message })
  }
}

async function finalizeExpiredRaffles() {
  const now = new Date()
  const raffles = await prisma.raffle.findMany({
    where: {
      isFinished: false,
      isActive: true,
      endDate: {
        lt: now
      }
    },
    include: {
      participants: {
        include: {
          user: true
        }
      },
      prizePlan: true
    }
  })

  for (const raffle of raffles) {
    if (raffle.participants.length === 0) {
      await prisma.raffle.update({
        where: { id: raffle.id },
        data: {
          isFinished: true,
          isActive: false
        }
      })
      continue
    }

    const randomIndex = Math.floor(Math.random() * raffle.participants.length)
    const winner = raffle.participants[randomIndex].user

    await prisma.raffle.update({
      where: { id: raffle.id },
      data: {
        winnerId: winner.id,
        isFinished: true,
        isActive: false
      }
    })

    if (raffle.prizeType === 'PLAN' && raffle.prizePlanId && raffle.prizePlan) {
      const plan = raffle.prizePlan
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + plan.duration)

      await prisma.user.update({
        where: { id: winner.id },
        data: {
          planId: plan.id,
          planExpiresAt: expiresAt
        }
      })
    } else if (raffle.prizeType === 'GENERATIONS') {
      const generations = parseInt(raffle.prize) || 10
      await prisma.user.update({
        where: { id: winner.id },
        data: {
          bonusGenerations: {
            increment: generations
          }
        }
      })
    }
  }
}

