import { NextApiRequest, NextApiResponse } from 'next'
import crypto from 'crypto'
import { sendTelegramMessage } from '@/lib/telegram'

function verifySignature(req: NextApiRequest, secret: string): boolean {
  const signature = req.headers['x-vercel-signature'] as string
  if (!signature) return false
  const rawBody = (req as any).bodyRaw || JSON.stringify(req.body || {})
  const hmac = crypto.createHmac('sha1', secret).update(rawBody).digest('hex')
  return signature === hmac
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const secret = process.env.DEPLOY_WEBHOOK_SECRET || ''
  const simpleSecret = req.query.secret as string
  const valid =
    (secret && verifySignature(req, secret)) ||
    (!!simpleSecret && (!!secret ? simpleSecret === secret : true))

  if (!valid) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const body = req.body || {}
  const state = body?.payload?.state || body?.state || 'unknown'
  const project = body?.payload?.name || body?.name || 'unknown'
  const url = body?.payload?.url || body?.url || ''
  const env = body?.payload?.target || body?.target || ''

  const lines = [
    '🚀 <b>Deploy Vercel</b>',
    '',
    `Projeto: <b>${escapeHtml(project)}</b>`,
    `Estado: <b>${escapeHtml(state)}</b>`,
    env ? `Ambiente: <b>${escapeHtml(env)}</b>` : '',
    url ? `URL: <a href="${escapeHtml(url)}">${escapeHtml(url)}</a>` : '',
    '',
    'Kaizen Gens'
  ].filter(Boolean)

  await sendTelegramMessage(lines.join('\n'))
  return res.json({ ok: true })
}

function escapeHtml(input: string): string {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
