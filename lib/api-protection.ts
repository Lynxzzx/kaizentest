/**
 * 🛡️ PROTEÇÃO UNIFICADA CONTRA ABUSO DE APIS
 * 
 * Este módulo fornece proteção contra:
 * - Brute force em redeem de keys
 * - Spam de validação de cupons
 * - Abuso de API de afiliados
 * - Requisições automatizadas em geral
 */

import { NextApiRequest } from 'next'
import { prisma } from './prisma'

// ===========================================
// 📊 CONFIGURAÇÕES
// ===========================================

export const API_PROTECTION_CONFIG = {
  // Key redemption
  KEY_REDEEM_MAX_ATTEMPTS: 5, // Máximo de tentativas por hora
  KEY_REDEEM_BLOCK_MINUTES: 30,
  
  // Coupon validation  
  COUPON_VALIDATE_MAX_ATTEMPTS: 10, // Máximo por hora
  COUPON_VALIDATE_BLOCK_MINUTES: 15,
  
  // Affiliate
  AFFILIATE_REDEEM_MAX_ATTEMPTS: 3, // Máximo por hora
  AFFILIATE_REDEEM_BLOCK_MINUTES: 60,
  
  // Password reset
  PASSWORD_RESET_MAX_ATTEMPTS: 3, // Máximo por hora
  PASSWORD_RESET_BLOCK_MINUTES: 60,
  
  // Generic API
  GENERIC_MAX_REQUESTS_PER_MINUTE: 60,
  GENERIC_BLOCK_MINUTES: 5,
  
  // Suspicious activity threshold
  SUSPICIOUS_THRESHOLD: 10, // Ações suspeitas para trigger bloqueio
}

// ===========================================
// 🗃️ CACHE EM MEMÓRIA
// ===========================================

interface RateLimitEntry {
  attempts: number
  windowStart: number
  blockedUntil?: number
  suspiciousScore: number
  lastRequest: number
}

type RateLimitType = 
  | 'key_redeem' 
  | 'coupon_validate' 
  | 'affiliate_redeem' 
  | 'password_reset'
  | 'generic'

const rateLimitCache: Map<string, RateLimitEntry> = new Map()

// Limpar cache periodicamente
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of rateLimitCache.entries()) {
    // Remover entradas antigas (mais de 2 horas sem atividade)
    if (now - value.lastRequest > 2 * 60 * 60 * 1000) {
      rateLimitCache.delete(key)
    }
  }
}, 30 * 60 * 1000)

// ===========================================
// 🔍 FUNÇÕES AUXILIARES
// ===========================================

/**
 * Obter IP do cliente
 */
export function getClientIp(req: NextApiRequest): string {
  const cfIp = req.headers['cf-connecting-ip']
  const realIp = req.headers['x-real-ip']
  const forwarded = req.headers['x-forwarded-for']
  
  if (cfIp && typeof cfIp === 'string') return cfIp.trim()
  if (realIp && typeof realIp === 'string') return realIp.trim()
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim()
  
  return req.socket?.remoteAddress || 'unknown'
}

/**
 * Obter User-Agent
 */
export function getUserAgent(req: NextApiRequest): string {
  return (req.headers['user-agent'] || '').toLowerCase()
}

/**
 * Verificar se é um bot/automação
 */
export function isBot(userAgent: string): boolean {
  const botPatterns = [
    'bot', 'spider', 'crawler', 'curl', 'wget', 'httpie',
    'postman', 'insomnia', 'axios', 'node-fetch', 'got',
    'request', 'superagent', 'puppeteer', 'playwright',
    'selenium', 'webdriver', 'phantomjs', 'headless', 'electron',
    'python', 'perl', 'ruby', 'php', 'java/'
  ]
  
  for (const pattern of botPatterns) {
    if (userAgent.includes(pattern)) {
      return true
    }
  }
  
  return false
}

/**
 * Obter configuração por tipo
 */
function getConfig(type: RateLimitType) {
  switch (type) {
    case 'key_redeem':
      return {
        maxAttempts: API_PROTECTION_CONFIG.KEY_REDEEM_MAX_ATTEMPTS,
        blockMinutes: API_PROTECTION_CONFIG.KEY_REDEEM_BLOCK_MINUTES,
        windowMinutes: 60
      }
    case 'coupon_validate':
      return {
        maxAttempts: API_PROTECTION_CONFIG.COUPON_VALIDATE_MAX_ATTEMPTS,
        blockMinutes: API_PROTECTION_CONFIG.COUPON_VALIDATE_BLOCK_MINUTES,
        windowMinutes: 60
      }
    case 'affiliate_redeem':
      return {
        maxAttempts: API_PROTECTION_CONFIG.AFFILIATE_REDEEM_MAX_ATTEMPTS,
        blockMinutes: API_PROTECTION_CONFIG.AFFILIATE_REDEEM_BLOCK_MINUTES,
        windowMinutes: 60
      }
    case 'password_reset':
      return {
        maxAttempts: API_PROTECTION_CONFIG.PASSWORD_RESET_MAX_ATTEMPTS,
        blockMinutes: API_PROTECTION_CONFIG.PASSWORD_RESET_BLOCK_MINUTES,
        windowMinutes: 60
      }
    default:
      return {
        maxAttempts: API_PROTECTION_CONFIG.GENERIC_MAX_REQUESTS_PER_MINUTE,
        blockMinutes: API_PROTECTION_CONFIG.GENERIC_BLOCK_MINUTES,
        windowMinutes: 1
      }
  }
}

// ===========================================
// 🎯 FUNÇÃO PRINCIPAL DE RATE LIMITING
// ===========================================

export interface RateLimitResult {
  allowed: boolean
  reason?: string
  remainingAttempts?: number
  retryAfter?: number // segundos
}

/**
 * Verificar rate limit para uma ação específica
 */
export async function checkRateLimit(
  req: NextApiRequest,
  type: RateLimitType,
  identifier?: string // userId, email, etc
): Promise<RateLimitResult> {
  const now = Date.now()
  const ip = getClientIp(req)
  const userAgent = getUserAgent(req)
  const config = getConfig(type)
  
  // Chave única para este limite
  const key = `${type}:${identifier || ip}`
  
  // ===========================================
  // 1. VERIFICAR IP BANIDO
  // ===========================================
  try {
    const bannedIp = await prisma.bannedIp.findUnique({
      where: { ip }
    })
    
    if (bannedIp) {
      if (!bannedIp.expiresAt || bannedIp.expiresAt > new Date()) {
        return {
          allowed: false,
          reason: 'Seu IP foi bloqueado por atividade suspeita.'
        }
      }
    }
  } catch (e) {
    // Ignorar
  }
  
  // ===========================================
  // 2. VERIFICAR SE É BOT
  // ===========================================
  if (isBot(userAgent)) {
    await logSuspiciousActivity(ip, type, 'bot_detected', userAgent)
    return {
      allowed: false,
      reason: 'Requisição bloqueada.'
    }
  }
  
  // ===========================================
  // 3. OBTER OU CRIAR ENTRADA
  // ===========================================
  let entry = rateLimitCache.get(key)
  
  if (!entry) {
    entry = {
      attempts: 0,
      windowStart: now,
      suspiciousScore: 0,
      lastRequest: now
    }
    rateLimitCache.set(key, entry)
  }
  
  // ===========================================
  // 4. VERIFICAR SE ESTÁ BLOQUEADO
  // ===========================================
  if (entry.blockedUntil && entry.blockedUntil > now) {
    const retryAfter = Math.ceil((entry.blockedUntil - now) / 1000)
    return {
      allowed: false,
      reason: `Muitas tentativas. Tente novamente em ${Math.ceil(retryAfter / 60)} minutos.`,
      retryAfter
    }
  }
  
  // ===========================================
  // 5. RESETAR JANELA SE NECESSÁRIO
  // ===========================================
  const windowMs = config.windowMinutes * 60 * 1000
  if (now - entry.windowStart > windowMs) {
    entry.attempts = 0
    entry.windowStart = now
    entry.suspiciousScore = Math.max(0, entry.suspiciousScore - 2)
  }
  
  // ===========================================
  // 6. VERIFICAR VELOCIDADE SUSPEITA
  // ===========================================
  const timeSinceLastRequest = now - entry.lastRequest
  
  // Menos de 100ms é muito suspeito (automação)
  if (timeSinceLastRequest < 100) {
    entry.suspiciousScore += 3
    await logSuspiciousActivity(ip, type, 'too_fast', `${timeSinceLastRequest}ms`)
  } else if (timeSinceLastRequest < 500) {
    entry.suspiciousScore += 1
  }
  
  entry.lastRequest = now
  
  // ===========================================
  // 7. VERIFICAR LIMITE DE TENTATIVAS
  // ===========================================
  entry.attempts++
  
  if (entry.attempts > config.maxAttempts) {
    entry.blockedUntil = now + (config.blockMinutes * 60 * 1000)
    entry.suspiciousScore += 5
    
    await logSuspiciousActivity(ip, type, 'rate_limit_exceeded', `${entry.attempts} tentativas`)
    
    // Se muito suspeito, banir IP temporariamente
    if (entry.suspiciousScore >= API_PROTECTION_CONFIG.SUSPICIOUS_THRESHOLD) {
      try {
        await prisma.bannedIp.upsert({
          where: { ip },
          update: {
            reason: `Rate limit excedido múltiplas vezes (${type})`,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 horas
          },
          create: {
            ip,
            reason: `Rate limit excedido múltiplas vezes (${type})`,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
          }
        })
      } catch (e) {
        // Ignorar
      }
    }
    
    return {
      allowed: false,
      reason: `Limite de tentativas excedido. Tente novamente em ${config.blockMinutes} minutos.`,
      retryAfter: config.blockMinutes * 60
    }
  }
  
  // ===========================================
  // 8. VERIFICAR SCORE DE SUSPEITA
  // ===========================================
  if (entry.suspiciousScore >= API_PROTECTION_CONFIG.SUSPICIOUS_THRESHOLD) {
    entry.blockedUntil = now + (config.blockMinutes * 60 * 1000)
    
    return {
      allowed: false,
      reason: 'Atividade suspeita detectada. Aguarde antes de tentar novamente.'
    }
  }
  
  // Atualizar cache
  rateLimitCache.set(key, entry)
  
  return {
    allowed: true,
    remainingAttempts: config.maxAttempts - entry.attempts
  }
}

/**
 * Registrar tentativa bem-sucedida (reduz suspeita)
 */
export function recordSuccess(type: RateLimitType, identifier: string): void {
  const key = `${type}:${identifier}`
  const entry = rateLimitCache.get(key)
  
  if (entry) {
    entry.suspiciousScore = Math.max(0, entry.suspiciousScore - 1)
    rateLimitCache.set(key, entry)
  }
}

// ===========================================
// 📝 LOGGING
// ===========================================

async function logSuspiciousActivity(
  ip: string,
  type: string,
  reason: string,
  details: string
): Promise<void> {
  try {
    await prisma.securityLog.create({
      data: {
        type: 'rate_limit',
        ip,
        success: false,
        reason: `API ${type}: ${reason}`,
        metadata: JSON.stringify({
          apiType: type,
          reason,
          details,
          timestamp: new Date().toISOString()
        })
      }
    })
  } catch (error) {
    console.error('Erro ao registrar atividade:', error)
  }
}

// ===========================================
// 🛡️ MIDDLEWARE HELPER
// ===========================================

/**
 * Verificação simples para APIs que precisam de proteção básica
 */
export async function simpleRateLimit(
  req: NextApiRequest,
  maxRequests: number = 30,
  windowMinutes: number = 1
): Promise<{ allowed: boolean; error?: string }> {
  const ip = getClientIp(req)
  const userAgent = getUserAgent(req)
  
  // Verificar bot
  if (isBot(userAgent)) {
    return { allowed: false, error: 'Acesso negado.' }
  }
  
  const key = `simple:${ip}:${req.url}`
  const now = Date.now()
  
  let entry = rateLimitCache.get(key)
  
  if (!entry || now - entry.windowStart > windowMinutes * 60 * 1000) {
    entry = {
      attempts: 1,
      windowStart: now,
      suspiciousScore: 0,
      lastRequest: now
    }
    rateLimitCache.set(key, entry)
    return { allowed: true }
  }
  
  entry.attempts++
  entry.lastRequest = now
  
  if (entry.attempts > maxRequests) {
    return { 
      allowed: false, 
      error: 'Muitas requisições. Aguarde um momento.' 
    }
  }
  
  rateLimitCache.set(key, entry)
  return { allowed: true }
}

// ===========================================
// 🔒 VERIFICAÇÃO DE HEADERS DE SEGURANÇA
// ===========================================

/**
 * Verificar se requisição tem headers válidos de navegador
 */
export function hasValidBrowserHeaders(req: NextApiRequest): boolean {
  const requiredHeaders = ['user-agent', 'accept', 'accept-language']
  
  for (const header of requiredHeaders) {
    if (!req.headers[header]) {
      return false
    }
  }
  
  return true
}

/**
 * Verificar origem da requisição
 */
export function isValidOrigin(req: NextApiRequest): boolean {
  const origin = req.headers.origin || req.headers.referer
  
  // Se não tem origin/referer, pode ser requisição direta (suspeito para POST)
  if (req.method === 'POST' && !origin) {
    return false
  }
  
  // Verificar se origin é do próprio site
  if (origin) {
    const allowedOrigins = [
      process.env.NEXTAUTH_URL,
      process.env.NEXT_PUBLIC_APP_URL,
      'http://localhost:3000',
      'https://localhost:3000'
    ].filter(Boolean)
    
    const originHost = new URL(origin).origin
    return allowedOrigins.some(allowed => {
      try {
        return new URL(allowed!).origin === originHost
      } catch {
        return false
      }
    })
  }
  
  return true
}

