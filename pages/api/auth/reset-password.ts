import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { token, password } = req.body as { token?: string; password?: string }

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Token obrigatório' })
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres' })
  }

  try {
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: {
          gt: new Date()
        }
      }
    })

    if (!user) {
      return res.status(400).json({ error: 'Token inválido ou expirado' })
    }

    const hashedPassword = await hashPassword(password)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null
      }
    })

    return res.json({ success: true, message: 'Senha redefinida com sucesso' })
  } catch (error: any) {
    console.error('Erro ao redefinir senha:', error)
    return res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

