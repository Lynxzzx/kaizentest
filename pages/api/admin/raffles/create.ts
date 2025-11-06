import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!session || (session.user.role !== 'OWNER' && session.user.role !== 'ADMIN')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { title, description, prize, prizeType, prizePlanId, endDate } = req.body

  if (!title || !prize || !prizeType || !endDate) {
    return res.status(400).json({ error: 'Title, prize, prizeType and endDate are required' })
  }

  // Validar data de finalização
  const endDateObj = new Date(endDate)
  if (isNaN(endDateObj.getTime()) || endDateObj <= new Date()) {
    return res.status(400).json({ error: 'End date must be a valid future date' })
  }

  // Se o prêmio for um plano, validar que o plano existe
  if (prizeType === 'PLAN' && prizePlanId) {
    const plan = await prisma.plan.findUnique({
      where: { id: prizePlanId }
    })
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' })
    }
  }

  try {
    const raffle = await prisma.raffle.create({
      data: {
        title,
        description: description || null,
        prize,
        prizeType,
        prizePlanId: prizeType === 'PLAN' ? prizePlanId : null,
        endDate: endDateObj,
        isActive: true,
        isFinished: false,
        createdById: session.user.id
      },
      include: {
        prizePlan: true,
        createdBy: {
          select: {
            id: true,
            username: true
          }
        }
      }
    })

    return res.status(201).json(raffle)
  } catch (error: any) {
    console.error('Error creating raffle:', error)
    return res.status(500).json({ error: 'Error creating raffle', details: error.message })
  }
}

