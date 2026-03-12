import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/ranking/weekly
 * Retorna o ranking semanal atual (domingo até agora, top 20)
 * e a posição do usuário logado.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Calcular início da semana atual (último domingo à meia-noite BRT = UTC-3)
    const now = new Date()
    const dayOfWeek = now.getUTCDay() // 0=Dom, 1=Seg, ..., 6=Sab
    // Ajuste para BRT (UTC-3): a semana começa domingo 00:00 BRT = domingo 03:00 UTC
    const weekStartUTC = new Date(now)
    weekStartUTC.setUTCDate(now.getUTCDate() - dayOfWeek)
    weekStartUTC.setUTCHours(3, 0, 0, 0) // domingo 00:00 BRT = 03:00 UTC

    // Se hoje é domingo e ainda não passaram as 3h UTC, voltar para o domingo anterior
    if (dayOfWeek === 0 && now.getUTCHours() < 3) {
      weekStartUTC.setUTCDate(weekStartUTC.getUTCDate() - 7)
    }

    // Calcular próximo reset (próximo domingo 00:00 BRT)
    const nextReset = new Date(weekStartUTC)
    nextReset.setUTCDate(nextReset.getUTCDate() + 7)

    // Buscar top 20 usuários por gerações semanais
    const topUsers = await prisma.user.findMany({
      where: {
        weeklyGenerations: { gt: 0 },
        isBanned: false,
        role: 'USER' // Apenas usuários normais concorrem
      },
      orderBy: { weeklyGenerations: 'desc' },
      take: 20,
      select: {
        id: true,
        username: true,
        weeklyGenerations: true,
        rankBadge: true,
        weeklyRankPosition: true,
        plan: {
          select: { name: true }
        }
      }
    })

    // Montar ranking com posições
    const rankings = topUsers.map((user, index) => ({
      position: index + 1,
      userId: user.id,
      username: user.username,
      count: user.weeklyGenerations,
      planName: user.plan?.name || null,
      badge: index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : null,
      lastWeekBadge: user.rankBadge || null
    }))

    // Posição do usuário logado
    let myPosition = null
    const session = await getServerSession(req, res, authOptions)
    if (session?.user?.id) {
      const myIndex = rankings.findIndex(r => r.userId === session.user.id)
      if (myIndex !== -1) {
        myPosition = myIndex + 1
      } else {
        // Usuário está fora do top 20, buscar posição exata
        const myUser = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { weeklyGenerations: true }
        })
        if (myUser && myUser.weeklyGenerations > 0) {
          const aboveMe = await prisma.user.count({
            where: {
              weeklyGenerations: { gt: myUser.weeklyGenerations },
              isBanned: false,
              role: 'USER'
            }
          })
          myPosition = aboveMe + 1
        }
      }
    }

    // Estatísticas gerais
    const totalParticipants = await prisma.user.count({
      where: { weeklyGenerations: { gt: 0 }, isBanned: false }
    })

    return res.json({
      success: true,
      weekStart: weekStartUTC.toISOString(),
      nextReset: nextReset.toISOString(),
      totalParticipants,
      rankings,
      myPosition
    })
  } catch (error: any) {
    console.error('❌ [ranking/weekly] Erro:', error)
    return res.status(500).json({ error: 'Erro interno ao buscar ranking' })
  }
}
