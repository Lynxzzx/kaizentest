import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import { clearBlockedIp } from '@/lib/security'

/**
 * API para gerenciar IPs banidos
 * 
 * GET: Listar IPs banidos
 * POST: Banir novo IP
 * DELETE: Desbanir IP
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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

  // GET - Listar IPs banidos
  if (req.method === 'GET') {
    try {
      const bannedIps = await prisma.bannedIp.findMany({
        include: {
          bannedBy: {
            select: {
              id: true,
              username: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      })

      // Buscar estatísticas de cada IP
      const ipsWithStats = await Promise.all(
        bannedIps.map(async (ban) => {
          const stats = await prisma.securityLog.aggregate({
            where: { ip: ban.ip },
            _count: true
          })

          const lastActivity = await prisma.securityLog.findFirst({
            where: { ip: ban.ip },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true, type: true }
          })

          return {
            ...ban,
            totalAttempts: stats._count,
            lastActivity: lastActivity?.createdAt || null,
            lastActivityType: lastActivity?.type || null
          }
        })
      )

      return res.status(200).json(ipsWithStats)
    } catch (error: any) {
      console.error('Erro ao listar IPs banidos:', error)
      return res.status(500).json({ error: 'Erro ao listar IPs banidos' })
    }
  }

  // POST - Banir IP
  if (req.method === 'POST') {
    try {
      const { ip, reason, duration } = req.body

      if (!ip || !reason) {
        return res.status(400).json({ error: 'IP e motivo são obrigatórios' })
      }

      // Validar formato do IP
      const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
      const ipv6Regex = /^(?:[a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}$/
      
      if (!ipRegex.test(ip) && !ipv6Regex.test(ip) && ip !== 'unknown') {
        return res.status(400).json({ error: 'Formato de IP inválido' })
      }

      // Verificar se já está banido
      const existing = await prisma.bannedIp.findUnique({
        where: { ip }
      })

      if (existing) {
        return res.status(400).json({ error: 'Este IP já está banido' })
      }

      // Calcular data de expiração (se fornecida)
      let expiresAt: Date | null = null
      if (duration && duration > 0) {
        expiresAt = new Date()
        expiresAt.setHours(expiresAt.getHours() + duration)
      }

      // Criar banimento
      const bannedIp = await prisma.bannedIp.create({
        data: {
          ip,
          reason,
          bannedById: user.id,
          expiresAt
        },
        include: {
          bannedBy: {
            select: {
              id: true,
              username: true
            }
          }
        }
      })

      // Limpar do cache de rate limiting (para garantir que o banimento seja aplicado)
      clearBlockedIp(ip)

      // Registrar log de segurança
      await prisma.securityLog.create({
        data: {
          type: 'blocked',
          ip,
          username: null,
          success: true,
          reason: `IP banido por ${user.username}: ${reason}`,
          metadata: JSON.stringify({
            bannedById: user.id,
            duration: duration || 'permanente'
          })
        }
      })

      return res.status(201).json({
        message: 'IP banido com sucesso',
        bannedIp
      })
    } catch (error: any) {
      console.error('Erro ao banir IP:', error)
      return res.status(500).json({ error: 'Erro ao banir IP' })
    }
  }

  // DELETE - Desbanir IP
  if (req.method === 'DELETE') {
    try {
      const { ip } = req.body

      if (!ip) {
        return res.status(400).json({ error: 'IP é obrigatório' })
      }

      // Verificar se está banido
      const existing = await prisma.bannedIp.findUnique({
        where: { ip }
      })

      if (!existing) {
        return res.status(404).json({ error: 'IP não está banido' })
      }

      // Remover banimento
      await prisma.bannedIp.delete({
        where: { ip }
      })

      // Limpar do cache de rate limiting
      clearBlockedIp(ip)

      // Registrar log
      await prisma.securityLog.create({
        data: {
          type: 'blocked',
          ip,
          username: null,
          success: true,
          reason: `IP desbanido por ${user.username}`,
          metadata: JSON.stringify({
            unbannedById: user.id
          })
        }
      })

      return res.status(200).json({ message: 'IP desbanido com sucesso' })
    } catch (error: any) {
      console.error('Erro ao desbanir IP:', error)
      return res.status(500).json({ error: 'Erro ao desbanir IP' })
    }
  }

  return res.status(405).json({ error: 'Método não permitido' })
}

