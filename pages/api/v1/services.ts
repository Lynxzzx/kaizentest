import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { validateApiKey } from '@/lib/api-key-utils'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Autenticação por API Key
  const apiKey = req.headers['x-api-key'] as string || req.query.apiKey as string

  if (!apiKey) {
    return res.status(401).json({ error: 'API key is required' })
  }

  const validation = await validateApiKey(apiKey)
  if (!validation.valid || !validation.apiKeyData) {
    return res.status(401).json({ error: validation.error || 'Invalid API key' })
  }

  const apiKeyData = validation.apiKeyData

  try {
    // Buscar todos os serviços ativos
    let services = await prisma.service.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        icon: true
      }
    })

    // Se o plano tem serviços específicos permitidos, filtrar
    if (apiKeyData.allowedServiceIds.length > 0) {
      services = services.filter(s => apiKeyData.allowedServiceIds.includes(s.id))
    }

    // Adicionar contagem de estoque disponível
    const servicesWithStock = await Promise.all(
      services.map(async (service) => {
        const stockCount = await prisma.stock.count({
          where: {
            serviceId: service.id,
            isUsed: false
          }
        })
        return {
          ...service,
          stockAvailable: stockCount
        }
      })
    )

    return res.json({
      success: true,
      services: servicesWithStock
    })
  } catch (error) {
    console.error('API services error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}