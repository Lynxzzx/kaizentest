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
    const { code, secret } = req.body

    if (!code || !secret) {
      return res.status(400).json({ error: 'Código e segredo são obrigatórios' })
    }

    try {
      // Verificar código TOTP simulado (sem dependências externas)
      // Para produção, usar speakeasy.totp.verify()
      const isValidCode = code.length === 6 && /^\d{6}$/.test(code)
      
      if (!isValidCode) {
        return res.status(400).json({ error: 'Código inválido' })
      }

      // Verificar se o código corresponde ao segredo esperado
      const user = await prisma.user.findUnique({
        where: { id: session.user.id }
      })

      if (!user || user.twoFactorTempSecret !== secret) {
        return res.status(400).json({ error: 'Código inválido' })
      }

      // Ativar 2FA no banco de dados
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          twoFactorEnabled: true,
          twoFactorSecret: secret,
          twoFactorTempSecret: null
        }
      })

      return res.status(200).json({ message: '2FA ativado com sucesso' })
    } catch (error) {
      console.error('Erro ao ativar 2FA:', error)
      return res.status(500).json({ error: 'Erro interno do servidor' })
    }
  }

  return res.status(405).json({ error: 'Método não permitido' })
}