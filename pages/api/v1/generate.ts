import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { validateApiKey, checkRateLimit } from '@/lib/api-key-utils'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  return res.status(503).json({ error: 'API offline', message: 'Serviço de API temporariamente offline. Em breve voltamos.' })

  // Autenticação por API Key
  const apiKey = req.headers['x-api-key'] as string || req.body.apiKey || req.query.apiKey as string

  if (!apiKey) {
    return res.status(401).json({ error: 'API key is required' })
  }

  const startTime = Date.now()
  const ip = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
             req.headers['x-real-ip']?.toString() ||
             req.socket?.remoteAddress || 'unknown'
  const userAgent = req.headers['user-agent'] || 'unknown'

  // Validar API key
  const validation = await validateApiKey(apiKey)
  if (!validation.valid || !validation.apiKeyData) {
    return res.status(401).json({ error: validation.error || 'Invalid API key' })
  }

  const apiKeyData = validation.apiKeyData

  // Verificar IP whitelist se configurado
  if (apiKeyData.ipWhitelist.length > 0 && !apiKeyData.ipWhitelist.includes(ip)) {
    await prisma.apiKeyUsageLog.create({
      data: {
        apiKeyId: apiKeyData.id,
        endpoint: '/api/v1/generate',
        ip,
        userAgent,
        success: false,
        errorMessage: 'IP not whitelisted'
      }
    })
    return res.status(403).json({ error: 'IP not whitelisted' })
  }

  // Verificar rate limit
  const rateLimit = checkRateLimit(apiKeyData.id, apiKeyData.rateLimit)
  if (!rateLimit.allowed) {
    const waitSeconds = Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
    return res.status(429).json({
      error: 'Rate limit exceeded',
      retryAfter: waitSeconds,
      limit: apiKeyData.rateLimit
    })
  }

  // Verificar limite mensal
  if (apiKeyData.usedGenerations >= apiKeyData.monthlyGenerations) {
    await prisma.apiKeyUsageLog.create({
      data: {
        apiKeyId: apiKeyData.id,
        endpoint: '/api/v1/generate',
        ip,
        userAgent,
        success: false,
        errorMessage: 'Monthly generation limit exceeded'
      }
    })
    return res.status(403).json({
      error: 'Monthly generation limit exceeded',
      limit: apiKeyData.monthlyGenerations,
      used: apiKeyData.usedGenerations
    })
  }

  const { serviceId } = req.body
  if (!serviceId) {
    return res.status(400).json({ error: 'serviceId is required' })
  }

  // Verificar se o serviço está permitido
  if (apiKeyData.allowedServiceIds.length > 0 && !apiKeyData.allowedServiceIds.includes(serviceId)) {
    await prisma.apiKeyUsageLog.create({
      data: {
        apiKeyId: apiKeyData.id,
        endpoint: '/api/v1/generate',
        ip,
        userAgent,
        success: false,
        errorMessage: 'Service not allowed'
      }
    })
    return res.status(403).json({ error: 'Service not allowed for this API key' })
  }

  try {
    // Buscar serviço
    const service = await prisma.service.findUnique({
      where: { id: serviceId }
    })

    if (!service || !service.isActive) {
      return res.status(404).json({ error: 'Service not found or inactive' })
    }

    // Buscar estoque (com prioridade se tiver)
    const stock = await prisma.stock.findFirst({
      where: {
        serviceId,
        isUsed: false
      },
      orderBy: apiKeyData.priorityStock ? { createdAt: 'desc' } : undefined
    })

    if (!stock) {
      await prisma.apiKeyUsageLog.create({
        data: {
          apiKeyId: apiKeyData.id,
          serviceId,
          endpoint: '/api/v1/generate',
          ip,
          userAgent,
          success: false,
          errorMessage: 'No stock available'
        }
      })
      return res.status(404).json({ error: 'No stock available for this service' })
    }

    // Gerar conta (transação atômica)
    const generatedAccount = await prisma.$transaction(async (tx) => {
      // Marcar stock como usado
      await tx.stock.update({
        where: { id: stock.id },
        data: {
          isUsed: true,
          usedAt: new Date(),
          usedBy: apiKeyData.userId
        }
      })

      // Criar conta gerada
      const account = await tx.generatedAccount.create({
        data: {
          userId: apiKeyData.userId,
          stockId: stock.id
        }
      })

      // Incrementar contador de gerações
      await tx.apiKey.update({
        where: { id: apiKeyData.id },
        data: {
          usedGenerations: { increment: 1 }
        }
      })

      return account
    })

    const responseTime = Date.now() - startTime

    // Log de uso (em background)
    prisma.apiKeyUsageLog.create({
      data: {
        apiKeyId: apiKeyData.id,
        serviceId,
        endpoint: '/api/v1/generate',
        ip,
        userAgent,
        success: true,
        responseTime
      }
    }).catch(() => {})

    return res.json({
      success: true,
      account: {
        username: stock.username,
        password: stock.password,
        email: stock.email,
        extraData: stock.extraData ? JSON.parse(stock.extraData) : null
      },
      usage: {
        used: apiKeyData.usedGenerations + 1,
        limit: apiKeyData.monthlyGenerations,
        remaining: apiKeyData.monthlyGenerations - (apiKeyData.usedGenerations + 1)
      }
    })
  } catch (error: any) {
    const responseTime = Date.now() - startTime
    await prisma.apiKeyUsageLog.create({
      data: {
        apiKeyId: apiKeyData.id,
        endpoint: '/api/v1/generate',
        ip,
        userAgent,
        success: false,
        errorMessage: error.message,
        responseTime
      }
    })
    console.error('API generation error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
