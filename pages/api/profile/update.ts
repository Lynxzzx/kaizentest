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
    const { bio, profilePicture } = req.body

    const updateData: any = {}

    if (bio !== undefined) {
      if (bio && bio.length > 500) {
        return res.status(400).json({ error: 'Bio too long (max 500 characters)' })
      }
      updateData.bio = bio || null
    }

    if (profilePicture !== undefined) {
      if (profilePicture && profilePicture.length > 500) {
        return res.status(400).json({ error: 'Profile picture URL too long' })
      }
      updateData.profilePicture = profilePicture || null
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        bio: true,
        profilePicture: true,
        role: true,
        createdAt: true
      }
    })

    return res.json({ user: updatedUser })
  } catch (error: any) {
    console.error('Error updating profile:', error)
    return res.status(500).json({ error: 'Error updating profile' })
  }
}

