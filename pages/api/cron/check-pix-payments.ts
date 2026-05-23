import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { checkMisticPayTransaction, isMisticPayPaid, isMisticPayTransactionId } from '@/lib/misticpay'
import { settlePaymentAsPaid } from '@/lib/payment-utils'

/**
 * Verifica automaticamente pagamentos PIX pendentes (MisticPay)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authHeader = req.headers.authorization
  const cronSecret = process.env.CRON_SECRET || 'kaizen_cron_secret_2024'

  if (authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    console.log('🔄 [cron-pix] Verificando pagamentos PIX MisticPay...')

    const pendingPixPayments = await prisma.payment.findMany({
      where: {
        method: 'PIX',
        status: 'PENDING',
        createdAt: {
          gte: new Date(Date.now() - 48 * 60 * 60 * 1000)
        }
      },
      include: {
        user: true,
        plan: true
      },
      orderBy: { createdAt: 'desc' }
    })

    const results = {
      total: pendingPixPayments.length,
      checked: 0,
      activated: 0,
      stillPending: 0,
      skipped: 0,
      errors: 0,
      details: [] as any[]
    }

    for (const payment of pendingPixPayments) {
      if (!payment.asaasId || !isMisticPayTransactionId(payment.asaasId)) {
        results.skipped++
        results.details.push({
          paymentId: payment.id,
          status: 'skipped',
          reason: 'Not a MisticPay PIX payment'
        })
        continue
      }

      results.checked++

      try {
        const remote = await checkMisticPayTransaction(payment.asaasId)
        const isPaid = isMisticPayPaid(remote.transactionState)

        if (isPaid) {
          await settlePaymentAsPaid(payment, {
            paidAt: remote.paidAt,
            pagSeguroReferenceId: payment.pagSeguroReferenceId ?? undefined
          })

          results.activated++
          results.details.push({
            paymentId: payment.id,
            userId: payment.userId,
            username: payment.user.username,
            status: 'activated',
            misticPayId: payment.asaasId
          })
        } else {
          results.stillPending++
          results.details.push({
            paymentId: payment.id,
            status: 'still_pending',
            providerStatus: remote.transactionState
          })
        }
      } catch (error: any) {
        results.errors++
        results.details.push({
          paymentId: payment.id,
          status: 'error',
          error: error.message
        })
      }
    }

    return res.json({
      success: true,
      message: 'MisticPay PIX payments checked',
      timestamp: new Date().toISOString(),
      results
    })
  } catch (error: any) {
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    })
  }
}
