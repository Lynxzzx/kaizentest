import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import { checkMisticPayTransaction, isMisticPayPaid, isMisticPayTransactionId } from '@/lib/misticpay'
import { checkPaymentStatus } from '@/lib/binance'
import { settlePaymentAsPaid } from '@/lib/payment-utils'

/**
 * API para verificar o status de um pagamento pendente
 * Pode ser chamada pelo próprio usuário (dono do pagamento) ou admin
 * 
 * GET /api/payments/check-status?paymentId=xxx
 * 
 * Isso substitui a necessidade de cron jobs no Vercel
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const session = await getServerSession(req, res, authOptions)
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { paymentId } = req.query

  if (!paymentId || typeof paymentId !== 'string') {
    return res.status(400).json({ error: 'paymentId é obrigatório' })
  }

  try {
    // Buscar o pagamento
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        user: true,
        plan: true
      }
    })

    if (!payment) {
      return res.status(404).json({ error: 'Pagamento não encontrado' })
    }

    // Verificar permissão: apenas o dono do pagamento ou admin pode verificar
    const isOwner = payment.userId === session.user.id
    const isAdmin = session.user.role === 'ADMIN' || session.user.role === 'OWNER'
    
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Sem permissão para verificar este pagamento' })
    }

    // Se já estiver pago, retornar status
    if (payment.status === 'PAID') {
      return res.json({
        success: true,
        status: 'PAID',
        message: 'Pagamento já foi confirmado',
        paidAt: payment.paidAt
      })
    }

    // Se estiver expirado ou cancelado
    if (payment.status === 'EXPIRED' || payment.status === 'CANCELLED') {
      return res.json({
        success: true,
        status: payment.status,
        message: payment.status === 'EXPIRED' ? 'Pagamento expirado' : 'Pagamento cancelado'
      })
    }

    // ========================================
    // VERIFICAR PAGAMENTOS PIX (MisticPay)
    // ========================================
    if (payment.method === 'PIX' && payment.asaasId && isMisticPayTransactionId(payment.asaasId)) {
      try {
        console.log(`🔍 [check-status] Verificando PIX MisticPay ${payment.id}...`)

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
            message: 'Pagamento confirmado! Plano ativado.',
            paidAt: remote.paidAt.toISOString(),
            planActivated: true
          })
        }

        return res.json({
          success: true,
          status: 'PENDING',
          message: 'Aguardando confirmação do pagamento',
          providerStatus: remote.transactionState
        })
      } catch (error: any) {
        console.error(`❌ [check-status] Erro ao verificar PIX:`, error.message)
        return res.json({
          success: true,
          status: 'PENDING',
          message: 'Aguardando confirmação do pagamento',
          note: 'Não foi possível consultar o status. Tente novamente em alguns segundos.'
        })
      }
    }

    // ========================================
    // VERIFICAR PAGAMENTOS BITCOIN
    // ========================================
    if (payment.method === 'BITCOIN' && payment.bitcoinAddress) {
      try {
        console.log(`🔍 [check-status] Verificando Bitcoin ${payment.id}...`)
        
        const status = await checkPaymentStatus(payment.bitcoinAddress, 'BTC')
        
        const isPaid = status.received && status.amount && status.amount >= payment.amount * 0.95

        if (isPaid) {
          console.log(`✅ [check-status] Bitcoin ${payment.id} está PAGO! Ativando...`)
          
          await settlePaymentAsPaid(payment, {
            paidAt: new Date()
          })

          return res.json({
            success: true,
            status: 'PAID',
            message: 'Pagamento confirmado! Plano ativado.',
            paidAt: new Date().toISOString(),
            planActivated: true,
            amountReceived: status.amount
          })
        }

        return res.json({
          success: true,
          status: 'PENDING',
          message: 'Aguardando confirmação na blockchain',
          amountReceived: status.amount || 0,
          amountExpected: payment.amount,
          confirmations: status.confirmations || 0
        })
      } catch (error: any) {
        console.error(`❌ [check-status] Erro ao verificar Bitcoin:`, error.message)
        return res.json({
          success: true,
          status: 'PENDING',
          message: 'Aguardando confirmação na blockchain',
          note: 'Não foi possível consultar o status. Tente novamente em alguns segundos.'
        })
      }
    }

    // Pagamento pendente sem informações adicionais
    return res.json({
      success: true,
      status: 'PENDING',
      message: 'Aguardando confirmação do pagamento'
    })

  } catch (error: any) {
    console.error('❌ [check-status] Erro geral:', error)
    return res.status(500).json({
      error: 'Erro interno',
      details: error.message
    })
  }
}

