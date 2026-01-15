import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { id } = req.query

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Payment ID is required' })
  }

  try {
    // Buscar pagamento - usuário só pode ver seus próprios pagamentos (a menos que seja owner)
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        plan: {
          select: {
            name: true
          }
        },
        user: {
          select: {
            username: true
          }
        }
      }
    })

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' })
    }

    // Verificar se o usuário tem permissão para ver este pagamento
    if (session.user.role !== 'OWNER' && payment.userId !== session.user.id) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    return res.status(200).json({
      id: payment.id,
      status: payment.status,
      method: payment.method,
      amount: payment.amount,
      finalAmount: payment.finalAmount || payment.amount,
      createdAt: payment.createdAt,
      paidAt: payment.paidAt,
      plan: payment.plan,
      user: payment.user
    })
  } catch (error: any) {
    console.error('Error fetching payment status:', error)
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    })
  }
}
