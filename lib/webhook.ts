import axios from 'axios'
import { prisma } from '@/lib/prisma'

function parseUrls(csv?: string | null): string[] {
  if (!csv) return []
  return csv
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0)
}

async function getWebhookUrls(): Promise<string[]> {
  const envCsv = process.env.STOCK_WEBHOOK_URLS || process.env.STOCK_WEBHOOK_URL || ''
  let urls = parseUrls(envCsv)
  if (urls.length > 0) return urls
  try {
    const cfg = await prisma.systemConfig.findUnique({
      where: { key: 'STOCK_WEBHOOK_URLS' }
    })
    urls = parseUrls(cfg?.value || '')
    return urls
  } catch {
    return []
  }
}

export async function sendStockRestockWebhook(
  serviceName: string,
  quantity: number,
  siteUrl: string = 'https://kaizengen.shop',
  extras?: Record<string, any>
) {
  const urls = await getWebhookUrls()
  if (urls.length === 0) return { ok: false, error: 'No webhook URLs configured' }

  const payload = {
    event: 'stock_restocked',
    service: serviceName,
    quantity,
    siteUrl,
    timestamp: new Date().toISOString(),
    ...extras
  }

  const results: Array<{ url: string; ok: boolean; status?: number; error?: any }> = []

  await Promise.all(
    urls.map(async (url) => {
      try {
        const res = await axios.post(url, payload, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        })
        results.push({ url, ok: true, status: res.status })
      } catch (error: any) {
        console.error('Error sending stock webhook:', url, error.response?.data || error.message)
        results.push({ url, ok: false, error: error.response?.data || error.message })
      }
    })
  )

  return { ok: results.every(r => r.ok), results }
}
