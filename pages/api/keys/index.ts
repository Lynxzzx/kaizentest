import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (req.method === 'GET') {
    if (!session || session.user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    const { planId } = req.query

    const keys = await prisma.key.findMany({
      where: planId ? { planId: planId as string } : {},
      include: {
        plan: true
      },
      orderBy: { createdAt: 'desc' }
    })

    return res.json(keys)
  }

  if (req.method === 'POST') {
    if (!session || session.user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    const { planId, count, expiresAt, expiresIn } = req.body

    if (!planId) {
      return res.status(400).json({ error: 'PlanId is required' })
    }

    const keyCount = count || 1
    let computedExpiresAt: Date | null = null

    if (expiresIn && typeof expiresIn.value === 'number' && expiresIn.value > 0) {
      const now = new Date()
      const value = expiresIn.value
      switch (expiresIn.unit) {
        case 'minutes':
          now.setMinutes(now.getMinutes() + value)
          break
        case 'hours':
          now.setHours(now.getHours() + value)
          break
        case 'days':
          now.setDate(now.getDate() + value)
          break
        case 'months':
          now.setMonth(now.getMonth() + value)
          break
        case 'years':
          now.setFullYear(now.getFullYear() + value)
          break
        default:
          break
      }
      computedExpiresAt = now
    } else if (expiresAt) {
      computedExpiresAt = new Date(expiresAt)
    }
    const keys = []

    for (let i = 0; i < keyCount; i++) {
      const keyString = randomBytes(16).toString('hex').toUpperCase()
      
      const key = await prisma.key.create({
        data: {
          key: keyString,
          planId,
          expiresAt: computedExpiresAt
        }
      })

      keys.push(key)
    }

    return res.json(keys)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
