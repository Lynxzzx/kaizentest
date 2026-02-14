import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/pages/api/auth/[...nextauth]'
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
  const session = await getServerSession(req, res, authOptions)
  
  if (!session) {
    return res.status(401).json({ error: 'Não autorizado' })
  }

  if (req.method === 'POST') {
    try {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id }
      })

      if (!user || !user.email) {
        return res.status(404).json({ error: 'Email não encontrado' })
      }

      // Gerar código de verificação
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 minutos

      // Salvar código no banco
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          emailVerificationCode: verificationCode,
          emailVerificationExpires: expiresAt
        }
      })

      // Por enquanto, apenas logar o código (em produção, enviar email)
      console.log(`📧 Código de verificação para ${user.email}: ${verificationCode}`)

      return res.status(200).json({ 
        message: 'Código enviado com sucesso',
        debugCode: verificationCode // Remover em produção
      })
    } catch (error) {
      console.error('Erro ao enviar código:', error)
      return res.status(500).json({ error: 'Erro ao enviar código' })
    }
  }

  return res.status(405).json({ error: 'Método não permitido' })
}