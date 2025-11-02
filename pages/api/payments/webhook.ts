import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { getAsaasPayment } from '@/lib/asaas'

/**
 * Webhook do Asaas para confirmar pagamentos PIX
 * Documentação: https://docs.asaas.com/docs/webhook
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const event = req.body.event
    const payment = req.body.payment

    console.log('📥 Webhook recebido do Asaas:', { event, paymentId: payment?.id })

    // Verificar se é evento de pagamento confirmado
    if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
      const asaasId = payment.id

      if (!asaasId) {
        return res.status(400).json({ error: 'Payment ID is required' })
      }

      // Buscar pagamento no banco
      const dbPayment = await prisma.payment.findUnique({
        where: { asaasId },
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

