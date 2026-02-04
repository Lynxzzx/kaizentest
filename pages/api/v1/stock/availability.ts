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

  const serviceId = (req.query.serviceId as string) || ''
  if (!serviceId) {
    return res.status(400).json({ error: 'serviceId is required' })
  }

  // Verificar se serviço existe e está ativo
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    select: { id: true, name: true, isActive: true }
  })

  if (!service || !service.isActive) {
    return res.status(404).json({ error: 'Service not found or inactive' })
  }

  // Restringir por allowedServiceIds se houver
  if (apiKeyData.allowedServiceIds.length > 0 && !apiKeyData.allowedServiceIds.includes(serviceId)) {
    return res.status(403).json({ error: 'Service not allowed for this API key' })
  }

  try {
    const [availableCount, totalCount, lastAdded, lastUsed] = await Promise.all([
      prisma.stock.count({ where: { serviceId, isUsed: false } }),
      prisma.stock.count({ where: { serviceId } }),
      prisma.stock.findFirst({
        where: { serviceId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true }
      }),
      prisma.stock.findFirst({
        where: { serviceId, isUsed: true, usedAt: { not: null } },
        orderBy: { usedAt: 'desc' },
        select: { usedAt: true }
      })
    ])

    return res.json({
      success: true,
      service: { id: service.id, name: service.name },
      availability: {
        available: availableCount,
        total: totalCount,
        isAvailable: availableCount > 0,
        lastAddedAt: lastAdded?.createdAt || null,
        lastUsedAt: lastUsed?.usedAt || null
      }
    })
  } catch (error) {
    console.error('API stock availability error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
