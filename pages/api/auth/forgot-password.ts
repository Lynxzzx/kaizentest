import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import nodemailer from 'nodemailer'

// Configurar transporte SMTP com suporte SSL/TLS
const smtpPort = parseInt(process.env.SMTP_PORT || '587')
const isSSL = smtpPort === 465

// Configuração específica para Gmail
const isGmail = process.env.SMTP_USER?.includes('@gmail.com')
const gmailConfig = isGmail && isSSL ? {
  service: 'gmail', // Usar serviço predefinido do Gmail
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
} : {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: smtpPort,
  secure: isSSL, // true para SSL (465), false para TLS (587)
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
}

const transporter = nodemailer.createTransport({
  ...gmailConfig,
  logger: true,
  debug: true
})

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

      // Enviar email com o código de redefinição
      try {
        if (!user.email) {
          console.log('⚠️ Usuário não tem email cadastrado')
          return res.status(200).json({ 
            message: 'Se o email existir, um código será enviado'
          })
        }
        
        console.log(`📧 Enviando email de redefinição para ${user.email}...`)
        
        const mailOptions = {
          from: `"Kaizen Gens" <${process.env.SMTP_USER}>`,
          to: user.email,
          subject: 'Código de Redefinição de Senha - Kaizen Gens',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Redefinição de Senha</h2>
              <p>Olá ${user.username},</p>
              <p>Você solicitou a redefinição de senha. Use o código abaixo:</p>
              <div style="background-color: #f4f4f4; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
                <h1 style="color: #333; margin: 0; font-size: 32px; letter-spacing: 4px;">${resetCode}</h1>
              </div>
              <p>Este código expira em 15 minutos.</p>
              <p>Se você não solicitou esta redefinição, ignore este email.</p>
              <hr>
              <p style="color: #666; font-size: 12px;">Kaizen Gens - Sistema de Gerenciamento</p>
            </div>
          `,
          text: `
            Redefinição de Senha - Kaizen Gens
            
            Olá ${user.username},
            
            Você solicitou a redefinição de senha. Use o código: ${resetCode}
            
            Este código expira em 15 minutos.
            
            Se você não solicitou esta redefinição, ignore este email.
          `
        }

        const result = await transporter.sendMail(mailOptions)
        console.log('✅ Email de redefinição enviado com sucesso:', result.messageId)
        
        return res.status(200).json({ 
          message: 'Se o email existir, um código será enviado',
          debugCode: resetCode // Remover em produção
        })
        
      } catch (emailError: any) {
        console.error('❌ Erro ao enviar email de redefinição:', emailError)
        console.error('📧 Detalhes do erro:', {
          message: emailError.message,
          code: emailError.code,
          response: emailError.response,
          isGmail: isGmail,
          smtpPort: smtpPort,
          isSSL: isSSL
        })
        
        // Mesmo que o email falhe, retornar sucesso para não expor informações
        return res.status(200).json({ 
          message: 'Se o email existir, um código será enviado',
          debugCode: resetCode // Remover em produção
        })
      }
    } catch (error) {
      console.error('Erro ao enviar código de redefinição:', error)
      return res.status(500).json({ error: 'Erro ao enviar código' })
    }
  }

  return res.status(405).json({ error: 'Método não permitido' })
}