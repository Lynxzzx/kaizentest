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

    // Buscar pagamentos recentes
    // Nota: Alguns pagamentos podem ter userId que não existe mais (referências quebradas)
    // Vamos buscar sem o user primeiro, depois buscar os usuários válidos separadamente
    const allRecentPayments = await prisma.payment.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20, // Buscar mais para garantir que temos 5 válidos
      select: {
        id: true,
        amount: true,
        status: true,
        method: true,
        createdAt: true,
        userId: true,
        planId: true,
        plan: {
          select: {
            name: true
          }
        }
      }
    })

    // Buscar apenas os userIds únicos e válidos
    const validUserIds = await prisma.user.findMany({
      where: {
        id: {
          in: allRecentPayments.map(p => p.userId)
        }
      },
      select: {
        id: true,
        username: true
      }
    })

    const userMap = new Map(validUserIds.map(u => [u.id, u]))

    // Filtrar apenas pagamentos com usuários válidos e formatar
    const recentPayments = allRecentPayments
      .filter(payment => userMap.has(payment.userId))
      .slice(0, 5) // Pegar apenas os 5 primeiros válidos
      .map(payment => ({
        id: payment.id,
        amount: payment.amount,
        status: payment.status,
        method: payment.method,
        createdAt: payment.createdAt,
        user: {
          username: userMap.get(payment.userId)!.username
        },
        plan: payment.plan
      }))

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
      recentPayments
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

