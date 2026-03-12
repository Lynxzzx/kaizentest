import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/cron/reset-weekly-ranking
 *
 * Reseta o ranking semanal e premia os top 3.
 * Deve ser chamado todo domingo às 00:00 BRT (03:00 UTC).
 *
 * Proteção: Authorization: Bearer <CRON_SECRET>
 *
 * Prêmios:
 * 🥇 1º: cooldown ÷2 por 7 dias + 10 gerações bônus + badge "gold"
 * 🥈 2º: cooldown ÷2 por 7 dias + 5 gerações bônus  + badge "silver"
 * 🥉 3º: cooldown ÷2 por 7 dias + 3 gerações bônus  + badge "bronze"
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authHeader = req.headers.authorization
  const cronSecret = process.env.CRON_SECRET || 'kaizen_cron_secret_2024'

  if (authHeader !== `Bearer ${cronSecret}`) {
    console.warn('⚠️ [cron-ranking] Tentativa de acesso não autorizado')
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    console.log('🏆 [cron-ranking] Iniciando reset do ranking semanal...')

    const now = new Date()

    // Calcular intervalo da semana que acabou (domingo 03:00 UTC → domingo 03:00 UTC)
    const weekEnd = new Date(now)
    const weekStart = new Date(now)
    weekStart.setUTCDate(weekStart.getUTCDate() - 7)

    // Buscar top 3 usuários por gerações semanais (apenas USERs, não banidos)
    const top3 = await prisma.user.findMany({
      where: {
        weeklyGenerations: { gt: 0 },
        isBanned: false,
        role: 'USER'
      },
      orderBy: { weeklyGenerations: 'desc' },
      take: 3,
      select: {
        id: true,
        username: true,
        weeklyGenerations: true,
        bonusGenerations: true,
        plan: { select: { name: true } }
      }
    })

    console.log(`📊 [cron-ranking] Top 3 encontrados: ${top3.map(u => `${u.username}(${u.weeklyGenerations})`).join(', ')}`)

    // Prêmios por posição
    const prizes = [
      { position: 1, badge: 'gold', bonusGenerations: 10 },
      { position: 2, badge: 'silver', bonusGenerations: 5 },
      { position: 3, badge: 'bronze', bonusGenerations: 3 }
    ]

    const cooldownHalvedUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // +7 dias

    // Salvar snapshot do ranking completo (top 20) para histórico
    const top20 = await prisma.user.findMany({
      where: { weeklyGenerations: { gt: 0 }, isBanned: false },
      orderBy: { weeklyGenerations: 'desc' },
      take: 20,
      select: { id: true, username: true, weeklyGenerations: true }
    })

    const rankingsSnapshot = top20.map((u, i) => ({
      position: i + 1,
      userId: u.id,
      username: u.username,
      count: u.weeklyGenerations,
      badge: i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : null
    }))

    await prisma.weeklyRankingSnapshot.create({
      data: {
        weekStart,
        weekEnd,
        rankings: JSON.stringify(rankingsSnapshot)
      }
    })

    console.log('📸 [cron-ranking] Snapshot histórico salvo')

    // Aplicar prêmios para top 3
    const awardResults: any[] = []
    for (let i = 0; i < top3.length; i++) {
      const user = top3[i]
      const prize = prizes[i]

      await prisma.user.update({
        where: { id: user.id },
        data: {
          // Cooldown pela metade por 7 dias
          cooldownHalved: true,
          cooldownHalvedUntil,
          // Gerações bônus
          bonusGenerations: { increment: prize.bonusGenerations },
          // Badge da posição
          rankBadge: prize.badge,
          weeklyRankPosition: prize.position
        }
      })

      awardResults.push({
        username: user.username,
        position: prize.position,
        badge: prize.badge,
        bonusGenerations: prize.bonusGenerations,
        previousWeeklyCount: user.weeklyGenerations
      })

      console.log(`🏅 [cron-ranking] ${prize.badge.toUpperCase()} premiado: ${user.username} (${user.weeklyGenerations} gerações) → +${prize.bonusGenerations} bônus + cooldown ÷2`)
    }

    // Remover badge dos usuários que estavam no top 3 mas NÃO estão mais
    // (limpar badges de semanas anteriores para quem saiu do top 3)
    const top3Ids = top3.map(u => u.id)
    await prisma.user.updateMany({
      where: {
        rankBadge: { not: null },
        id: { notIn: top3Ids }
      },
      data: {
        rankBadge: null,
        weeklyRankPosition: null
      }
    })

    // Remover cooldown expirado de usuários que tinham mas já venceu
    await prisma.user.updateMany({
      where: {
        cooldownHalved: true,
        cooldownHalvedUntil: { lt: now }
      },
      data: {
        cooldownHalved: false,
        cooldownHalvedUntil: null
      }
    })

    // Resetar weeklyGenerations de TODOS os usuários
    const resetResult = await prisma.user.updateMany({
      data: { weeklyGenerations: 0 }
    })

    console.log(`✅ [cron-ranking] Reset concluído! ${resetResult.count} usuários resetados.`)

    return res.json({
      success: true,
      message: 'Ranking semanal resetado e prêmios distribuídos!',
      timestamp: now.toISOString(),
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      usersReset: resetResult.count,
      top3Awarded: awardResults,
      cooldownHalvedUntil: cooldownHalvedUntil.toISOString()
    })
  } catch (error: any) {
    console.error('❌ [cron-ranking] Erro geral:', error)
    return res.status(500).json({ error: 'Erro interno', details: error.message })
  }
}
