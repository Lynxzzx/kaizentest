import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // Apenas OWNER pode ver os logs
  if (session.user.role !== 'OWNER') {
    return res.status(403).json({ error: 'Apenas o Owner pode acessar os logs administrativos' })
  }

  if (req.method === 'GET') {
    try {
      const { 
        page = '1', 
        limit = '50',
        action,
        userId,
        targetType,
        startDate,
        endDate
      } = req.query

      const pageNum = parseInt(page as string)
      const limitNum = parseInt(limit as string)
      const skip = (pageNum - 1) * limitNum

      // Construir filtros
      const where: any = {}
      
      if (action) {
        where.action = action
      }
      
      if (userId) {
        where.userId = userId
      }
      
      if (targetType) {
        where.targetType = targetType
      }
      
      if (startDate || endDate) {
        where.createdAt = {}
        if (startDate) {
          where.createdAt.gte = new Date(startDate as string)
        }
        if (endDate) {
          where.createdAt.lte = new Date(endDate as string)
        }
      }

      const [logs, total] = await Promise.all([
        prisma.adminLog.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                username: true,
                role: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          skip,
          take: limitNum
        }),
        prisma.adminLog.count({ where })
      ])

      // Buscar lista de admins para filtro
      const admins = await prisma.user.findMany({
        where: {
          role: {
            in: ['OWNER', 'CO_OWNER', 'ADMIN', 'MODERATOR']
          }
        },
        select: {
          id: true,
          username: true,
          role: true
        },
        orderBy: {
          username: 'asc'
        }
      })

      return res.status(200).json({
        logs,
        admins,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      })
    } catch (error: any) {
      console.error('Erro ao buscar logs:', error)
      return res.status(500).json({ error: 'Erro ao buscar logs', details: error.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

