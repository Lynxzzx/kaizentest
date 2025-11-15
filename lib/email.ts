import nodemailer from 'nodemailer'

let cachedTransporter: nodemailer.Transporter | null = null

const smtpConfig = {
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined,
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS,
  secure: process.env.SMTP_SECURE === 'true',
  from: process.env.SMTP_FROM
}

export function isEmailConfigured() {
  return Boolean(smtpConfig.host && smtpConfig.user && smtpConfig.pass && (smtpConfig.from || smtpConfig.user))
}

async function getTransporter() {
  if (!isEmailConfigured()) {
    throw new Error('Serviço de email não configurado. Defina SMTP_HOST, SMTP_USER, SMTP_PASS e SMTP_FROM.')
  }

  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port || (smtpConfig.secure ? 465 : 587),
      secure: smtpConfig.secure ?? false,
      auth: {
        user: smtpConfig.user!,
        pass: smtpConfig.pass!
      }
    })
  }

  return cachedTransporter
}

interface SendEmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

export async function sendEmail(options: SendEmailOptions) {
  const transporter = await getTransporter()
  const from = smtpConfig.from || smtpConfig.user!

  await transporter.sendMail({
    from,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text
  })
}

export async function sendPasswordResetEmail(params: { to: string; username?: string | null; resetUrl: string }) {
  const subject = 'Redefinição de senha - Kaizen Gens'
  const previewText = 'Use o link abaixo para criar uma nova senha.'
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">
      <h2>Olá${params.username ? `, ${params.username}` : ''} 👋</h2>
      <p>Recebemos uma solicitação para redefinir sua senha no <strong>Kaizen Gens</strong>.</p>
      <p>Se você fez essa solicitação, clique no botão abaixo para criar uma nova senha. Este link é válido por 30 minutos.</p>
      <p style="margin: 24px 0;">
        <a href="${params.resetUrl}" style="background: #6366f1; color: #ffffff; padding: 12px 20px; text-decoration: none; border-radius: 8px; font-weight: bold;">
          Redefinir senha
        </a>
      </p>
      <p>Ou copie e cole esta URL no seu navegador:</p>
      <p style="word-break: break-all; color: #4c1d95;">${params.resetUrl}</p>
      <p>Se você não solicitou uma redefinição, ignore este email. Sua senha permanecerá a mesma.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;" />
      <p style="font-size: 12px; color: #94a3b8;">Este email foi enviado automaticamente, por favor não responda.</p>
    </div>
  `

  const text = `${previewText}\n\nLink: ${params.resetUrl}\n\nSe você não solicitou, ignore.`

  await sendEmail({
    to: params.to,
    subject,
    html,
    text
  })
}

