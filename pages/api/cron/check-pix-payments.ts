import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { getPagSeguroPayment } from '@/lib/pagseguro'
import { settlePaymentAsPaid } from '@/lib/payment-utils'

/**
 * Endpoint para verificar automaticamente pagamentos PIX (PagSeguro)
 * 
 * NOTA: Cron jobs do Vercel requerem plano Pro.
 * Este endpoint agora é chamado via polling no frontend ou manualmente pelo admin.
 * 
 * Para uso manual, envie header Authorization: Bearer <CRON_SECRET>
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authHeader = req.headers.authorization
  const cronSecret = process.env.CRON_SECRET || 'kaizen_cron_secret_2024'

  if (authHeader !== `Bearer ${cronSecret}`) {
    console.warn('⚠️ [cron-pix] Tentativa de acesso não autorizado')
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    console.log('🔄 [cron-pix] Iniciando verificação automática de pagamentos PIX PagSeguro...')

    const pendingPixPayments = await prisma.payment.findMany({
      where: {
        method: 'PIX',
        status: 'PENDING',
        createdAt: {
          gte: new Date(Date.now() - 48 * 60 * 60 * 1000) // últimas 48 horas
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

    console.log(`📊 [cron-pix] Encontrados ${pendingPixPayments.length} pagamentos PIX pendentes`)

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
      const asaasId = payment.asaasId || ''
      const isPagSeguro =
        !!asaasId &&
        !asaasId.toLowerCase().startsWith('pay') && // IDs do Asaas começam com pay_
        !asaasId.toLowerCase().startsWith('pix')

      if (!isPagSeguro) {
        results.skipped++
        results.details.push({
          paymentId: payment.id,
          status: 'skipped',
          reason: 'Not a PagSeguro PIX payment'
        })
        continue
      }

      if (!asaasId) {
        results.skipped++
        results.details.push({
          paymentId: payment.id,
          status: 'skipped',
          reason: 'Missing PagSeguro ID'
        })
        continue
      }

      results.checked++

      try {
        console.log(`🔍 [cron-pix] Verificando pagamento ${payment.id} (${payment.user.username})...`)
        console.log(`   PagSeguro ID: ${asaasId}`)
        console.log(`   Reference ID: ${payment.pagSeguroReferenceId || 'N/A'}`)

        const pagSeguroOrder = await getPagSeguroPayment(asaasId)

        const statusCandidates = [
          pagSeguroOrder?.status,
          pagSeguroOrder?.order?.status,
          pagSeguroOrder?.charge?.status,
          pagSeguroOrder?.charges?.[0]?.status,
          pagSeguroOrder?.event
        ]
        const normalizedStatus = statusCandidates
          .filter((status): status is string => typeof status === 'string')
          .map((status) => status.toUpperCase().trim())

        const isPaid = normalizedStatus.some((status) =>
          ['PAID', 'PAYMENT_PAID', 'CONFIRMED', 'APPROVED'].includes(status)
        )

        if (isPaid) {
          const paidAt = pagSeguroOrder?.charges?.[0]?.paid_at
            ? new Date(pagSeguroOrder.charges[0].paid_at)
            : new Date()

          const referenceId =
            pagSeguroOrder?.reference_id ||
            pagSeguroOrder?.order_id ||
            pagSeguroOrder?.charges?.[0]?.reference_id ||
            pagSeguroOrder?.charge_reference ||
            payment.pagSeguroReferenceId ||
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
            planName: payment.plan?.name,
            status: 'activated',
            paidAt: paidAt.toISOString(),
            pagSeguroId: asaasId
          })

          console.log(`✅ [cron-pix] Pagamento ${payment.id} confirmado e plano ativado`)
        } else {
          results.stillPending++
          results.details.push({
            paymentId: payment.id,
            userId: payment.userId,
            username: payment.user.username,
            status: 'still_pending',
            pagSeguroId: asaasId,
            detectedStatus: normalizedStatus
          })

          console.log(`⏳ [cron-pix] Pagamento ${payment.id} ainda pendente`)
        }
      } catch (error: any) {
        console.error(`❌ [cron-pix] Erro ao verificar pagamento ${payment.id}:`, error.message)
        console.error('Stack:', error.stack)

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

    console.log(
      `📊 [cron-pix] Concluído | Verificados: ${results.checked} | Ativados: ${results.activated} | Pendentes: ${results.stillPending} | Pulados: ${results.skipped} | Erros: ${results.errors}`
    )

    return res.json({
      success: true,
      message: 'PagSeguro PIX payments checked automatically',
      timestamp: new Date().toISOString(),
      results
    })
  } catch (error: any) {
    console.error('❌ [cron-pix] Erro geral na verificação automática:', error)
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message,
      timestamp: new Date().toISOString()
    })
  }
}


