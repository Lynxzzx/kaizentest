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
    if (search && typeof search === 'string' && search.trim()) {
      const searchTrimmed = search.trim()
      
      // Verificar se é um ObjectId válido (24 caracteres hex)
      if (/^[0-9a-fA-F]{24}$/.test(searchTrimmed)) {
        where.id = searchTrimmed
      } else {
        // Buscar por username ou email
        where.OR = [
          {
            user: {
              username: {
                contains: searchTrimmed
              }
            }
          },
          {
            user: {
              email: {
                contains: searchTrimmed
              }
            }
          }
        ]
      }
    }

    // Construir where clause final
    const finalWhere = Object.keys(where).length > 0 ? where : undefined

    // Buscar pagamentos SEM incluir user diretamente (evita erro se user for null)
    // Usar select em vez de include para ter mais controle
    const paymentsData = await prisma.payment.findMany({
      where: finalWhere,
      select: {
        id: true,
        userId: true,
        planId: true,
        amount: true,
        finalAmount: true,
        discountValue: true,
        method: true,
        status: true,
        createdAt: true,
        paidAt: true,
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

    // Buscar apenas os userIds únicos e válidos
    const userIds = [...new Set(paymentsData.map(p => p.userId))]
    const validUsers = await prisma.user.findMany({
      where: {
        id: {
          in: userIds
        }
      },
      select: {
        id: true,
        username: true,
        email: true
      }
    })

    // Criar map de usuários para lookup rápido
    const userMap = new Map(validUsers.map(u => [u.id, u]))

    // Combinar dados e filtrar apenas pagamentos com usuários válidos
    const payments = paymentsData
      .filter(payment => userMap.has(payment.userId))
      .map(payment => {
        const user = userMap.get(payment.userId)!
        return {
          id: payment.id,
          userId: payment.userId,
          planId: payment.planId,
          amount: payment.amount,
          finalAmount: payment.finalAmount,
          discountValue: payment.discountValue,
          method: payment.method,
          status: payment.status,
          createdAt: payment.createdAt,
          paidAt: payment.paidAt,
          user: user,
          plan: payment.plan,
          coupon: payment.coupon
        }
      })

    // Calcular estatísticas - buscar todos os pagamentos sem filtros de busca para estatísticas gerais
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Construir where para estatísticas (sem busca de texto)
    const statsWhere: any = {}
    if (startDate || endDate) {
      statsWhere.createdAt = {}
      if (startDate) {
        statsWhere.createdAt.gte = new Date(startDate as string)
      }
      if (endDate) {
        const end = new Date(endDate as string)
        end.setHours(23, 59, 59, 999)
        statsWhere.createdAt.lte = end
      }
    }
    if (status && typeof status === 'string') {
      statsWhere.status = status
    }
    if (method && typeof method === 'string') {
      statsWhere.method = method
    }

    const statsWhereClause = Object.keys(statsWhere).length > 0 ? statsWhere : undefined

    const allPayments = await prisma.payment.findMany({
      where: statsWhereClause,
      select: {
        status: true,
        finalAmount: true,
        amount: true,
        paidAt: true
      }
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
    console.error('Error stack:', error.stack)
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    })
  }
}
