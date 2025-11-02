import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  const { id } = req.query

  if (req.method === 'PUT' || req.method === 'PATCH') {
    if (!session || session.user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    const { name, description, price, duration, maxGenerations, isActive } = req.body

    const plan = await prisma.plan.update({
      where: { id: id as string },
      data: {
        name,
        description,
        price: price ? parseFloat(price) : undefined,
        duration: duration ? parseInt(duration) : undefined,
        maxGenerations: maxGenerations !== undefined ? parseInt(maxGenerations) : undefined,
        isActive
      }
    })

    return res.json(plan)
  }

  if (req.method === 'DELETE') {
    if (!session || session.user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    await prisma.plan.update({
      where: { id: id as string },
      data: { isActive: false }
    })

    return res.json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
