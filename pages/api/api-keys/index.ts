import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import { generateApiKey } from '@/lib/api-key-utils'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method === 'GET') {
    // Listar API keys do usuário
    const apiKeys = await prisma.apiKey.findMany({
      where: { userId: session.user.id },
      include: {
        plan: {
          select: { name: true, price: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return res.json(apiKeys)
  }

  if (req.method === 'POST') {
    // Criar nova API key
    const { planId, name } = req.body

    if (!planId) {
      return res.status(400).json({ error: 'planId is required' })
    }

    // Verificar se o plano existe e é um plano de API
    const plan = await prisma.plan.findUnique({
      where: { id: planId }
    })

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' })
    }

    // OWNER tem acesso automático ao melhor plano de API (api-pro) para testes
    const isOwner = session.user.role === 'OWNER'
    const isApiProPlan = plan.name.toLowerCase().includes('api') && plan.name.toLowerCase().includes('pro')
    
    if (!isOwner) {
      // Buscar dados atualizados do usuário com seus planos
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          planId: true,
          planExpiresAt: true,
          apiPlanId: true,
          apiPlanExpiresAt: true
        }
      })

      if (!user) {
        return res.status(404).json({ error: 'User not found' })
      }

      const now = new Date()
      
      // Verificar se o plano solicitado é o plano principal ou o plano de API do usuário
      const isMainPlanActive = user.planId === planId && user.planExpiresAt && user.planExpiresAt > now
      const isApiPlanActive = user.apiPlanId === planId && user.apiPlanExpiresAt && user.apiPlanExpiresAt > now

      if (!isMainPlanActive && !isApiPlanActive) {
        return res.status(403).json({ error: 'Você precisa ter este plano ativo para criar uma API key' })
      }
    }

    const apiKey = await prisma.apiKey.create({
      data: {
        key: generateApiKey(),
        userId: session.user.id,
        planId: planId,
        name: name || undefined,
        monthlyGenerations: plan.maxGenerations || 0,
        rateLimit: 60 // Padrão, pode ser customizado por plano
      },
      include: {
        plan: {
          select: { name: true }
        }
      }
    })

    return res.json(apiKey)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}