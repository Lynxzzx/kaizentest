import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (req.method === 'GET') {
    const services = await prisma.service.findMany({
      where: { isActive: true },
      include: {
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

    const { name, description, icon } = req.body

    if (!name) {
      return res.status(400).json({ error: 'Name is required' })
    }

    const service = await prisma.service.create({
      data: {
        name,
        description,
        icon
      }
    })

    return res.json(service)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
