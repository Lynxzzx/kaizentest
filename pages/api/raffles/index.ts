import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { active } = req.query

    const where: any = {}
    if (active === 'true') {
      where.isActive = true
      where.isFinished = false
      where.endDate = {
        gte: new Date() // Ainda não expirou
      }
    }

    const raffles = await prisma.raffle.findMany({
      where,
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
            username: true
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

