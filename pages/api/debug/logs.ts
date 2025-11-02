import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'

// Esta é uma rota temporária para debug - remover em produção
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Apenas admin pode ver logs
  if (!session || session.user.role !== 'OWNER') {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // Retornar informações de ambiente e possíveis problemas
  return res.json({
    env: {
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      hasAsaasKey: !!process.env.ASAAS_API_KEY,
      hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
      nodeEnv: process.env.NODE_ENV,
      asaasApiUrl: process.env.ASAAS_API_URL || 'https://api.asaas.com/v3'
    },
    timestamp: new Date().toISOString(),
    message: 'Verifique o console do servidor para logs detalhados'
  })
}

