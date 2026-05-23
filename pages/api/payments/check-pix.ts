import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import { checkMisticPayTransaction, isMisticPayPaid, isMisticPayTransactionId } from '@/lib/misticpay'
import { settlePaymentAsPaid } from '@/lib/payment-utils'

/**
 * Verifica status de pagamento PIX (MisticPay) e ativa plano automaticamente se pago
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const { paymentId } = req.body

    if (!paymentId) {
      return res.status(400).json({ error: 'Payment ID is required' })
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        user: true,
        plan: true
      }
    })

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' })
    }

    if (payment.userId !== session.user.id) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    if (payment.status === 'PAID') {
      return res.json({
        success: true,
        status: 'PAID',
        message: 'Payment already confirmed',
        payment
      })
    }

    if (payment.method !== 'PIX' || !payment.asaasId || !isMisticPayTransactionId(payment.asaasId)) {
      return res.json({
        success: true,
        status: payment.status,
        message: 'Payment status checked',
        payment
      })
    }

    try {
      const remote = await checkMisticPayTransaction(payment.asaasId)
      const isPaid = isMisticPayPaid(remote.transactionState)

      if (isPaid) {
        await settlePaymentAsPaid(payment, {
          paidAt: remote.paidAt,
          pagSeguroReferenceId: payment.pagSeguroReferenceId ?? undefined
        })

        return res.json({
          success: true,
          status: 'PAID',
          message: 'Payment confirmed and plan activated',
          payment: {
            ...payment,
            status: 'PAID',
            paidAt: remote.paidAt
          }
        })
      }

      return res.json({
        success: true,
        status: 'PENDING',
        message: 'Payment not yet confirmed',
        providerStatus: remote.transactionState
      })
    } catch (error: any) {
      console.error('❌ [check-pix] Erro MisticPay:', error.message)
      return res.json({
        success: true,
        status: 'PENDING',
        message: 'Aguardando confirmação do pagamento',
        warning: error.message
      })
    }
  } catch (error: any) {
    console.error('❌ Erro ao verificar pagamento PIX:', error)
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    })
  }
}
