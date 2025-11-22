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

  // Log inicial com timestamp
  const timestamp = new Date().toISOString()
  console.log(`\n${'='.repeat(80)}`)
  console.log(`📥 [webhook] WEBHOOK RECEBIDO - ${timestamp}`)
  console.log(`${'='.repeat(80)}`)
  console.log('📦 [webhook] Headers:', JSON.stringify(req.headers, null, 2))
  console.log('📦 [webhook] Body:', JSON.stringify(req.body, null, 2))

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

      console.log('🔍 IDs extraídos do webhook:', { orderId, chargeId, referenceId })

      const paymentFilters: { asaasId?: string; pagSeguroReferenceId?: string }[] = []
      if (orderId) paymentFilters.push({ asaasId: orderId })
      if (chargeId) paymentFilters.push({ asaasId: chargeId })
      if (referenceId) paymentFilters.push({ pagSeguroReferenceId: referenceId })
      
      console.log('🔍 Filtros de busca de pagamento:', paymentFilters)

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
          plan: true,
          user: true
        }
      })

      if (!dbPayment) {
        console.warn('⚠️ Pagamento não encontrado no banco.', { orderId, chargeId, referenceId })
        console.warn('⚠️ Tentando buscar todos os pagamentos pendentes PIX para debug...')
        
        const pendingPayments = await prisma.payment.findMany({
          where: {
            method: 'PIX',
            status: 'PENDING'
          },
          select: {
            id: true,
            asaasId: true,
            pagSeguroReferenceId: true,
            createdAt: true
          },
          take: 10,
          orderBy: { createdAt: 'desc' }
        })
        
        console.warn('📊 Últimos 10 pagamentos PIX pendentes:', JSON.stringify(pendingPayments, null, 2))
        return res.status(404).json({ error: 'Payment not found' })
      }

      console.log('✅ Pagamento encontrado no banco:', {
        id: dbPayment.id,
        userId: dbPayment.userId,
        username: dbPayment.user.username,
        planId: dbPayment.planId,
        planName: dbPayment.plan.name,
        currentStatus: dbPayment.status,
        asaasId: dbPayment.asaasId,
        pagSeguroReferenceId: dbPayment.pagSeguroReferenceId
      })

      if (dbPayment.status === 'PAID') {
        console.log('✅ Pagamento já estava confirmado:', dbPayment.id)
        return res.json({ success: true, message: 'Payment already confirmed' })
      }

      const statusCandidates = [
        order?.status,
        charge?.status,
        pagSeguroPayload?.status,
        pagSeguroPayload?.data?.status,
        pagSeguroPayload?.charges?.[0]?.status,
        pagSeguroPayload?.event // Alguns webhooks enviam 'PAYMENT_PAID' no campo event
      ]
      const normalizedStatus = statusCandidates
        .filter((status): status is string => typeof status === 'string')
        .map((status) => status.toUpperCase())

      console.log('🔍 Status encontrados no webhook:', normalizedStatus)

      let paidAt: Date | undefined = charge?.paid_at ? new Date(charge.paid_at) : undefined
      // Verificar múltiplas variações de status PAID
      let isPaid = normalizedStatus.some(status => 
        status === 'PAID' || 
        status === 'PAYMENT_PAID' || 
        status === 'CONFIRMED' ||
        status === 'APPROVED'
      )
      
      console.log('🔍 Status de pagamento detectado:', { isPaid, normalizedStatus })

      if (!isPaid && (chargeId || orderId)) {
        console.log('🔄 Status não confirmado no webhook, consultando API do PagSeguro...')
        try {
          const remotePayment = await getPagSeguroPayment(chargeId || orderId)
          console.log('📦 Resposta da API PagSeguro:', JSON.stringify(remotePayment, null, 2))
          
          const remoteStatus = remotePayment?.status
          const remoteChargeStatus = remotePayment?.charges?.[0]?.status
          
          console.log('🔍 Status remoto extraídos:', { remoteStatus, remoteChargeStatus })
          
          if (
            (typeof remoteStatus === 'string' && remoteStatus.toUpperCase() === 'PAID') ||
            (typeof remoteChargeStatus === 'string' && remoteChargeStatus.toUpperCase() === 'PAID')
          ) {
            isPaid = true
            console.log('✅ Status PAID confirmado via API PagSeguro!')
            
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
          console.error('❌ Erro ao consultar status no PagSeguro:', statusError.message)
          console.error('Stack:', statusError.stack)
        }
      }

      if (!isPaid) {
        console.log('ℹ️ Pagamento PagSeguro ainda não confirmado.', normalizedStatus)
        return res.json({ success: true, message: 'Payment not yet paid', status: normalizedStatus[0] || 'PENDING' })
      }

      console.log('🚀 Iniciando processo de ativação do plano...')
      console.log('📊 Dados do pagamento:', {
        paymentId: dbPayment.id,
        userId: dbPayment.userId,
        username: dbPayment.user.username,
        planId: dbPayment.planId,
        planName: dbPayment.plan.name,
        planDuration: dbPayment.plan.duration,
        amount: dbPayment.amount,
        paidAt: paidAt?.toISOString()
      })

      try {
        await settlePaymentAsPaid(dbPayment, {
          paidAt,
          pagSeguroReferenceId: referenceId ?? undefined
        })

        console.log('✅ Pagamento PagSeguro confirmado e plano ativado com sucesso!')
        console.log('✅ Usuário:', dbPayment.user.username, '| Plano:', dbPayment.plan.name)
        console.log(`${'='.repeat(80)}\n`)
        
        return res.json({ 
          success: true, 
          message: 'Payment confirmed and plan activated',
          paymentId: dbPayment.id,
          userId: dbPayment.userId,
          planId: dbPayment.planId
        })
      } catch (activationError: any) {
        console.error('❌ ERRO CRÍTICO ao ativar plano:', activationError.message)
        console.error('Stack:', activationError.stack)
        
        // Mesmo com erro, retornar 200 para o webhook não reenviar
        // Mas logamos o erro para investigação
        return res.json({ 
          success: false, 
          error: 'Plan activation failed',
          details: activationError.message,
          paymentId: dbPayment.id
        })
      }
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
        console.log(`${'='.repeat(80)}\n`)

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
    console.error(`\n${'='.repeat(80)}`)
    console.error('❌ [webhook] ERRO AO PROCESSAR WEBHOOK')
    console.error(`${'='.repeat(80)}`)
    console.error('❌ [webhook] Erro:', error.message)
    console.error('❌ [webhook] Stack:', error.stack)
    console.error('❌ [webhook] Body recebido:', JSON.stringify(req.body, null, 2))
    console.error(`${'='.repeat(80)}\n`)
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    })
  }
}

