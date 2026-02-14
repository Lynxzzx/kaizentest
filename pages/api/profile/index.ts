import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/pages/api/auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  
  if (!session) {
    return res.status(401).json({ error: 'Não autorizado' })
  }

  if (req.method === 'GET') {
    try {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          twoFactorEnabled: true,
          emailVerified: true,
          createdAt: true,
          lastLoginAt: true
        }
      })

      if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado' })
      }

      return res.status(200).json(user)
    } catch (error) {
      console.error('Erro ao buscar perfil:', error)
      return res.status(500).json({ error: 'Erro interno do servidor' })
    }
  }

  return res.status(405).json({ error: 'Método não permitido' })
}