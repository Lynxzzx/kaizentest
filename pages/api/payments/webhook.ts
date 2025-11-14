import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { getPagSeguroPayment } from '@/lib/pagseguro'
import { settlePaymentAsPaid } from '@/lib/payment-utils'

/**
 * Webhook para confirmar pagamentos PIX (Asaas e PagSeguro)
 * Documentação Asaas: https://docs.asaas.com/docs/webhook
 * Documentação PagSeguro: https://dev.pagseguro.uol.com.br/docs/api-pagamentos
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // ============================================
    // WEBHOOK DO PAGSEGURO
    // ============================================
    const pagSeguroPayload = req.body
    const isPagSeguroWebhook =
      !!pagSeguroPayload?.order ||
      !!pagSeguroPayload?.charge ||
      Array.isArray(pagSeguroPayload?.charges) ||
      typeof req.headers['x-pagseguro-signature'] === 'string' ||
      (typeof pagSeguroPayload?.provider === 'string' &&
        pagSeguroPayload.provider.toLowerCase().includes('pagseguro'))

    if (isPagSeguroWebhook) {
      console.log('📥 Webhook recebido do PagSeguro:', JSON.stringify(pagSeguroPayload, null, 2))

      const order = pagSeguroPayload.order || pagSeguroPayload
      const charge = pagSeguroPayload.charge || order?.charges?.[0] || pagSeguroPayload?.charges?.[0]
      const orderId =
        order?.id ||
        pagSeguroPayload?.order_id ||
        pagSeguroPayload?.orderId ||
        pagSeguroPayload?.data?.order_id ||
        null
      const chargeId =
        charge?.id ||
        pagSeguroPayload?.charge_id ||
        pagSeguroPayload?.data?.charge_id ||
        null
      let referenceId =
        order?.reference_id ||
        charge?.reference_id ||
        pagSeguroPayload?.reference_id ||
        pagSeguroPayload?.data?.reference_id ||
        pagSeguroPayload?.referenceId ||
        null

      const paymentFilters: { asaasId?: string; pagSeguroReferenceId?: string }[] = []
      if (orderId) paymentFilters.push({ asaasId: orderId })
      if (chargeId) paymentFilters.push({ asaasId: chargeId })
      if (referenceId) paymentFilters.push({ pagSeguroReferenceId: referenceId })

      if (paymentFilters.length === 0) {
        console.warn('⚠️ Webhook PagSeguro sem identificadores suficientes para localizar o pagamento.')
        return res.status(400).json({ error: 'Missing identifiers to match payment' })
      }

      const dbPayment = await prisma.payment.findFirst({
        where: {
          OR: paymentFilters,
          method: 'PIX'
        },
        include: {
          plan: true
        }
      })

      if (!dbPayment) {
        console.warn('⚠️ Pagamento não encontrado no banco.', { orderId, chargeId, referenceId })
        return res.status(404).json({ error: 'Payment not found' })
      }

      if (dbPayment.status === 'PAID') {
        console.log('✅ Pagamento já estava confirmado:', dbPayment.id)
        return res.json({ success: true, message: 'Payment already confirmed' })
      }

      const statusCandidates = [
        order?.status,
        charge?.status,
        pagSeguroPayload?.status,
        pagSeguroPayload?.data?.status,
        pagSeguroPayload?.charges?.[0]?.status
      ]
      const normalizedStatus = statusCandidates
        .filter((status): status is string => typeof status === 'string')
        .map((status) => status.toUpperCase())

      let paidAt: Date | undefined = charge?.paid_at ? new Date(charge.paid_at) : undefined
      let isPaid = normalizedStatus.includes('PAID')

      if (!isPaid && (chargeId || orderId)) {
        try {
          const remotePayment = await getPagSeguroPayment(chargeId || orderId)
          const remoteStatus = remotePayment?.status
          const remoteChargeStatus = remotePayment?.charges?.[0]?.status
          if (
            (typeof remoteStatus === 'string' && remoteStatus.toUpperCase() === 'PAID') ||
            (typeof remoteChargeStatus === 'string' && remoteChargeStatus.toUpperCase() === 'PAID')
          ) {
            isPaid = true
            if (remotePayment?.charges?.[0]?.paid_at) {
              paidAt = new Date(remotePayment.charges[0].paid_at)
            }
            referenceId =
              referenceId ||
              remotePayment?.reference_id ||
              remotePayment?.charges?.[0]?.reference_id ||
              remotePayment?.charge_reference ||
              null
          }
        } catch (statusError: any) {
          console.warn('⚠️ Não foi possível consultar status no PagSeguro:', statusError.message)
        }
      }

      if (!isPaid) {
        console.log('ℹ️ Pagamento PagSeguro ainda não confirmado.', normalizedStatus)
        return res.json({ success: true, message: 'Payment not yet paid', status: normalizedStatus[0] || 'PENDING' })
      }

      await settlePaymentAsPaid(dbPayment, {
        paidAt,
        pagSeguroReferenceId: referenceId ?? undefined
      })

      console.log('✅ Pagamento PagSeguro confirmado e plano ativado:', dbPayment.id)
      return res.json({ success: true, message: 'Payment confirmed and plan activated' })
    }

    // ============================================
    // WEBHOOK DO ASAAS
    // ============================================
    const event = req.body.event
    const payment = req.body.payment

    if (event && payment) {
      console.log('📥 Webhook recebido do Asaas:', { event, paymentId: payment?.id })

      // Verificar se é evento de pagamento confirmado
      if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
        const asaasId = payment.id

        if (!asaasId) {
          return res.status(400).json({ error: 'Payment ID is required' })
        }

        // Buscar pagamento no banco (usa findFirst porque asaasId não é mais único, mas ainda é único para PIX)
        const dbPayment = await prisma.payment.findFirst({
          where: { 
            asaasId,
            method: 'PIX' // Garantir que é um pagamento PIX (único que tem asaasId)
          },
          include: {
            plan: true
          }
        })

        if (!dbPayment) {
          console.warn('⚠️ Pagamento não encontrado no banco:', asaasId)
          return res.status(404).json({ error: 'Payment not found' })
        }

        // Verificar se já foi confirmado
        if (dbPayment.status === 'PAID') {
          console.log('✅ Pagamento já estava confirmado:', dbPayment.id)
          return res.json({ success: true, message: 'Payment already confirmed' })
        }

        await settlePaymentAsPaid(dbPayment, { paidAt: new Date() })
        console.log('✅ Pagamento Asaas confirmado:', dbPayment.id)

        return res.json({ success: true, message: 'Payment confirmed and plan activated' })
      }

      // Outros eventos podem ser tratados aqui
      console.log('ℹ️ Evento não tratado:', event)
      return res.json({ success: true, message: 'Event received but not processed' })
    }

    // Se não for nenhum dos formatos conhecidos
    console.warn('⚠️ Formato de webhook não reconhecido:', JSON.stringify(req.body, null, 2))
    return res.status(400).json({ error: 'Unknown webhook format' })

  } catch (error: any) {
    console.error('❌ Erro ao processar webhook:', error)
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    })
  }
}

