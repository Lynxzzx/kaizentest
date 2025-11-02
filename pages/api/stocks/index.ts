import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (req.method === 'GET') {
    if (!session || session.user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    const { serviceId } = req.query

    const stocks = await prisma.stock.findMany({
      where: serviceId ? { serviceId: serviceId as string } : {},
      include: {
        service: true
      },
      orderBy: { createdAt: 'desc' }
    })

    return res.json(stocks)
  }

  if (req.method === 'POST') {
    if (!session || session.user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    const { serviceId, username, password, email, extraData } = req.body

    if (!serviceId || !username || !password) {
      return res.status(400).json({ error: 'ServiceId, username and password are required' })
    }

    const stock = await prisma.stock.create({
      data: {
        serviceId,
        username,
        password,
        email,
        extraData: extraData ? JSON.stringify(extraData) : null
      }
    })

    return res.json(stock)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
