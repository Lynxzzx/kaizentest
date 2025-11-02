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
    return res.status(403).json({ error: 'Only owners and admins can manage broadcasts' })
  }

  const { id } = req.query

  if (req.method === 'PUT') {
    try {
      const { isActive } = req.body

      const broadcast = await prisma.broadcastMessage.update({
        where: { id: id as string },
        data: {
          isActive: isActive !== undefined ? isActive : true
        },
        include: {
          user: {
            select: {
              username: true,
              role: true
            }
          }
        }
      })

      return res.json({ broadcast })
    } catch (error: any) {
      console.error('Error updating broadcast:', error)
      return res.status(500).json({ error: 'Error updating broadcast' })
    }
  }

  if (req.method === 'DELETE') {
    try {
      await prisma.broadcastMessage.delete({
        where: { id: id as string }
      })

      return res.json({ success: true })
    } catch (error: any) {
      console.error('Error deleting broadcast:', error)
      return res.status(500).json({ error: 'Error deleting broadcast' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

