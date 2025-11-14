import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { code, planId, amount } = req.body

  if (!code) {
    return res.status(400).json({ error: 'Coupon code is required' })
  }

  try {
    let baseAmount = Number(amount) || 0

    if (planId) {
      const plan = await prisma.plan.findUnique({ where: { id: planId } })
      if (!plan) {
        return res.status(404).json({ error: 'Plan not found' })
      }
      baseAmount = plan.price
    }

    if (!baseAmount || baseAmount <= 0) {
      return res.status(400).json({ error: 'Invalid amount for coupon validation' })
    }

    const coupon = await prisma.coupon.findFirst({
      where: {
        code: code.trim().toUpperCase()
      }
    })

    if (!coupon || !coupon.isActive) {
      return res.status(404).json({ error: 'Coupon not found or inactive' })
    }

    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Coupon expired' })
    }

    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
      return res.status(400).json({ error: 'Coupon usage limit reached' })
    }

    if (coupon.minAmount && baseAmount < coupon.minAmount) {
      return res.status(400).json({ error: 'Order total does not reach the minimum required for this coupon' })
    }

    let discountAmount =
      coupon.discountType === 'PERCENTAGE'
        ? (baseAmount * coupon.discountValue) / 100
        : coupon.discountValue

    discountAmount = Math.min(discountAmount, baseAmount)
    const finalAmount = Math.max(baseAmount - discountAmount, 0)

    return res.status(200).json({
      couponId: coupon.id,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discountAmount,
      finalAmount
    })
  } catch (error: any) {
    console.error('Error validating coupon:', error)
    return res.status(500).json({ error: 'Failed to validate coupon', details: error.message })
  }
}

