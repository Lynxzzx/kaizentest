import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (!session || (session.user.role !== 'OWNER' && session.user.role !== 'ADMIN')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method === 'GET') {
    try {
      const coupons = await prisma.coupon.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: {
            select: { id: true, username: true }
          },
          _count: {
            select: { payments: true }
          }
        }
      })

      return res.status(200).json(coupons)
    } catch (error: any) {
      console.error('Error fetching coupons:', error)
      return res.status(500).json({ error: 'Failed to fetch coupons', details: error.message })
    }
  }

  if (req.method === 'POST') {
    const {
      code,
      description,
      discountType = 'PERCENTAGE',
      discountValue,
      maxUses,
      expiresAt,
      minAmount
    } = req.body

    if (!code || !discountValue) {
      return res.status(400).json({ error: 'Code and discount value are required' })
    }

    if (discountType === 'PERCENTAGE' && (discountValue <= 0 || discountValue > 100)) {
      return res.status(400).json({ error: 'Percentage discount must be between 1 and 100' })
    }

    if (discountType === 'VALUE' && discountValue <= 0) {
      return res.status(400).json({ error: 'Value discount must be greater than 0' })
    }

    try {
      const coupon = await prisma.coupon.create({
        data: {
          code: code.trim().toUpperCase(),
          description: description?.trim() || null,
          discountType,
          discountValue: Number(discountValue),
          maxUses: maxUses ? Number(maxUses) : null,
          minAmount: minAmount ? Number(minAmount) : null,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          createdById: session.user.id
        }
      })

      return res.status(201).json(coupon)
    } catch (error: any) {
      console.error('Error creating coupon:', error)
      return res.status(500).json({ error: 'Failed to create coupon', details: error.message })
    }
  }

  if (req.method === 'PUT') {
    const { id, code, description, discountType, discountValue, maxUses, minAmount, expiresAt, isActive } = req.body

    if (!id) {
      return res.status(400).json({ error: 'Coupon ID is required' })
    }

    try {
      const existing = await prisma.coupon.findUnique({ where: { id } })
      if (!existing) {
        return res.status(404).json({ error: 'Coupon not found' })
      }

      const updateData: any = {}

      if (code !== undefined) {
        const trimmed = code.trim().toUpperCase()
        // Check uniqueness if code changed
        if (trimmed !== existing.code) {
          const duplicate = await prisma.coupon.findFirst({ where: { code: trimmed, id: { not: id } } })
          if (duplicate) {
            return res.status(400).json({ error: 'A coupon with this code already exists' })
          }
        }
        updateData.code = trimmed
      }
      if (description !== undefined) updateData.description = description?.trim() || null
      if (discountType !== undefined) updateData.discountType = discountType
      if (discountValue !== undefined) {
        const dv = Number(discountValue)
        const dt = discountType || existing.discountType
        if (dt === 'PERCENTAGE' && (dv <= 0 || dv > 100)) {
          return res.status(400).json({ error: 'Percentage discount must be between 1 and 100' })
        }
        if (dt === 'VALUE' && dv <= 0) {
          return res.status(400).json({ error: 'Value discount must be greater than 0' })
        }
        updateData.discountValue = dv
      }
      if (maxUses !== undefined) updateData.maxUses = maxUses ? Number(maxUses) : null
      if (minAmount !== undefined) updateData.minAmount = minAmount ? Number(minAmount) : null
      if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt) : null
      if (isActive !== undefined) updateData.isActive = Boolean(isActive)

      const updated = await prisma.coupon.update({
        where: { id },
        data: updateData
      })

      return res.status(200).json(updated)
    } catch (error: any) {
      console.error('Error updating coupon:', error)
      return res.status(500).json({ error: 'Failed to update coupon', details: error.message })
    }
  }

  if (req.method === 'DELETE') {
    const { id } = req.query

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Coupon ID is required' })
    }

    try {
      const existing = await prisma.coupon.findUnique({ where: { id } })
      if (!existing) {
        return res.status(404).json({ error: 'Coupon not found' })
      }

      // Check if coupon is used in any payment
      const paymentsCount = await prisma.payment.count({ where: { couponId: id } })
      if (paymentsCount > 0) {
        // Soft delete: just deactivate if there are linked payments
        await prisma.coupon.update({ where: { id }, data: { isActive: false } })
        return res.status(200).json({ message: 'Coupon deactivated (has linked payments)', deactivated: true })
      }

      await prisma.coupon.delete({ where: { id } })
      return res.status(200).json({ message: 'Coupon deleted successfully' })
    } catch (error: any) {
      console.error('Error deleting coupon:', error)
      return res.status(500).json({ error: 'Failed to delete coupon', details: error.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

