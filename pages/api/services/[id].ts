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

    const { name, description, icon, isActive } = req.body

    const service = await prisma.service.update({
      where: { id: id as string },
      data: {
        name,
        description,
        icon,
        isActive
      }
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
