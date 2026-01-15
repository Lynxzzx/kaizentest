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
    const { startDate, endDate, status, method, search } = req.query

    // Construir filtros
    const where: any = {}

    // Filtro de data
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) {
        where.createdAt.gte = new Date(startDate as string)
      }
      if (endDate) {
        const end = new Date(endDate as string)
        end.setHours(23, 59, 59, 999)
        where.createdAt.lte = end
      }
    }

    // Filtro de status
    if (status && typeof status === 'string') {
      where.status = status
    }

    // Filtro de método
    if (method && typeof method === 'string') {
      where.method = method
    }

    // Filtro de busca (usuário ou ID)
    if (search && typeof search === 'string') {
      where.OR = [
        {
          user: {
            username: {
              contains: search,
              mode: 'insensitive'
            }
          }
        },
        {
          user: {
            email: {
              contains: search,
              mode: 'insensitive'
            }
          }
        },
        {
          id: {
            contains: search
          }
        }
      ]
    }

    // Buscar pagamentos
    const payments = await prisma.payment.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true
          }
        },
        plan: {
          select: {
            id: true,
            name: true,
            price: true
          }
        },
        coupon: {
          select: {
            code: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 1000 // Limitar a 1000 pagamentos
    })

    // Calcular estatísticas
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const allPayments = await prisma.payment.findMany({
      where: startDate || endDate ? where : undefined
    })

    const stats = {
      total: allPayments.length,
      paid: allPayments.filter(p => p.status === 'PAID').length,
      pending: allPayments.filter(p => p.status === 'PENDING').length,
      totalRevenue: allPayments
        .filter(p => p.status === 'PAID')
        .reduce((sum, p) => sum + (p.finalAmount || p.amount), 0),
      todayRevenue: allPayments
        .filter(p => p.status === 'PAID' && p.paidAt && new Date(p.paidAt) >= today && new Date(p.paidAt) < tomorrow)
        .reduce((sum, p) => sum + (p.finalAmount || p.amount), 0)
    }

    return res.status(200).json({
      payments,
      stats
    })
  } catch (error: any) {
    console.error('Error fetching payments:', error)
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    })
  }
}
