import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { validateApiKey, checkRateLimit } from '@/lib/api-key-utils'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Autenticação por API Key
  const apiKey = req.headers['x-api-key'] as string || req.query.apiKey as string

  if (!apiKey) {
    return res.status(401).json({ error: 'API key is required' })
  }

  const validation = await validateApiKey(apiKey)
  if (!validation.valid || !validation.apiKeyData) {
    return res.status(401).json({ error: validation.error || 'Invalid API key' })
  }

  const apiKeyData = validation.apiKeyData
  const rateLimit = checkRateLimit(apiKeyData.id, apiKeyData.rateLimit)

  try {
    // Buscar informações do plano
    const plan = await prisma.plan.findUnique({
      where: { id: apiKeyData.planId },
      select: { name: true }
    })

    // Buscar últimas 10 gerações
    const recentGenerations = await prisma.generatedAccount.findMany({
      where: { userId: apiKeyData.userId },
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        stock: {
          include: {
            service: {
              select: { name: true }
            }
          }
        }
      }
    })

    return res.json({
      success: true,
      apiKey: {
        name: apiKeyData.id, // Pode ser melhorado com campo name no modelo
        plan: plan?.name || 'Unknown',
        monthlyGenerations: apiKeyData.monthlyGenerations,
        usedGenerations: apiKeyData.usedGenerations,
        remainingGenerations: apiKeyData.monthlyGenerations - apiKeyData.usedGenerations,
        rateLimit: apiKeyData.rateLimit,
        rateLimitRemaining: rateLimit.remaining,
        rateLimitResetAt: new Date(rateLimit.resetAt).toISOString(),
        isActive: apiKeyData.isActive,
        isCommercial: apiKeyData.isCommercial,
        priorityStock: apiKeyData.priorityStock
      },
      recentGenerations: recentGenerations.map(g => ({
        service: g.stock.service.name,
        username: g.stock.username,
        createdAt: g.createdAt
      }))
    })
  } catch (error) {
    console.error('API status error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}