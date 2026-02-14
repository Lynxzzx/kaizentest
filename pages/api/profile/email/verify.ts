import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/pages/api/auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  
  if (!session) {
    return res.status(401).json({ error: 'Não autorizado' })
  }

  if (req.method === 'POST') {
    const { code } = req.body

    if (!code || code.length !== 6) {
      return res.status(400).json({ error: 'Código inválido' })
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id }
      })

      if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado' })
      }

      // Verificar se o código existe e não expirou
      if (!user.emailVerificationCode || !user.emailVerificationExpires) {
        return res.status(400).json({ error: 'Código não encontrado' })
      }

      if (new Date() > user.emailVerificationExpires) {
        return res.status(400).json({ error: 'Código expirado' })
      }

      if (user.emailVerificationCode !== code) {
        return res.status(400).json({ error: 'Código incorreto' })
      }

      // Verificar email
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          emailVerified: true,
          emailVerificationCode: null,
          emailVerificationExpires: null
        }
      })

      return res.status(200).json({ message: 'Email verificado com sucesso' })
    } catch (error) {
      console.error('Erro ao verificar email:', error)
      return res.status(500).json({ error: 'Erro interno do servidor' })
    }
  }

  return res.status(405).json({ error: 'Método não permitido' })
}