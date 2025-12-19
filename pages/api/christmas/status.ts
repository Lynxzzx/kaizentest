import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'

/**
 * API pública para verificar se o modo natalino está ativo
 * GET /api/christmas/status
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Buscar configuração do modo natalino
    const config = await prisma.systemConfig.findUnique({
      where: { key: 'CHRISTMAS_MODE' }
    })

    // Se não existir ou valor não for 'true', retorna false
    const enabled = config?.value === 'true'

    return res.json({ 
      enabled,
      updatedAt: config?.updatedAt || null
    })
  } catch (error: any) {
    console.error('Erro ao verificar modo natalino:', error)
    return res.status(500).json({ 
      error: 'Internal server error',
      enabled: false
    })
  }
}

