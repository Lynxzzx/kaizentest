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

  if (!title || !prizeType || !endDate) {
    return res.status(400).json({ error: 'Title, prizeType and endDate are required' })
  }

  // Se o prêmio for um plano, validar que o plano existe e usar o nome do plano como prize
  let finalPrize = prize
  if (prizeType === 'PLAN') {
    if (!prizePlanId) {
      return res.status(400).json({ error: 'prizePlanId is required when prizeType is PLAN' })
    }
    const plan = await prisma.plan.findUnique({
      where: { id: prizePlanId }
    })
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' })
    }
    // Usar o nome do plano como prize se não foi fornecido
    finalPrize = prize || plan.name
  } else {
    // Para outros tipos, prize é obrigatório
    if (!prize) {
      return res.status(400).json({ error: 'Prize is required when prizeType is not PLAN' })
    }
  }

  // Validar data de finalização
  const endDateObj = new Date(endDate)
  if (isNaN(endDateObj.getTime()) || endDateObj <= new Date()) {
    return res.status(400).json({ error: 'End date must be a valid future date' })
  }

  try {
    const raffle = await prisma.raffle.create({
      data: {
        title,
        description: description || null,
        prize: finalPrize,
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

