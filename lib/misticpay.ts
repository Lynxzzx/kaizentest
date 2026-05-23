import axios from 'axios'
import { prisma } from '@/lib/prisma'

const MISTICPAY_API_URL = 'https://api.misticpay.com/api'
const HTTP_TIMEOUT_MS = Number(process.env.MISTICPAY_HTTP_TIMEOUT_MS || 45000)

export interface MisticPayCredentials {
  clientId: string
  clientSecret: string
}

async function getConfigValue(key: string): Promise<string | null> {
  try {
    const config = await prisma.systemConfig.findUnique({ where: { key } })
    if (config?.value?.trim()) return config.value.trim()
  } catch {
    // ignore
  }
  return null
}

export async function getMisticPayCredentials(): Promise<MisticPayCredentials> {
  let clientId = process.env.MISTICPAY_CLIENT_ID
  let clientSecret = process.env.MISTICPAY_CLIENT_SECRET

  if (!clientId?.trim()) {
    clientId = (await getConfigValue('MISTICPAY_CLIENT_ID')) || undefined
  }
  if (!clientSecret?.trim()) {
    clientSecret = (await getConfigValue('MISTICPAY_CLIENT_SECRET')) || undefined
  }

  if (!clientId?.trim() || !clientSecret?.trim()) {
    throw new Error(
      'MISTICPAY_CLIENT_ID e MISTICPAY_CLIENT_SECRET não estão configurados. Configure no .env ou no painel admin.'
    )
  }

  return { clientId: clientId.trim(), clientSecret: clientSecret.trim() }
}

function misticPayHeaders(credentials: MisticPayCredentials) {
  return {
    ci: credentials.clientId,
    cs: credentials.clientSecret,
    'Content-Type': 'application/json'
  }
}

export function isMisticPayTransactionId(id: string | null | undefined): boolean {
  return !!id && /^\d+$/.test(id)
}

export function isMisticPayPaid(status: string | null | undefined): boolean {
  if (!status) return false
  const normalized = status.toUpperCase()
  return normalized === 'COMPLETO' || normalized === 'PAID' || normalized === 'APPROVED'
}

export interface CreateMisticPayPixData {
  amount: number
  payerName: string
  payerDocument: string
  transactionId: string
  description: string
  projectWebhook?: string
}

export async function createMisticPayPixPayment(data: CreateMisticPayPixData) {
  const credentials = await getMisticPayCredentials()

  const payload = {
    amount: data.amount,
    payerName: data.payerName,
    payerDocument: data.payerDocument.replace(/\D/g, ''),
    transactionId: data.transactionId,
    description: data.description,
    ...(data.projectWebhook ? { projectWebhook: data.projectWebhook } : {})
  }

  console.log('📤 MisticPay: criando transação PIX...', {
    transactionId: data.transactionId,
    amount: data.amount
  })

  try {
    const response = await axios.post(`${MISTICPAY_API_URL}/transactions/create`, payload, {
      headers: misticPayHeaders(credentials),
      timeout: HTTP_TIMEOUT_MS,
      validateStatus: () => true
    })

    if (response.status >= 400) {
      const msg =
        response.data?.message ||
        response.data?.error ||
        `MisticPay HTTP ${response.status}`
      const err: any = new Error(msg)
      err.response = response
      if (response.status === 401) err.name = 'MisticPayAuthenticationError'
      else if (response.status >= 500) err.name = 'MisticPayServiceUnavailableError'
      throw err
    }

    const tx = response.data?.data
    if (!tx?.transactionId) {
      throw new Error('MisticPay não retornou transactionId na resposta.')
    }

    const copyPaste = tx.copyPaste || ''
    if (!copyPaste) {
      throw new Error('MisticPay não retornou o código PIX copia e cola.')
    }

    let qrCodeImage: string | null = tx.qrCodeBase64 || null
    if (qrCodeImage && !qrCodeImage.startsWith('data:')) {
      qrCodeImage = `data:image/png;base64,${qrCodeImage}`
    }

    return {
      id: String(tx.transactionId),
      qrCode: copyPaste,
      qrCodeImage,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      state: tx.transactionState || 'PENDENTE'
    }
  } catch (error: any) {
    if (
      error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ENOTFOUND' ||
      error.code === 'ECONNABORTED'
    ) {
      const networkError = new Error(
        'A API da MisticPay está temporariamente indisponível. Tente novamente em alguns minutos.'
      )
      networkError.name = 'MisticPayServiceUnavailableError'
      throw networkError
    }
    throw error
  }
}

export async function checkMisticPayTransaction(transactionId: string) {
  const credentials = await getMisticPayCredentials()

  const response = await axios.post(
    `${MISTICPAY_API_URL}/transactions/check`,
    { transactionId: String(transactionId) },
    {
      headers: misticPayHeaders(credentials),
      timeout: HTTP_TIMEOUT_MS,
      validateStatus: () => true
    }
  )

  if (response.status >= 400) {
    const msg =
      response.data?.message ||
      response.data?.error ||
      `MisticPay check HTTP ${response.status}`
    throw new Error(msg)
  }

  const transaction = response.data?.transaction || response.data?.data
  return {
    transactionId: transaction?.transactionId ?? transactionId,
    transactionState: transaction?.transactionState || transaction?.status || 'PENDENTE',
    value: transaction?.value,
    paidAt: transaction?.updatedAt ? new Date(transaction.updatedAt) : new Date()
  }
}

export function getMisticPayWebhookUrl(): string | undefined {
  const base = process.env.NEXTAUTH_URL || process.env.VERCEL_URL
  if (!base) return undefined
  const origin = base.startsWith('http') ? base : `https://${base}`
  return `${origin.replace(/\/$/, '')}/api/payments/webhook`
}
