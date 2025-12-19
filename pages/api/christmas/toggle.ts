import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

/**
 * API para ativar/desativar modo natalino (apenas admin)
 * POST /api/christmas/toggle
 * Body: { enabled: boolean }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Verificar autenticação
    const session = await getServerSession(req, res, authOptions)
    if (!session || !session.user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Verificar se é admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!user || (user.role !== 'ADMIN' && user.role !== 'OWNER')) {
      return res.status(403).json({ error: 'Forbidden - Admin only' })
    }

    const { enabled } = req.body

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'Campo "enabled" é obrigatório e deve ser boolean' })
    }

    // Atualizar ou criar configuração
    const config = await prisma.systemConfig.upsert({
      where: { key: 'CHRISTMAS_MODE' },
      update: {
        value: enabled ? 'true' : 'false',
        updatedById: user.id
      },
      create: {
        key: 'CHRISTMAS_MODE',
        value: enabled ? 'true' : 'false',
        description: 'Modo natalino do site - exibe decorações e efeitos de Natal',
        isEncrypted: false,
        updatedById: user.id
      }
    })

    return res.json({
      success: true,
      enabled: config.value === 'true',
      message: enabled ? 'Modo natalino ativado!' : 'Modo natalino desativado!'
    })
  } catch (error: any) {
    console.error('Erro ao alternar modo natalino:', error)
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    })
  }
}

