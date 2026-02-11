import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import { getGroqReply } from '@/lib/groq'
import { simpleRateLimit, getClientIp } from '@/lib/api-protection'

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
    // 🛡️ RATE LIMITING: Máximo 5 tickets por hora
    try {
      const rateCheck = await simpleRateLimit(req, 5, 60)
      if (!rateCheck.allowed) {
        return res.status(429).json({ error: rateCheck.error })
      }
    } catch {}

    try {
      // Criar novo ticket
      const { subject, message, priority } = req.body

      if (typeof subject !== 'string' || typeof message !== 'string' || !subject || !message) {
        return res.status(400).json({ error: 'Subject and message are required' })
      }

      // 🛡️ Validar tamanhos
      if (subject.length < 3 || subject.length > 200) {
        return res.status(400).json({ error: 'Assunto deve ter entre 3 e 200 caracteres' })
      }

      if (message.length < 10 || message.length > 5000) {
        return res.status(400).json({ error: 'Mensagem deve ter entre 10 e 5000 caracteres' })
      }

      // 🛡️ Sanitizar inputs
      const sanitizedSubject = subject.replace(/<[^>]*>/g, '').trim()
      const sanitizedMessage = message.replace(/<[^>]*>/g, '').trim()

      // Validar prioridade
      const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
      const ticketPriority = validPriorities.includes(priority) ? priority : 'MEDIUM'

      // 🛡️ Verificar se usuário tem muitos tickets abertos
      const openTicketsCount = await prisma.ticket.count({
        where: {
          userId: session.user.id,
          status: { in: ['OPEN', 'IN_PROGRESS'] }
        }
      })

      if (openTicketsCount >= 5) {
        return res.status(429).json({ 
          error: 'Você tem muitos tickets abertos. Aguarde a resolução antes de abrir novos.' 
        })
      }

      const ticket = await prisma.ticket.create({
        data: {
          userId: session.user.id,
          subject: sanitizedSubject,
          message: sanitizedMessage,
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

      try {
        const aiText = await getGroqReply(buildAiMessages(ticket.subject, ticket.message, []))
        if (aiText) {
          await prisma.ticketReply.create({
            data: {
              ticketId: ticket.id,
              userId: session.user.id,
              message: `🤖 IA: ${aiText}\n\nSe quiser falar com humano, use o botão Atendimento Humano.`,
              isAdmin: true
            }
          })
          await prisma.ticket.update({
            where: { id: ticket.id },
            data: { status: 'IN_PROGRESS' }
          })
        }
      } catch {}

      // Log ticket criado
      try {
        await prisma.securityLog.create({
          data: {
            type: 'register_attempt',
            ip: getClientIp(req),
            username: session.user.id,
            success: true,
            reason: 'Ticket criado',
            metadata: JSON.stringify({
              action: 'ticket_create',
              ticketId: ticket.id
            })
          }
        })
      } catch (e) {}

      return res.status(201).json(ticket)
    } catch (error: any) {
      console.error('Error creating ticket:', error)
      return res.status(500).json({ error: 'Internal server error', details: error.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
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
