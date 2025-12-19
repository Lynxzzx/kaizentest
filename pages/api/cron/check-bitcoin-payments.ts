import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { checkPaymentStatus } from '@/lib/binance'
import { settlePaymentAsPaid } from '@/lib/payment-utils'

/**
 * Endpoint para verificar automaticamente pagamentos Bitcoin pendentes
 * 
 * NOTA: Cron jobs do Vercel requerem plano Pro.
 * Este endpoint agora é chamado via polling no frontend ou manualmente pelo admin.
 * 
 * Para uso manual, envie header Authorization: Bearer <CRON_SECRET>
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verificar autorização (token de cron ou API key)
  const authHeader = req.headers.authorization
  const cronSecret = process.env.CRON_SECRET || 'kaizen_cron_secret_2024'
  
  if (authHeader !== `Bearer ${cronSecret}`) {
    console.warn('⚠️ [cron-btc] Tentativa de acesso não autorizado')
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    console.log('🔄 [cron-btc] Iniciando verificação automática de pagamentos Bitcoin...')
    
    // Buscar todos os pagamentos Bitcoin pendentes das últimas 48 horas
    const pendingBitcoinPayments = await prisma.payment.findMany({
      where: {
        method: 'BITCOIN',
        status: 'PENDING',
        createdAt: {
          gte: new Date(Date.now() - 48 * 60 * 60 * 1000) // 48 horas
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

    console.log(`📊 [cron-btc] Encontrados ${pendingBitcoinPayments.length} pagamentos Bitcoin pendentes`)

    const results = {
      total: pendingBitcoinPayments.length,
      checked: 0,
      activated: 0,
      stillPending: 0,
      errors: 0,
      details: [] as any[]
    }

    for (const payment of pendingBitcoinPayments) {
      if (!payment.bitcoinAddress) {
        console.log(`⏭️ [cron-btc] Pulando pagamento ${payment.id} - sem endereço Bitcoin`)
        results.details.push({
          paymentId: payment.id,
          status: 'skipped',
          reason: 'No Bitcoin address'
        })
        continue
      }

      results.checked++

      try {
        console.log(`🔍 [cron-btc] Verificando pagamento ${payment.id} (${payment.user.username})...`)
        console.log(`   Bitcoin Address: ${payment.bitcoinAddress}`)
        console.log(`   Valor esperado: R$ ${payment.amount}`)
        
        // Verificar status na Binance
        const status = await checkPaymentStatus(payment.bitcoinAddress, 'BTC')
        
        const isPaid = status.received && status.amount && status.amount >= payment.amount * 0.95

        if (isPaid) {
          console.log(`✅ [cron-btc] Pagamento ${payment.id} está PAGO! Ativando plano...`)
          console.log(`   Valor recebido: R$ ${status.amount}`)
          console.log(`   Usuário: ${payment.user.username}`)
          console.log(`   Plano: ${payment.plan.name}`)
          
          await settlePaymentAsPaid(payment, {
            paidAt: new Date()
          })

          results.activated++
          results.details.push({
            paymentId: payment.id,
            userId: payment.userId,
            username: payment.user.username,
            planName: payment.plan.name,
            status: 'activated',
            amountReceived: status.amount,
            amountExpected: payment.amount,
            paidAt: new Date().toISOString()
          })

          console.log(`✅ [cron-btc] Plano ativado com sucesso para ${payment.user.username}!`)
        } else {
          console.log(`⏳ [cron-btc] Pagamento ${payment.id} ainda pendente`)
          console.log(`   Valor recebido: R$ ${status.amount || 0}`)
          results.stillPending++
          results.details.push({
            paymentId: payment.id,
            userId: payment.userId,
            username: payment.user.username,
            status: 'still_pending',
            amountReceived: status.amount || 0,
            amountExpected: payment.amount
          })
        }
      } catch (error: any) {
        console.error(`❌ [cron-btc] Erro ao verificar pagamento ${payment.id}:`, error.message)
        console.error(`   Stack:`, error.stack)
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

    console.log('✅ [cron-btc] Verificação automática concluída!')
    console.log(`📊 [cron-btc] Total: ${results.total} | Verificados: ${results.checked} | Ativados: ${results.activated} | Pendentes: ${results.stillPending} | Erros: ${results.errors}`)

    return res.json({
      success: true,
      message: 'Bitcoin payments checked automatically',
      timestamp: new Date().toISOString(),
      results
    })

  } catch (error: any) {
    console.error('❌ [cron-btc] Erro geral na verificação automática:', error)
    console.error('Stack:', error.stack)
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message,
      timestamp: new Date().toISOString()
    })
  }
}

