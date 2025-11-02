import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { code } = req.body

  if (!code || !code.trim()) {
    return res.status(400).json({ error: 'Code is required' })
  }

  try {
    console.log('Redeeming affiliate code:', code)
    
    // Buscar usuário que possui o código
    const referrer = await prisma.user.findFirst({
      where: { affiliateCode: code.trim().toUpperCase() }
    })

    if (!referrer) {
      console.log('Affiliate code not found:', code)
      return res.status(404).json({ error: 'Código de afiliado inválido' })
    }

    // Verificar se o usuário atual já foi referenciado
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' })
    }

    if (currentUser.referredBy) {
      console.log('User already referred by:', currentUser.referredBy)
      return res.status(400).json({ error: 'Você já utilizou um código de afiliado' })
    }

    if (currentUser.id === referrer.id) {
      console.log('User trying to use own code')
      return res.status(400).json({ error: 'Você não pode usar seu próprio código' })
    }

    // Verificar se já existe recompensa para este usuário
    const existingReward = await prisma.affiliateReward.findFirst({
      where: { referredUserId: currentUser.id }
    })

    if (existingReward) {
      console.log('Reward already exists for user:', currentUser.id)
      return res.status(400).json({ error: 'Você já foi referenciado anteriormente' })
    }

    // Criar recompensa
    console.log('Creating affiliate reward...')
    await prisma.affiliateReward.create({
      data: {
        userId: referrer.id,
        referredUserId: currentUser.id,
        rewardedGenerations: 2
      }
    })

    // Atualizar usuário referido
    await prisma.user.update({
      where: { id: currentUser.id },
      data: { referredBy: referrer.id }
    })

    // Adicionar gerações bonus ao referenciador
    await prisma.user.update({
      where: { id: referrer.id },
      data: {
        bonusGenerations: {
          increment: 2
        }
      }
    })

    console.log('Affiliate reward created successfully')
    return res.json({ 
      success: true,
      message: 'Código de afiliado resgatado! Você ganhou 2 gerações grátis.',
      rewardedGenerations: 2
    })
  } catch (error: any) {
    console.error('Error redeeming affiliate code:', error)
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    })
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    })
  }
}
