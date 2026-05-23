import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import { checkMisticPayTransaction, isMisticPayPaid, isMisticPayTransactionId } from '@/lib/misticpay'
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
        if (!payment.asaasId || !isMisticPayTransactionId(payment.asaasId)) {
          results.details.push({
            paymentId: payment.id,
            method: 'PIX',
            status: 'skipped',
            reason: 'Not a MisticPay PIX payment'
          })
          continue
        }

        results.checked++

        try {
          const remote = await checkMisticPayTransaction(payment.asaasId)
          const isPaid = isMisticPayPaid(remote.transactionState)

          if (isPaid) {
            await settlePaymentAsPaid(payment, {
              paidAt: remote.paidAt,
              pagSeguroReferenceId: payment.pagSeguroReferenceId ?? undefined
            })

            results.activated++
            results.details.push({
              paymentId: payment.id,
              userId: payment.userId,
              username: payment.user.username,
              planName: payment.plan.name,
              method: 'PIX',
              status: 'activated',
              paidAt: remote.paidAt.toISOString()
            })
          } else {
            results.stillPending++
            results.details.push({
              paymentId: payment.id,
              method: 'PIX',
              status: 'still_pending',
              providerStatus: remote.transactionState
            })
          }
        } catch (error: any) {
          results.errors++
          results.details.push({
            paymentId: payment.id,
            method: 'PIX',
            status: 'error',
            error: error.message
          })
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

