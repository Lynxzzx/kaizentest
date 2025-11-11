import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

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

      // Verificar se há sessão (opcional - feedback pode ser anônimo)
      const session = await getServerSession(req, res, authOptions)
      const userId = session?.user?.id || null

      // Se o usuário está logado, usar o username dele como nome padrão
      const feedbackName = session?.user?.username || name

      const feedback = await prisma.feedback.create({
        data: {
          userId,
          name: feedbackName,
          message,
          rating: rating ? parseInt(rating) : null,
          isApproved: false // Por padrão, precisa ser aprovado
        }
      })

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

