import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'
import { logAdminAction, getIpFromRequest } from '@/lib/admin-log'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  // OWNER e CO_OWNER podem acessar
  const allowedRoles = ['OWNER', 'CO_OWNER', 'ADMIN']
  if (!session || !allowedRoles.includes(session.user.role)) {
    return res.status(403).json({ error: 'Unauthorized' })
  }

  if (req.method === 'GET') {
    try {
      console.log('📡 GET /api/admin/users - Iniciando busca de usuários')
      const search =
        typeof req.query.search === 'string'
          ? req.query.search.trim()
          : ''

      console.log('🔍 Parâmetro de busca:', search || 'nenhum')

      const users = await prisma.user.findMany({
        where: search
          ? {
            username: {
              contains: search,
              mode: 'insensitive'
            }
          }
          : undefined,
        include: {
          plan: true,
          _count: {
            select: {
              generatedAccounts: true,
              payments: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      })

      // Verificar quais IPs estão banidos
      const allIps = new Set<string>()
      users.forEach(user => {
        if (user.registrationIp) allIps.add(user.registrationIp)
        if (user.lastIp) allIps.add(user.lastIp)
      })

      const bannedIps = await prisma.bannedIp.findMany({
        where: {
          ip: { in: Array.from(allIps) }
        },
        select: {
          ip: true,
          expiresAt: true
        }
      })

      const bannedIpSet = new Set<string>()
      bannedIps.forEach(ban => {
        // Verificar se o banimento não expirou
        if (!ban.expiresAt || ban.expiresAt > new Date()) {
          bannedIpSet.add(ban.ip)
        }
      })

      // Adicionar informações de banimento aos usuários
      const usersWithIpStatus = users.map(user => ({
        ...user,
        registrationIpBanned: user.registrationIp ? bannedIpSet.has(user.registrationIp) : false,
        lastIpBanned: user.lastIp ? bannedIpSet.has(user.lastIp) : false
      }))

      console.log('✅ Usuários encontrados:', users.length)
      return res.json(usersWithIpStatus)
    } catch (error: any) {
      console.error('❌ Error fetching users:', error)
      return res.status(500).json({ error: 'Internal server error', details: error.message })
    }
  }

  if (req.method === 'PUT') {
    const { userId, planId, planExpiresAt, apiPlanId, apiPlanExpiresAt, isBanned, newPassword, role } = req.body

    console.log('🔧 PUT /api/admin/users - Atualizando usuário:', { userId, temNovaSenha: !!newPassword })

    if (!userId) {
      return res.status(400).json({ error: 'UserId is required' })
    }

    if (role !== undefined && session.user.role === 'CO_OWNER') {
      return res.status(403).json({ error: 'Co-Owner não pode alterar cargos de usuários' })
    }

    if (role !== undefined && ['OWNER', 'CO_OWNER', 'ADMIN'].includes(role) && session.user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Apenas o Owner pode definir cargos administrativos' })
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, role: true }
    })

    if (!targetUser) {
      return res.status(404).json({ error: 'Usuário não encontrado' })
    }

    let computedPlanExpiresAt: Date | null | undefined
    let computedApiPlanExpiresAt: Date | null | undefined

    try {
      const updateData: any = {}

      // --- LOGIC FOR NORMAL PLAN ---
      if (planId !== undefined) {
        updateData.planId = planId || null

        const shouldAutoComputeExpiration =
          planExpiresAt === undefined || planExpiresAt === null || planExpiresAt === ''

        if (shouldAutoComputeExpiration && planId) {
          const plan = await prisma.plan.findUnique({ where: { id: planId } })
          if (plan) {
            computedPlanExpiresAt = plan.duration > 0
              ? new Date(Date.now() + plan.duration * 24 * 60 * 60 * 1000)
              : null
          }
        }

        if (!planId) computedPlanExpiresAt = null
      }

      if (planExpiresAt !== undefined) {
        computedPlanExpiresAt = planExpiresAt ? new Date(planExpiresAt) : null
      }

      if (computedPlanExpiresAt !== undefined) {
        updateData.planExpiresAt = computedPlanExpiresAt
      }

      // --- LOGIC FOR API PLAN ---
      if (apiPlanId !== undefined) {
        updateData.apiPlanId = apiPlanId || null

        const shouldAutoComputeApiExpiration =
          apiPlanExpiresAt === undefined || apiPlanExpiresAt === null || apiPlanExpiresAt === ''

        if (shouldAutoComputeApiExpiration && apiPlanId) {
          const apiPlan = await prisma.plan.findUnique({ where: { id: apiPlanId } })
          if (apiPlan) {
            computedApiPlanExpiresAt = apiPlan.duration > 0
              ? new Date(Date.now() + apiPlan.duration * 24 * 60 * 60 * 1000)
              : null
          }
        }

        if (!apiPlanId) computedApiPlanExpiresAt = null
      }

      if (apiPlanExpiresAt !== undefined) {
        computedApiPlanExpiresAt = apiPlanExpiresAt ? new Date(apiPlanExpiresAt) : null
      }

      if (computedApiPlanExpiresAt !== undefined) {
        updateData.apiPlanExpiresAt = computedApiPlanExpiresAt
      }

      // --- OTHER FIELDS ---
      if (typeof newPassword === 'string' && newPassword.trim().length > 0) {
        if (newPassword.trim().length < 6) return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres' })
        updateData.password = await hashPassword(newPassword.trim())
        updateData.passwordResetToken = null
        updateData.passwordResetExpires = null
      }

      if (isBanned !== undefined) {
        updateData.isBanned = isBanned
        updateData.bannedAt = isBanned ? new Date() : null
        updateData.bannedBy = isBanned ? session.user.id : null
      }

      if (role !== undefined && session.user.role === 'OWNER') {
        updateData.role = role
      }

      console.log('💾 Salvando alterações no banco de dados...')
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        include: { plan: true } // verify if we need to include apiPlan
      })

      // Logging
      const ipAddress = getIpFromRequest(req)
      const logDetails: any = {}

      if (planId !== undefined) {
        logDetails.planId = planId
        logDetails.planExpiresAt = computedPlanExpiresAt
        await logAdminAction({
          userId: session.user.id,
          action: 'USER_SET_PLAN',
          targetType: 'User',
          targetId: userId,
          targetName: targetUser.username,
          details: logDetails,
          ipAddress
        })
      }

      if (apiPlanId !== undefined) {
        await logAdminAction({
          userId: session.user.id,
          action: 'USER_SET_PLAN',
          targetType: 'User',
          targetId: userId,
          targetName: targetUser.username,
          details: { type: 'API_PLAN', apiPlanId, apiPlanExpiresAt: computedApiPlanExpiresAt },
          ipAddress
        })
      }

      if (isBanned !== undefined) {
        await logAdminAction({
          userId: session.user.id,
          action: isBanned ? 'USER_BAN' : 'USER_UNBAN',
          targetType: 'User',
          targetId: userId,
          targetName: targetUser.username,
          ipAddress
        })
      }

      if (role !== undefined) {
        await logAdminAction({
          userId: session.user.id,
          action: 'USER_SET_ROLE',
          targetType: 'User',
          targetId: userId,
          targetName: targetUser.username,
          details: { oldRole: targetUser.role, newRole: role },
          ipAddress
        })
      }

      if (updateData.password) {
        await logAdminAction({
          userId: session.user.id,
          action: 'USER_EDIT',
          targetType: 'User',
          targetId: userId,
          targetName: targetUser.username,
          details: { passwordChanged: true },
          ipAddress
        })
      }

      return res.json(updatedUser)
    } catch (error: any) {
      console.error('❌ Error updating user:', error)
      return res.status(500).json({ error: 'Internal server error', details: error.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

