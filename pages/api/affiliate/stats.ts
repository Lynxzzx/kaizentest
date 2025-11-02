import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    console.log('Fetching affiliate stats for user:', session.user.id)
    
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        affiliateRewards: {
          include: {
            user: {
              select: {
                username: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        referrals: {
          select: {
            id: true,
            username: true,
            createdAt: true
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const stats = {
      affiliateCode: user.affiliateCode,
      totalReferrals: user.referrals.length,
      totalRewards: user.affiliateRewards.length,
      bonusGenerations: user.bonusGenerations || 0,
      recentReferrals: user.referrals.slice(0, 10),
      recentRewards: user.affiliateRewards.slice(0, 10)
    }

    console.log('Affiliate stats fetched successfully')
    return res.json(stats)
  } catch (error: any) {
    console.error('Error fetching affiliate stats:', error)
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    })
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    })
  }
}
