/**
 * 🛡️ SISTEMA DE SEGURANÇA ANTI-BOT
 * 
 * Este arquivo contém múltiplas camadas de proteção contra:
 * - Bots de criação automática de contas
 * - Ataques de força bruta
 * - Flood de requisições
 * - Comportamento suspeito
 */

import { NextApiRequest } from 'next'
import { prisma } from './prisma'
import { validateCaptcha } from './captcha'

// ===========================================
// 📊 CONFIGURAÇÕES DE SEGURANÇA
// ===========================================

export const SECURITY_CONFIG = {
  // Rate Limiting - MAIS PERMISSIVO
  MAX_REGISTER_ATTEMPTS_PER_IP: 10,       // Máximo de registros por IP por hora (aumentado)
  MAX_LOGIN_ATTEMPTS_PER_IP: 30,          // Máximo de logins por IP por hora (aumentado)
  MAX_LOGIN_ATTEMPTS_PER_USER: 10,        // Máximo de tentativas por usuário (aumentado)
  BLOCK_DURATION_MINUTES: 10,             // Tempo de bloqueio reduzido
  
  // Tempo mínimo para preencher formulários (segundos) - MENOS RESTRITIVO
  MIN_FORM_FILL_TIME_REGISTER: 1,         // 1 segundo é suficiente
  MIN_FORM_FILL_TIME_LOGIN: 0.5,          // 0.5 segundo para login
  
  // reCAPTCHA - MENOS RESTRITIVO
  RECAPTCHA_MIN_SCORE: 0.3,               // Score mínimo reduzido (0-1)
  
  // Padrões de username suspeitos - APENAS OS MAIS ÓBVIOS
  SUSPICIOUS_USERNAME_PATTERNS: [
    /^(admin|root|system)$/i,             // Apenas nomes reservados exatos
    /^(.)\1{6,}$/,                         // aaaaaaa (repetição de 7+)
  ],
  
  // User Agents bloqueados - APENAS FERRAMENTAS DE AUTOMAÇÃO ÓBVIAS
  BLOCKED_USER_AGENTS: [
    'scrapy', 'selenium', 'phantomjs', 'headlesschrome',
    'sqlmap', 'nikto', 'scanner',
  ],
  
  // Headers obrigatórios - apenas user-agent
  REQUIRED_HEADERS: ['user-agent'],
}

// ===========================================
// 🗃️ ARMAZENAMENTO EM MEMÓRIA (Rate Limiting)
// ===========================================

interface RateLimitEntry {
  count: number
  firstAttempt: number
  blocked: boolean
  blockedUntil?: number
}

// Cache em memória para rate limiting (em produção, usar Redis)
const ipAttempts: Map<string, RateLimitEntry> = new Map()
const userLoginAttempts: Map<string, RateLimitEntry> = new Map()

// Limpar cache periodicamente (a cada hora)
setInterval(() => {
  const now = Date.now()
  const hourAgo = now - (60 * 60 * 1000)
  
  for (const [key, value] of ipAttempts.entries()) {
    if (value.firstAttempt < hourAgo && !value.blocked) {
      ipAttempts.delete(key)
    }
    if (value.blockedUntil && value.blockedUntil < now) {
      ipAttempts.delete(key)
    }
  }
  
  for (const [key, value] of userLoginAttempts.entries()) {
    if (value.firstAttempt < hourAgo && !value.blocked) {
      userLoginAttempts.delete(key)
    }
    if (value.blockedUntil && value.blockedUntil < now) {
      userLoginAttempts.delete(key)
    }
  }
}, 60 * 60 * 1000)

// ===========================================
// 🔍 FUNÇÕES DE EXTRAÇÃO
// ===========================================

/**
 * Extrair IP real do cliente considerando proxies e CDNs
 */
export function getClientIp(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for']
  const realIp = req.headers['x-real-ip']
  const cfConnectingIp = req.headers['cf-connecting-ip'] // Cloudflare
  
  if (cfConnectingIp && typeof cfConnectingIp === 'string') {
    return cfConnectingIp.trim()
  }
  
  if (realIp && typeof realIp === 'string') {
    return realIp.trim()
  }
  
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim()
  }
  
  return req.socket?.remoteAddress || 'unknown'
}

/**
 * Extrair User-Agent normalizado
 */
export function getUserAgent(req: NextApiRequest): string {
  return (req.headers['user-agent'] || '').toLowerCase()
}

// ===========================================
// 🛑 RATE LIMITING
// ===========================================

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetIn: number
  blocked: boolean
  message?: string
}

/**
 * Verificar rate limit para registro
 */
export function checkRegisterRateLimit(ip: string): RateLimitResult {
  const now = Date.now()
  const hourAgo = now - (60 * 60 * 1000)
  const key = `register:${ip}`
  
  let entry = ipAttempts.get(key)
  
  // Verificar se está bloqueado
  if (entry?.blocked && entry.blockedUntil && entry.blockedUntil > now) {
    const resetIn = Math.ceil((entry.blockedUntil - now) / 1000 / 60)
    return {
      allowed: false,
      remaining: 0,
      resetIn,
      blocked: true,
      message: `IP bloqueado por atividade suspeita. Tente novamente em ${resetIn} minutos.`
    }
  }
  
  // Resetar se passou 1 hora
  if (!entry || entry.firstAttempt < hourAgo) {
    entry = { count: 0, firstAttempt: now, blocked: false }
  }
  
  entry.count++
  
  // Verificar limite
  if (entry.count > SECURITY_CONFIG.MAX_REGISTER_ATTEMPTS_PER_IP) {
    entry.blocked = true
    entry.blockedUntil = now + (SECURITY_CONFIG.BLOCK_DURATION_MINUTES * 60 * 1000)
    ipAttempts.set(key, entry)
    
    return {
      allowed: false,
      remaining: 0,
      resetIn: SECURITY_CONFIG.BLOCK_DURATION_MINUTES,
      blocked: true,
      message: `Muitas tentativas de registro. IP bloqueado por ${SECURITY_CONFIG.BLOCK_DURATION_MINUTES} minutos.`
    }
  }
  
  ipAttempts.set(key, entry)
  
  return {
    allowed: true,
    remaining: SECURITY_CONFIG.MAX_REGISTER_ATTEMPTS_PER_IP - entry.count,
    resetIn: Math.ceil((entry.firstAttempt + 60 * 60 * 1000 - now) / 1000 / 60),
    blocked: false
  }
}

/**
 * Verificar rate limit para login
 */
export function checkLoginRateLimit(ip: string, username?: string): RateLimitResult {
  const now = Date.now()
  const hourAgo = now - (60 * 60 * 1000)
  
  // Verificar por IP
  const ipKey = `login:${ip}`
  let ipEntry = ipAttempts.get(ipKey)
  
  if (ipEntry?.blocked && ipEntry.blockedUntil && ipEntry.blockedUntil > now) {
    const resetIn = Math.ceil((ipEntry.blockedUntil - now) / 1000 / 60)
    return {
      allowed: false,
      remaining: 0,
      resetIn,
      blocked: true,
      message: `IP bloqueado por muitas tentativas. Aguarde ${resetIn} minutos.`
    }
  }
  
  if (!ipEntry || ipEntry.firstAttempt < hourAgo) {
    ipEntry = { count: 0, firstAttempt: now, blocked: false }
  }
  
  ipEntry.count++
  
  if (ipEntry.count > SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS_PER_IP) {
    ipEntry.blocked = true
    ipEntry.blockedUntil = now + (SECURITY_CONFIG.BLOCK_DURATION_MINUTES * 60 * 1000)
    ipAttempts.set(ipKey, ipEntry)
    
    return {
      allowed: false,
      remaining: 0,
      resetIn: SECURITY_CONFIG.BLOCK_DURATION_MINUTES,
      blocked: true,
      message: `Muitas tentativas de login deste IP. Bloqueado por ${SECURITY_CONFIG.BLOCK_DURATION_MINUTES} minutos.`
    }
  }
  
  ipAttempts.set(ipKey, ipEntry)
  
  // Verificar por usuário
  if (username) {
    const userKey = `user:${username.toLowerCase()}`
    let userEntry = userLoginAttempts.get(userKey)
    
    if (userEntry?.blocked && userEntry.blockedUntil && userEntry.blockedUntil > now) {
      const resetIn = Math.ceil((userEntry.blockedUntil - now) / 1000 / 60)
      return {
        allowed: false,
        remaining: 0,
        resetIn,
        blocked: true,
        message: `Conta temporariamente bloqueada. Aguarde ${resetIn} minutos ou redefina sua senha.`
      }
    }
    
    if (!userEntry || userEntry.firstAttempt < hourAgo) {
      userEntry = { count: 0, firstAttempt: now, blocked: false }
    }
    
    userEntry.count++
    
    if (userEntry.count > SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS_PER_USER) {
      userEntry.blocked = true
      userEntry.blockedUntil = now + (SECURITY_CONFIG.BLOCK_DURATION_MINUTES * 60 * 1000)
      userLoginAttempts.set(userKey, userEntry)
      
      return {
        allowed: false,
        remaining: 0,
        resetIn: SECURITY_CONFIG.BLOCK_DURATION_MINUTES,
        blocked: true,
        message: `Muitas tentativas de login nesta conta. Bloqueada por ${SECURITY_CONFIG.BLOCK_DURATION_MINUTES} minutos.`
      }
    }
    
    userLoginAttempts.set(userKey, userEntry)
  }
  
  return {
    allowed: true,
    remaining: SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS_PER_IP - ipEntry.count,
    resetIn: Math.ceil((ipEntry.firstAttempt + 60 * 60 * 1000 - now) / 1000 / 60),
    blocked: false
  }
}

/**
 * Resetar tentativas de login após sucesso
 */
export function resetLoginAttempts(ip: string, username: string): void {
  const ipKey = `login:${ip}`
  const userKey = `user:${username.toLowerCase()}`
  
  ipAttempts.delete(ipKey)
  userLoginAttempts.delete(userKey)
}

// ===========================================
// 🤖 DETECÇÃO DE BOT
// ===========================================

interface BotDetectionResult {
  isBot: boolean
  score: number // 0 = definitivamente humano, 100 = definitivamente bot
  reasons: string[]
}

/**
 * Analisar request para detectar comportamento de bot
 */
export function detectBot(
  req: NextApiRequest,
  formStartTime?: number,
  formType: 'login' | 'register' = 'register'
): BotDetectionResult {
  const reasons: string[] = []
  let score = 0
  
  const userAgent = getUserAgent(req)
  const headers = req.headers
  
  // 1. Verificar User-Agent bloqueado
  for (const blocked of SECURITY_CONFIG.BLOCKED_USER_AGENTS) {
    if (userAgent.includes(blocked)) {
      reasons.push(`User-Agent suspeito: ${blocked}`)
      score += 50
    }
  }
  
  // 2. User-Agent vazio ou muito curto
  if (!userAgent || userAgent.length < 20) {
    reasons.push('User-Agent ausente ou muito curto')
    score += 30
  }
  
  // 3. Falta de headers esperados de navegadores
  if (!headers['accept-language']) {
    reasons.push('Header Accept-Language ausente')
    score += 15
  }
  
  if (!headers['accept']) {
    reasons.push('Header Accept ausente')
    score += 10
  }
  
  // 4. Headers suspeitos
  if (headers['x-requested-with'] && headers['x-requested-with'] !== 'XMLHttpRequest') {
    reasons.push('Header X-Requested-With suspeito')
    score += 10
  }
  
  // 5. Verificar tempo de preenchimento do formulário
  if (formStartTime) {
    const now = Date.now()
    const fillTime = (now - formStartTime) / 1000 // em segundos
    const minFillTime =
      formType === 'login'
        ? SECURITY_CONFIG.MIN_FORM_FILL_TIME_LOGIN
        : SECURITY_CONFIG.MIN_FORM_FILL_TIME_REGISTER

    if (fillTime < minFillTime) {
      reasons.push(`Formulário preenchido muito rápido: ${fillTime.toFixed(1)}s`)
      score += formType === 'login' ? 20 : 40
    }
  }
  
  // 6. Verificar se é um navegador headless
  if (userAgent.includes('headlesschrome') || userAgent.includes('phantomjs')) {
    reasons.push('Navegador headless detectado')
    score += 60
  }
  
  // 7. Verificar padrões de Selenium/WebDriver
  if (headers['sec-ch-ua'] === '' || headers['sec-ch-ua-mobile'] === '') {
    reasons.push('Headers de Client Hints suspeitos')
    score += 10
  }
  
  return {
    isBot: score >= 50,
    score: Math.min(score, 100),
    reasons
  }
}

// ===========================================
// 🍯 HONEYPOT VALIDATION
// ===========================================

/**
 * Verificar campo honeypot (deve estar vazio)
 */
export function validateHoneypot(value: string | undefined | null): boolean {
  // Se o honeypot foi preenchido, é um bot
  if (value && value.trim().length > 0) {
    return false
  }
  return true
}

// ===========================================
// 👤 VALIDAÇÃO DE USERNAME
// ===========================================

interface UsernameValidationResult {
  valid: boolean
  suspicious: boolean
  reason?: string
}

/**
 * Validar username contra padrões suspeitos
 */
export function validateUsername(username: string): UsernameValidationResult {
  if (!username || username.length < 3) {
    return { valid: false, suspicious: false, reason: 'Username muito curto' }
  }
  
  if (username.length > 30) {
    return { valid: false, suspicious: false, reason: 'Username muito longo' }
  }
  
  // Apenas letras, números e underscore
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { valid: false, suspicious: false, reason: 'Username contém caracteres inválidos' }
  }
  
  // Verificar padrões suspeitos
  for (const pattern of SECURITY_CONFIG.SUSPICIOUS_USERNAME_PATTERNS) {
    if (pattern.test(username)) {
      return {
        valid: true,
        suspicious: true,
        reason: 'Username com padrão suspeito de bot'
      }
    }
  }
  
  return { valid: true, suspicious: false }
}

// ===========================================
// 🔐 RECAPTCHA VERIFICATION
// ===========================================

interface RecaptchaResult {
  success: boolean
  score?: number
  action?: string
  errorCodes?: string[]
}

/**
 * Verificar token Cloudflare Turnstile
 */
export async function verifyTurnstile(token: string): Promise<RecaptchaResult> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY
  
  if (!secretKey) {
    console.warn('⚠️ TURNSTILE_SECRET_KEY não configurada')
    // Em desenvolvimento, permitir sem CAPTCHA
    if (process.env.NODE_ENV === 'development') {
      return { success: true }
    }
    return { success: false, errorCodes: ['missing-secret-key'] }
  }
  
  if (!token) {
    return { success: false, errorCodes: ['missing-input-response'] }
  }
  
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        secret: secretKey,
        response: token
      }),
    })
    
    const data = await response.json()
    
    if (!data.success) {
      return {
        success: false,
        errorCodes: data['error-codes'] || ['unknown-error']
      }
    }
    
    return { success: true }
  } catch (error) {
    console.error('Erro ao verificar Turnstile:', error)
    return { success: false, errorCodes: ['network-error'] }
  }
}

/**
 * Verificar token reCAPTCHA v2 (checkbox) com o Google (DEPRECATED - usar verifyTurnstile)
 * Mantido para compatibilidade
 */
export async function verifyRecaptchaV2(token: string): Promise<RecaptchaResult> {
  // Tentar usar Turnstile primeiro
  const turnstileKey = process.env.TURNSTILE_SECRET_KEY
  if (turnstileKey) {
    return verifyTurnstile(token)
  }
  
  // Fallback para reCAPTCHA se Turnstile não estiver configurado
  const secretKey = process.env.RECAPTCHA_V2_SECRET_KEY
  
  if (!secretKey) {
    console.warn('⚠️ RECAPTCHA_V2_SECRET_KEY não configurada')
    // Em desenvolvimento, permitir sem CAPTCHA
    if (process.env.NODE_ENV === 'development') {
      return { success: true }
    }
    return { success: false, errorCodes: ['missing-secret-key'] }
  }
  
  if (!token) {
    return { success: false, errorCodes: ['missing-input-response'] }
  }
  
  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `secret=${secretKey}&response=${token}`,
    })
    
    const data = await response.json()
    
    if (!data.success) {
      return {
        success: false,
        errorCodes: data['error-codes'] || ['unknown-error']
      }
    }
    
    return { success: true }
  } catch (error) {
    console.error('Erro ao verificar reCAPTCHA v2:', error)
    return { success: false, errorCodes: ['network-error'] }
  }
}

/**
 * Verificar token reCAPTCHA v3 (invisível) com o Google
 */
export async function verifyRecaptcha(token: string, expectedAction: string): Promise<RecaptchaResult> {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY
  
  if (!secretKey) {
    console.warn('⚠️ RECAPTCHA_SECRET_KEY não configurada - CAPTCHA desativado')
    // Em desenvolvimento, permitir sem CAPTCHA
    if (process.env.NODE_ENV === 'development') {
      return { success: true, score: 1 }
    }
    // Em produção, falhar se não configurado
    return { success: false, errorCodes: ['missing-secret-key'] }
  }
  
  if (!token) {
    return { success: false, errorCodes: ['missing-input-response'] }
  }
  
  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `secret=${secretKey}&response=${token}`,
    })
    
    const data = await response.json()
    
    if (!data.success) {
      return {
        success: false,
        errorCodes: data['error-codes'] || ['unknown-error']
      }
    }
    
    // Verificar score (reCAPTCHA v3)
    if (data.score !== undefined && data.score < SECURITY_CONFIG.RECAPTCHA_MIN_SCORE) {
      return {
        success: false,
        score: data.score,
        action: data.action,
        errorCodes: ['low-score']
      }
    }
    
    // Action divergente: log apenas (evita bloquear usuários legítimos)
    if (expectedAction && data.action && data.action !== expectedAction) {
      console.warn(
        `⚠️ reCAPTCHA action mismatch: esperado "${expectedAction}", recebido "${data.action}"`
      )
    }

    return {
      success: true,
      score: data.score,
      action: data.action
    }
  } catch (error) {
    console.error('Erro ao verificar reCAPTCHA:', error)
    return { success: false, errorCodes: ['network-error'] }
  }
}

// ===========================================
// 📝 LOGGING DE SEGURANÇA
// ===========================================

interface SecurityEvent {
  type: 'register_attempt' | 'login_attempt' | 'bot_detected' | 'rate_limit' | 'blocked'
  ip: string
  userAgent?: string
  username?: string
  success: boolean
  reason?: string
  metadata?: Record<string, any>
}

/**
 * Registrar evento de segurança no banco de dados
 */
export async function logSecurityEvent(event: SecurityEvent): Promise<void> {
  try {
    // Tentar salvar no banco de dados
    await prisma.securityLog.create({
      data: {
        type: event.type,
        ip: event.ip,
        userAgent: event.userAgent || null,
        username: event.username || null,
        success: event.success,
        reason: event.reason || null,
        metadata: event.metadata ? JSON.stringify(event.metadata) : null,
        createdAt: new Date()
      }
    }).catch(() => {
      // Se a tabela não existir, apenas log no console
      console.log('🔒 Security Event:', JSON.stringify(event))
    })
  } catch (error) {
    // Fallback para console
    console.log('🔒 Security Event:', JSON.stringify(event))
  }
}

// ===========================================
// 🎯 FUNÇÃO PRINCIPAL DE VALIDAÇÃO
// ===========================================

export interface SecurityCheckResult {
  allowed: boolean
  reason?: string
  warnings: string[]
  botScore: number
  recaptchaScore?: number
}

/**
 * Verificação completa de segurança para registro
 */
export async function validateRegisterRequest(
  req: NextApiRequest,
  data: {
    username: string
    recaptchaToken?: string
    captchaId?: string
    captchaCode?: string
    honeypot?: string
    formStartTime?: number
  }
): Promise<SecurityCheckResult> {
  const warnings: string[] = []
  const ip = getClientIp(req)
  const userAgent = getUserAgent(req)
  
  // 0. Verificar se IP está banido permanentemente
  const ipBanCheck = await isIpBanned(ip)
  if (ipBanCheck.banned) {
    await logSecurityEvent({
      type: 'blocked',
      ip,
      userAgent,
      username: data.username,
      success: false,
      reason: `IP banido: ${ipBanCheck.reason}`
    })
    
    return {
      allowed: false,
      reason: `Seu IP foi banido. Motivo: ${ipBanCheck.reason}`,
      warnings: [],
      botScore: 100
    }
  }
  
  // 1. Rate Limiting
  const rateLimit = checkRegisterRateLimit(ip)
  if (!rateLimit.allowed) {
    await logSecurityEvent({
      type: 'rate_limit',
      ip,
      userAgent,
      username: data.username,
      success: false,
      reason: rateLimit.message
    })
    
    return {
      allowed: false,
      reason: rateLimit.message,
      warnings: [],
      botScore: 100
    }
  }
  
  // 2. Honeypot
  if (!validateHoneypot(data.honeypot)) {
    await logSecurityEvent({
      type: 'bot_detected',
      ip,
      userAgent,
      username: data.username,
      success: false,
      reason: 'Honeypot preenchido'
    })
    
    return {
      allowed: false,
      reason: 'Atividade suspeita detectada. Por favor, tente novamente.',
      warnings: [],
      botScore: 100
    }
  }
  
  // 3. Detecção de Bot
  const botCheck = detectBot(req, data.formStartTime)
  if (botCheck.isBot) {
    await logSecurityEvent({
      type: 'bot_detected',
      ip,
      userAgent,
      username: data.username,
      success: false,
      reason: botCheck.reasons.join('; '),
      metadata: { score: botCheck.score }
    })
    
    return {
      allowed: false,
      reason: 'Comportamento automatizado detectado. Por favor, use um navegador comum.',
      warnings: botCheck.reasons,
      botScore: botCheck.score
    }
  }
  
  // 4. Validação de Username
  const usernameCheck = validateUsername(data.username)
  if (!usernameCheck.valid) {
    return {
      allowed: false,
      reason: usernameCheck.reason,
      warnings: [],
      botScore: 0
    }
  }
  
  if (usernameCheck.suspicious) {
    warnings.push('Username com padrão suspeito')
  }
  
  // 5. Google reCAPTCHA v3 (invisível)
  let recaptchaScore: number | undefined
  if (data.recaptchaToken) {
    const recaptchaResult = await verifyRecaptcha(data.recaptchaToken, 'register')
    recaptchaScore = recaptchaResult.score
    
    if (!recaptchaResult.success) {
      await logSecurityEvent({
        type: 'bot_detected',
        ip,
        userAgent,
        username: data.username,
        success: false,
        reason: 'reCAPTCHA v3 falhou',
        metadata: { errorCodes: recaptchaResult.errorCodes, score: recaptchaResult.score }
      })
      
      return {
        allowed: false,
        reason: 'Verificação de segurança falhou. Por favor, tente novamente.',
        warnings: [],
        botScore: 80,
        recaptchaScore
      }
    }
    // reCAPTCHA v3 passou - sucesso!
  } else if (data.captchaId && data.captchaCode) {
    // Fallback: Validar CAPTCHA Visual
    const captchaResult = await validateCaptcha(data.captchaId, data.captchaCode)
    if (!captchaResult.valid) {
      await logSecurityEvent({
        type: 'bot_detected',
        ip,
        userAgent,
        username: data.username,
        success: false,
        reason: `CAPTCHA Visual falhou: ${captchaResult.error}`
      })

      return {
        allowed: false,
        reason: captchaResult.error || 'Verificação de segurança falhou.',
        warnings: [],
        botScore: 40
      }
    }
    // CAPTCHA Visual passou!
  } else if (process.env.RECAPTCHA_SECRET_KEY && process.env.NODE_ENV === 'production') {
    // reCAPTCHA obrigatório em produção se configurado
    return {
      allowed: false,
      reason: 'Verificação de segurança obrigatória.',
      warnings: [],
      botScore: 50
    }
  }
  
  // Registro de tentativa bem-sucedida (validações passaram)
  await logSecurityEvent({
    type: 'register_attempt',
    ip,
    userAgent,
    username: data.username,
    success: true,
    metadata: {
      botScore: botCheck.score,
      recaptchaScore,
      warnings
    }
  })
  
  return {
    allowed: true,
    warnings,
    botScore: botCheck.score,
    recaptchaScore
  }
}

/**
 * Verificação completa de segurança para login
 */
export async function validateLoginRequest(
  req: NextApiRequest,
  data: {
    username: string
    recaptchaToken?: string
    captchaId?: string
    captchaCode?: string
    honeypot?: string
    formStartTime?: number
  }
): Promise<SecurityCheckResult> {
  const warnings: string[] = []
  const ip = getClientIp(req)
  const userAgent = getUserAgent(req)
  
  // 0. Verificar se IP está banido permanentemente
  const ipBanCheck = await isIpBanned(ip)
  if (ipBanCheck.banned) {
    await logSecurityEvent({
      type: 'blocked',
      ip,
      userAgent,
      username: data.username,
      success: false,
      reason: `IP banido: ${ipBanCheck.reason}`
    })
    
    return {
      allowed: false,
      reason: `Seu IP foi banido. Motivo: ${ipBanCheck.reason}`,
      warnings: [],
      botScore: 100
    }
  }
  
  // 1. Rate Limiting
  const rateLimit = checkLoginRateLimit(ip, data.username)
  if (!rateLimit.allowed) {
    await logSecurityEvent({
      type: 'blocked',
      ip,
      userAgent,
      username: data.username,
      success: false,
      reason: rateLimit.message
    })
    
    return {
      allowed: false,
      reason: rateLimit.message,
      warnings: [],
      botScore: 100
    }
  }
  
  // 2. Honeypot
  if (!validateHoneypot(data.honeypot)) {
    await logSecurityEvent({
      type: 'bot_detected',
      ip,
      userAgent,
      username: data.username,
      success: false,
      reason: 'Honeypot preenchido'
    })
    
    return {
      allowed: false,
      reason: 'Verificação de segurança falhou.',
      warnings: [],
      botScore: 100
    }
  }
  
  // 3. Detecção básica de Bot
  const botCheck = detectBot(req, data.formStartTime, 'login')
  if (botCheck.score >= 70) { // Threshold mais alto para login
    await logSecurityEvent({
      type: 'bot_detected',
      ip,
      userAgent,
      username: data.username,
      success: false,
      reason: botCheck.reasons.join('; ')
    })
    
    return {
      allowed: false,
      reason: 'Comportamento suspeito detectado.',
      warnings: [],
      botScore: botCheck.score
    }
  }
  
  // 4. (Removido) CAPTCHAs não são mais necessários no login
  
  return {
    allowed: true,
    warnings,
    botScore: botCheck.score,
  }
}

// ===========================================
// 🚫 VERIFICAÇÃO DE IP BANIDO
// ===========================================

/**
 * Verificar se um IP está banido permanentemente
 */
export async function isIpBanned(ip: string): Promise<{ banned: boolean; reason?: string; expiresAt?: Date }> {
  try {
    const bannedIp = await prisma.bannedIp.findUnique({
      where: { ip }
    })
    
    if (!bannedIp) {
      return { banned: false }
    }
    
    // Verificar se o banimento expirou
    if (bannedIp.expiresAt && bannedIp.expiresAt < new Date()) {
      // Banimento expirou, remover
      await prisma.bannedIp.delete({
        where: { ip }
      }).catch(() => {})
      
      return { banned: false }
    }
    
    return {
      banned: true,
      reason: bannedIp.reason,
      expiresAt: bannedIp.expiresAt || undefined
    }
  } catch (error) {
    console.error('Erro ao verificar IP banido:', error)
    return { banned: false }
  }
}

/**
 * Banir um IP
 */
export async function banIp(
  ip: string, 
  reason: string, 
  bannedById?: string,
  durationHours?: number
): Promise<boolean> {
  try {
    let expiresAt: Date | null = null
    if (durationHours && durationHours > 0) {
      expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + durationHours)
    }
    
    await prisma.bannedIp.create({
      data: {
        ip,
        reason,
        bannedById: bannedById || null,
        expiresAt
      }
    })
    
    // Também limpar do cache de rate limiting
    clearBlockedIp(ip)
    
    return true
  } catch (error) {
    console.error('Erro ao banir IP:', error)
    return false
  }
}

/**
 * Desbanir um IP
 */
export async function unbanIp(ip: string): Promise<boolean> {
  try {
    await prisma.bannedIp.delete({
      where: { ip }
    })
    
    // Também limpar do cache de rate limiting
    clearBlockedIp(ip)
    
    return true
  } catch (error) {
    console.error('Erro ao desbanir IP:', error)
    return false
  }
}

// ===========================================
// 🧹 UTILITÁRIOS
// ===========================================

/**
 * Limpar IPs bloqueados manualmente (para admin)
 */
export function clearBlockedIp(ip: string): void {
  const registerKey = `register:${ip}`
  const loginKey = `login:${ip}`
  
  ipAttempts.delete(registerKey)
  ipAttempts.delete(loginKey)
}

/**
 * Listar todos os IPs bloqueados (para admin)
 */
export function getBlockedIps(): { ip: string; type: string; blockedUntil: Date }[] {
  const blocked: { ip: string; type: string; blockedUntil: Date }[] = []
  const now = Date.now()
  
  for (const [key, value] of ipAttempts.entries()) {
    if (value.blocked && value.blockedUntil && value.blockedUntil > now) {
      const [type, ip] = key.split(':')
      blocked.push({
        ip,
        type,
        blockedUntil: new Date(value.blockedUntil)
      })
    }
  }
  
  return blocked
}

