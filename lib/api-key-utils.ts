import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

// Gerar API key única
export function generateApiKey(): string {
  return `kaizen_${crypto.randomBytes(32).toString('hex')}`
}

// Validar API key e retornar dados
export async function validateApiKey(apiKey: string): Promise<{
  valid: boolean
  apiKeyData?: {
    id: string
    userId: string
    planId: string
    monthlyGenerations: number
    usedGenerations: number
    rateLimit: number
    allowedServiceIds: string[]
    ipWhitelist: string[]
    isActive: boolean
    isCommercial: boolean
    priorityStock: boolean
  }
  error?: string
}> {
  try {
    const key = await prisma.apiKey.findUnique({
      where: { key: apiKey },
      include: { plan: true }
    })

    if (!key) {
      return { valid: false, error: 'Invalid API key' }
    }

    if (!key.isActive) {
      return { valid: false, error: 'API key is inactive' }
    }

    // Verificar se precisa resetar contador mensal
    const now = new Date()
    const lastReset = new Date(key.lastResetAt)
    const shouldReset = 
      now.getMonth() !== lastReset.getMonth() || 
      now.getFullYear() !== lastReset.getFullYear()

    if (shouldReset) {
      await prisma.apiKey.update({
        where: { id: key.id },
        data: {
          usedGenerations: 0,
          lastResetAt: now
        }
      })
      key.usedGenerations = 0
    }

    return {
      valid: true,
      apiKeyData: {
        id: key.id,
        userId: key.userId,
        planId: key.planId,
        monthlyGenerations: key.monthlyGenerations,
        usedGenerations: key.usedGenerations,
        rateLimit: key.rateLimit,
        allowedServiceIds: key.allowedServiceIds,
        ipWhitelist: key.ipWhitelist,
        isActive: key.isActive,
        isCommercial: key.isCommercial,
        priorityStock: key.priorityStock
      }
    }
  } catch (error) {
    console.error('Error validating API key:', error)
    return { valid: false, error: 'Internal error' }
  }
}

// Verificar rate limit (em memória simples - pode ser melhorado com Redis)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(apiKeyId: string, limit: number): {
  allowed: boolean
  remaining: number
  resetAt: number
} {
  const now = Date.now()
  const windowMs = 60 * 1000 // 1 minuto
  const key = `ratelimit:${apiKeyId}`
  
  const current = rateLimitMap.get(key)
  
  if (!current || now > current.resetAt) {
    // Novo window
    rateLimitMap.set(key, {
      count: 1,
      resetAt: now + windowMs
    })
    return {
      allowed: true,
      remaining: limit - 1,
      resetAt: now + windowMs
    }
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: current.resetAt
    }
  }

  current.count++
  return {
    allowed: true,
    remaining: limit - current.count,
    resetAt: current.resetAt
  }
}