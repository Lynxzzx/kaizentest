import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { username } = req.query

    if (!username || typeof username !== 'string') {
      return res.status(400).json({ error: 'Username is required' })
    }

    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        bio: true,
        profilePicture: true,
        role: true,
        createdAt: true,
        plan: {
          select: {
            id: true,
            name: true
          }
        },
        planExpiresAt: true,
        _count: {
          select: {
            generatedAccounts: true,
            payments: true,
            chatMessages: true
          }
        }
      }
    })

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    return res.json({ user })
  } catch (error: any) {
    console.error('Error fetching profile:', error)
    return res.status(500).json({ error: 'Error fetching profile' })
  }
}

