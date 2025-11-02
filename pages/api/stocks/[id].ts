import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  const { id } = req.query

  if (req.method === 'DELETE') {
    if (!session || session.user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    await prisma.stock.delete({
      where: { id: id as string }
    })

    return res.json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
