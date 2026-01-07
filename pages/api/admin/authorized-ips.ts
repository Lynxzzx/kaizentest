import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import { logAdminAction, getIpFromRequest } from '@/lib/admin-log'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true }
  })

  // Apenas OWNER pode gerenciar IPs autorizados
  if (!currentUser || currentUser.role !== 'OWNER') {
    return res.status(403).json({ error: 'Apenas o Owner pode gerenciar IPs autorizados' })
  }

  if (req.method === 'GET') {
    try {
      const authorizedIps = await prisma.authorizedIp.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          authorizedBy: {
            select: {
              id: true,
              username: true
            }
          }
        }
      })

      return res.json({ authorizedIps })
    } catch (error: any) {
      console.error('Error fetching authorized IPs:', error)
      return res.status(500).json({ error: 'Erro ao buscar IPs autorizados' })
    }
  }

  if (req.method === 'POST') {
    try {
      const { ip, description } = req.body

      if (!ip || typeof ip !== 'string') {
        return res.status(400).json({ error: 'IP é obrigatório' })
      }

      // Validar formato básico de IP
      const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
      if (!ipRegex.test(ip.trim())) {
        return res.status(400).json({ error: 'Formato de IP inválido' })
      }

      // Verificar se já existe
      const existing = await prisma.authorizedIp.findUnique({
        where: { ip: ip.trim() }
      })

      if (existing) {
        return res.status(400).json({ error: 'Este IP já está autorizado' })
      }

      const authorizedIp = await prisma.authorizedIp.create({
        data: {
          ip: ip.trim(),
          description: description || null,
          authorizedById: session.user.id
        },
        include: {
          authorizedBy: {
            select: {
              id: true,
              username: true
            }
          }
        }
      })

      // Registrar log
      await logAdminAction({
        userId: session.user.id,
        action: 'OTHER',
        targetType: 'AuthorizedIp',
        targetId: authorizedIp.id,
        targetName: ip.trim(),
        details: {
          action: 'authorize_ip',
          description
        },
        ipAddress: getIpFromRequest(req)
      })

      return res.status(201).json({ authorizedIp })
    } catch (error: any) {
      console.error('Error creating authorized IP:', error)
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Este IP já está autorizado' })
      }
      return res.status(500).json({ error: 'Erro ao autorizar IP' })
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { id } = req.body

      if (!id) {
        return res.status(400).json({ error: 'ID é obrigatório' })
      }

      const authorizedIp = await prisma.authorizedIp.findUnique({
        where: { id }
      })

      if (!authorizedIp) {
        return res.status(404).json({ error: 'IP autorizado não encontrado' })
      }

      await prisma.authorizedIp.delete({
        where: { id }
      })

      // Registrar log
      await logAdminAction({
        userId: session.user.id,
        action: 'OTHER',
        targetType: 'AuthorizedIp',
        targetId: id,
        targetName: authorizedIp.ip,
        details: {
          action: 'remove_authorized_ip'
        },
        ipAddress: getIpFromRequest(req)
      })

      return res.json({ message: 'IP removido com sucesso' })
    } catch (error: any) {
      console.error('Error deleting authorized IP:', error)
      return res.status(500).json({ error: 'Erro ao remover IP autorizado' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

