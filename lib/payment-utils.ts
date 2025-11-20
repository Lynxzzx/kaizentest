import { prisma } from '@/lib/prisma'
import { registerCouponUsage } from '@/lib/coupon-utils'

type PaymentWithPlan = {
  id: string
  userId: string
  planId: string
  couponId?: string | null
  plan?: {
    duration: number
  } | null
}

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
  
  return expiresAt
}


