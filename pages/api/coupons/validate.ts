import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, getClientIp } from '@/lib/api-protection'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // 🛡️ PROTEÇÃO CONTRA ABUSO
  const session = await getServerSession(req, res, authOptions)
  const identifier = session?.user?.id || getClientIp(req)
  
  const rateCheck = await checkRateLimit(req, 'coupon_validate', identifier)
  
  if (!rateCheck.allowed) {
    return res.status(429).json({ 
      error: rateCheck.reason,
      retryAfter: rateCheck.retryAfter
    })
  }

  const { code, planId, amount } = req.body

  if (!code) {
    return res.status(400).json({ error: 'Coupon code is required' })
  }

  // Normalizar código
  const normalizedCode = code.trim().toUpperCase()
  
  // Validar formato
  if (normalizedCode.length < 2 || normalizedCode.length > 30) {
    return res.status(400).json({ error: 'Invalid coupon format' })
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
        code: normalizedCode
      }
    })

    if (!coupon || !coupon.isActive) {
      // Log tentativa (mas não revelar se cupom existe ou não)
      try {
        await prisma.securityLog.create({
          data: {
            type: 'login_attempt',
            ip: getClientIp(req),
            username: identifier,
            success: false,
            reason: 'Cupom inválido ou inativo',
            metadata: JSON.stringify({
              action: 'coupon_validate',
              codeAttempt: normalizedCode.substring(0, 3) + '***'
            })
          }
        })
      } catch (e) {}
      
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
