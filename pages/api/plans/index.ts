import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (req.method === 'GET') {
    const plans = await prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' }
    })
    return res.json(plans)
  }

  if (req.method === 'POST') {
    if (!session || session.user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    const { name, description, price, duration, maxGenerations } = req.body

    if (!name || !price || !duration) {
      return res.status(400).json({ error: 'Name, price and duration are required' })
    }

    const plan = await prisma.plan.create({
      data: {
        name,
        description,
        price: parseFloat(price),
        duration: parseInt(duration),
        maxGenerations: maxGenerations ? parseInt(maxGenerations) : 0
      }
    })

    return res.json(plan)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
