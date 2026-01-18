import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { id } = req.query

  if (req.method === 'GET') {
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        id: id as string,
        userId: session.user.id
      },
      include: {
        plan: true,
        usageLogs: {
          take: 50,
          orderBy: { createdAt: 'desc' },
          include: {
            service: {
              select: { name: true }
            }
          }
        }
      }
    })

    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' })
    }

    return res.json(apiKey)
  }

  if (req.method === 'DELETE') {
    await prisma.apiKey.delete({
      where: {
        id: id as string,
        userId: session.user.id // Garantir que só o dono pode deletar
      }
    })

    return res.json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}