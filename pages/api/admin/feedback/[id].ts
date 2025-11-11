import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

// PUT - Aprovar/rejeitar feedback
// DELETE - Deletar feedback
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (!session || session.user.role !== 'OWNER') {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { id } = req.query

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'ID inválido' })
  }

  if (req.method === 'PUT') {
    try {
      const { action } = req.body // 'approve' ou 'reject'

      if (action !== 'approve' && action !== 'reject') {
        return res.status(400).json({ error: 'Ação inválida. Use "approve" ou "reject"' })
      }

      const feedback = await prisma.feedback.findUnique({
        where: { id }
      })

      if (!feedback) {
        return res.status(404).json({ error: 'Feedback não encontrado' })
      }

      if (action === 'approve') {
        const updated = await prisma.feedback.update({
          where: { id },
          data: {
            isApproved: true,
            approvedById: session.user.id,
            approvedAt: new Date()
          },
          include: {
            user: {
              select: {
                id: true,
                username: true
              }
            },
            approvedBy: {
              select: {
                id: true,
                username: true
              }
            }
          }
        })

        return res.status(200).json({
          message: 'Feedback aprovado com sucesso',
          feedback: updated
        })
      } else {
        // Rejeitar (apenas desaprovar)
        const updated = await prisma.feedback.update({
          where: { id },
          data: {
            isApproved: false,
            approvedById: null,
            approvedAt: null
          }
        })

        return res.status(200).json({
          message: 'Feedback rejeitado',
          feedback: updated
        })
      }
    } catch (error: any) {
      console.error('Erro ao atualizar feedback:', error)
      return res.status(500).json({ error: 'Erro ao atualizar feedback' })
    }
  }

  if (req.method === 'DELETE') {
    try {
      const feedback = await prisma.feedback.findUnique({
        where: { id }
      })

      if (!feedback) {
        return res.status(404).json({ error: 'Feedback não encontrado' })
      }

      await prisma.feedback.delete({
        where: { id }
      })

      return res.status(200).json({ message: 'Feedback deletado com sucesso' })
    } catch (error: any) {
      console.error('Erro ao deletar feedback:', error)
      return res.status(500).json({ error: 'Erro ao deletar feedback' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

