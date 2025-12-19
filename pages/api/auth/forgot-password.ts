import type { NextApiRequest, NextApiResponse } from 'next'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { isEmailConfigured, sendPasswordResetEmail } from '@/lib/email'
import { checkRateLimit, getClientIp } from '@/lib/api-protection'

const RESET_TOKEN_EXPIRATION_MINUTES = 30

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // 🛡️ PROTEÇÃO CONTRA ABUSO (limita tentativas de reset por IP)
  const ip = getClientIp(req)
  const rateCheck = await checkRateLimit(req, 'password_reset', ip)
  
  if (!rateCheck.allowed) {
    return res.status(429).json({ 
      error: rateCheck.reason,
      retryAfter: rateCheck.retryAfter
    })
  }

  if (!isEmailConfigured()) {
    return res.status(500).json({
      error: 'Serviço de email não configurado. Defina SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM e SMTP_PORT/SMTP_SECURE.'
    })
  }

  const { email } = req.body as { email?: string }

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email é obrigatório' })
  }

  const normalizedEmail = email.trim().toLowerCase()
  
  // Validar formato do email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(normalizedEmail)) {
    return res.status(400).json({ error: 'Formato de email inválido' })
  }

  try {
    const user = await prisma.user.findFirst({
      where: {
        email: normalizedEmail
      }
    })

    // Log da tentativa (sem revelar se email existe)
    try {
      await prisma.securityLog.create({
        data: {
          type: 'login_attempt',
          ip,
          success: !!user,
          reason: 'Password reset request',
          metadata: JSON.stringify({
            action: 'password_reset_request',
            emailDomain: normalizedEmail.split('@')[1]
          })
        }
      })
    } catch (e) {}

    if (user) {
      // Verificar se usuário está banido
      if (user.isBanned) {
        // Não revelar que usuário está banido
        return res.json({
          success: true,
          message: 'Se o email existir em nossa base, enviaremos instruções de recuperação.'
        })
      }

      // Verificar se já existe um token válido recente (evita spam)
      if (user.passwordResetToken && user.passwordResetExpires) {
        const tokenAge = Date.now() - user.passwordResetExpires.getTime() + (RESET_TOKEN_EXPIRATION_MINUTES * 60 * 1000)
        
        // Se token foi criado há menos de 2 minutos, não criar outro
        if (tokenAge < 2 * 60 * 1000) {
          return res.json({
            success: true,
            message: 'Se o email existir em nossa base, enviaremos instruções de recuperação.'
          })
        }
      }

      const token = crypto.randomBytes(32).toString('hex')
      const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRATION_MINUTES * 60 * 1000)

      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: token,
          passwordResetExpires: expiresAt
        }
      })

      const baseUrl =
        process.env.NEXTAUTH_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
        'http://localhost:3000'
      const resetUrl = `${baseUrl.replace(/\/$/, '')}/reset-password?token=${token}`

      await sendPasswordResetEmail({
        to: normalizedEmail,
        username: user.username,
        resetUrl
      })
    }

    // Sempre retornar mesma resposta para não revelar se email existe
    return res.json({
      success: true,
      message: 'Se o email existir em nossa base, enviaremos instruções de recuperação.'
    })
  } catch (error: any) {
    console.error('Erro ao solicitar redefinição de senha:', error)
    return res.status(500).json({ error: 'Erro interno do servidor' })
  }
}
