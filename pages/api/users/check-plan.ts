import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { checkAndCleanUserPlan, isUserPlanActive } from '@/lib/plan-utils'
import { prisma } from '@/lib/prisma'

/**
 * API para verificar e limpar plano expirado do usuário autenticado
 * Deve ser chamada periodicamente pelo frontend para manter dados consistentes
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    // Limpa o plano se estiver expirado
    const wasCleanedUp = await checkAndCleanUserPlan(session.user.id)

    // Busca dados atualizados do usuário
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { plan: true },
      select: {
        id: true,
        username: true,
        planId: true,
        planExpiresAt: true,
        plan: true
      }
    })

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const isActive = isUserPlanActive(user.planId, user.planExpiresAt)

    return res.json({
      planActive: isActive,
      wasCleanedUp,
      plan: user.plan,
      planExpiresAt: user.planExpiresAt
    })
  } catch (error: any) {
    console.error('❌ Erro ao verificar plano do usuário:', error)
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    })
  }
}

