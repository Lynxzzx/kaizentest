import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '5mb', // Limite para imagens base64
    },
  },
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { image } = req.body

    if (!image || typeof image !== 'string') {
      return res.status(400).json({ error: 'Image is required' })
    }

    // Validar formato base64
    if (!image.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Invalid image format' })
    }

    // Validar tamanho (aproximadamente 5MB em base64)
    const base64Size = image.length * 0.75
    if (base64Size > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image too large (max 5MB)' })
    }

    // Validar tipo de imagem
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    const imageType = image.match(/data:image\/(\w+);base64/)?.[1]
    if (!imageType || !validTypes.includes(`image/${imageType.toLowerCase()}`)) {
      return res.status(400).json({ error: 'Invalid image type. Only JPEG, PNG, GIF and WebP are allowed' })
    }

    // Atualizar perfil com a imagem base64
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        profilePicture: image
      },
      select: {
        id: true,
        username: true,
        profilePicture: true
      }
    })

    return res.json({ 
      success: true,
      profilePicture: updatedUser.profilePicture 
    })
  } catch (error: any) {
    console.error('Error uploading profile picture:', error)
    return res.status(500).json({ error: 'Error uploading profile picture', details: error.message })
  }
}

