import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  
  if (!session) {
    return res.status(401).json({ error: 'Não autorizado' })
  }

  if (req.method === 'POST') {
    try {
      // Gerar segredo 2FA simulado (sem dependências externas)
      const secret = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
      
      // Salvar segredo temporariamente (não ativado ainda)
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          twoFactorSecret: secret,
          twoFactorTempSecret: secret
        }
      })

      // Retornar dados para setup (sem QR code por enquanto)
      return res.status(200).json({
        secret: secret,
        qrCodeUrl: '', // QR code será implementado quando as dependências forem instaladas
        otpauth_url: `otpauth://totp/Kaizen%20Gens%20(${session.user.username})?secret=${secret}&issuer=Kaizen%20Gens`
      })
    } catch (error) {
      console.error('Erro ao configurar 2FA:', error)
      return res.status(500).json({ error: 'Erro interno do servidor' })
    }
  }

  return res.status(405).json({ error: 'Método não permitido' })
}