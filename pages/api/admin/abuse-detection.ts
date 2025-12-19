import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

/**
 * API para detectar abuso de contas (mesmo IP, mesmo dispositivo)
 * GET /api/admin/abuse-detection
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const session = await getServerSession(req, res, authOptions)
  if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'OWNER')) {
    return res.status(403).json({ error: 'Forbidden - Admin only' })
  }

  try {
    // Buscar todos os usuários com IP e fingerprint
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        registrationIp: true,
        lastIp: true,
        lastIpAt: true,
        deviceFingerprint: true,
        dailyFreeGenerations: true,
        isBanned: true,
        createdAt: true,
        plan: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Agrupar por IP de registro
    const ipGroups: Record<string, typeof users> = {}
    const fingerprintGroups: Record<string, typeof users> = {}

    users.forEach(user => {
      // Agrupar por IP de registro
      if (user.registrationIp) {
        if (!ipGroups[user.registrationIp]) {
          ipGroups[user.registrationIp] = []
        }
        ipGroups[user.registrationIp].push(user)
      }

      // Agrupar por fingerprint
      if (user.deviceFingerprint) {
        if (!fingerprintGroups[user.deviceFingerprint]) {
          fingerprintGroups[user.deviceFingerprint] = []
        }
        fingerprintGroups[user.deviceFingerprint].push(user)
      }
    })

    // Filtrar grupos suspeitos (mais de 1 conta)
    const suspiciousIps = Object.entries(ipGroups)
      .filter(([_, users]) => users.length > 1)
      .map(([ip, users]) => ({
        ip,
        count: users.length,
        users: users.map(u => ({
          id: u.id,
          username: u.username,
          email: u.email,
          plan: u.plan?.name || 'Sem plano',
          isBanned: u.isBanned,
          freeGenerationsUsed: u.dailyFreeGenerations,
          createdAt: u.createdAt
        }))
      }))
      .sort((a, b) => b.count - a.count)

    const suspiciousFingerprints = Object.entries(fingerprintGroups)
      .filter(([_, users]) => users.length > 1)
      .map(([fingerprint, users]) => ({
        fingerprint: fingerprint.substring(0, 16) + '...',
        fullFingerprint: fingerprint,
        count: users.length,
        users: users.map(u => ({
          id: u.id,
          username: u.username,
          email: u.email,
          plan: u.plan?.name || 'Sem plano',
          isBanned: u.isBanned,
          freeGenerationsUsed: u.dailyFreeGenerations,
          registrationIp: u.registrationIp,
          createdAt: u.createdAt
        }))
      }))
      .sort((a, b) => b.count - a.count)

    // Estatísticas gerais
    const stats = {
      totalUsers: users.length,
      usersWithIp: users.filter(u => u.registrationIp).length,
      usersWithFingerprint: users.filter(u => u.deviceFingerprint).length,
      suspiciousIpCount: suspiciousIps.length,
      suspiciousFingerprintCount: suspiciousFingerprints.length,
      totalSuspiciousAccounts: new Set([
        ...suspiciousIps.flatMap(g => g.users.map(u => u.id)),
        ...suspiciousFingerprints.flatMap(g => g.users.map(u => u.id))
      ]).size
    }

    // Lista de todos os usuários com IPs
    const allUsersWithIp = users
      .filter(u => u.registrationIp || u.lastIp)
      .map(u => ({
        id: u.id,
        username: u.username,
        email: u.email,
        registrationIp: u.registrationIp,
        lastIp: u.lastIp,
        lastIpAt: u.lastIpAt,
        deviceFingerprint: u.deviceFingerprint?.substring(0, 16) + '...' || null,
        plan: u.plan?.name || 'Sem plano',
        isBanned: u.isBanned,
        createdAt: u.createdAt
      }))

    return res.json({
      stats,
      suspiciousIps,
      suspiciousFingerprints,
      allUsersWithIp
    })

  } catch (error: any) {
    console.error('Erro ao detectar abusos:', error)
    return res.status(500).json({
      error: 'Erro interno',
      details: error.message
    })
  }
}

