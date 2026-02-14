import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
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
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ error: 'Email é obrigatório' })
    }

    try {
      const user = await prisma.user.findFirst({
        where: { email: email.toLowerCase() }
      })

      if (!user) {
        // Não revelar se o email existe ou não por segurança
        return res.status(200).json({ message: 'Se o email existir, um código será enviado' })
      }

      // Gerar código de redefinição
      const resetCode = Math.floor(100000 + Math.random() * 900000).toString()
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 minutos

      // Salvar código no banco
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetCode: resetCode,
          passwordResetExpires: expiresAt
        }
      })

      // Por enquanto, apenas logar o código (em produção, enviar email)
      console.log(`📧 Código de redefinição para ${user.email}: ${resetCode}`)

      return res.status(200).json({ 
        message: 'Se o email existir, um código será enviado',
        debugCode: resetCode // Remover em produção
      })
    } catch (error) {
      console.error('Erro ao enviar código de redefinição:', error)
      return res.status(500).json({ error: 'Erro ao enviar código' })
    }
  }

  return res.status(405).json({ error: 'Método não permitido' })
}