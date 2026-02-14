import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/pages/api/auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  
  if (!session) {
    return res.status(401).json({ error: 'Não autorizado' })
  }

  if (req.method === 'PUT') {
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias' })
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres' })
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id }
      })

      if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado' })
      }

      // Verificar senha atual
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password)
      
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ error: 'Senha atual incorreta' })
      }

      // Hash da nova senha
      const hashedNewPassword = await bcrypt.hash(newPassword, 12)

      // Atualizar senha
      await prisma.user.update({
        where: { id: session.user.id },
        data: { password: hashedNewPassword }
      })

      return res.status(200).json({ message: 'Senha alterada com sucesso' })
    } catch (error) {
      console.error('Erro ao alterar senha:', error)
      return res.status(500).json({ error: 'Erro interno do servidor' })
    }
  }

  return res.status(405).json({ error: 'Método não permitido' })
}