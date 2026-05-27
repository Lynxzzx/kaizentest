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
            <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0b0f19; color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 40px -10px rgba(0,0,0,0.5);">
              <div style="background: linear-gradient(135deg, #101423 0%, #171026 100%); padding: 40px 30px; text-align: center; border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                <h1 style="margin: 0; font-size: 32px; font-weight: 800; background: linear-gradient(90deg, #A78BFA 0%, #F472B6 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; color: #A78BFA;">KAIZEN GENS</h1>
                <p style="margin: 15px 0 0 0; font-size: 16px; color: #a1a1aa; letter-spacing: 1px; text-transform: uppercase;">Acesso Premium</p>
              </div>
              <div style="padding: 40px 30px; background-color: #0b0f19; position: relative;">
                <div style="position: absolute; top: 0; left: 50%; transform: translateX(-50%); width: 200px; height: 100px; background: radial-gradient(circle, rgba(167, 139, 250, 0.15) 0%, rgba(244, 114, 182, 0) 70%); pointer-events: none;"></div>
                
                <h2 style="color: #f4f4f5; margin-top: 0; font-size: 20px; font-weight: 600;">Olá, ${username}!</h2>
                <p style="color: #a1a1aa; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
                  Notamos que você está tentando criar uma conta. Utilize o código de verificação abaixo para concluir o registro com segurança:
                </p>
                
                <div style="text-align: center; margin: 35px 0;">
                  <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(167, 139, 250, 0.3); color: #fff; padding: 20px 30px; border-radius: 12px; font-size: 36px; font-weight: 800; letter-spacing: 8px; display: inline-block; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2), inset 0 0 0 1px rgba(255, 255, 255, 0.05);">
                    ${verificationCode}
                  </div>
                </div>
                
                <div style="background-color: rgba(239, 68, 68, 0.05); border-left: 3px solid #ef4444; padding: 15px; border-radius: 4px; margin-top: 30px;">
                  <p style="color: #f87171; font-size: 14px; margin: 0;">
                    <strong style="margin-right: 5px;">Importante:</strong> Este código expira em 15 minutos.
                  </p>
                </div>
                
                <p style="color: #71717a; font-size: 13px; margin-top: 25px; line-height: 1.5; text-align: center;">
                  Caso não tenha solicitado este registro, considere mudar sua senha de email. Apenas ignore esta mensagem.
                </p>
                
                <hr style="border: none; border-top: 1px solid rgba(255, 255, 255, 0.05); margin: 35px 0 25px 0;">
                
                <p style="color: #52525b; font-size: 12px; text-align: center; margin: 0; font-weight: 500;">
                  &copy; ${new Date().getFullYear()} Kaizen Gens. Todos os direitos reservados.
                </p>
              </div>
            </div>
          `,          text: `
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
        console.error('❌ Erro ao enviar email:', emailError.message, emailError.code)
        return res.status(500).json({ 
          error: `Erro ao enviar email: ${emailError.message}`,
          code: emailError.code
        })
      }
    } catch (error: any) {
      console.error('Erro ao enviar código:', error)
      return res.status(500).json({ 
        error: error.message || 'Erro ao enviar código',
        details: error.code
      })
    }
  }

  return res.status(405).json({ error: 'Método não permitido' })
}