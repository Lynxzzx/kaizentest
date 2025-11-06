import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

/**
 * API para listar configurações do sistema
 * Apenas admins podem ver
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
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

    const configs = await prisma.systemConfig.findMany({
      orderBy: { key: 'asc' },
      include: {
        updatedBy: {
          select: {
            id: true,
            username: true,
            email: true
          }
        }
      }
    })

    // Não retornar valores sensíveis, apenas indicar se está configurado
    const safeConfigs = configs.map(config => ({
      id: config.id,
      key: config.key,
      description: config.description,
      isConfigured: !!config.value && config.value.length > 0,
      valueLength: config.value?.length || 0,
      isEncrypted: config.isEncrypted,
      updatedBy: config.updatedBy,
      updatedAt: config.updatedAt,
      createdAt: config.createdAt
    }))

    return res.json({ configs: safeConfigs })
  } catch (error: any) {
    console.error('Error listing configs:', error)
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    })
  }
}

