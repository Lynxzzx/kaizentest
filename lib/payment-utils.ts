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
  if (!durationDays || durationDays <= 0) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        planId,
        planExpiresAt: null
      }
    })
    console.log('✅ Plano vitalício ativado para usuário:', userId)
    return null
  }

  const duration = durationDays || DEFAULT_PLAN_DURATION_FALLBACK
  const now = new Date()

  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { planId: true, planExpiresAt: true }
  })

  let baseDate = now
  if (currentUser?.planId === planId && currentUser.planExpiresAt && currentUser.planExpiresAt > now) {
    baseDate = currentUser.planExpiresAt
  }

  const expiresAt = new Date(baseDate)
  expiresAt.setDate(expiresAt.getDate() + duration)

  await prisma.user.update({
    where: { id: userId },
    data: {
      planId,
      planExpiresAt: expiresAt
    }
  })

  console.log('✅ Plano ativado/renovado para usuário:', userId, '- expira em:', expiresAt.toISOString())
  return expiresAt
}

export async function settlePaymentAsPaid(
  payment: PaymentWithPlan,
  options?: { paidAt?: Date; pagSeguroReferenceId?: string }
) {
  const planDuration =
    payment.plan?.duration ??
    (
      await prisma.plan.findUnique({
        where: { id: payment.planId },
        select: { duration: true }
      })
    )?.duration ??
    DEFAULT_PLAN_DURATION_FALLBACK

  const paidAt = options?.paidAt ?? new Date()
  const updateData: Record<string, any> = {
    status: 'PAID',
    paidAt
  }

  if (options?.pagSeguroReferenceId) {
    updateData.pagSeguroReferenceId = options.pagSeguroReferenceId
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: updateData
  })

  await registerCouponUsage(payment.couponId)
  await activateUserPlan(payment.userId, payment.planId, planDuration)
}


