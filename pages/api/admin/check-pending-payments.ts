import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import { getPagSeguroPayment } from '@/lib/pagseguro'
import { checkPaymentStatus } from '@/lib/binance'
import { settlePaymentAsPaid } from '@/lib/payment-utils'

/**
 * Endpoint admin para verificar e ativar manualmente pagamentos pendentes (TODOS OS MÉTODOS)
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
    console.log('🔍 [admin-check] Buscando TODOS os pagamentos pendentes...')
    
    // Buscar TODOS os pagamentos pendentes (PIX e BITCOIN)
    const pendingPayments = await prisma.payment.findMany({
      where: {
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
    console.log(`   PIX: ${pendingPayments.filter(p => p.method === 'PIX').length}`)
    console.log(`   BITCOIN: ${pendingPayments.filter(p => p.method === 'BITCOIN').length}`)

    const results = {
      total: pendingPayments.length,
      checked: 0,
      activated: 0,
      stillPending: 0,
      errors: 0,
      details: [] as any[]
    }

    for (const payment of pendingPayments) {
      // ========================================
      // VERIFICAÇÃO DE PAGAMENTOS PIX
      // ========================================
      if (payment.method === 'PIX') {
        const isPagSeguro = !!payment.asaasId && !payment.asaasId.startsWith('pay_')
        
        if (!isPagSeguro) {
          console.log(`⏭️ [admin-check] Pulando pagamento PIX ${payment.id} - não é PagSeguro (é Asaas, será processado via webhook)`)
          results.details.push({
            paymentId: payment.id,
            method: 'PIX',
            status: 'skipped',
            reason: 'Not PagSeguro - will be processed via webhook'
          })
          continue
        }

        results.checked++

        try {
          console.log(`🔄 [admin-check] Verificando pagamento PIX ${payment.id} (${payment.user.username})...`)
          console.log(`   ID: ${payment.asaasId}`)
          console.log(`   Reference ID: ${payment.pagSeguroReferenceId}`)
          
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
            console.log(`✅ [admin-check] Pagamento PIX ${payment.id} está PAGO! Ativando plano...`)
            
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
              method: 'PIX',
              status: 'activated',
              paidAt: paidAt.toISOString()
            })

            console.log(`✅ [admin-check] Plano ativado para ${payment.user.username}!`)
          } else {
            console.log(`⏳ [admin-check] Pagamento PIX ${payment.id} ainda está pendente`)
            results.stillPending++
            results.details.push({
              paymentId: payment.id,
              userId: payment.userId,
              username: payment.user.username,
              method: 'PIX',
              status: 'still_pending',
              orderStatus: normalizedOrderStatus || orderStatus,
              chargeStatus: normalizedChargeStatus || chargeStatus
            })
          }
        } catch (error: any) {
          console.error(`❌ [admin-check] Erro ao verificar pagamento PIX ${payment.id}:`, error.message)
          console.error(`   ID tentado: ${payment.asaasId}`)
          console.error(`   Reference ID: ${payment.pagSeguroReferenceId}`)
          
          // Se o erro for 400/404, é porque o ID não é válido/encontrado
          if (error.response?.status === 400 || error.response?.status === 404) {
            console.warn(`⚠️ [admin-check] ID inválido/não encontrado. Marcando como erro mas aguardando webhook.`)
            results.stillPending++
            results.details.push({
              paymentId: payment.id,
              userId: payment.userId,
              username: payment.user.username,
              method: 'PIX',
              status: 'awaiting_webhook',
              note: 'Payment ID not found in PagSeguro API. Will be activated via webhook.',
              asaasId: payment.asaasId,
              referenceId: payment.pagSeguroReferenceId
            })
          } else {
            results.errors++
            results.details.push({
              paymentId: payment.id,
              userId: payment.userId,
              username: payment.user.username,
              method: 'PIX',
              status: 'error',
              error: error.message
            })
          }
        }
      }
      
      // ========================================
      // VERIFICAÇÃO DE PAGAMENTOS BITCOIN
      // ========================================
      else if (payment.method === 'BITCOIN') {
        if (!payment.bitcoinAddress) {
          console.log(`⏭️ [admin-check] Pulando pagamento BITCOIN ${payment.id} - sem endereço Bitcoin`)
          results.details.push({
            paymentId: payment.id,
            method: 'BITCOIN',
            status: 'skipped',
            reason: 'No Bitcoin address'
          })
          continue
        }

        results.checked++

        try {
          console.log(`🔄 [admin-check] Verificando pagamento BITCOIN ${payment.id} (${payment.user.username})...`)
          console.log(`   Bitcoin Address: ${payment.bitcoinAddress}`)
          
          // Verificar status na Binance
          const status = await checkPaymentStatus(payment.bitcoinAddress, 'BTC')
          
          const isPaid = status.received && status.amount && status.amount >= payment.amount * 0.95

          if (isPaid) {
            console.log(`✅ [admin-check] Pagamento BITCOIN ${payment.id} está PAGO! Ativando plano...`)
            console.log(`   Valor recebido: ${status.amount} BRL`)
            console.log(`   Valor esperado: ${payment.amount} BRL`)
            
            await settlePaymentAsPaid(payment, {
              paidAt: new Date()
            })

            results.activated++
            results.details.push({
              paymentId: payment.id,
              userId: payment.userId,
              username: payment.user.username,
              planName: payment.plan.name,
              method: 'BITCOIN',
              status: 'activated',
              amountReceived: status.amount,
              paidAt: new Date().toISOString()
            })

            console.log(`✅ [admin-check] Plano ativado para ${payment.user.username}!`)
          } else {
            console.log(`⏳ [admin-check] Pagamento BITCOIN ${payment.id} ainda está pendente`)
            console.log(`   Valor recebido: ${status.amount || 0} BRL`)
            console.log(`   Valor esperado: ${payment.amount} BRL`)
            results.stillPending++
            results.details.push({
              paymentId: payment.id,
              userId: payment.userId,
              username: payment.user.username,
              method: 'BITCOIN',
              status: 'still_pending',
              amountReceived: status.amount || 0,
              amountExpected: payment.amount,
              blockchainStatus: status
            })
          }
        } catch (error: any) {
          console.error(`❌ [admin-check] Erro ao verificar pagamento BITCOIN ${payment.id}:`, error.message)
          results.errors++
          results.details.push({
            paymentId: payment.id,
            userId: payment.userId,
            username: payment.user.username,
            method: 'BITCOIN',
            status: 'error',
            error: error.message
          })
        }
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

