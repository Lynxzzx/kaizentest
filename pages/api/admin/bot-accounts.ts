import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

/**
 * API para detectar e remover contas de bots
 * 
 * GET: Listar contas suspeitas
 * DELETE: Remover contas em massa
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (!session?.user) {
    return res.status(401).json({ error: 'Não autenticado' })
  }

  // Verificar permissão (apenas OWNER e CO_OWNER)
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id }
  })

  if (!currentUser || !['OWNER', 'CO_OWNER'].includes(currentUser.role)) {
    return res.status(403).json({ error: 'Apenas OWNER e CO_OWNER podem gerenciar contas suspeitas' })
  }

  // GET - Listar contas suspeitas
  if (req.method === 'GET') {
    try {
      // Buscar todos os usuários (exceto admins)
      const allUsers = await prisma.user.findMany({
        where: {
          role: 'USER'
        },
        select: {
          id: true,
          username: true,
          email: true,
          registrationIp: true,
          deviceFingerprint: true,
          createdAt: true,
          planId: true,
          isBanned: true,
          _count: {
            select: {
              generatedAccounts: true,
              payments: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      })

      // Agrupar por IP
      const ipGroups: Record<string, typeof allUsers> = {}
      const fingerprintGroups: Record<string, typeof allUsers> = {}
      
      allUsers.forEach(user => {
        // Agrupar por IP
        if (user.registrationIp) {
          if (!ipGroups[user.registrationIp]) {
            ipGroups[user.registrationIp] = []
          }
          ipGroups[user.registrationIp].push(user)
        }
        
        // Agrupar por device fingerprint
        if (user.deviceFingerprint) {
          if (!fingerprintGroups[user.deviceFingerprint]) {
            fingerprintGroups[user.deviceFingerprint] = []
          }
          fingerprintGroups[user.deviceFingerprint].push(user)
        }
      })

      // Identificar IPs suspeitos (mais de 2 contas)
      const suspiciousIps = Object.entries(ipGroups)
        .filter(([_, users]) => users.length > 2)
        .map(([ip, users]) => ({
          ip,
          count: users.length,
          users: users.map(u => ({
            id: u.id,
            username: u.username,
            email: u.email,
            createdAt: u.createdAt,
            hasPayments: u._count.payments > 0,
            hasGenerations: u._count.generatedAccounts > 0,
            hasPlan: !!u.planId,
            isBanned: u.isBanned
          }))
        }))
        .sort((a, b) => b.count - a.count)

      // Identificar fingerprints suspeitos (mais de 1 conta)
      const suspiciousFingerprints = Object.entries(fingerprintGroups)
        .filter(([_, users]) => users.length > 1)
        .map(([fingerprint, users]) => ({
          fingerprint: fingerprint.substring(0, 20) + '...',
          count: users.length,
          users: users.map(u => ({
            id: u.id,
            username: u.username,
            email: u.email,
            createdAt: u.createdAt,
            hasPayments: u._count.payments > 0,
            hasGenerations: u._count.generatedAccounts > 0,
            hasPlan: !!u.planId,
            isBanned: u.isBanned
          }))
        }))
        .sort((a, b) => b.count - a.count)

      // Padrões de username suspeitos
      const suspiciousPatterns = [
        /^user\d+$/i,
        /^test\d*$/i,
        /^[a-z]{1,2}\d{5,}$/i,
        /^\d+$/,
        /^(.)\1{4,}$/,
        /^[a-z]+\d{3,}$/i
      ]

      const suspiciousUsernames = allUsers.filter(user => 
        suspiciousPatterns.some(pattern => pattern.test(user.username))
      ).map(u => ({
        id: u.id,
        username: u.username,
        email: u.email,
        registrationIp: u.registrationIp,
        createdAt: u.createdAt,
        hasPayments: u._count.payments > 0,
        hasGenerations: u._count.generatedAccounts > 0,
        hasPlan: !!u.planId,
        isBanned: u.isBanned
      }))

      // Contas criadas em rajada (muitas no mesmo minuto)
      const timeGroups: Record<string, typeof allUsers> = {}
      allUsers.forEach(user => {
        const timeKey = new Date(user.createdAt).toISOString().substring(0, 16) // YYYY-MM-DDTHH:MM
        if (!timeGroups[timeKey]) {
          timeGroups[timeKey] = []
        }
        timeGroups[timeKey].push(user)
      })

      const burstCreations = Object.entries(timeGroups)
        .filter(([_, users]) => users.length > 3)
        .map(([time, users]) => ({
          time,
          count: users.length,
          users: users.map(u => ({
            id: u.id,
            username: u.username,
            registrationIp: u.registrationIp,
            hasPayments: u._count.payments > 0,
            isBanned: u.isBanned
          }))
        }))
        .sort((a, b) => b.count - a.count)

      // Estatísticas gerais
      const stats = {
        totalUsers: allUsers.length,
        usersWithPayments: allUsers.filter(u => u._count.payments > 0).length,
        usersWithGenerations: allUsers.filter(u => u._count.generatedAccounts > 0).length,
        usersWithPlans: allUsers.filter(u => u.planId).length,
        bannedUsers: allUsers.filter(u => u.isBanned).length,
        suspiciousIpsCount: suspiciousIps.length,
        suspiciousFingerprintsCount: suspiciousFingerprints.length,
        suspiciousUsernamesCount: suspiciousUsernames.length,
        burstCreationsCount: burstCreations.length
      }

      return res.status(200).json({
        stats,
        suspiciousIps,
        suspiciousFingerprints,
        suspiciousUsernames,
        burstCreations
      })
    } catch (error: any) {
      console.error('Erro ao buscar contas suspeitas:', error)
      return res.status(500).json({ error: 'Erro ao buscar contas suspeitas' })
    }
  }

  // DELETE - Remover contas em massa
  if (req.method === 'DELETE') {
    try {
      const { userIds, banIp } = req.body

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ error: 'Lista de IDs é obrigatória' })
      }

      // Verificar se algum usuário tem pagamentos ou é admin
      const usersToDelete = await prisma.user.findMany({
        where: {
          id: { in: userIds },
          role: 'USER' // Apenas usuários normais
        },
        select: {
          id: true,
          username: true,
          registrationIp: true,
          _count: {
            select: {
              payments: true
            }
          }
        }
      })

      // Filtrar apenas usuários SEM pagamentos
      const safeToDelete = usersToDelete.filter(u => u._count.payments === 0)
      const withPayments = usersToDelete.filter(u => u._count.payments > 0)

      if (withPayments.length > 0) {
        console.log(`⚠️ ${withPayments.length} usuários têm pagamentos e não serão deletados`)
      }

      // Coletar IPs para banir (se solicitado)
      const ipsToban: string[] = []
      if (banIp) {
        safeToDelete.forEach(u => {
          if (u.registrationIp && !ipsToban.includes(u.registrationIp)) {
            ipsToban.push(u.registrationIp)
          }
        })
      }

      // Deletar registros relacionados primeiro
      const idsToDelete = safeToDelete.map(u => u.id)

      // Deletar tickets e replies
      await prisma.ticketReply.deleteMany({
        where: { userId: { in: idsToDelete } }
      })
      
      await prisma.ticket.deleteMany({
        where: { userId: { in: idsToDelete } }
      })

      // Deletar contas geradas
      await prisma.generatedAccount.deleteMany({
        where: { userId: { in: idsToDelete } }
      })

      // Deletar chaves resgatadas
      await prisma.redeemedKey.deleteMany({
        where: { userId: { in: idsToDelete } }
      })

      // Deletar recompensas de afiliado
      await prisma.affiliateReward.deleteMany({
        where: { userId: { in: idsToDelete } }
      })

      // Deletar mensagens de chat
      await prisma.chatMessage.deleteMany({
        where: { userId: { in: idsToDelete } }
      })

      // Deletar participações em sorteios
      await prisma.raffleParticipant.deleteMany({
        where: { userId: { in: idsToDelete } }
      })

      // Deletar feedbacks
      await prisma.feedback.deleteMany({
        where: { userId: { in: idsToDelete } }
      })

      // Deletar comissões de afiliado relacionadas
      await prisma.affiliateCommission.deleteMany({
        where: { affiliateId: { in: idsToDelete } }
      })

      // Deletar saques de afiliado relacionados
      await prisma.affiliateWithdrawal.deleteMany({
        where: { userId: { in: idsToDelete } }
      })

      // Remover referências de afiliados ANTES de deletar
      // 1. Remover referredBy dos usuários que serão deletados (caso tenham referenciado alguém)
      await prisma.user.updateMany({
        where: { id: { in: idsToDelete } },
        data: { referredBy: null }
      })

      // 2. Remover referredBy de outros usuários que apontam para os usuários que serão deletados
      await prisma.user.updateMany({
        where: { referredBy: { in: idsToDelete } },
        data: { referredBy: null }
      })

      // Finalmente, deletar os usuários
      const result = await prisma.user.deleteMany({
        where: { id: { in: idsToDelete } }
      })

      // Banir IPs se solicitado
      let bannedIpsCount = 0
      if (banIp && ipsToban.length > 0) {
        for (const ip of ipsToban) {
          try {
            await prisma.bannedIp.create({
              data: {
                ip,
                reason: 'Múltiplas contas de bot detectadas',
                bannedById: currentUser.id
              }
            })
            bannedIpsCount++
          } catch (e) {
            // IP já banido, ignorar
          }
        }
      }

      // Log de segurança
      await prisma.securityLog.create({
        data: {
          type: 'blocked',
          ip: 'admin-action',
          success: true,
          reason: `${currentUser.username} deletou ${result.count} contas de bot`,
          metadata: JSON.stringify({
            deletedIds: idsToDelete,
            bannedIps: ipsToban,
            skippedWithPayments: withPayments.map(u => u.username)
          })
        }
      })

      return res.status(200).json({
        message: `${result.count} contas deletadas com sucesso`,
        deleted: result.count,
        skippedWithPayments: withPayments.length,
        bannedIps: bannedIpsCount
      })
    } catch (error: any) {
      console.error('Erro ao deletar contas:', error)
      return res.status(500).json({ error: 'Erro ao deletar contas: ' + error.message })
    }
  }

  return res.status(405).json({ error: 'Método não permitido' })
}

