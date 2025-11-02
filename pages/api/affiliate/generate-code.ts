import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Se já tem código, retornar
    if (user.affiliateCode) {
      return res.json({ code: user.affiliateCode })
    }

    // Gerar código único
    let affiliateCode: string = ''
    let attempts = 0
    const maxAttempts = 10

    while (attempts < maxAttempts) {
      // Gerar código de 12 caracteres
      affiliateCode = randomBytes(6).toString('hex').toUpperCase()
      
      const existing = await prisma.user.findFirst({
        where: { affiliateCode }
      })
      
      if (!existing) {
        break // Código único encontrado
      }
      
      attempts++
    }

    if (attempts >= maxAttempts) {
      console.error('Failed to generate unique affiliate code after', maxAttempts, 'attempts')
      return res.status(500).json({ error: 'Failed to generate unique affiliate code. Please try again.' })
    }

    // Salvar código
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { affiliateCode }
    })

    return res.json({ code: updated.affiliateCode })
  } catch (error: any) {
    console.error('Error generating affiliate code:', error)
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    })
  }
}
