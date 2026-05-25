import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// 🛡️ CONFIGURAÇÕES DE SEGURANÇA
const SECURITY_HEADERS = {
  // Prevenir clickjacking
  'X-Frame-Options': 'DENY',
  
  // Prevenir MIME type sniffing
  'X-Content-Type-Options': 'nosniff',
  
  // Prevenir XSS (navegadores modernos)
  'X-XSS-Protection': '1; mode=block',
  
  // Controlar referrer
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  
  // Política de permissões
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  
  // HSTS - Force HTTPS (1 ano)
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
}

// Lista de User-Agents suspeitos (APENAS ferramentas de hacking reais)
// Removidos clients HTTP comuns para evitar falsos positivos
const BLOCKED_USER_AGENTS = [
  // Ferramentas de hacking e scanners
  'sqlmap', 'nikto', 'nessus', 'nmap',
  'masscan', 'zmap', 'gobuster', 'dirbuster',
  'wpscan', 'nuclei', 'hydra', 'medusa',
  'metasploit', 'burp', 'owasp', 'acunetix',
  'netsparker', 'appscan', 'webinspect',
  
  // Automação óbvia (mantidos apenas os mais óbvios)
  'puppeteer', 'playwright', 'selenium', 'webdriver',
  'phantomjs', 'headlesschrome',
  'scrapy',
]

// Paths que não precisam de validação extra
const SKIP_PATHS = [
  '/_next',
  '/api/auth',
  '/favicon.ico',
  '/logo.png'
]

// 🛡️ APIs sensíveis que precisam de proteção extra
const SENSITIVE_API_PATHS = [
  '/api/accounts/generate',
  '/api/keys/redeem',
  '/api/affiliate/redeem',
  '/api/coupons/validate',
  '/api/auth/register',
  '/api/auth/forgot-password'
]

// Cache simples para rate limiting no Edge (por IP)
const ipRequestCounts = new Map<string, { count: number; resetAt: number }>()

// Limpar cache periodicamente (a cada minuto no Edge)
const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minuto
const MAX_REQUESTS_PER_MINUTE = 500 // Máximo de requisições por minuto por IP (AUMENTADO para suportar uso intensivo)

function getClientIp(request: NextRequest): string {
  // Cloudflare
  const cfIp = request.headers.get('cf-connecting-ip')
  if (cfIp) return cfIp
  
  // Vercel
  const xRealIp = request.headers.get('x-real-ip')
  if (xRealIp) return xRealIp
  
  // Standard
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  
  return 'unknown'
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const record = ipRequestCounts.get(ip)
  
  // Limpar registros antigos
  if (ipRequestCounts.size > 10000) {
    for (const [key, value] of ipRequestCounts.entries()) {
      if (now > value.resetAt) {
        ipRequestCounts.delete(key)
      }
    }
  }
  
  if (!record || now > record.resetAt) {
    ipRequestCounts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  
  record.count++
  
  if (record.count > MAX_REQUESTS_PER_MINUTE) {
    return false
  }
  
  return true
}

export function middleware(request: NextRequest) {
  const userAgent = request.headers.get('user-agent')?.toLowerCase() || ''
  const pathname = request.nextUrl.pathname
  const ip = getClientIp(request)
  
  // Pular paths que não precisam de validação
  const shouldSkip = SKIP_PATHS.some(path => pathname.startsWith(path))
  
  // 🛡️ Bloquear ferramentas de hacking conhecidas
  if (!shouldSkip) {
    for (const blocked of BLOCKED_USER_AGENTS) {
      if (userAgent.includes(blocked)) {
        console.log(`🚫 Blocked suspicious user agent from ${ip}: ${userAgent.substring(0, 100)}`)
        return new NextResponse(JSON.stringify({ error: 'Forbidden' }), { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }
  }
  
  // 🛡️ Rate limiting global no Edge (proteção básica)
  if (pathname.startsWith('/api/')) {
    if (!checkRateLimit(ip)) {
      console.log(`🚫 Rate limit exceeded for IP: ${ip}`)
      return new NextResponse(JSON.stringify({ 
        error: 'Too many requests. Please slow down.',
        retryAfter: 60
      }), { 
        status: 429,
        headers: { 
          'Content-Type': 'application/json',
          'Retry-After': '60'
        }
      })
    }
  }
  
  // 🛡️ Verificação extra para APIs sensíveis (MENOS RESTRITIVA)
  const isSensitiveApi = SENSITIVE_API_PATHS.some(path => pathname.startsWith(path))
  
  if (isSensitiveApi) {
    // Verificar se tem User-Agent (apenas bloquear se completamente vazio)
    if (!userAgent) {
      console.log(`🚫 Blocked request without user-agent to ${pathname}`)
      return new NextResponse(JSON.stringify({ error: 'Invalid request' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    // Não verificar mais headers extras - muitos clientes legítimos não enviam
  }
  
  const response = NextResponse.next()
  
  // 🛡️ Adicionar headers de segurança em todas as respostas
  for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(header, value)
  }
  
  // 🛡️ CSP (Content Security Policy) - Mais restritivo
  const cspValue = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.google.com https://www.gstatic.com https://recaptcha.google.com https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://www.google.com https://www.gstatic.com https://recaptcha.google.com https://challenges.cloudflare.com https://vitals.vercel-insights.com",
    "frame-src 'self' https://www.google.com https://recaptcha.google.com https://challenges.cloudflare.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests"
  ].join('; ')
  
  response.headers.set('Content-Security-Policy', cspValue)
  
  // 🛡️ Adicionar identificador único para rastreamento
  const requestId = crypto.randomUUID()
  response.headers.set('X-Request-ID', requestId)
  
  // 🛡️ Adicionar header indicando proteção ativa
  response.headers.set('X-Protected-By', 'Kaizen-Security')
  
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
