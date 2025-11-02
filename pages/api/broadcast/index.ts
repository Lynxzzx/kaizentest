import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    // GET não requer autenticação - broadcasts são públicos
    try {
      console.log('📢 Buscando broadcasts ativos...')
      
      const broadcasts = await prisma.broadcastMessage.findMany({
        where: {
          isActive: true,
          OR: [
            { expiresAt: null },
            { expiresAt: { gte: new Date() } }
          ]
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
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

      console.log('📢 Broadcasts encontrados:', broadcasts.length)
      console.log('📢 Broadcasts:', broadcasts.map(b => ({ id: b.id, title: b.title, isActive: b.isActive })))

      return res.json({ broadcasts })
    } catch (error: any) {
      console.error('❌ Error fetching broadcasts:', error)
      console.error('❌ Error stack:', error.stack)
      return res.status(500).json({ error: 'Error fetching broadcasts', details: error.message })
    }
  }

  const session = await getServerSession(req, res, authOptions)

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method === 'POST') {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    if (!user || (user.role !== 'OWNER' && user.role !== 'ADMIN')) {
      return res.status(403).json({ error: 'Only owners and admins can create broadcasts' })
    }

    try {
      const { title, message, expiresAt } = req.body

      if (!message || message.trim().length === 0) {
        return res.status(400).json({ error: 'Message is required' })
      }

      const broadcast = await prisma.broadcastMessage.create({
        data: {
          userId: session.user.id,
          title: title || null,
          message: message.trim(),
          expiresAt: expiresAt ? new Date(expiresAt) : null
        },
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

      return res.json({ broadcast })
    } catch (error: any) {
      console.error('Error creating broadcast:', error)
      return res.status(500).json({ error: 'Error creating broadcast' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

