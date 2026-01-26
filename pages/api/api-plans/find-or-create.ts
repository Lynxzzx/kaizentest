import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'

// Mapeamento dos planos de API estáticos
const API_PLANS_MAP: Record<string, { name: string; price: number; duration: number; maxGenerations: number }> = {
  'api-starter': {
    name: 'API KAIZEN STARTER',
    price: 79.90,
    duration: 30,
    maxGenerations: 1500
  },
  'api-creator': {
    name: 'API KAIZEN CREATOR',
    price: 149.90,
    duration: 30,
    maxGenerations: 5000
  },
  'api-pro': {
    name: 'API KAIZEN PRO',
    price: 299.90,
    duration: 30,
    maxGenerations: 15000
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { planId } = req.body // planId é o ID estático (api-starter, api-creator, etc)

  if (!planId || !API_PLANS_MAP[planId]) {
    return res.status(400).json({ error: 'Invalid API plan ID' })
  }

  const planData = API_PLANS_MAP[planId]

  try {
    // Buscar plano existente pelo nome
    let plan = await prisma.plan.findFirst({
      where: {
        name: planData.name,
        isActive: true
      }
    })

    // Se não encontrou, criar
    if (!plan) {
      plan = await prisma.plan.create({
        data: {
          name: planData.name,
          description: planData.name,
          price: planData.price,
          duration: planData.duration,
          maxGenerations: planData.maxGenerations,
          isActive: true
        }
      })
    }

    return res.json(plan)
  } catch (error: any) {
    console.error('Error finding/creating API plan:', error)
    return res.status(500).json({ error: 'Internal server error', details: error.message })
  }
}
