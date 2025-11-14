import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (req.method === 'GET') {
    // Se for OWNER, retornar todos os serviços (ativos e inativos)
    // Se não for OWNER, retornar apenas os ativos
    const isOwner = session && session.user.role === 'OWNER'
    
    const services = await prisma.service.findMany({
      where: isOwner ? {} : { isActive: true },
      include: {
        allowedPlans: {
          include: {
            plan: {
              select: {
                id: true,
                name: true,
                price: true,
                isActive: true
              }
            }
          }
        },
        _count: {
          select: {
            stocks: {
              where: { isUsed: false }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    return res.json(services)
  }

  if (req.method === 'POST') {
    if (!session || session.user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    const { name, description, icon, isActive, allowedPlanIds } = req.body

    if (!name) {
      return res.status(400).json({ error: 'Name is required' })
    }

    const sanitizedPlanIds = Array.isArray(allowedPlanIds)
      ? Array.from(
          new Set(
            allowedPlanIds.filter((planId: unknown) => typeof planId === 'string' && planId.trim().length > 0)
          )
        )
      : []

    const service = await prisma.$transaction(async (tx) => {
      const created = await tx.service.create({
        data: {
          name,
          description,
          icon,
          isActive: typeof isActive === 'boolean' ? isActive : true
        }
      })

      if (sanitizedPlanIds.length > 0) {
        await tx.servicePlanAccess.createMany({
          data: sanitizedPlanIds.map((planId) => ({
            serviceId: created.id,
            planId
          }))
        })
      }

      return tx.service.findUnique({
        where: { id: created.id },
        include: {
          allowedPlans: {
            include: {
              plan: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                  isActive: true
                }
              }
            }
          },
          _count: {
            select: {
              stocks: {
                where: { isUsed: false }
              }
            }
          }
        }
      })
    })

    return res.json(service)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
