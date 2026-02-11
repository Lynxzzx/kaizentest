import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import { getGroqReply } from '@/lib/groq'

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

    if (session.user.role !== 'OWNER' && ticket.status !== 'CLOSED' && ticket.status !== 'RESOLVED') {
      try {
        const ticketWithReplies = await prisma.ticket.findUnique({
          where: { id: id as string },
          include: {
            replies: { orderBy: { createdAt: 'asc' } }
          }
        })
        if (ticketWithReplies) {
          const replies = ticketWithReplies.replies.map(r => ({ message: r.message, isAdmin: r.isAdmin }))
          const aiText = await getGroqReply(buildAiMessages(ticketWithReplies.subject, ticketWithReplies.message, replies))
          if (aiText) {
            await prisma.ticketReply.create({
              data: {
                ticketId: id as string,
                userId: session.user.id,
                message: `🤖 IA: ${aiText}\n\nSe quiser falar com humano, use o botão Atendimento Humano.`,
                isAdmin: true
              }
            })
            if (ticket.status === 'OPEN') {
              await prisma.ticket.update({
                where: { id: id as string },
                data: { status: 'IN_PROGRESS' }
              })
            }
          }
        }
      } catch {}
    }

    return res.status(201).json(reply)
  } catch (error: any) {
    console.error('Error creating ticket reply:', error)
    return res.status(500).json({ error: 'Internal server error', details: error.message })
  }
}

function buildAiMessages(subject: string, message: string, replies: Array<{ message: string; isAdmin: boolean }>) {
  const context = [
    `Assunto: ${subject}`,
    `Mensagem inicial: ${message}`,
    ...replies.map(r => `${r.isAdmin ? 'Admin' : 'Usuário'}: ${r.message}`)
  ].join('\n')
  return [
    {
      role: 'system' as const,
      content: 'Você é um assistente de suporte. Responda de forma clara, objetiva e amigável. Se faltar informação, peça detalhes específicos.'
    },
    {
      role: 'user' as const,
      content: context
    }
  ]
}
