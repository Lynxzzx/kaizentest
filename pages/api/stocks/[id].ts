import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  const { id } = req.query

  if (req.method === 'GET') {
    if (!session || session.user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    const stock = await prisma.stock.findUnique({
      where: { id: id as string },
      include: {
        service: true
      }
    })

    if (!stock) {
      return res.status(404).json({ error: 'Stock not found' })
    }

    return res.json(stock)
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
    if (!session || session.user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    const { username, password, email, serviceId } = req.body

    // Verificar se o estoque existe
    const existingStock = await prisma.stock.findUnique({
      where: { id: id as string }
    })

    if (!existingStock) {
      return res.status(404).json({ error: 'Stock not found' })
    }

    // Se o estoque está usado, não permitir edição (exceto se for admin)
    if (existingStock.isUsed && !req.body.force) {
      return res.status(400).json({ 
        error: 'Este estoque já foi usado e não pode ser editado. Use o parâmetro force=true para forçar a edição.' 
      })
    }

    const stock = await prisma.stock.update({
      where: { id: id as string },
      data: {
        ...(username && { username }),
        ...(password && { password }),
        ...(email !== undefined && { email }),
        ...(serviceId && { serviceId })
      },
      include: {
        service: true
      }
    })

    return res.json(stock)
  }

  if (req.method === 'DELETE') {
    if (!session || session.user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    // Verificar se o estoque está usado
    const stock = await prisma.stock.findUnique({
      where: { id: id as string }
    })

    if (!stock) {
      return res.status(404).json({ error: 'Stock not found' })
    }

    if (stock.isUsed) {
      return res.status(400).json({ 
        error: 'Este estoque já foi usado e não pode ser excluído. Considere apenas desativá-lo.' 
      })
    }

    await prisma.stock.delete({
      where: { id: id as string }
    })

    return res.json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
