import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import { checkPaymentStatus } from '@/lib/binance'
import { settlePaymentAsPaid } from '@/lib/payment-utils'

/**
 * API para verificar manualmente o status de um pagamento Bitcoin
 * Pode ser chamada periodicamente pelo frontend ou por um cron job
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const session = await getServerSession(req, res, authOptions)

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { paymentId } = req.body

  if (!paymentId) {
    return res.status(400).json({ error: 'Payment ID is required' })
  }

  try {
    // Buscar pagamento
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

    // Verificar se o pagamento pertence ao usuário
    if (payment.userId !== session.user.id) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    // Verificar se é um pagamento Bitcoin
    if (payment.method !== 'BITCOIN') {
      return res.status(400).json({ error: 'This endpoint is only for Bitcoin payments' })
    }

    // Verificar se já foi confirmado
    if (payment.status === 'PAID') {
      return res.json({
        success: true,
        status: 'PAID',
        message: 'Payment already confirmed',
        payment
      })
    }

    // Verificar status na blockchain (ou Binance Pay)
    if (!payment.bitcoinAddress) {
      return res.status(400).json({ error: 'Bitcoin address not found' })
    }

    const status = await checkPaymentStatus(payment.bitcoinAddress, 'BTC')

    if (status.received && status.amount && status.amount >= payment.amount * 0.95) {
      // Pagamento confirmado (aceita 95% do valor devido a taxas)
      
      console.log('✅ [check-btc] Pagamento Bitcoin confirmado! Ativando plano...')
      console.log('📊 [check-btc] Dados:', {
        paymentId: payment.id,
        userId: payment.userId,
        planId: payment.planId,
        planName: payment.plan.name,
        planDuration: payment.plan.duration,
        amountReceived: status.amount,
        amountExpected: payment.amount
      })
      
      // Usar função unificada para garantir consistência
      const expiresAt = await settlePaymentAsPaid(payment, {
        paidAt: new Date()
      })

      console.log('✅ [check-btc] Pagamento Bitcoin confirmado e plano ativado:', payment.id)
      console.log('✅ [check-btc] Plano expira em:', expiresAt?.toISOString() || 'VITALÍCIO')

      return res.json({
        success: true,
        status: 'PAID',
        message: 'Payment confirmed and plan activated',
        planExpiresAt: expiresAt?.toISOString() || null,
        payment: {
          ...payment,
          status: 'PAID',
          paidAt: new Date()
        }
      })
    }

    // Pagamento ainda pendente
    return res.json({
      success: true,
      status: 'PENDING',
      message: 'Payment not yet confirmed',
      blockchainStatus: status
    })

  } catch (error: any) {
    console.error('❌ Erro ao verificar pagamento Bitcoin:', error)
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    })
  }
}

