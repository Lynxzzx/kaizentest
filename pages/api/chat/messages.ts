import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method === 'GET') {
    try {
      const messages = await prisma.chatMessage.findMany({
        take: 100,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              profilePicture: true,
              role: true,
              bio: true
            }
          }
        }
      })

      return res.json({ messages: messages.reverse() })
    } catch (error: any) {
      console.error('Error fetching messages:', error)
      return res.status(500).json({ error: 'Error fetching messages' })
    }
  }

  if (req.method === 'POST') {
    try {
      const { message } = req.body

      if (!message || message.trim().length === 0) {
        return res.status(400).json({ error: 'Message is required' })
      }

      if (message.length > 1000) {
        return res.status(400).json({ error: 'Message too long (max 1000 characters)' })
      }

      const user = await prisma.user.findUnique({
        where: { id: session.user.id }
      })

      if (!user || user.isBanned) {
        return res.status(403).json({ error: 'User banned or not found' })
      }

      const chatMessage = await prisma.chatMessage.create({
        data: {
          userId: session.user.id,
          message: message.trim()
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              profilePicture: true,
              role: true,
              bio: true
            }
          }
        }
      })

      return res.json({ message: chatMessage })
    } catch (error: any) {
      console.error('Error creating message:', error)
      return res.status(500).json({ error: 'Error creating message' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

