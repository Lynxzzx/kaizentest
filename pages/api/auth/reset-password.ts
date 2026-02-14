import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
// import nodemailer from 'nodemailer'

// const transporter = nodemailer.createTransport({
//   host: process.env.SMTP_HOST || 'smtp.gmail.com',
//   port: parseInt(process.env.SMTP_PORT || '587'),
//   secure: false,
//   auth: {
//     user: process.env.SMTP_USER,
//     pass: process.env.SMTP_PASS
//   }
// })

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { email, code, newPassword } = req.body

    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'Email, código e nova senha são obrigatórios' })
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres' })
    }

    try {
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() }
      })

      if (!user) {
        return res.status(400).json({ error: 'Código inválido ou expirado' })
      }

      // Verificar código e expiração
      if (!user.passwordResetCode || !user.passwordResetExpires) {
        return res.status(400).json({ error: 'Código inválido ou expirado' })
      }

      if (new Date() > user.passwordResetExpires) {
        return res.status(400).json({ error: 'Código expirado' })
      }

      if (user.passwordResetCode !== code) {
        return res.status(400).json({ error: 'Código inválido' })
      }

      // Hash da nova senha
      const hashedPassword = await bcrypt.hash(newPassword, 12)

      // Atualizar senha e limpar código
      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          passwordResetCode: null,
          passwordResetExpires: null
        }
      })

      return res.status(200).json({ message: 'Senha redefinida com sucesso' })
    } catch (error) {
      console.error('Erro ao redefinir senha:', error)
      return res.status(500).json({ error: 'Erro interno do servidor' })
    }
  }

  return res.status(405).json({ error: 'Método não permitido' })
}