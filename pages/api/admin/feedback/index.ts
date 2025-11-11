import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

// GET - Listar todos os feedbacks (admin)
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (!session || session.user.role !== 'OWNER') {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { status } = req.query // 'all', 'approved', 'pending'

    const where: any = {}
    
    if (status === 'approved') {
      where.isApproved = true
    } else if (status === 'pending') {
      where.isApproved = false
    }
    // Se status for 'all' ou não especificado, não adiciona filtro

    const feedbacks = await prisma.feedback.findMany({
      where,
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true
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

    return res.status(200).json(feedbacks)
  } catch (error: any) {
    console.error('Erro ao buscar feedbacks:', error)
    return res.status(500).json({ error: 'Erro ao buscar feedbacks' })
  }
}

