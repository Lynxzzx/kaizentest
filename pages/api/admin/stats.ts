import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!session || session.user.role !== 'OWNER') {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const [
      totalUsers,
      totalServices,
      totalPlans,
      totalStocks,
      availableStocks,
      usedStocks,
      totalPayments,
      paidPayments,
      totalRevenue,
      totalKeys,
      usedKeys,
      totalAccounts
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'USER' } }),
      prisma.service.count(),
      prisma.plan.count(),
      prisma.stock.count(),
      prisma.stock.count({ where: { isUsed: false } }),
      prisma.stock.count({ where: { isUsed: true } }),
      prisma.payment.count(),
      prisma.payment.count({ where: { status: 'PAID' } }),
      prisma.payment.aggregate({
        where: { status: 'PAID' },
        _sum: { amount: true }
      }),
      prisma.key.count(),
      prisma.key.count({ where: { isUsed: true } }),
      prisma.generatedAccount.count()
    ])

    const recentUsers = await prisma.user.findMany({
      where: { role: 'USER' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true,
        plan: {
          select: {
            name: true
          }
        }
      }
    })

    // Buscar pagamentos apenas com usuários válidos (evitar referências quebradas)
    const recentPayments = await prisma.payment.findMany({
      where: {
        user: {
          isNot: null // Apenas pagamentos com usuários válidos
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        amount: true,
        status: true,
        method: true,
        createdAt: true,
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
    })

    return res.json({
      overview: {
        totalUsers,
        totalServices,
        totalPlans,
        totalStocks,
        availableStocks,
        usedStocks,
        totalPayments,
        paidPayments,
        totalRevenue: totalRevenue._sum.amount || 0,
        totalKeys,
        usedKeys,
        totalAccounts
      },
      recentUsers,
      recentPayments: formattedPayments
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

