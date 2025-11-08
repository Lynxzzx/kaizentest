import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!session || session.user.role !== 'OWNER') {
    return res.status(403).json({ error: 'Unauthorized' })
  }

  const { ids } = req.body

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'IDs array is required' })
  }

  try {
    // Verificar quais estoques estão usados (não podem ser deletados)
    const stocks = await prisma.stock.findMany({
      where: {
        id: { in: ids }
      },
      select: {
        id: true,
        isUsed: true
      }
    })

    const usedStocks = stocks.filter(s => s.isUsed)
    const availableStocks = stocks.filter(s => !s.isUsed)

    // Deletar apenas estoques disponíveis
    let deletedCount = 0
    if (availableStocks.length > 0) {
      const result = await prisma.stock.deleteMany({
        where: {
          id: { in: availableStocks.map(s => s.id) },
          isUsed: false
        }
      })
      deletedCount = result.count
    }

    // Se houver estoques usados, retornar aviso mas ainda assim retornar sucesso
    if (usedStocks.length > 0) {
      return res.json({
        success: true,
        deleted: deletedCount,
        total: ids.length,
        usedIds: usedStocks.map(s => s.id),
        warning: `${usedStocks.length} estoque(s) não podem ser excluídos pois já foram usados.`
      })
    }

    return res.json({
      success: true,
      deleted: deletedCount,
      total: ids.length
    })
  } catch (error: any) {
    console.error('Error deleting bulk stocks:', error)
    return res.status(500).json({ error: 'Error deleting stocks' })
  }
}

