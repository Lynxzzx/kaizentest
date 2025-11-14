import { prisma } from '@/lib/prisma'

export async function registerCouponUsage(couponId?: string | null) {
  if (!couponId) return

  try {
    const coupon = await prisma.coupon.findUnique({
      where: { id: couponId }
    })

    if (!coupon) return

    const nextCount = coupon.usedCount + 1
    const shouldDeactivate = coupon.maxUses ? nextCount >= coupon.maxUses : false

    await prisma.coupon.update({
      where: { id: couponId },
      data: {
        usedCount: { increment: 1 },
        isActive: shouldDeactivate ? false : coupon.isActive
      }
    })
  } catch (error) {
    console.error('Error updating coupon usage:', error)
  }
}

