import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

/**
 * API para admin listar todas as solicitações de resgate
 * GET /api/admin/withdrawals
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const session = await getServerSession(req, res, authOptions)
  if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'OWNER')) {
    return res.status(403).json({ error: 'Forbidden - Admin only' })
  }

  try {
    const { status } = req.query

    const where: any = {}
    if (status && typeof status === 'string') {
      where.status = status
    }

    const withdrawals = await prisma.affiliateWithdrawal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            affiliateBalance: true,
            totalAffiliateEarnings: true
          }
        },
        processedBy: {
          select: {
            id: true,
            username: true
          }
        }
      }
    })

    // Estatísticas
    const stats = {
      pending: await prisma.affiliateWithdrawal.count({ where: { status: 'PENDING' } }),
      processing: await prisma.affiliateWithdrawal.count({ where: { status: 'PROCESSING' } }),
      completed: await prisma.affiliateWithdrawal.count({ where: { status: 'COMPLETED' } }),
      rejected: await prisma.affiliateWithdrawal.count({ where: { status: 'REJECTED' } }),
      totalPending: await prisma.affiliateWithdrawal.aggregate({
        where: { status: { in: ['PENDING', 'PROCESSING'] } },
        _sum: { amount: true }
      }),
      totalPaid: await prisma.affiliateWithdrawal.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { amount: true }
      })
    }

    return res.json({ 
      withdrawals,
      stats: {
        ...stats,
        totalPendingAmount: stats.totalPending._sum.amount || 0,
        totalPaidAmount: stats.totalPaid._sum.amount || 0
      }
    })

  } catch (error: any) {
    console.error('Erro ao listar resgates:', error)
    return res.status(500).json({
      error: 'Erro interno',
      details: error.message
    })
  }
}

