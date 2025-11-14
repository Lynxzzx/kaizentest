import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  const { id } = req.query

  if (req.method === 'GET') {
    const service = await prisma.service.findUnique({
      where: { id: id as string },
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
    return res.json(service)
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
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
      : null

    const service = await prisma.$transaction(async (tx) => {
      const updated = await tx.service.update({
        where: { id: id as string },
        data: {
          name,
          description,
          icon,
          isActive
        }
      })

      if (sanitizedPlanIds !== null) {
        await tx.servicePlanAccess.deleteMany({ where: { serviceId: updated.id } })

        if (sanitizedPlanIds.length > 0) {
          await tx.servicePlanAccess.createMany({
            data: sanitizedPlanIds.map((planId) => ({
              serviceId: updated.id,
              planId
            }))
          })
        }
      }

      return tx.service.findUnique({
        where: { id: updated.id },
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

  if (req.method === 'DELETE') {
    if (!session || session.user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    await prisma.service.delete({
      where: { id: id as string }
    })

    return res.json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
