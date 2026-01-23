import { NextApiRequest, NextApiResponse } from 'next'
import {
  validateLoginRequest,
  getClientIp,
  getUserAgent,
  resetLoginAttempts
} from '@/lib/security'

/**
 * API para validar requisição de login antes de autenticar
 * 
 * Esta API verifica:
 * - Rate limiting por IP e username
 * - Honeypot
 * - Detecção de bot
 * - reCAPTCHA (se configurado)
 * 
 * Deve ser chamada ANTES de chamar signIn do NextAuth
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const ip = getClientIp(req)
  const userAgent = getUserAgent(req)

  try {
    const { 
      username, 
      recaptchaToken,
      honeypot, 
      formStartTime,
      resetAttempts // Flag para resetar tentativas após login bem-sucedido
    } = req.body

    // Se é para resetar tentativas (chamado após login bem-sucedido)
    if (resetAttempts && username) {
      resetLoginAttempts(ip, username)
      return res.status(200).json({ success: true, message: 'Attempts reset' })
    }

    const sanitizedUsername = typeof username === 'string' ? username.trim() : ''

    if (!sanitizedUsername) {
      return res.status(400).json({ error: 'Username é obrigatório' })
    }

    // Validação de segurança completa
    const securityCheck = await validateLoginRequest(req, {
      username: sanitizedUsername,
      recaptchaToken,
      honeypot,
      formStartTime
    })

    if (!securityCheck.allowed) {
      console.log('🚫 Login security check failed:', securityCheck.reason)
      return res.status(403).json({ 
        error: securityCheck.reason || 'Verificação de segurança falhou',
        securityBlock: true,
        botScore: securityCheck.botScore
      })
    }

    // Login permitido
    return res.status(200).json({ 
      allowed: true,
      warnings: securityCheck.warnings,
      botScore: securityCheck.botScore
    })

  } catch (error: any) {
    console.error('Error validating login:', error)
    
    return res.status(500).json({ 
      error: 'Erro ao validar requisição',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
}
