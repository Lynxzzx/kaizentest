import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (!session || session.user.role !== 'OWNER') {
    return res.status(403).json({ error: 'Unauthorized' })
  }

  if (req.method === 'GET') {
    try {
      const search =
        typeof req.query.search === 'string'
          ? req.query.search.trim()
          : ''

      const users = await prisma.user.findMany({
        where: search
          ? {
              username: {
                contains: search,
                mode: 'insensitive'
              }
            }
          : undefined,
        include: {
          plan: true,
          _count: {
            select: {
              generatedAccounts: true,
              payments: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      })

      return res.json(users)
    } catch (error: any) {
      console.error('Error fetching users:', error)
      return res.status(500).json({ error: 'Internal server error', details: error.message })
    }
  }

  if (req.method === 'PUT') {
    const { userId, planId, planExpiresAt, isBanned } = req.body

    if (!userId) {
      return res.status(400).json({ error: 'UserId is required' })
    }

    let computedPlanExpiresAt: Date | null | undefined

    try {
      const updateData: any = {}

      // Atualizar plano usando a sintaxe de relação do Prisma
      if (planId !== undefined) {
        if (planId) {
          updateData.plan = {
            connect: { id: planId }
          }

          const shouldAutoComputeExpiration =
            planExpiresAt === undefined || planExpiresAt === null || planExpiresAt === ''

          if (shouldAutoComputeExpiration) {
            const plan = await prisma.plan.findUnique({
              where: { id: planId }
            })

            if (plan) {
              if (plan.duration > 0) {
                const expiresAt = new Date()
                expiresAt.setDate(expiresAt.getDate() + plan.duration)
                computedPlanExpiresAt = expiresAt
              } else {
                computedPlanExpiresAt = null
              }
            }
          }
        } else {
          updateData.plan = {
            disconnect: true
          }
          computedPlanExpiresAt = null
        }
      }

      if (planExpiresAt !== undefined) {
        computedPlanExpiresAt = planExpiresAt ? new Date(planExpiresAt) : null
      }

      if (computedPlanExpiresAt !== undefined) {
        updateData.planExpiresAt = computedPlanExpiresAt
      }

      if (isBanned !== undefined) {
        updateData.isBanned = isBanned
        if (isBanned) {
          updateData.bannedAt = new Date()
          updateData.bannedBy = session.user.id
        } else {
          updateData.bannedAt = null
          updateData.bannedBy = null
        }
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        include: {
          plan: true
        }
      })

      return res.json(updatedUser)
    } catch (error: any) {
      console.error('Error updating user:', error)
      
      // Se o erro for sobre campos desconhecidos, tentar usar $executeRaw
      if (error.message && error.message.includes('Unknown argument')) {
        try {
          // Construir query MongoDB diretamente
          const setData: any = {}
          
          if (planId !== undefined) {
            setData.planId = planId ? { $oid: planId } : null
          }
          
          if (computedPlanExpiresAt !== undefined) {
            setData.planExpiresAt = computedPlanExpiresAt
          }
          
          if (isBanned !== undefined) {
            setData.isBanned = isBanned
            if (isBanned) {
              setData.bannedAt = new Date()
              setData.bannedBy = { $oid: session.user.id }
            } else {
              setData.bannedAt = null
              setData.bannedBy = null
            }
          }

          // Usar updateMany como fallback
          await prisma.user.updateMany({
            where: { id: userId },
            data: setData as any
          })

          // Buscar usuário atualizado
          const updatedUser = await prisma.user.findUnique({
            where: { id: userId },
            include: {
              plan: true
            }
          })

          return res.json(updatedUser)
        } catch (fallbackError: any) {
          console.error('Fallback update also failed:', fallbackError)
          return res.status(500).json({ 
            error: 'Internal server error', 
            details: 'Prisma Client precisa ser regenerado. Execute: npm run db:generate',
            originalError: error.message 
          })
        }
      }
      
      return res.status(500).json({ error: 'Internal server error', details: error.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

