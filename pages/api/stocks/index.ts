import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import { sendStockRestockNotification } from '@/lib/discord-webhook'

const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1462491603875926151/zjLBTVjZLpA20IhBjAs5NQvV4J4nbKn8t3hlNEZ_vYFMCMnLjNc4h_RmpiMqkbD2xmfT'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (req.method === 'GET') {
    if (!session || session.user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    const { serviceId } = req.query

    const stocks = await prisma.stock.findMany({
      where: serviceId ? { serviceId: serviceId as string } : {},
      include: {
        service: true
      },
      orderBy: { createdAt: 'desc' }
    })

    return res.json(stocks)
  }

  if (req.method === 'POST') {
    if (!session || session.user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    const { serviceId, username, password, email, extraData } = req.body

    if (!serviceId || !username || !password) {
      return res.status(400).json({ error: 'ServiceId, username and password are required' })
    }

    const stock = await prisma.stock.create({
      data: {
        serviceId,
        username,
        password,
        email,
        extraData: extraData ? JSON.stringify(extraData) : null
      },
      include: {
        service: true
      }
    })

    // Enviar notificação do Discord
    try {
      await sendStockRestockNotification(
        DISCORD_WEBHOOK_URL,
        stock.service.name,
        1
      )
    } catch (error) {
      console.error('Error sending Discord notification:', error)
      // Não bloquear a resposta se o webhook falhar
    }

    return res.json(stock)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
