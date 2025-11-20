import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import { getPagSeguroPayment } from '@/lib/pagseguro'
import { settlePaymentAsPaid } from '@/lib/payment-utils'

/**
 * Verifica status de pagamento PIX (PagSeguro ou Asaas) e ativa plano automaticamente se pago
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

    // Buscar pagamento no banco
    console.log('🔍 [check-pix] Buscando pagamento:', paymentId)
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        user: true,
        plan: true
      }
    })

    if (!payment) {
      console.warn('⚠️ [check-pix] Pagamento não encontrado:', paymentId)
      return res.status(404).json({ error: 'Payment not found' })
    }

    console.log('✅ [check-pix] Pagamento encontrado:', {
      id: payment.id,
      userId: payment.userId,
      username: payment.user.username,
      status: payment.status,
      method: payment.method,
      asaasId: payment.asaasId,
      pagSeguroReferenceId: payment.pagSeguroReferenceId
    })

    // Verificar se o pagamento pertence ao usuário
    if (payment.userId !== session.user.id) {
      console.warn('⚠️ [check-pix] Usuário tentando acessar pagamento de outro usuário')
      return res.status(403).json({ error: 'Forbidden' })
    }

    // Se já está pago, retornar sucesso
    if (payment.status === 'PAID') {
      console.log('✅ [check-pix] Pagamento já está confirmado')
      return res.json({
        success: true,
        status: 'PAID',
        message: 'Payment already confirmed',
        payment
      })
    }

    // Verificar se é PagSeguro: usamos PagSeguro quando o pagamento PIX não possui ID no formato "pay_"
    const isPagSeguro =
      !!payment.asaasId &&
      !payment.asaasId.startsWith('pay_') &&
      !payment.asaasId.startsWith('pay')

    console.log('🔍 [check-pix] Tipo de pagamento:', isPagSeguro ? 'PagSeguro' : 'Asaas')

    if (isPagSeguro && payment.asaasId) {
      try {
        console.log('🔄 [check-pix] Consultando status no PagSeguro...')
        console.log('   ID:', payment.asaasId)
        
        // Buscar status no PagSeguro
        const pagSeguroOrder = await getPagSeguroPayment(payment.asaasId)
        console.log('📦 [check-pix] Resposta do PagSeguro:', JSON.stringify(pagSeguroOrder, null, 2))
        
        const orderStatus = pagSeguroOrder.status
        const chargeStatus = pagSeguroOrder.charges?.[0]?.status
        const normalizedOrderStatus = typeof orderStatus === 'string' ? orderStatus.toUpperCase() : ''
        const normalizedChargeStatus = typeof chargeStatus === 'string' ? chargeStatus.toUpperCase() : ''
        
        console.log('🔍 [check-pix] Status extraídos:', {
          orderStatus,
          chargeStatus,
          normalizedOrderStatus,
          normalizedChargeStatus
        })
        
        const isPaid = normalizedOrderStatus === 'PAID' || 
                       normalizedChargeStatus === 'PAID' ||
                       normalizedOrderStatus === 'CONFIRMED' ||
                       normalizedChargeStatus === 'CONFIRMED' ||
                       normalizedOrderStatus === 'APPROVED' ||
                       normalizedChargeStatus === 'APPROVED'
        
        console.log('🔍 [check-pix] Pagamento pago?', isPaid)
        
        const referenceId =
          pagSeguroOrder.reference_id ||
          pagSeguroOrder.order_id ||
          pagSeguroOrder.charges?.[0]?.reference_id ||
          pagSeguroOrder.charge_reference ||
          null

        if (isPaid) {
          const paidAt = pagSeguroOrder.charges?.[0]?.paid_at
            ? new Date(pagSeguroOrder.charges[0].paid_at)
            : new Date()

          console.log('🚀 [check-pix] Iniciando processo de ativação do plano...')
          
          await settlePaymentAsPaid(payment, {
            paidAt,
            pagSeguroReferenceId: referenceId ?? undefined
          })

          console.log('✅ [check-pix] Pagamento PagSeguro confirmado e plano ativado:', payment.id)

          return res.json({
            success: true,
            status: 'PAID',
            message: 'Payment confirmed and plan activated',
            payment: {
              ...payment,
              status: 'PAID',
              paidAt
            }
          })
        }

        // Pagamento ainda pendente
        console.log('⏳ [check-pix] Pagamento ainda pendente')
        return res.json({
          success: true,
          status: 'PENDING',
          message: 'Payment not yet confirmed',
          pagSeguroStatus: {
            orderStatus: normalizedOrderStatus || orderStatus,
            chargeStatus: normalizedChargeStatus || chargeStatus
          }
        })
      } catch (error: any) {
        console.error('❌ [check-pix] Erro ao verificar pagamento PagSeguro:', error.message)
        console.error('Stack:', error.stack)
        return res.status(500).json({
          error: 'Error checking payment status',
          details: error.message
        })
      }
    } else {
      // É Asaas - usar verificação do Asaas (já implementado)
      // Por enquanto, retornar pendente se não for PagSeguro
      return res.json({
        success: true,
        status: payment.status,
        message: 'Payment status checked',
        payment
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

