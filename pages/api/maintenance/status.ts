import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'

/**
 * API pública para verificar o status do modo de manutenção
 * Não requer autenticação
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
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
  } catch (error: any) {
    console.error('Error checking maintenance status:', error)
    return res.json({
      isMaintenanceMode: false,
      message: 'O site está em manutenção. Volte em breve!'
    })
  }
}

