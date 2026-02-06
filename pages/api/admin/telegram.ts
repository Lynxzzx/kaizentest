import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import { sendTelegramMessage } from '@/lib/telegram'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session || session.user.role !== 'OWNER') {
    return res.status(403).json({ error: 'Unauthorized' })
  }

  if (req.method === 'GET') {
    try {
      const tokenCfg = await prisma.systemConfig.findUnique({ where: { key: 'TELEGRAM_BOT_TOKEN' } })
      const chatCfg = await prisma.systemConfig.findUnique({ where: { key: 'TELEGRAM_CHAT_ID' } })
      return res.json({
        configured: !!(tokenCfg?.value && chatCfg?.value),
        botTokenSet: !!tokenCfg?.value,
        chatIdSet: !!chatCfg?.value
      })
    } catch (error: any) {
      return res.status(500).json({ error: 'Internal error', details: error.message })
    }
  }

  if (req.method === 'POST') {
    const { botToken, chatId, test, message } = req.body || {}
    try {
      if (botToken && typeof botToken === 'string') {
        await prisma.systemConfig.upsert({
          where: { key: 'TELEGRAM_BOT_TOKEN' },
          update: { value: botToken },
          create: { key: 'TELEGRAM_BOT_TOKEN', value: botToken }
        })
      }
      if (chatId && typeof chatId === 'string') {
        await prisma.systemConfig.upsert({
          where: { key: 'TELEGRAM_CHAT_ID' },
          update: { value: chatId },
          create: { key: 'TELEGRAM_CHAT_ID', value: chatId }
        })
      }
      if (test) {
        const text = typeof message === 'string' && message.trim().length > 0
          ? message
          : '🔔 Teste de integração: Telegram foi configurado com sucesso.'
        const result = await sendTelegramMessage(text, {
          token: typeof botToken === 'string' && botToken.trim().length > 0 ? botToken.trim() : undefined,
          chatId: typeof chatId === 'string' && chatId.trim().length > 0 ? chatId.trim() : undefined
        })
        return res.json({ ok: result.ok, result })
      }
      return res.json({ ok: true })
    } catch (error: any) {
      return res.status(500).json({ error: 'Internal error', details: error.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
