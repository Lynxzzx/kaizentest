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

  return res.status(405).json({ error: 'Method not allowed' })
}

