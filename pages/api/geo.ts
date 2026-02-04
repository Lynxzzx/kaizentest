import type { NextApiRequest, NextApiResponse } from 'next'

function getClientIp(req: NextApiRequest): string | null {
  const xff = (req.headers['x-forwarded-for'] as string) || ''
  if (xff) return xff.split(',')[0].trim()
  const xri = (req.headers['x-real-ip'] as string) || ''
  if (xri) return xri
  const cfIp = (req.headers['cf-connecting-ip'] as string) || ''
  if (cfIp) return cfIp
  const ra = req.socket?.remoteAddress || null
  return ra
}

function suggestLocale(countryCode: string): 'pt-BR' | 'en' | 'es' {
  const cc = (countryCode || '').toUpperCase()
  const esCountries = new Set([
    'ES','MX','AR','CO','PE','CL','VE','UY','PY','BO','EC','CR','PA','SV','DO','GT','NI','HN'
  ])
  if (cc === 'BR' || cc === 'PT') return 'pt-BR'
  if (esCountries.has(cc)) return 'es'
  return 'en'
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const ip = getClientIp(req)
    const url = ip && ip !== 'unknown'
      ? `https://ipapi.co/${encodeURIComponent(ip)}/json/`
      : 'https://ipapi.co/json/'
    const response = await fetch(url, { method: 'GET' })
    const data = await response.json().catch(() => ({}))
    const countryCode = typeof data?.country_code === 'string' ? data.country_code : null
    const locale = suggestLocale(countryCode || '')
    return res.status(200).json({
      ip: ip || null,
      countryCode: countryCode,
      suggestedLocale: locale
    })
  } catch (error: any) {
    return res.status(200).json({
      ip: null,
      countryCode: null,
      suggestedLocale: 'en'
    })
  }
}
