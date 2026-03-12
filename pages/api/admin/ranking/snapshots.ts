import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/admin/ranking/snapshots
 * Retorna histórico de snapshots do ranking semanal (apenas admins)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const session = await getServerSession(req, res, authOptions)
  if (!session || !['OWNER', 'CO_OWNER', 'ADMIN'].includes(session.user.role)) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  try {
    const snapshots = await prisma.weeklyRankingSnapshot.findMany({
      orderBy: { weekEnd: 'desc' },
      take: 20
    })

    return res.json({ success: true, snapshots })
  } catch (error: any) {
    console.error('❌ [admin/ranking/snapshots]', error)
    return res.status(500).json({ error: 'Erro interno' })
  }
}
