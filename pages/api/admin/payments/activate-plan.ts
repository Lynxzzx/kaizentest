import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import { activateUserPlan } from '@/lib/payment-utils'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!session || session.user.role !== 'OWNER') {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { paymentId } = req.body

  if (!paymentId || typeof paymentId !== 'string') {
    return res.status(400).json({ error: 'Payment ID is required' })
  }

  try {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        plan: {
          select: {
            duration: true,
            name: true
          }
        }
      }
    })

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' })
    }

    if (payment.status !== 'PAID') {
      return res.status(400).json({ error: 'Payment is not marked as paid' })
    }

    const planDuration =
      payment.plan?.duration ??
      (
        await prisma.plan.findUnique({
          where: { id: payment.planId },
          select: { duration: true }
        })
      )?.duration ??
      30

    await activateUserPlan(payment.userId, payment.planId, planDuration)

    return res.json({
      success: true,
      message: 'Plano ativado com sucesso!'
    })
  } catch (error) {
    console.error('Error activating plan manually:', error)
    return res.status(500).json({ error: 'Erro ao ativar plano automaticamente' })
  }
}

