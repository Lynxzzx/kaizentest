import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { theme } = req.body

    if (!theme || !['dark', 'light', 'default'].includes(theme)) {
      return res.status(400).json({ error: 'Invalid theme. Must be dark, light, or default' })
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: { theme },
      select: {
        id: true,
        username: true,
        theme: true
      }
    })

    return res.json({ user: updatedUser })
  } catch (error: any) {
    console.error('Error updating theme:', error)
    return res.status(500).json({ error: 'Error updating theme' })
  }
}

