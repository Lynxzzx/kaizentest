import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { id } = req.query
  const { message } = req.body

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message is required' })
  }

  try {
    // Verificar se o ticket existe e se o usuário tem permissão
    const ticket = await prisma.ticket.findUnique({
      where: { id: id as string }
    })

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' })
    }

    // Verificar permissão
    if (session.user.role !== 'OWNER' && ticket.userId !== session.user.id) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    // Criar resposta
    const reply = await prisma.ticketReply.create({
      data: {
        ticketId: id as string,
        userId: session.user.id,
        message: message.trim(),
        isAdmin: session.user.role === 'OWNER'
      }
    })

    // Atualizar status do ticket se for admin respondendo
    if (session.user.role === 'OWNER' && ticket.status === 'OPEN') {
      await prisma.ticket.update({
        where: { id: id as string },
        data: { status: 'IN_PROGRESS' }
      })
    }

    return res.status(201).json(reply)
  } catch (error: any) {
    console.error('Error creating ticket reply:', error)
    return res.status(500).json({ error: 'Internal server error', details: error.message })
  }
}
