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

  // Apenas OWNER pode promover/rebaixar usuários
  // CO_OWNER NÃO pode dar cargos de admin
  if (!currentUser || currentUser.role !== 'OWNER') {
    return res.status(403).json({ error: 'Apenas o Owner pode alterar cargos de usuários' })
  }

  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { userId, role } = req.body

    if (!userId || !role) {
      return res.status(400).json({ error: 'UserId and role are required' })
    }

    // Incluir CO_OWNER na lista de cargos válidos
    const validRoles = ['OWNER', 'CO_OWNER', 'ADMIN', 'MODERATOR', 'USER']
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' })
    }

    // Não permitir que o owner se rebaixe
    if (userId === session.user.id && role !== 'OWNER') {
      return res.status(400).json({ error: 'Owner cannot demote themselves' })
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' })
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role: role as any },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        bio: true,
        profilePicture: true,
        createdAt: true
      }
    })

    // Registrar log da alteração de cargo
    await logAdminAction({
      userId: session.user.id,
      action: 'USER_SET_ROLE',
      targetType: 'User',
      targetId: userId,
      targetName: targetUser.username,
      details: {
        oldRole: targetUser.role,
        newRole: role
      },
      ipAddress: getIpFromRequest(req)
    })

    return res.json({ user: updatedUser })
  } catch (error: any) {
    console.error('Error promoting user:', error)
    return res.status(500).json({ error: 'Error promoting user' })
  }
}

