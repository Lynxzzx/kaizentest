import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

/**
 * API para listar resgates do usuário
 * GET /api/affiliate/withdrawals
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const session = await getServerSession(req, res, authOptions)
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const withdrawals = await prisma.affiliateWithdrawal.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        amount: true,
        pixKey: true,
        pixKeyType: true,
        status: true,
        adminNotes: true,
        processedAt: true,
        createdAt: true
      }
    })

    return res.json({ withdrawals })

  } catch (error: any) {
    console.error('Erro ao listar resgates:', error)
    return res.status(500).json({
      error: 'Erro interno',
      details: error.message
    })
  }
}

