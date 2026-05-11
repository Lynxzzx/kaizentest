import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const type = typeof req.query.type === 'string' ? req.query.type.toUpperCase() : null
      if (type === 'API') {
        const apiPlans = await prisma.plan.findMany({
          where: {
            isActive: true,
            OR: [
              { type: 'API' },
              { name: { contains: 'API', mode: 'insensitive' } }
            ]
          },
          orderBy: { price: 'asc' }
        })
        return res.json(apiPlans)
      }
      if (type === 'SITE') {
        // Evita NOT/OR + contains(mode) no Mongo (gera erro em várias versões). Filtra em memória.
        const allActive = await prisma.plan.findMany({
          where: { isActive: true },
          orderBy: { price: 'asc' }
        })
        const rows = allActive.filter(
          (p) =>
            p.type !== 'API' &&
            !String(p.name || '')
              .toLowerCase()
              .includes('api')
        )
        return res.json(rows)
      }
      const plans = await prisma.plan.findMany({
        where: { isActive: true },
        orderBy: { price: 'asc' }
      })
      return res.json(plans)
    } catch (err) {
      console.error('[api/plans] GET failed:', err)
      return res.status(500).json({
        error: 'Falha ao carregar planos',
        message: err instanceof Error ? err.message : String(err)
      })
    }
  }

  if (req.method === 'POST') {
    const session = await getServerSession(req, res, authOptions)
    if (!session || session.user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    const { name, description, price, duration, maxGenerations, generationCooldownSeconds } = req.body

    if (!name || !price || !duration) {
      return res.status(400).json({ error: 'Name, price and duration are required' })
    }

    const plan = await prisma.plan.create({
      data: {
        name,
        description,
        price: parseFloat(price),
        duration: parseInt(duration),
        maxGenerations: maxGenerations ? parseInt(maxGenerations) : 0,
        generationCooldownSeconds: generationCooldownSeconds ? parseInt(generationCooldownSeconds) : 120
      }
    })

    return res.json(plan)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
