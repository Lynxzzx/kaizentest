import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { getAsaasPayment } from '@/lib/asaas'
import { getPagSeguroPayment } from '@/lib/pagseguro'

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
    if (req.body.event && (req.body.event === 'PAYMENT_PAID' || req.body.order)) {
      console.log('📥 Webhook recebido do PagSeguro:', JSON.stringify(req.body, null, 2))
      
      const order = req.body.order || req.body
      const charge = req.body.charge || order.charges?.[0]
      const orderId = order.id
      const referenceId = order.reference_id
      
      if (!referenceId) {
        console.warn('⚠️ Webhook PagSeguro sem reference_id')
        return res.status(400).json({ error: 'Reference ID is required' })
      }

      // Buscar pagamento pelo reference_id (que contém o ID do pagamento)
      const paymentIdMatch = referenceId.match(/payment_(\d+)_([a-z0-9]+)/)
      if (!paymentIdMatch) {
        console.warn('⚠️ Reference ID inválido:', referenceId)
        return res.status(400).json({ error: 'Invalid reference ID format' })
      }

      // Buscar pagamento no banco pelo asaasId (que armazena o ID do PagSeguro)
      const dbPayment = await prisma.payment.findFirst({
        where: {
          OR: [
            { asaasId: orderId }, // ID do pedido PagSeguro
            { asaasId: charge?.id } // ID da cobrança PagSeguro
          ],
          method: 'PIX'
        },
        include: {
          user: true,
          plan: true
        }
      })

      if (!dbPayment) {
        console.warn('⚠️ Pagamento não encontrado no banco. Order ID:', orderId, 'Reference ID:', referenceId)
        // Tentar buscar pelo reference_id se tiver o ID do pagamento
        return res.status(404).json({ error: 'Payment not found' })
      }

      // Verificar status do pagamento no PagSeguro
      const orderStatus = order.status || charge?.status
      const isPaid = orderStatus === 'PAID' || charge?.status === 'PAID'

      if (!isPaid) {
        console.log('ℹ️ Pagamento ainda não confirmado. Status:', orderStatus)
        return res.json({ success: true, message: 'Payment not yet paid', status: orderStatus })
      }

      // Verificar se já foi confirmado
      if (dbPayment.status === 'PAID') {
        console.log('✅ Pagamento já estava confirmado:', dbPayment.id)
        return res.json({ success: true, message: 'Payment already confirmed' })
      }

      // Atualizar status do pagamento
      const paidAt = charge?.paid_at ? new Date(charge.paid_at) : new Date()
      await prisma.payment.update({
        where: { id: dbPayment.id },
        data: {
          status: 'PAID',
          paidAt: paidAt
        }
      })

      console.log('✅ Pagamento PagSeguro confirmado:', dbPayment.id)

      // Ativar plano do usuário
      await activateUserPlan(dbPayment.userId, dbPayment.planId, dbPayment.plan.duration)

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
            user: true,
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

        // Atualizar status do pagamento
        await prisma.payment.update({
          where: { id: dbPayment.id },
          data: {
            status: 'PAID',
            paidAt: new Date()
          }
        })

        console.log('✅ Pagamento confirmado:', dbPayment.id)

        // Ativar plano do usuário
        await activateUserPlan(dbPayment.userId, dbPayment.planId, dbPayment.plan.duration)

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

/**
 * Ativa o plano do usuário após pagamento confirmado
 */
async function activateUserPlan(userId: string, planId: string, durationDays: number) {
  try {
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + durationDays)

    await prisma.user.update({
      where: { id: userId },
      data: {
        planId: planId,
        planExpiresAt: expiresAt
      }
    })

    console.log('✅ Plano ativado para usuário:', userId)
    console.log('   Plano expira em:', expiresAt.toISOString())
  } catch (error: any) {
    console.error('❌ Erro ao ativar plano:', error)
    throw error
  }
}

