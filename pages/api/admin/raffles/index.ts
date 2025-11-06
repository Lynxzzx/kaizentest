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

