import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { id } = req.query

  if (req.method === 'GET') {
    try {
      // Obter ticket específico
      const ticket = await prisma.ticket.findUnique({
        where: { id: id as string },
        include: {
          user: {
            select: {
              username: true,
              email: true
            }
          },
          replies: {
            orderBy: { createdAt: 'asc' }
          }
        }
      })

      if (!ticket) {
        return res.status(404).json({ error: 'Ticket not found' })
      }

      // Verificar permissão
      if (session.user.role !== 'OWNER' && ticket.userId !== session.user.id) {
        return res.status(403).json({ error: 'Forbidden' })
      }

      return res.json(ticket)
    } catch (error: any) {
      console.error('Error fetching ticket:', error)
      return res.status(500).json({ error: 'Internal server error', details: error.message })
    }
  }

  if (req.method === 'PUT') {
    try {
      // Atualizar ticket (admin pode mudar status e prioridade, usuário pode marcar como resolvido/fechado)
      const { status, priority } = req.body

      const ticket = await prisma.ticket.findUnique({
        where: { id: id as string }
      })

      if (!ticket) {
        return res.status(404).json({ error: 'Ticket not found' })
      }

      // Verificar permissão
      const isOwner = session.user.role === 'OWNER' || session.user.role === 'ADMIN' || session.user.role === 'MODERATOR'
      const isTicketOwner = ticket.userId === session.user.id

      if (!isOwner && !isTicketOwner) {
        return res.status(403).json({ error: 'Forbidden' })
      }

      // Validar status e prioridade
      const validStatuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']
      const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']

      const updateData: any = {}
      
      // Usuários podem apenas marcar como RESOLVED ou CLOSED
      if (status && validStatuses.includes(status)) {
        if (!isOwner && (status === 'OPEN' || status === 'IN_PROGRESS')) {
          return res.status(403).json({ error: 'Only admins can set status to OPEN or IN_PROGRESS' })
        }
        updateData.status = status
      }
      
      // Apenas admins podem mudar prioridade
      if (priority && validPriorities.includes(priority)) {
        if (!isOwner) {
          return res.status(403).json({ error: 'Only admins can change priority' })
        }
        updateData.priority = priority
      }

      const updated = await prisma.ticket.update({
        where: { id: id as string },
        data: updateData,
        include: {
          user: {
            select: {
              username: true,
              email: true,
              profilePicture: true,
              role: true
            }
          },
          replies: {
            orderBy: { createdAt: 'asc' },
            include: {
              user: {
                select: {
                  username: true,
                  profilePicture: true,
                  role: true
                }
              }
            }
          }
        }
      })

      return res.json(updated)
    } catch (error: any) {
      console.error('Error updating ticket:', error)
      return res.status(500).json({ error: 'Internal server error', details: error.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
