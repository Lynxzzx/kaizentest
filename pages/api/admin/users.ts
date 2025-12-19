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

      console.log('✅ Usuários encontrados:', users.length)
      return res.json(users)
    } catch (error: any) {
      console.error('❌ Error fetching users:', error)
      return res.status(500).json({ error: 'Internal server error', details: error.message })
    }
  }

  if (req.method === 'PUT') {
    const { userId, planId, planExpiresAt, isBanned, newPassword, role } = req.body

    console.log('🔧 PUT /api/admin/users - Atualizando usuário:', { userId, temNovaSenha: !!newPassword })

    if (!userId) {
      return res.status(400).json({ error: 'UserId is required' })
    }

    // CO_OWNER não pode alterar cargos de admin (OWNER, CO_OWNER, ADMIN)
    if (role !== undefined && session.user.role === 'CO_OWNER') {
      return res.status(403).json({ error: 'Co-Owner não pode alterar cargos de usuários' })
    }

    // Apenas OWNER pode definir cargos de OWNER, CO_OWNER ou ADMIN
    if (role !== undefined && ['OWNER', 'CO_OWNER', 'ADMIN'].includes(role) && session.user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Apenas o Owner pode definir cargos administrativos' })
    }

    // Buscar usuário alvo para o log
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, role: true }
    })

    if (!targetUser) {
      return res.status(404).json({ error: 'Usuário não encontrado' })
    }

    let computedPlanExpiresAt: Date | null | undefined

    try {
      const updateData: any = {}

      if (planId !== undefined) {
        updateData.planId = planId || null

        const shouldAutoComputeExpiration =
          planExpiresAt === undefined || planExpiresAt === null || planExpiresAt === ''

        if (shouldAutoComputeExpiration && planId) {
          const plan = await prisma.plan.findUnique({
            where: { id: planId }
          })

          if (plan) {
            if (plan.duration > 0) {
              const expiresAt = new Date()
              expiresAt.setDate(expiresAt.getDate() + plan.duration)
              computedPlanExpiresAt = expiresAt
            } else {
              computedPlanExpiresAt = null
            }
          }
        }

        if (!planId) {
          computedPlanExpiresAt = null
        }
      }

      if (planExpiresAt !== undefined) {
        computedPlanExpiresAt = planExpiresAt ? new Date(planExpiresAt) : null
      }

      if (computedPlanExpiresAt !== undefined) {
        updateData.planExpiresAt = computedPlanExpiresAt
      }

      if (typeof newPassword === 'string' && newPassword.trim().length > 0) {
        console.log('🔐 Alterando senha do usuário...')
        if (newPassword.trim().length < 6) {
          return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres' })
        }
        const hashedPassword = await hashPassword(newPassword.trim())
        console.log('✅ Senha hasheada com sucesso')
        updateData.password = hashedPassword
        updateData.passwordResetToken = null
        updateData.passwordResetExpires = null
      }

      if (isBanned !== undefined) {
        updateData.isBanned = isBanned
        if (isBanned) {
          updateData.bannedAt = new Date()
          updateData.bannedBy = session.user.id
        } else {
          updateData.bannedAt = null
          updateData.bannedBy = null
        }
      }

      // Adicionar role se definido (apenas OWNER pode)
      if (role !== undefined && session.user.role === 'OWNER') {
        updateData.role = role
      }

      console.log('💾 Salvando alterações no banco de dados...')
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        include: {
          plan: true
        }
      })

      console.log('✅ Usuário atualizado com sucesso:', updatedUser.username)
      if (updateData.password) {
        console.log('✅ Nova senha salva no banco de dados')
      }

      // Registrar log da ação
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

