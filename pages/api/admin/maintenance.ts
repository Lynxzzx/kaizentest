import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

/**
 * API para gerenciar o modo de manutenção
 * GET: Obter configurações de manutenção
 * POST: Atualizar configurações de manutenção (apenas OWNER)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Verificar autenticação
    const session = await getServerSession(req, res, authOptions)
    if (!session || !session.user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Verificar se é owner
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!user || user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Forbidden - Owner only' })
    }

    if (req.method === 'GET') {
      // Obter configurações de manutenção
      const maintenanceModeConfig = await prisma.systemConfig.findUnique({
        where: { key: 'MAINTENANCE_MODE' }
      })

      const maintenanceMessageConfig = await prisma.systemConfig.findUnique({
        where: { key: 'MAINTENANCE_MESSAGE' }
      })

      const isMaintenanceMode = maintenanceModeConfig?.value === 'true'
      const message = maintenanceMessageConfig?.value || 'O site está em manutenção. Volte em breve!'

      return res.json({
        isMaintenanceMode,
        message
      })
    }

    if (req.method === 'POST') {
      // Atualizar configurações de manutenção
      const { isMaintenanceMode, message } = req.body

      if (typeof isMaintenanceMode !== 'boolean') {
        return res.status(400).json({ error: 'isMaintenanceMode deve ser um booleano' })
      }

      if (isMaintenanceMode && (!message || !message.trim())) {
        return res.status(400).json({ error: 'Mensagem de manutenção é obrigatória quando o modo está ativo' })
      }

      // Atualizar ou criar configuração de modo de manutenção
      await prisma.systemConfig.upsert({
        where: { key: 'MAINTENANCE_MODE' },
        update: {
          value: isMaintenanceMode ? 'true' : 'false',
          updatedById: user.id
        },
        create: {
          key: 'MAINTENANCE_MODE',
          value: isMaintenanceMode ? 'true' : 'false',
          description: 'Modo de manutenção do site',
          updatedById: user.id
        }
      })

      // Atualizar ou criar configuração de mensagem de manutenção
      await prisma.systemConfig.upsert({
        where: { key: 'MAINTENANCE_MESSAGE' },
        update: {
          value: message?.trim() || 'O site está em manutenção. Volte em breve!',
          updatedById: user.id
        },
        create: {
          key: 'MAINTENANCE_MESSAGE',
          value: message?.trim() || 'O site está em manutenção. Volte em breve!',
          description: 'Mensagem exibida durante o modo de manutenção',
          updatedById: user.id
        }
      })

      return res.json({
        success: true,
        isMaintenanceMode,
        message: message?.trim() || 'O site está em manutenção. Volte em breve!'
      })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error: any) {
    console.error('Error managing maintenance mode:', error)
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    })
  }
}

