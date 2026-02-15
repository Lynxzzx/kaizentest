import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import nodemailer from 'nodemailer'

// Configurar o transporte de email com suporte para SSL/TLS
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
  logger: true, // Ativar logs do nodemailer
  debug: true   // Ativar debug mode
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    try {
      const { email, username } = req.body

      if (!email || !username) {
        return res.status(400).json({ error: 'Email e username são obrigatórios' })
      }

      // Validar formato de email
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Email inválido' })
      }

      // Verificar se o email já está em uso
      const existingEmail = await prisma.user.findFirst({
        where: {
          email: {
            equals: email.toLowerCase(),
            mode: 'insensitive'
          }
        }
      })

      if (existingEmail) {
        return res.status(400).json({ error: 'Email já está em uso' })
      }

      // Gerar código de verificação
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 minutos

      // Criar registro temporário de verificação
      await prisma.emailVerification.upsert({
        where: { email: email.toLowerCase() },
        update: {
          code: verificationCode,
          expiresAt,
          username,
          createdAt: new Date()
        },
        create: {
          email: email.toLowerCase(),
          code: verificationCode,
          expiresAt,
          username,
          createdAt: new Date()
        }
      })

      // Enviar email com o código de verificação
      try {
        console.log('📧 Enviando código de verificação para:', email)

        // Verificar se todas as configurações estão presentes
        if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
          console.error('❌ Credenciais SMTP ausentes')
          return res.status(500).json({ error: 'Configuração de email incompleta' })
        }

        await transporter.sendMail({
          from: `"Kaizen Gens" <${process.env.SMTP_USER}>`,
          to: email,
          subject: 'Código de Verificação - Kaizen Gens',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white;">
                <h1 style="margin: 0; font-size: 28px;">Kaizen Gens</h1>
                <p style="margin: 10px 0 0 0; font-size: 16px;">Verificação de Email</p>
              </div>
              <div style="padding: 30px; background-color: #f8f9fa; border-radius: 0 0 8px 8px;">
                <h2 style="color: #333; margin-top: 0;">Olá ${username}!</h2>
                <p style="color: #666; font-size: 16px; line-height: 1.6;">
                  Você está criando uma conta no Kaizen Gens. 
                  Use o código abaixo para verificar seu email:
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
                  Se você não solicitou este registro, por favor ignore este email.
                </p>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
                  Kaizen Gens - Todos os direitos reservados
                </p>
              </div>
            </div>
          `,
          text: `
            Olá ${username}!\n\n
            Você está criando uma conta no Kaizen Gens.\n
            Use o código abaixo para verificar seu email:\n\n
            Código: ${verificationCode}\n\n
            Importante: Este código expira em 15 minutos.\n\n
            Se você não solicitou este registro, por favor ignore este email.\n\n
            Kaizen Gens - Todos os direitos reservados
          `
        })

        console.log(`📧 Código de verificação enviado para ${email}: ${verificationCode}`)

        return res.status(200).json({ 
          message: 'Código enviado com sucesso',
          debugCode: verificationCode // Remover em produção
        })
      } catch (emailError: any) {
        console.error('❌ Erro detalhado ao enviar email:')
        console.error('Erro:', emailError.message)
        console.error('Código do erro:', emailError.code)
        
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