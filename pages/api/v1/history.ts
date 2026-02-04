import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { validateApiKey, checkRateLimit } from '@/lib/api-key-utils'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = (req.headers['x-api-key'] as string) || (req.query.apiKey as string)
  if (!apiKey) {
    return res.status(401).json({ error: 'API key is required' })
  }

  const validation = await validateApiKey(apiKey)
  if (!validation.valid || !validation.apiKeyData) {
    return res.status(401).json({ error: validation.error || 'Invalid API key' })
  }
  const apiKeyData = validation.apiKeyData

  const rate = checkRateLimit(apiKeyData.id, apiKeyData.rateLimit)
  if (!rate.allowed) {
    const waitSeconds = Math.ceil((rate.resetAt - Date.now()) / 1000)
    return res.status(429).json({
      error: 'Rate limit exceeded',
      retryAfter: waitSeconds,
      limit: apiKeyData.rateLimit
    })
  }

  const page = parseInt((req.query.page as string) || '1', 10)
  const limit = Math.min(Math.max(parseInt((req.query.limit as string) || '20', 10), 1), 100)
  const offset = (page - 1) * limit

  try {
    const [accounts, total] = await Promise.all([
      prisma.generatedAccount.findMany({
        where: { userId: apiKeyData.userId },
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          stock: {
            select: {
              service: { select: { id: true, name: true } }
            }
          }
        }
      }),
      prisma.generatedAccount.count({
        where: { userId: apiKeyData.userId }
      })
    ])

    const sanitized = accounts.map((a) => ({
      id: a.id,
      service: a.stock?.service ? { id: a.stock.service.id, name: a.stock.service.name } : null,
      createdAt: a.createdAt
    }))

    return res.json({
      success: true,
      history: sanitized,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasPrev: page > 1,
        hasNext: offset + limit < total
      }
    })
  } catch (error) {
    console.error('API history error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
