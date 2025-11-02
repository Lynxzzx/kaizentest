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
      // Listar tickets
      if (session.user.role === 'OWNER') {
        // Admin vê todos os tickets
        const tickets = await prisma.ticket.findMany({
          include: {
            user: {
              select: {
                username: true,
                email: true
              }
            },
            replies: {
              orderBy: { createdAt: 'asc' }
            },
            _count: {
              select: { replies: true }
            }
          },
          orderBy: { updatedAt: 'desc' }
        })
        return res.json(tickets)
      } else {
        // Usuário vê apenas seus tickets
        const tickets = await prisma.ticket.findMany({
          where: { userId: session.user.id },
          include: {
            user: {
              select: {
                username: true,
                email: true
              }
            },
            replies: {
              orderBy: { createdAt: 'asc' }
            },
            _count: {
              select: { replies: true }
            }
          },
          orderBy: { updatedAt: 'desc' }
        })
        return res.json(tickets)
      }
    } catch (error: any) {
      console.error('Error fetching tickets:', error)
      return res.status(500).json({ error: 'Internal server error', details: error.message })
    }
  }

  if (req.method === 'POST') {
    try {
      // Criar novo ticket
      const { subject, message, priority } = req.body

      if (!subject || !message) {
        return res.status(400).json({ error: 'Subject and message are required' })
      }

      // Validar prioridade
      const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
      const ticketPriority = validPriorities.includes(priority) ? priority : 'MEDIUM'

      const ticket = await prisma.ticket.create({
        data: {
          userId: session.user.id,
          subject: subject.trim(),
          message: message.trim(),
          priority: ticketPriority as any
        },
        include: {
          user: {
            select: {
              username: true,
              email: true
            }
          }
        }
      })

      return res.status(201).json(ticket)
    } catch (error: any) {
      console.error('Error creating ticket:', error)
      return res.status(500).json({ error: 'Internal server error', details: error.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
