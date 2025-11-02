import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true }
  })

  if (!user || (user.role !== 'OWNER' && user.role !== 'ADMIN')) {
    return res.status(403).json({ error: 'Only owners and admins can view all broadcasts' })
  }

  if (req.method === 'GET') {
    try {
      // Listar TODOS os broadcasts para admin (não apenas ativos)
      const broadcasts = await prisma.broadcastMessage.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              role: true
            }
          }
        }
      })

      return res.json({ broadcasts })
    } catch (error: any) {
      console.error('Error fetching broadcasts:', error)
      return res.status(500).json({ error: 'Error fetching broadcasts' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

