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

  const { serviceId } = req.body

  if (!serviceId) {
    return res.status(400).json({ error: 'ServiceId is required' })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { plan: true }
  })

  if (!user) {
    return res.status(404).json({ error: 'User not found' })
  }

  // Verificar se usuário está banido
  if (user.isBanned) {
    return res.status(403).json({ error: 'Usuário banido. Entre em contato com o suporte.' })
  }

  // Verificar gerações grátis diárias (2 por dia)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const lastFreeGenDate = user.lastFreeGenerationDate ? new Date(user.lastFreeGenerationDate) : null
  const lastFreeGenDateStart = lastFreeGenDate ? new Date(lastFreeGenDate) : null
  if (lastFreeGenDateStart) {
    lastFreeGenDateStart.setHours(0, 0, 0, 0)
  }

  let useFreeGeneration = false
  
  // Se é um novo dia, resetar contador
  if (!lastFreeGenDateStart || lastFreeGenDateStart.getTime() !== today.getTime()) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        dailyFreeGenerations: 0,
        lastFreeGenerationDate: today
      }
    })
    user.dailyFreeGenerations = 0
  }

  // Verificar se pode usar geração grátis (máximo 2 por dia)
  if (user.dailyFreeGenerations < 2) {
    useFreeGeneration = true
  }

  // Verificar se tem plano ativo
  const hasActivePlan = user.planId && (!user.planExpiresAt || new Date() <= user.planExpiresAt)
  
  // Verificar se tem gerações bonus disponíveis
  const hasBonusGenerations = user.bonusGenerations > 0
  
  // Se não tem plano ativo, só pode usar gerações grátis diárias ou bonus
  if (!hasActivePlan && !useFreeGeneration && !hasBonusGenerations) {
    return res.status(400).json({ error: 'Você não possui um plano ativo e já usou suas 2 gerações grátis de hoje. Adquira um plano ou aguarde até amanhã.' })
  }

  // Se está usando geração grátis diária, não precisa verificar limites do plano
  if (useFreeGeneration) {
    // Já será tratado abaixo, apenas incrementar contador
  } else if (hasActivePlan && user.planId) {
    // Check max generations (considerando gerações bonus)
    const generatedCount = await prisma.generatedAccount.count({
      where: { userId: session.user.id }
    })

    // Total de gerações permitidas = maxGenerations do plano + bonusGenerations
    const totalAllowed = user.plan!.maxGenerations === 0 
      ? Infinity 
      : user.plan!.maxGenerations + user.bonusGenerations

    if (user.plan!.maxGenerations > 0 && generatedCount >= totalAllowed) {
      // Verificar se ainda tem gerações bonus disponíveis
      if (generatedCount >= user.plan!.maxGenerations) {
        // Se já usou todas do plano, usar bonus
        if (user.bonusGenerations > 0) {
          // Decrementar bonus
          await prisma.user.update({
            where: { id: user.id },
            data: {
              bonusGenerations: {
                decrement: 1
              }
            }
          })
        } else {
          return res.status(400).json({ error: 'Max generations reached' })
        }
      }
    }
  } else if (hasBonusGenerations) {
    // Usuário sem plano ativo, mas tem gerações bonus - usar uma
    await prisma.user.update({
      where: { id: user.id },
      data: {
        bonusGenerations: {
          decrement: 1
        }
      }
    })
  }

  // Find available stock
  const stock = await prisma.stock.findFirst({
    where: {
      serviceId,
      isUsed: false
    }
  })

  if (!stock) {
    return res.status(404).json({ error: 'No stock available for this service' })
  }

  // Mark stock as used
  await prisma.stock.update({
    where: { id: stock.id },
    data: {
      isUsed: true,
      usedAt: new Date(),
      usedBy: session.user.id
    }
  })

  // Create generated account
  const generatedAccount = await prisma.generatedAccount.create({
    data: {
      userId: session.user.id,
      stockId: stock.id
    },
    include: {
      stock: true
    }
  })

  // Atualizar contador de gerações grátis se necessário
  if (useFreeGeneration) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        dailyFreeGenerations: {
          increment: 1
        },
        lastFreeGenerationDate: today
      }
    })
  }

  return res.json({
    id: generatedAccount.id,
    username: stock.username,
    password: stock.password,
    email: stock.email,
    extraData: stock.extraData ? JSON.parse(stock.extraData) : null,
    createdAt: generatedAccount.createdAt,
    isFreeGeneration: useFreeGeneration
  })
}
