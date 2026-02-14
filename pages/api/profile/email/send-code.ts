import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/pages/api/auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import nodemailer from 'nodemailer'

// Configurar o transporte de email
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

      // Enviar email com o código de verificação
      try {
        await transporter.sendMail({
          from: `"Kaizen Gens" <${process.env.SMTP_USER}>`,
          to: user.email,
          subject: 'Código de Verificação - Kaizen Gens',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white;">
                <h1 style="margin: 0; font-size: 28px;">Kaizen Gens</h1>
                <p style="margin: 10px 0 0 0; font-size: 16px;">Verificação de Email</p>
              </div>
              <div style="padding: 30px; background-color: #f8f9fa; border-radius: 0 0 8px 8px;">
                <h2 style="color: #333; margin-top: 0;">Olá ${user.username}!</h2>
                <p style="color: #666; font-size: 16px; line-height: 1.6;">
                  Você solicitou a verificação de email em sua conta Kaizen Gens. 
                  Use o código abaixo para completar a verificação:
                </p>
                <div style="text-align: center; margin: 30px 0;">
                  <div style="background-color: #667eea; color: white; padding: 15px 30px; border-radius: 8px; font-size: 24px; font-weight: bold; letter-spacing: 3px; display: inline-block;">
                    ${verificationCode}
                  </div>
                </div>
                <p style="color: #666; font-size: 14px; margin-bottom: 0;">
                  <strong>Importante:</strong> Este código expira em 15 minutos.
                </p>
                <p style="color: #666; font-size: 14px; margin-top: 10px;">
                  Se você não solicitou esta verificação, por favor ignore este email.
                </p>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
                  Kaizen Gens - Todos os direitos reservados
                </p>
              </div>
            </div>
          `,
          text: `
            Olá ${user.username}!\n\n
            Você solicitou a verificação de email em sua conta Kaizen Gens.\n
            Use o código abaixo para completar a verificação:\n\n
            Código: ${verificationCode}\n\n
            Importante: Este código expira em 15 minutos.\n\n
            Se você não solicitou esta verificação, por favor ignore este email.\n\n
            Kaizen Gens - Todos os direitos reservados
          `
        })

        console.log(`📧 Email de verificação enviado para ${user.email}: ${verificationCode}`)

        return res.status(200).json({ 
          message: 'Código enviado com sucesso',
          debugCode: verificationCode // Remover em produção
        })
      } catch (emailError) {
        console.error('Erro ao enviar email:', emailError)
        // Mesmo que o email falhe, ainda assim retornar sucesso para não expor o erro ao usuário
        // Mas logar o erro para monitoramento
        return res.status(200).json({ 
          message: 'Código enviado com sucesso',
          debugCode: verificationCode // Remover em produção
        })
      }
    } catch (error) {
      console.error('Erro ao enviar código:', error)
      return res.status(500).json({ error: 'Erro ao enviar código' })
    }
  }

  return res.status(405).json({ error: 'Método não permitido' })
}