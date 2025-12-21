/**
 * 🛡️ PROTEÇÃO CONTRA EXTRAÇÃO AUTOMATIZADA DE ESTOQUE
 * 
 * Este módulo implementa múltiplas camadas de proteção contra:
 * - Extensões de navegador que extraem contas
 * - Scripts automatizados
 * - Bots de geração em massa
 * - Requisições simultâneas
 */

import { NextApiRequest } from 'next'
import { prisma } from './prisma'

// ===========================================
// 📊 CONFIGURAÇÕES DE PROTEÇÃO
// ===========================================

export const GENERATION_PROTECTION = {
  // Cooldown entre gerações (em segundos)
  COOLDOWN_SECONDS: 120, // 2 minutos
  
  // Rate limiting - MAIS PERMISSIVO para usuários legítimos
  MAX_GENERATIONS_PER_HOUR: 60, // Máximo por hora (aumentado)
  MAX_GENERATIONS_PER_MINUTE: 5, // Máximo por minuto (aumentado)
  MAX_GENERATIONS_PER_DAY: 500, // Máximo por dia (aumentado)
  
  // Detecção de automação - MENOS SENSÍVEL (evitar falsos positivos)
  MIN_TIME_BETWEEN_REQUESTS_MS: 200, // 200ms é suficiente para detectar bots extremos
  SUSPICIOUS_SPEED_THRESHOLD_MS: 500, // Requisições mais rápidas que 500ms são suspeitas
  
  // Bloqueio - MAIS LEVE (usuários legítimos não devem sofrer muito)
  MAX_SUSPICIOUS_ACTIONS: 10, // Após 10 ações suspeitas, bloquear
  BLOCK_DURATION_MINUTES: 15, // Tempo de bloqueio de apenas 15 minutos
  
  // Headers obrigatórios - apenas os essenciais
  REQUIRED_HEADERS: ['user-agent', 'accept'],
  
  // User agents bloqueados (apenas ferramentas de automação conhecidas)
  BLOCKED_USER_AGENTS: [
    // Ferramentas de linha de comando
    'curl/', 'wget/', 'httpie',
    // Automação de navegador real (não todos os clientes HTTP)
    'puppeteer', 'playwright', 'selenium', 'webdriver', 'chromedriver',
    'geckodriver', 'phantomjs', 'headlesschrome',
    // Scanners e crawlers maliciosos
    'scrapy', 'scanner', 'sqlmap', 'nikto'
  ],
  
  // Padrões suspeitos em User-Agent - apenas os mais óbvios
  SUSPICIOUS_UA_PATTERNS: [
    /HeadlessChrome/i,
    /PhantomJS/i
  ]
}

// ===========================================
// 🗃️ CACHE EM MEMÓRIA
// ===========================================

interface UserGenerationState {
  lastGeneration: number
  generationsThisMinute: number
  generationsThisHour: number
  generationsThisDay: number
  minuteStart: number
  hourStart: number
  dayStart: number
  suspiciousActions: number
  blockedUntil?: number
  lastRequestTime: number
  requestCount: number
  isProcessing: boolean // Flag para bloquear requisições simultâneas
  consecutiveRequests: number // Requisições consecutivas sem intervalo adequado
}

const userGenerationState: Map<string, UserGenerationState> = new Map()

// Limpar cache periodicamente
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of userGenerationState.entries()) {
    // Remover entradas antigas (mais de 2 horas sem atividade)
    if (now - value.lastRequestTime > 2 * 60 * 60 * 1000) {
      userGenerationState.delete(key)
    }
  }
}, 30 * 60 * 1000) // A cada 30 minutos

// ===========================================
// 🔍 FUNÇÕES DE VERIFICAÇÃO
// ===========================================

/**
 * Obter IP do cliente
 */
function getClientIp(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for']
  const realIp = req.headers['x-real-ip']
  const cfIp = req.headers['cf-connecting-ip']
  
  if (cfIp && typeof cfIp === 'string') return cfIp.trim()
  if (realIp && typeof realIp === 'string') return realIp.trim()
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim()
  
  return req.socket?.remoteAddress || 'unknown'
}

/**
 * Obter User-Agent
 */
function getUserAgent(req: NextApiRequest): string {
  return (req.headers['user-agent'] || '').toLowerCase()
}

/**
 * Verificar se User-Agent é suspeito
 * NOTA: Menos restritivo para evitar falsos positivos
 */
function isSuspiciousUserAgent(userAgent: string): boolean {
  // Permitir user agents vazios em desenvolvimento
  if (!userAgent && process.env.NODE_ENV === 'development') {
    return false
  }
  
  // Verificar palavras bloqueadas (apenas automação óbvia)
  for (const blocked of GENERATION_PROTECTION.BLOCKED_USER_AGENTS) {
    if (userAgent.includes(blocked)) {
      return true
    }
  }
  
  // Verificar padrões suspeitos via regex
  for (const pattern of GENERATION_PROTECTION.SUSPICIOUS_UA_PATTERNS) {
    if (pattern.test(userAgent)) {
      return true
    }
  }
  
  // User agent muito curto (< 15 chars) é suspeito
  // Mas permitir mobile e outros navegadores
  if (userAgent.length < 15 && userAgent.length > 0) {
    return true
  }
  
  return false
}

/**
 * Verificar headers obrigatórios
 */
function hasRequiredHeaders(req: NextApiRequest): boolean {
  for (const header of GENERATION_PROTECTION.REQUIRED_HEADERS) {
    if (!req.headers[header]) {
      return false
    }
  }
  return true
}

/**
 * Obter ou criar estado do usuário
 */
function getUserState(userId: string): UserGenerationState {
  const now = Date.now()
  let state = userGenerationState.get(userId)
  
  if (!state) {
    state = {
      lastGeneration: 0,
      generationsThisMinute: 0,
      generationsThisHour: 0,
      generationsThisDay: 0,
      minuteStart: now,
      hourStart: now,
      dayStart: now,
      suspiciousActions: 0,
      lastRequestTime: 0, // Inicializar como 0 para permitir primeira requisição
      requestCount: 0,
      isProcessing: false,
      consecutiveRequests: 0
    }
    userGenerationState.set(userId, state)
  }
  
  // Resetar contadores se necessário
  if (now - state.minuteStart > 60 * 1000) {
    state.generationsThisMinute = 0
    state.minuteStart = now
    state.consecutiveRequests = 0 // Resetar requisições consecutivas
  }
  
  if (now - state.hourStart > 60 * 60 * 1000) {
    state.generationsThisHour = 0
    state.hourStart = now
    state.suspiciousActions = Math.max(0, state.suspiciousActions - 2) // Reduzir suspeitas com o tempo
  }
  
  // Resetar contador diário
  if (now - state.dayStart > 24 * 60 * 60 * 1000) {
    state.generationsThisDay = 0
    state.dayStart = now
    state.suspiciousActions = 0 // Resetar suspeitas no dia
  }
  
  return state
}

// ===========================================
// 🎯 FUNÇÃO PRINCIPAL DE PROTEÇÃO
// ===========================================

export interface GenerationProtectionResult {
  allowed: boolean
  reason?: string
  cooldownRemaining?: number // segundos restantes
  shouldBan?: boolean
  suspiciousLevel: number // 0-100
}

/**
 * Verificar se a geração é permitida
 */
export async function checkGenerationAllowed(
  req: NextApiRequest,
  userId: string
): Promise<GenerationProtectionResult> {
  const now = Date.now()
  const ip = getClientIp(req)
  const userAgent = getUserAgent(req)
  
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
          reason: 'Seu IP foi banido por atividade suspeita.',
          suspiciousLevel: 100
        }
      }
    }
  } catch (e) {
    // Ignorar erro se tabela não existir
  }
  
  // ===========================================
  // 2. VERIFICAR USER-AGENT SUSPEITO
  // ===========================================
  if (isSuspiciousUserAgent(userAgent)) {
    await logSuspiciousActivity(userId, ip, 'suspicious_user_agent', userAgent)
    return {
      allowed: false,
      reason: 'Requisição bloqueada. Use um navegador comum.',
      suspiciousLevel: 80,
      shouldBan: true
    }
  }
  
  // ===========================================
  // 3. VERIFICAR HEADERS OBRIGATÓRIOS
  // ===========================================
  if (!hasRequiredHeaders(req)) {
    await logSuspiciousActivity(userId, ip, 'missing_headers', '')
    return {
      allowed: false,
      reason: 'Requisição inválida.',
      suspiciousLevel: 60
    }
  }
  
  // ===========================================
  // 4. OBTER ESTADO DO USUÁRIO
  // ===========================================
  const state = getUserState(userId)
  
  // ===========================================
  // 5. VERIFICAR SE ESTÁ BLOQUEADO
  // ===========================================
  if (state.blockedUntil && state.blockedUntil > now) {
    const remainingMinutes = Math.ceil((state.blockedUntil - now) / 1000 / 60)
    return {
      allowed: false,
      reason: `Você está temporariamente bloqueado. Aguarde ${remainingMinutes} minutos.`,
      suspiciousLevel: 100
    }
  }
  
  // ===========================================
  // 6. VERIFICAR REQUISIÇÃO SIMULTÂNEA
  // ===========================================
  if (state.isProcessing) {
    state.suspiciousActions++
    await logSuspiciousActivity(userId, ip, 'simultaneous_request', '')
    return {
      allowed: false,
      reason: 'Aguarde a geração anterior ser concluída.',
      suspiciousLevel: 70
    }
  }
  
  // ===========================================
  // 7. VERIFICAR VELOCIDADE SUSPEITA
  // ===========================================
  // Se lastRequestTime é 0, é a primeira requisição - sempre permitir
  const isFirstRequest = state.lastRequestTime === 0 || state.requestCount === 0
  const timeSinceLastRequest = isFirstRequest ? Infinity : (now - state.lastRequestTime)
  
  // Só verificar velocidade se já houve uma requisição anterior (não é a primeira)
  if (!isFirstRequest && timeSinceLastRequest < GENERATION_PROTECTION.MIN_TIME_BETWEEN_REQUESTS_MS) {
    state.suspiciousActions += 2
    await logSuspiciousActivity(userId, ip, 'too_fast', `${timeSinceLastRequest}ms`)
    
    // Bloquear após muitas ações suspeitas
    if (state.suspiciousActions >= GENERATION_PROTECTION.MAX_SUSPICIOUS_ACTIONS) {
      state.blockedUntil = now + (GENERATION_PROTECTION.BLOCK_DURATION_MINUTES * 60 * 1000)
      return {
        allowed: false,
        reason: 'Atividade automatizada detectada. Você foi bloqueado temporariamente.',
        suspiciousLevel: 100,
        shouldBan: true
      }
    }
    
    return {
      allowed: false,
      reason: 'Muitas requisições. Aguarde um momento.',
      suspiciousLevel: 50
    }
  }
  
  // Marcar como suspeito se muito rápido (mas não bloquear) - apenas se não for primeira requisição
  if (!isFirstRequest && timeSinceLastRequest < GENERATION_PROTECTION.SUSPICIOUS_SPEED_THRESHOLD_MS) {
    state.suspiciousActions++
  }
  
  // ===========================================
  // 8. VERIFICAR COOLDOWN DE 2 MINUTOS
  // ===========================================
  const timeSinceLastGeneration = now - state.lastGeneration
  const cooldownMs = GENERATION_PROTECTION.COOLDOWN_SECONDS * 1000
  
  if (state.lastGeneration > 0 && timeSinceLastGeneration < cooldownMs) {
    const remainingSeconds = Math.ceil((cooldownMs - timeSinceLastGeneration) / 1000)
    return {
      allowed: false,
      reason: `Aguarde ${remainingSeconds} segundos antes de gerar novamente.`,
      cooldownRemaining: remainingSeconds,
      suspiciousLevel: 0 // Cooldown normal não é suspeito
    }
  }
  
  // ===========================================
  // 9. VERIFICAR RATE LIMITING POR MINUTO
  // ===========================================
  if (state.generationsThisMinute >= GENERATION_PROTECTION.MAX_GENERATIONS_PER_MINUTE) {
    state.suspiciousActions++
    return {
      allowed: false,
      reason: 'Limite de gerações por minuto atingido. Aguarde.',
      suspiciousLevel: 40
    }
  }
  
  // ===========================================
  // 10. VERIFICAR RATE LIMITING POR HORA
  // ===========================================
  if (state.generationsThisHour >= GENERATION_PROTECTION.MAX_GENERATIONS_PER_HOUR) {
    return {
      allowed: false,
      reason: 'Limite de gerações por hora atingido. Aguarde.',
      suspiciousLevel: 20
    }
  }
  
  // ===========================================
  // 10.5. VERIFICAR RATE LIMITING DIÁRIO
  // ===========================================
  if (state.generationsThisDay >= GENERATION_PROTECTION.MAX_GENERATIONS_PER_DAY) {
    return {
      allowed: false,
      reason: 'Limite de gerações diárias atingido. Aguarde até amanhã.',
      suspiciousLevel: 10
    }
  }
  
  // ===========================================
  // 11. VERIFICAR AÇÕES SUSPEITAS ACUMULADAS
  // ===========================================
  if (state.suspiciousActions >= GENERATION_PROTECTION.MAX_SUSPICIOUS_ACTIONS) {
    state.blockedUntil = now + (GENERATION_PROTECTION.BLOCK_DURATION_MINUTES * 60 * 1000)
    await logSuspiciousActivity(userId, ip, 'max_suspicious_reached', `${state.suspiciousActions} ações`)
    return {
      allowed: false,
      reason: 'Muitas ações suspeitas detectadas. Bloqueio temporário aplicado.',
      suspiciousLevel: 100,
      shouldBan: true
    }
  }
  
  // Atualizar tempo da última requisição
  state.lastRequestTime = now
  state.requestCount++
  
  // Geração permitida
  return {
    allowed: true,
    suspiciousLevel: Math.min(state.suspiciousActions * 15, 100)
  }
}

/**
 * Marcar início de processamento (bloqueia requisições simultâneas)
 */
export function startGeneration(userId: string): void {
  const state = getUserState(userId)
  state.isProcessing = true
}

/**
 * Marcar fim de processamento e registrar geração bem-sucedida
 */
export function completeGeneration(userId: string): void {
  const state = getUserState(userId)
  const now = Date.now()
  
  state.isProcessing = false
  state.lastGeneration = now
  state.generationsThisMinute++
  state.generationsThisHour++
  state.generationsThisDay++
  state.consecutiveRequests = 0 // Resetar após geração bem-sucedida
  
  // Reduzir nível de suspeita com gerações bem-sucedidas
  if (state.suspiciousActions > 0) {
    state.suspiciousActions = Math.max(0, state.suspiciousActions - 0.5)
  }
  
  userGenerationState.set(userId, state)
}

/**
 * Cancelar processamento (em caso de erro)
 */
export function cancelGeneration(userId: string): void {
  const state = getUserState(userId)
  state.isProcessing = false
  userGenerationState.set(userId, state)
}

/**
 * Obter tempo restante de cooldown
 */
export function getCooldownRemaining(userId: string): number {
  const state = userGenerationState.get(userId)
  if (!state) return 0
  
  const now = Date.now()
  const cooldownMs = GENERATION_PROTECTION.COOLDOWN_SECONDS * 1000
  const timeSinceLastGeneration = now - state.lastGeneration
  
  if (timeSinceLastGeneration >= cooldownMs) return 0
  
  return Math.ceil((cooldownMs - timeSinceLastGeneration) / 1000)
}

// ===========================================
// 📝 LOGGING
// ===========================================

/**
 * Registrar atividade suspeita
 */
async function logSuspiciousActivity(
  userId: string,
  ip: string,
  type: string,
  details: string
): Promise<void> {
  try {
    await prisma.securityLog.create({
      data: {
        type: 'bot_detected',
        ip,
        username: userId,
        success: false,
        reason: `Geração suspeita: ${type}`,
        metadata: JSON.stringify({
          userId,
          suspiciousType: type,
          details,
          timestamp: new Date().toISOString()
        })
      }
    })
  } catch (error) {
    console.error('Erro ao registrar atividade suspeita:', error)
  }
}

/**
 * Registrar geração bem-sucedida
 */
export async function logGeneration(
  userId: string,
  ip: string,
  serviceId: string,
  serviceName: string
): Promise<void> {
  try {
    await prisma.securityLog.create({
      data: {
        type: 'register_attempt', // Reutilizando tipo existente
        ip,
        username: userId,
        success: true,
        reason: `Geração: ${serviceName}`,
        metadata: JSON.stringify({
          action: 'generation',
          serviceId,
          serviceName,
          timestamp: new Date().toISOString()
        })
      }
    })
  } catch (error) {
    // Ignorar erro de log
  }
}

// ===========================================
// 🔧 UTILITÁRIOS ADMIN
// ===========================================

/**
 * Desbloquear usuário
 */
export function unblockUser(userId: string): void {
  const state = userGenerationState.get(userId)
  if (state) {
    state.blockedUntil = undefined
    state.suspiciousActions = 0
    userGenerationState.set(userId, state)
  }
}

/**
 * Obter estado de todos os usuários (para debug)
 */
export function getAllUserStates(): Array<{
  oderId: string
  state: UserGenerationState
}> {
  const result: Array<{ oderId: string; state: UserGenerationState }> = []
  
  for (const [userId, state] of userGenerationState.entries()) {
    result.push({ oderId: userId, state })
  }
  
  return result
}

/**
 * Bloquear usuário manualmente
 */
export function blockUser(userId: string, durationMinutes: number = 60): void {
  const state = getUserState(userId)
  state.blockedUntil = Date.now() + (durationMinutes * 60 * 1000)
  state.suspiciousActions = GENERATION_PROTECTION.MAX_SUSPICIOUS_ACTIONS
  userGenerationState.set(userId, state)
}

