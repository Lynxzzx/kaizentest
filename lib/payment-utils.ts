import { prisma } from '@/lib/prisma'
import { registerCouponUsage } from '@/lib/coupon-utils'

type PaymentWithPlan = {
  id: string
  userId: string
  planId: string
  amount?: number
  finalAmount?: number | null
  couponId?: string | null
  plan?: {
    duration: number
  } | null
}

const AFFILIATE_COMMISSION_RATE = 0.40 // padrão para afiliados comuns

const DEFAULT_PLAN_DURATION_FALLBACK = 30

export async function activateUserPlan(userId: string, planId: string, durationDays: number) {
  console.log('🎯 [activateUserPlan] Iniciando ativação:', { userId, planId, durationDays })
  
  if (!durationDays || durationDays <= 0) {
    console.log('♾️ [activateUserPlan] Plano vitalício detectado (duração 0 ou negativa)')
    await prisma.user.update({
      where: { id: userId },
      data: {
        planId,
        planExpiresAt: null
      }
    })
    console.log('✅ [activateUserPlan] Plano vitalício ativado para usuário:', userId)
    return null
  }

  const duration = durationDays || DEFAULT_PLAN_DURATION_FALLBACK
  const now = new Date()

  console.log('🔍 [activateUserPlan] Verificando plano atual do usuário...')
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { planId: true, planExpiresAt: true, username: true }
  })

  console.log('👤 [activateUserPlan] Usuário encontrado:', {
    username: currentUser?.username,
    planIdAtual: currentUser?.planId,
    expiraEm: currentUser?.planExpiresAt?.toISOString()
  })

  let baseDate = now
  if (currentUser?.planId === planId && currentUser.planExpiresAt && currentUser.planExpiresAt > now) {
    baseDate = currentUser.planExpiresAt
    console.log('♻️ [activateUserPlan] Renovação detectada! Somando ao plano existente.')
  } else {
    console.log('🆕 [activateUserPlan] Novo plano ou plano diferente. Iniciando do zero.')
  }

  const expiresAt = new Date(baseDate)
  expiresAt.setDate(expiresAt.getDate() + duration)

  console.log('💾 [activateUserPlan] Salvando novo plano no banco...')
  await prisma.user.update({
    where: { id: userId },
    data: {
      planId,
      planExpiresAt: expiresAt
    }
  })

  console.log('✅ [activateUserPlan] Plano ativado/renovado com sucesso!')
  console.log('   Usuário:', currentUser?.username || userId)
  console.log('   Plano ID:', planId)
  console.log('   Duração:', duration, 'dias')
  console.log('   Expira em:', expiresAt.toISOString())
  
  return expiresAt
}

export async function settlePaymentAsPaid(
  payment: PaymentWithPlan,
  options?: { paidAt?: Date; pagSeguroReferenceId?: string }
) {
  console.log('💰 [settlePaymentAsPaid] Iniciando confirmação de pagamento:', payment.id)
  
  const planDuration =
    payment.plan?.duration ??
    (
      await prisma.plan.findUnique({
        where: { id: payment.planId },
        select: { duration: true }
      })
    )?.duration ??
    DEFAULT_PLAN_DURATION_FALLBACK

  console.log('📅 [settlePaymentAsPaid] Duração do plano:', planDuration, 'dias')

  const paidAt = options?.paidAt ?? new Date()
  const updateData: Record<string, any> = {
    status: 'PAID',
    paidAt
  }

  if (options?.pagSeguroReferenceId) {
    updateData.pagSeguroReferenceId = options.pagSeguroReferenceId
    console.log('🔗 [settlePaymentAsPaid] Salvando reference_id do PagSeguro:', options.pagSeguroReferenceId)
  }

  console.log('💾 [settlePaymentAsPaid] Atualizando status do pagamento para PAID...')
  await prisma.payment.update({
    where: { id: payment.id },
    data: updateData
  })
  console.log('✅ [settlePaymentAsPaid] Pagamento atualizado com sucesso!')

  if (payment.couponId) {
    console.log('🎟️ [settlePaymentAsPaid] Registrando uso de cupom:', payment.couponId)
    await registerCouponUsage(payment.couponId)
  }

  console.log('🎯 [settlePaymentAsPaid] Ativando plano do usuário...')
  const expiresAt = await activateUserPlan(payment.userId, payment.planId, planDuration)
  console.log('✅ [settlePaymentAsPaid] Plano ativado! Expira em:', expiresAt?.toISOString() || 'VITALÍCIO')

  // Garantir que o plano foi realmente aplicado (principalmente para planos vitalícios)
  const userAfterActivation = await prisma.user.findUnique({
    where: { id: payment.userId },
    select: {
      planId: true,
      planExpiresAt: true,
      username: true,
      referredBy: true
    }
  })

  const requiresForceUpdate =
    userAfterActivation?.planId !== payment.planId ||
    (planDuration > 0 &&
      !!expiresAt &&
      (!userAfterActivation?.planExpiresAt ||
        Math.abs(userAfterActivation.planExpiresAt.getTime() - expiresAt.getTime()) > 1000))

  if (requiresForceUpdate) {
    console.warn('⚠️ [settlePaymentAsPaid] Plano não aplicado corretamente. Forçando atualização...', {
      userId: payment.userId,
      username: userAfterActivation?.username,
      expectedPlanId: payment.planId,
      currentPlanId: userAfterActivation?.planId
    })

    await prisma.user.update({
      where: { id: payment.userId },
      data: {
        planId: payment.planId,
        planExpiresAt: planDuration > 0 ? expiresAt : null
      }
    })

    console.log('✅ [settlePaymentAsPaid] Plano forçado com sucesso!')
  }

  // Dar comissão ao afiliado (CO_OWNER: 50%, demais: 40%) se o comprador foi indicado por alguém
  await giveAffiliateCommission(payment, userAfterActivation?.referredBy)
  
  // Se o plano é de API, criar API key automaticamente
  const plan = await prisma.plan.findUnique({
    where: { id: payment.planId },
    select: { name: true, maxGenerations: true }
  })
  
  if (plan && plan.name.toLowerCase().includes('api')) {
    try {
      const { generateApiKey } = await import('@/lib/api-key-utils')
      
      // Verificar se já existe API key para este plano
      const existingKey = await prisma.apiKey.findFirst({
        where: {
          userId: payment.userId,
          planId: payment.planId,
          isActive: true
        }
      })
      
      if (!existingKey) {
        // Determinar rate limit baseado no plano
        let rateLimit = 60
        let isCommercial = false
        let priorityStock = false
        
        if (plan.name.toLowerCase().includes('pro')) {
          rateLimit = 120
          isCommercial = true
          priorityStock = true
        } else if (plan.name.toLowerCase().includes('creator')) {
          rateLimit = 90
          isCommercial = true
        }
        
        await prisma.apiKey.create({
          data: {
            key: generateApiKey(),
            userId: payment.userId,
            planId: payment.planId,
            monthlyGenerations: plan.maxGenerations || 0,
            rateLimit,
            isCommercial,
            priorityStock
          }
        })
        console.log('✅ [settlePaymentAsPaid] API key criada automaticamente para plano de API')
      }
    } catch (error) {
      console.error('❌ [settlePaymentAsPaid] Erro ao criar API key automaticamente:', error)
      // Não falhar a ativação do plano se criar API key falhar
    }
  }
  
  return expiresAt
}

/**
 * Dá comissão ao afiliado que indicou o comprador (CO_OWNER: 50%, demais: 40%)
 */
async function giveAffiliateCommission(payment: PaymentWithPlan, affiliateId?: string | null) {
  if (!affiliateId) {
    console.log('💸 [affiliateCommission] Comprador não foi indicado por ninguém')
    return
  }

  try {
    // Verificar se já existe comissão para este pagamento
    const existingCommission = await prisma.affiliateCommission.findFirst({
      where: { paymentId: payment.id }
    })

    if (existingCommission) {
      console.log('💸 [affiliateCommission] Comissão já existe para este pagamento')
      return
    }

    // Calcular valor da comissão
    const paymentAmount = payment.finalAmount || payment.amount || 0
    if (paymentAmount <= 0) {
      console.log('💸 [affiliateCommission] Valor do pagamento é zero ou negativo')
      return
    }

    // Buscar afiliado
    const affiliate = await prisma.user.findUnique({
      where: { id: affiliateId },
      select: { id: true, username: true, affiliateBalance: true, totalAffiliateEarnings: true, role: true }
    })

    if (!affiliate) {
      console.log('💸 [affiliateCommission] Afiliado não encontrado:', affiliateId)
      return
    }

    const rate = affiliate.role === 'CO_OWNER' ? 0.50 : AFFILIATE_COMMISSION_RATE
    const commissionAmount = paymentAmount * rate

    // Criar registro de comissão
    await prisma.affiliateCommission.create({
      data: {
        affiliateId: affiliate.id,
        paymentId: payment.id,
        amount: commissionAmount,
        paymentAmount: paymentAmount,
        status: 'CREDITED'
      }
    })

    // Adicionar ao saldo do afiliado
    await prisma.user.update({
      where: { id: affiliate.id },
      data: {
        affiliateBalance: {
          increment: commissionAmount
        },
        totalAffiliateEarnings: {
          increment: commissionAmount
        }
      }
    })

    console.log(`💰 [affiliateCommission] Comissão de R$ ${commissionAmount.toFixed(2)} creditada para ${affiliate.username}`)
    console.log(`   Pagamento: R$ ${paymentAmount.toFixed(2)} | Taxa: ${AFFILIATE_COMMISSION_RATE * 100}%`)

  } catch (error) {
    console.error('❌ [affiliateCommission] Erro ao dar comissão:', error)
    // Não lançar erro para não afetar a confirmação do pagamento
  }
}


