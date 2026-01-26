import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

/**
 * API para listar logs de segurança
 * 
 * GET: Listar logs de segurança (últimos 100)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' })
  }

  const session = await getServerSession(req, res, authOptions)

  if (!session?.user) {
    return res.status(401).json({ error: 'Não autenticado' })
  }

  // Verificar permissão (apenas OWNER, CO_OWNER e ADMIN)
  const user = await prisma.user.findUnique({
    where: { id: session.user.id }
  })

  if (!user || !['OWNER', 'CO_OWNER', 'ADMIN'].includes(user.role)) {
    return res.status(403).json({ error: 'Sem permissão' })
  }

  try {
    const { limit = '100', type, ip } = req.query

    const where: any = {}
    
    if (type && typeof type === 'string') {
      where.type = type
    }
    
    if (ip && typeof ip === 'string') {
      where.ip = ip
    }

    const logs = await prisma.securityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string) || 100
    })

    return res.status(200).json(logs)
  } catch (error: any) {
    console.error('Erro ao listar logs de segurança:', error)
    return res.status(500).json({ error: 'Erro ao listar logs de segurança' })
  }
}

