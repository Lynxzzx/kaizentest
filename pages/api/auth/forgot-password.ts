import type { NextApiRequest, NextApiResponse } from 'next'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'

const RESET_TOKEN_EXPIRATION_MINUTES = 30

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email } = req.body as { email?: string }

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email é obrigatório' })
  }

  const normalizedEmail = email.trim().toLowerCase()

  try {
    const user = await prisma.user.findFirst({
      where: {
        email: normalizedEmail
      }
    })

    if (user) {
      const token = crypto.randomBytes(32).toString('hex')
      const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRATION_MINUTES * 60 * 1000)

      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: token,
          passwordResetExpires: expiresAt
        }
      })

      const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL || 'http://localhost:3000'
      const resetUrl = `${baseUrl.replace(/\/$/, '')}/reset-password?token=${token}`

      console.log('🔐 Link de redefinição de senha:', resetUrl)
      console.log('   (Configure um serviço de email para enviar este link ao usuário)')
    }

    return res.json({
      success: true,
      message: 'Se o email existir em nossa base, enviaremos instruções de recuperação.'
    })
  } catch (error: any) {
    console.error('Erro ao solicitar redefinição de senha:', error)
    return res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

