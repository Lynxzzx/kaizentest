import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import { simpleRateLimit, getClientIp } from '@/lib/api-protection'

// GET - Listar feedbacks aprovados (público)
// POST - Criar feedback
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const feedbacks = await prisma.feedback.findMany({
        where: {
          isApproved: true
        },
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          id: true,
          name: true,
          message: true,
          rating: true,
          createdAt: true,
          user: {
            select: {
              username: true,
              profilePicture: true
            }
          }
        },
        take: 50 // Limitar a 50 feedbacks mais recentes
      })

      return res.status(200).json(feedbacks)
    } catch (error: any) {
      console.error('Erro ao buscar feedbacks:', error)
      return res.status(500).json({ error: 'Erro ao buscar feedbacks' })
    }
  }

  if (req.method === 'POST') {
    // 🛡️ RATE LIMITING: Máximo 3 feedbacks por hora por IP
    const rateCheck = await simpleRateLimit(req, 3, 60)
    if (!rateCheck.allowed) {
      return res.status(429).json({ error: rateCheck.error })
    }

    try {
      const { name, message, rating } = req.body

      // Validações
      if (!name || !message) {
        return res.status(400).json({ error: 'Nome e mensagem são obrigatórios' })
      }

      if (name.length < 2 || name.length > 50) {
        return res.status(400).json({ error: 'Nome deve ter entre 2 e 50 caracteres' })
      }

      if (message.length < 10 || message.length > 1000) {
        return res.status(400).json({ error: 'Mensagem deve ter entre 10 e 1000 caracteres' })
      }

      if (rating && (rating < 1 || rating > 5)) {
        return res.status(400).json({ error: 'Avaliação deve ser entre 1 e 5' })
      }

      // 🛡️ Filtrar caracteres suspeitos / XSS básico
      const sanitizedName = name.replace(/<[^>]*>/g, '').trim()
      const sanitizedMessage = message.replace(/<[^>]*>/g, '').trim()

      // Verificar se há sessão (opcional - feedback pode ser anônimo)
      const session = await getServerSession(req, res, authOptions)
      const userId = session?.user?.id || null

      // Se o usuário está logado, usar o username dele como nome padrão
      const feedbackName = session?.user?.username || sanitizedName

      // 🛡️ Verificar se usuário logado já enviou feedback recentemente
      if (userId) {
        const recentFeedback = await prisma.feedback.findFirst({
          where: {
            userId,
            createdAt: {
              gte: new Date(Date.now() - 60 * 60 * 1000) // última hora
            }
          }
        })

        if (recentFeedback) {
          return res.status(429).json({ 
            error: 'Você já enviou um feedback recentemente. Aguarde 1 hora.' 
          })
        }
      }

      const feedback = await prisma.feedback.create({
        data: {
          userId,
          name: feedbackName,
          message: sanitizedMessage,
          rating: rating ? parseInt(rating) : null,
          isApproved: false // Por padrão, precisa ser aprovado
        }
      })

      // Log feedback criado
      try {
        await prisma.securityLog.create({
          data: {
            type: 'register_attempt',
            ip: getClientIp(req),
            username: userId || 'anonymous',
            success: true,
            reason: 'Feedback enviado',
            metadata: JSON.stringify({
              action: 'feedback_create',
              feedbackId: feedback.id
            })
          }
        })
      } catch (e) {}

      return res.status(201).json({
        message: 'Feedback enviado com sucesso! Aguarde aprovação do administrador.',
        feedback
      })
    } catch (error: any) {
      console.error('Erro ao criar feedback:', error)
      return res.status(500).json({ error: 'Erro ao criar feedback' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
