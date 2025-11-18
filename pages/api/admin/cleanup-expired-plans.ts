import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { cleanExpiredPlans } from '@/lib/plan-utils'

/**
 * API para limpar planos expirados
 * Somente administradores (OWNER) podem acessar
 * 
 * Esta API deve ser chamada periodicamente (via cron job ou manualmente)
 * para remover planos expirados dos usuários
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Verificar autenticação
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // Verificar se é OWNER
  if (session.user.role !== 'OWNER') {
    return res.status(403).json({ error: 'Forbidden - Only admins can cleanup expired plans' })
  }

  try {
    console.log('🔄 Iniciando limpeza de planos expirados...')
    const cleanedCount = await cleanExpiredPlans()
    
    return res.json({
      success: true,
      message: `${cleanedCount} planos expirados foram removidos`,
      cleanedCount
    })
  } catch (error: any) {
    console.error('❌ Erro na limpeza de planos expirados:', error)
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    })
  }
}

