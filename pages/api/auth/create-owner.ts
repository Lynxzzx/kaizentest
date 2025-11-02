import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const ownerExists = await prisma.user.findFirst({
      where: { username: 'Lynx', role: 'OWNER' }
    })

    if (ownerExists) {
      return res.json({ message: 'Owner already exists', owner: ownerExists })
    }

    const hashedPassword = await hashPassword('eliezermito1')

    const owner = await prisma.user.create({
      data: {
        username: 'Lynx',
        password: hashedPassword,
        role: 'OWNER'
      }
    })

    return res.json({ message: 'Owner created successfully', owner })
  } catch (error: any) {
    console.error('Error creating owner:', error)
    return res.status(500).json({ error: 'Error creating owner' })
  }
}
