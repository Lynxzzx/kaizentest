import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import { getPagSeguroPayment } from '@/lib/pagseguro'
import { registerCouponUsage } from '@/lib/coupon-utils'

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

    // Se já está pago, retornar sucesso
    if (payment.status === 'PAID') {
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

    if (isPagSeguro && payment.asaasId) {
      try {
        // Buscar status no PagSeguro
        const pagSeguroOrder = await getPagSeguroPayment(payment.asaasId)
        
        const orderStatus = pagSeguroOrder.status
        const chargeStatus = pagSeguroOrder.charges?.[0]?.status
        const isPaid = orderStatus === 'PAID' || chargeStatus === 'PAID'

        if (isPaid) {
          // Atualizar status do pagamento
          const paidAt = pagSeguroOrder.charges?.[0]?.paid_at 
            ? new Date(pagSeguroOrder.charges[0].paid_at) 
            : new Date()

          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: 'PAID',
              paidAt: paidAt
            }
          })
          await registerCouponUsage(payment.couponId)

          // Ativar plano do usuário
          const expiresAt = new Date()
          expiresAt.setDate(expiresAt.getDate() + payment.plan.duration)

          await prisma.user.update({
            where: { id: payment.userId },
            data: {
              planId: payment.planId,
              planExpiresAt: expiresAt
            }
          })

          console.log('✅ Pagamento PagSeguro confirmado e plano ativado:', payment.id)

          return res.json({
            success: true,
            status: 'PAID',
            message: 'Payment confirmed and plan activated',
            payment: {
              ...payment,
              status: 'PAID',
              paidAt: paidAt
            }
          })
        }

        // Pagamento ainda pendente
        return res.json({
          success: true,
          status: 'PENDING',
          message: 'Payment not yet confirmed',
          pagSeguroStatus: {
            orderStatus,
            chargeStatus
          }
        })
      } catch (error: any) {
        console.error('❌ Erro ao verificar pagamento PagSeguro:', error)
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

