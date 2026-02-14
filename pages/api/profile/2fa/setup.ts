import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]'
import prisma from '@/lib/prisma'
import speakeasy from 'speakeasy'
import QRCode from 'qrcode'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  
  if (!session) {
    return res.status(401).json({ error: 'Não autorizado' })
  }

  if (req.method === 'POST') {
    try {
      // Gerar segredo 2FA
      const secret = speakeasy.generateSecret({
        name: `Kaizen Gens (${session.user.username})`,
        length: 32
      })

      // Salvar segredo temporariamente (não ativado ainda)
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          twoFactorSecret: secret.base32,
          twoFactorTempSecret: secret.base32
        }
      })

      // Gerar QR Code
      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url)

      return res.status(200).json({
        secret: secret.base32,
        qrCodeUrl: qrCodeUrl,
        otpauth_url: secret.otpauth_url
      })
    } catch (error) {
      console.error('Erro ao configurar 2FA:', error)
      return res.status(500).json({ error: 'Erro interno do servidor' })
    }
  }

  return res.status(405).json({ error: 'Método não permitido' })
}