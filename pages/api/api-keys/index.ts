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
    const { planId, name, usageType, identifier } = req.body

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
      // Verificar se o usuário tem pagamento ativo para este plano
      const activePayment = await prisma.payment.findFirst({
        where: {
          userId: session.user.id,
          planId: planId,
          status: 'PAID'
        },
        orderBy: { createdAt: 'desc' }
      })

      if (!activePayment) {
        return res.status(403).json({ error: 'Você precisa ter um pagamento ativo para este plano para criar uma API key' })
      }
    }

    // Construir nome amigável com tipo de uso
    let computedName: string | undefined = name || undefined
    const normalizedUsage = typeof usageType === 'string' ? usageType.toUpperCase() : null
    const idLabel = typeof identifier === 'string' && identifier.trim().length > 0 ? identifier.trim() : undefined
    if (!computedName) {
      if (normalizedUsage === 'BOT' && idLabel) {
        computedName = `bot:${idLabel}`
      } else if (normalizedUsage === 'BOT') {
        computedName = 'bot:unnamed'
      } else if (normalizedUsage === 'SITE' && idLabel) {
        computedName = `site:${idLabel}`
      } else if (normalizedUsage === 'SITE') {
        computedName = 'site:unknown'
      }
    }

    const apiKey = await prisma.apiKey.create({
      data: {
        key: generateApiKey(),
        userId: session.user.id,
        planId: planId,
        name: computedName,
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
