import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import { generateApiKey } from '@/lib/api-key-utils'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method === 'GET') {
    // Listar API keys do usuário
    const apiKeys = await prisma.apiKey.findMany({
      where: { userId: session.user.id },
      include: {
        plan: {
          select: { name: true, price: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return res.json(apiKeys)
  }

  if (req.method === 'POST') {
    return res.status(503).json({ error: 'API offline', message: 'Geração de API key indisponível no momento.' })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
