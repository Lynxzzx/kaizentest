import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const session = await getServerSession(req, res, authOptions)

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100) // Máximo 100 por página
    const skip = (page - 1) * limit

    // Buscar contas geradas com paginação otimizada
    // Usar select específico para reduzir dados transferidos
    const [accounts, total] = await Promise.all([
      prisma.generatedAccount.findMany({
        where: {
          userId: session.user.id
        },
        select: {
          id: true,
          createdAt: true,
          stock: {
            select: {
              id: true,
              username: true,
              email: true,
              service: {
                select: {
                  id: true,
                  name: true,
                  icon: true
                }
              }
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.generatedAccount.count({
        where: {
          userId: session.user.id
        }
      })
    ])

    const totalPages = Math.ceil(total / limit)

    return res.json({
      accounts: accounts.map(acc => ({
        id: acc.id,
        username: acc.stock.username,
        email: acc.stock.email,
        service: {
          id: acc.stock.service.id,
          name: acc.stock.service.name,
          icon: acc.stock.service.icon
        },
        createdAt: acc.createdAt
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    })
  } catch (error: any) {
    console.error('Error fetching account history:', error)
    return res.status(500).json({ error: 'Erro ao buscar histórico de contas' })
  }
}

