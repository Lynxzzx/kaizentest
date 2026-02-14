import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]'
import prisma from '@/lib/prisma'
import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
})

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

      // Enviar email
      await transporter.sendMail({
        from: process.env.SMTP_USER,
        to: user.email,
        subject: 'Código de Verificação - Kaizen Gens',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4F46E5;">Verificação de Email</h2>
            <p>Olá ${user.username},</p>
            <p>Use o código abaixo para verificar seu email:</p>
            <div style="background-color: #F3F4F6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
              <h1 style="color: #4F46E5; font-size: 32px; margin: 0; letter-spacing: 4px;">${verificationCode}</h1>
            </div>
            <p>Este código expira em 15 minutos.</p>
            <p>Se você não solicitou isso, ignore este email.</p>
            <hr style="border: 1px solid #E5E7EB; margin: 30px 0;">
            <p style="color: #6B7280; font-size: 12px;">Kaizen Gens - Segurança em primeiro lugar</p>
          </div>
        `
      })

      return res.status(200).json({ message: 'Código enviado com sucesso' })
    } catch (error) {
      console.error('Erro ao enviar código:', error)
      return res.status(500).json({ error: 'Erro ao enviar código' })
    }
  }

  return res.status(405).json({ error: 'Método não permitido' })
}