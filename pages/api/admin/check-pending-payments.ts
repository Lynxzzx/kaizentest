import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import { getPagSeguroPayment } from '@/lib/pagseguro'
import { settlePaymentAsPaid } from '@/lib/payment-utils'

/**
 * Endpoint admin para verificar e ativar manualmente pagamentos pendentes do PagSeguro
 * Útil para casos onde o webhook não funcionou
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!session || session.user.role !== 'OWNER') {
    return res.status(403).json({ error: 'Unauthorized - Admin only' })
  }

  try {
    console.log('🔍 [admin-check] Buscando pagamentos PIX pendentes...')
    
    // Buscar todos os pagamentos PIX pendentes
    const pendingPayments = await prisma.payment.findMany({
      where: {
        method: 'PIX',
        status: 'PENDING',
        // Apenas pagamentos das últimas 24 horas para evitar processar pagamentos muito antigos
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      },
      include: {
        user: true,
        plan: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    console.log(`📊 [admin-check] Encontrados ${pendingPayments.length} pagamentos pendentes`)

    const results = {
      total: pendingPayments.length,
      checked: 0,
      activated: 0,
      stillPending: 0,
      errors: 0,
      details: [] as any[]
    }

    for (const payment of pendingPayments) {
      const isPagSeguro = !!payment.asaasId && !payment.asaasId.startsWith('pay_')
      
      if (!isPagSeguro) {
        console.log(`⏭️ [admin-check] Pulando pagamento ${payment.id} - não é PagSeguro`)
        results.details.push({
          paymentId: payment.id,
          status: 'skipped',
          reason: 'Not PagSeguro'
        })
        continue
      }

      results.checked++

      try {
        console.log(`🔄 [admin-check] Verificando pagamento ${payment.id} (${payment.user.username})...`)
        
        // Buscar status no PagSeguro
        const pagSeguroOrder = await getPagSeguroPayment(payment.asaasId!)
        
        const orderStatus = pagSeguroOrder.status
        const chargeStatus = pagSeguroOrder.charges?.[0]?.status
        const normalizedOrderStatus = typeof orderStatus === 'string' ? orderStatus.toUpperCase() : ''
        const normalizedChargeStatus = typeof chargeStatus === 'string' ? chargeStatus.toUpperCase() : ''
        
        const isPaid = normalizedOrderStatus === 'PAID' || 
                       normalizedChargeStatus === 'PAID' ||
                       normalizedOrderStatus === 'CONFIRMED' ||
                       normalizedChargeStatus === 'CONFIRMED' ||
                       normalizedOrderStatus === 'APPROVED' ||
                       normalizedChargeStatus === 'APPROVED'

        if (isPaid) {
          console.log(`✅ [admin-check] Pagamento ${payment.id} está PAGO! Ativando plano...`)
          
          const paidAt = pagSeguroOrder.charges?.[0]?.paid_at
            ? new Date(pagSeguroOrder.charges[0].paid_at)
            : new Date()

          const referenceId =
            pagSeguroOrder.reference_id ||
            pagSeguroOrder.order_id ||
            pagSeguroOrder.charges?.[0]?.reference_id ||
            pagSeguroOrder.charge_reference ||
            null

          await settlePaymentAsPaid(payment, {
            paidAt,
            pagSeguroReferenceId: referenceId ?? undefined
          })

          results.activated++
          results.details.push({
            paymentId: payment.id,
            userId: payment.userId,
            username: payment.user.username,
            planName: payment.plan.name,
            status: 'activated',
            paidAt: paidAt.toISOString()
          })

          console.log(`✅ [admin-check] Plano ativado para ${payment.user.username}!`)
        } else {
          console.log(`⏳ [admin-check] Pagamento ${payment.id} ainda está pendente`)
          results.stillPending++
          results.details.push({
            paymentId: payment.id,
            userId: payment.userId,
            username: payment.user.username,
            status: 'still_pending',
            orderStatus: normalizedOrderStatus || orderStatus,
            chargeStatus: normalizedChargeStatus || chargeStatus
          })
        }
      } catch (error: any) {
        console.error(`❌ [admin-check] Erro ao verificar pagamento ${payment.id}:`, error.message)
        results.errors++
        results.details.push({
          paymentId: payment.id,
          userId: payment.userId,
          username: payment.user.username,
          status: 'error',
          error: error.message
        })
      }
    }

    console.log('📊 [admin-check] Verificação concluída:', results)

    return res.json({
      success: true,
      message: 'Pending payments checked',
      results
    })

  } catch (error: any) {
    console.error('❌ [admin-check] Erro geral:', error)
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    })
  }
}

