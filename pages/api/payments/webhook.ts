import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { checkMisticPayTransaction, isMisticPayPaid } from '@/lib/misticpay'
import { settlePaymentAsPaid } from '@/lib/payment-utils'

/**
 * Webhook para confirmar pagamentos PIX (MisticPay)
 * Documentação: https://docs.misticpay.com/
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const timestamp = new Date().toISOString()
  console.log(`\n${'='.repeat(80)}`)
  console.log(`📥 [webhook] WEBHOOK RECEBIDO - ${timestamp}`)
  console.log(`${'='.repeat(80)}`)
  console.log('📦 [webhook] Body:', JSON.stringify(req.body, null, 2))

  try {
    const payload = req.body

    // ============================================
    // WEBHOOK DA MISTICPAY (depósito PIX)
    // ============================================
    const isMisticPayWebhook =
      payload?.transactionType === 'DEPOSITO' &&
      payload?.transactionMethod === 'PIX' &&
      payload?.transactionId != null

    if (isMisticPayWebhook) {
      console.log('📥 Webhook recebido da MisticPay')

      const misticTransactionId = String(payload.transactionId)
      const clientTransactionId =
        payload.clientTransactionId || payload.externalId || null

      const paymentFilters: { asaasId?: string; pagSeguroReferenceId?: string }[] = [
        { asaasId: misticTransactionId }
      ]
      if (clientTransactionId) {
        paymentFilters.push({ pagSeguroReferenceId: String(clientTransactionId) })
      }

      const dbPayment = await prisma.payment.findFirst({
        where: {
          OR: paymentFilters,
          method: 'PIX'
        },
        include: {
          plan: true,
          user: true
        }
      })

      if (!dbPayment) {
        console.warn('⚠️ Pagamento MisticPay não encontrado:', {
          misticTransactionId,
          clientTransactionId
        })
        return res.status(404).json({ error: 'Payment not found' })
      }

      if (dbPayment.status === 'PAID') {
        return res.json({ success: true, message: 'Payment already confirmed' })
      }

      let isPaid = isMisticPayPaid(payload.status)

      if (!isPaid) {
        try {
          const remote = await checkMisticPayTransaction(misticTransactionId)
          isPaid = isMisticPayPaid(remote.transactionState)
        } catch (statusError: any) {
          console.error('❌ Erro ao consultar MisticPay:', statusError.message)
        }
      }

      if (!isPaid) {
        return res.json({
          success: true,
          message: 'Payment not yet paid',
          status: payload.status || 'PENDENTE'
        })
      }

      await settlePaymentAsPaid(dbPayment, {
        paidAt: new Date(),
        pagSeguroReferenceId: clientTransactionId ?? undefined
      })

      console.log('✅ Pagamento MisticPay confirmado:', dbPayment.id)
      return res.json({
        success: true,
        message: 'Payment confirmed and plan activated',
        paymentId: dbPayment.id
      })
    }

    console.warn('⚠️ Formato de webhook não reconhecido:', JSON.stringify(req.body, null, 2))
    return res.status(400).json({ error: 'Unknown webhook format' })
  } catch (error: any) {
    console.error('❌ [webhook] Erro:', error.message)
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    })
  }
}
