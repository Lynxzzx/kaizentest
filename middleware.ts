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

// Lista de User-Agents suspeitos
const BLOCKED_USER_AGENTS = [
  'sqlmap', 'nikto', 'nessus', 'nmap',
  'masscan', 'zmap', 'gobuster', 'dirbuster',
  'wpscan', 'nuclei', 'hydra', 'medusa'
]

// Paths que não precisam de validação extra
const SKIP_PATHS = [
  '/_next',
  '/api/auth',
  '/favicon.ico',
  '/logo.png'
]

export function middleware(request: NextRequest) {
  const response = NextResponse.next()
  const userAgent = request.headers.get('user-agent')?.toLowerCase() || ''
  const pathname = request.nextUrl.pathname
  
  // Pular paths que não precisam de validação
  const shouldSkip = SKIP_PATHS.some(path => pathname.startsWith(path))
  
  // 🛡️ Bloquear ferramentas de hacking conhecidas
  if (!shouldSkip) {
    for (const blocked of BLOCKED_USER_AGENTS) {
      if (userAgent.includes(blocked)) {
        console.log(`🚫 Blocked suspicious user agent: ${userAgent}`)
        return new NextResponse('Forbidden', { status: 403 })
      }
    }
  }
  
  // 🛡️ Adicionar headers de segurança em todas as respostas
  for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(header, value)
  }
  
  // 🛡️ CSP (Content Security Policy) - Mais restritivo
  // Ajustar conforme necessário para sua aplicação
  const cspValue = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.google.com https://www.gstatic.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://www.google.com https://vitals.vercel-insights.com",
    "frame-src 'self' https://www.google.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests"
  ].join('; ')
  
  response.headers.set('Content-Security-Policy', cspValue)
  
  // 🛡️ Adicionar identificador único para rastreamento (sem expor dados sensíveis)
  const requestId = crypto.randomUUID()
  response.headers.set('X-Request-ID', requestId)
  
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes) - handled separately
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
