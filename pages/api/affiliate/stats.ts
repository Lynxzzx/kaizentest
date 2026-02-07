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
        },
        affiliateCommissions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            payment: {
              select: {
                id: true,
                amount: true,
                finalAmount: true,
                paidAt: true,
                user: {
                  select: {
                    username: true
                  }
                },
                plan: {
                  select: {
                    name: true
                  }
                }
              }
            }
          }
        },
        affiliateWithdrawals: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            amount: true,
            status: true,
            createdAt: true,
            processedAt: true
          }
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
      // Novo sistema de comissões em dinheiro
      affiliateBalance: user.affiliateBalance || 0,
      totalAffiliateEarnings: user.totalAffiliateEarnings || 0,
      commissionRate: (session.user.role === 'CO_OWNER') ? 50 : 40,
      recentReferrals: user.referrals.slice(0, 10),
      recentRewards: user.affiliateRewards.slice(0, 10),
      recentCommissions: user.affiliateCommissions.map(c => ({
        id: c.id,
        amount: c.amount,
        paymentAmount: c.paymentAmount,
        buyerUsername: c.payment.user.username,
        planName: c.payment.plan.name,
        paidAt: c.payment.paidAt,
        createdAt: c.createdAt
      })),
      recentWithdrawals: user.affiliateWithdrawals
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
