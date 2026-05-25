import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import { canManagePaymentConfig } from '@/lib/admin-payment-config-auth'
import axios from 'axios'

const KEYS = {
  clientId: 'MISTICPAY_CLIENT_ID',
  clientSecret: 'MISTICPAY_CLIENT_SECRET'
} as const

function maskSecret(value: string, visibleStart = 4, visibleEnd = 4): string {
  if (value.length <= visibleStart + visibleEnd) return '••••••••'
  return `${value.slice(0, visibleStart)}••••${value.slice(-visibleEnd)}`
}

async function getStoredValue(key: string): Promise<string | null> {
  const config = await prisma.systemConfig.findUnique({ where: { key } })
  return config?.value?.trim() || null
}

async function upsertConfig(
  key: string,
  value: string,
  description: string,
  userId: string
) {
  return prisma.systemConfig.upsert({
    where: { key },
    update: {
      value: value.trim(),
      description,
      updatedById: userId
    },
    create: {
      key,
      value: value.trim(),
      description,
      updatedById: userId
    }
  })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user || !canManagePaymentConfig(user.role)) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  if (req.method === 'GET') {
    const dbClientId = await getStoredValue(KEYS.clientId)
    const dbClientSecret = await getStoredValue(KEYS.clientSecret)
    const envClientId = process.env.MISTICPAY_CLIENT_ID?.trim() || null
    const envClientSecret = process.env.MISTICPAY_CLIENT_SECRET?.trim() || null

    const effectiveClientId = dbClientId || envClientId
    const effectiveClientSecret = dbClientSecret || envClientSecret

    return res.json({
      clientIdConfigured: !!(dbClientId || envClientId),
      clientSecretConfigured: !!(dbClientSecret || envClientSecret),
      ready: !!(effectiveClientId && effectiveClientSecret),
      clientIdMask: effectiveClientId ? maskSecret(effectiveClientId) : null,
      clientSecretMask: effectiveClientSecret ? maskSecret(effectiveClientSecret) : null,
      sources: {
        clientId: dbClientId ? 'database' : envClientId ? 'environment' : null,
        clientSecret: dbClientSecret ? 'database' : envClientSecret ? 'environment' : null
      },
      storedInDatabase: {
        clientId: !!dbClientId,
        clientSecret: !!dbClientSecret
      }
    })
  }

  if (req.method === 'POST') {
    const { clientId, clientSecret } = req.body as {
      clientId?: string
      clientSecret?: string
    }

    const trimmedId = clientId?.trim() || ''
    const trimmedSecret = clientSecret?.trim() || ''

    if (!trimmedId) {
      return res.status(400).json({ error: 'Client ID é obrigatório' })
    }
    if (!trimmedId.startsWith('ci_')) {
      return res.status(400).json({ error: 'Client ID deve começar com ci_' })
    }

    const existingSecret = await getStoredValue(KEYS.clientSecret)
    const secretToSave = trimmedSecret || existingSecret

    if (!secretToSave) {
      return res.status(400).json({ error: 'Client Secret é obrigatório' })
    }
    if (!secretToSave.startsWith('cs_')) {
      return res.status(400).json({ error: 'Client Secret deve começar com cs_' })
    }

    await upsertConfig(
      KEYS.clientId,
      trimmedId,
      'Client ID da MisticPay (pagamentos PIX)',
      user.id
    )

    if (trimmedSecret) {
      await upsertConfig(
        KEYS.clientSecret,
        trimmedSecret,
        'Client Secret da MisticPay (pagamentos PIX)',
        user.id
      )
    }

    try {
      await axios.get('https://api.misticpay.com/api/users/balance', {
        headers: {
          ci: trimmedId,
          cs: secretToSave,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      })
    } catch (testError: any) {
      const status = testError.response?.status
      if (status === 401 || status === 403) {
        return res.status(400).json({
          error: 'Credenciais inválidas na MisticPay. Verifique Client ID e Client Secret.'
        })
      }
      console.warn('⚠️ MisticPay salvo, mas teste de conexão falhou:', testError.message)
    }

    return res.json({
      success: true,
      message: 'Credenciais MisticPay salvas com sucesso',
      clientIdMask: maskSecret(trimmedId),
      clientSecretMask: maskSecret(secretToSave)
    })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
