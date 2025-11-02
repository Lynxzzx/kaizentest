import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { key } = req.body

  if (!key) {
    return res.status(400).json({ error: 'Key is required' })
  }

  const keyRecord = await prisma.key.findUnique({
    where: { key },
    include: { plan: true }
  })

  if (!keyRecord) {
    return res.status(404).json({ error: 'Invalid key' })
  }

  if (keyRecord.isUsed) {
    return res.status(400).json({ error: 'Key already used' })
  }

  if (keyRecord.expiresAt && new Date() > keyRecord.expiresAt) {
    return res.status(400).json({ error: 'Key expired' })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id }
  })

  if (!user) {
    return res.status(404).json({ error: 'User not found' })
  }

  // Mark key as used
  await prisma.key.update({
    where: { id: keyRecord.id },
    data: {
      isUsed: true,
      usedAt: new Date(),
      usedBy: session.user.id
    }
  })

  // Create redeemed key record
  await prisma.redeemedKey.create({
    data: {
      keyId: keyRecord.id,
      userId: session.user.id
    }
  })

  // Update user plan
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + keyRecord.plan.duration)

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      planId: keyRecord.planId,
      planExpiresAt: expiresAt
    }
  })

  return res.json({ success: true, plan: keyRecord.plan })
}
