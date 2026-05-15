import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

interface CookieLine {
  domain: string
  includeSubdomains: boolean
  path: string
  secure: boolean
  expiry: number
  name: string
  value: string
}

function parseCookieLine(line: string): CookieLine | null {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) return null
  const parts = trimmed.split('\t')
  if (parts.length < 7) return null
  const expiry = parseInt(parts[4].trim(), 10)
  return {
    domain: parts[0].trim(),
    includeSubdomains: parts[1].trim().toUpperCase() === 'TRUE',
    path: parts[2].trim(),
    secure: parts[3].trim().toUpperCase() === 'TRUE',
    expiry: isNaN(expiry) ? 0 : expiry,
    name: parts[5].trim(),
    value: parts[6].trim()
  }
}

/**
 * Agrupa linhas de cookies em "sessões".
 * Estratégia: cookies com o mesmo expiry formam uma sessão.
 * Se não der para agrupar por expiry, agrupa sequencialmente em pares.
 */
function groupCookiesIntoSessions(cookies: CookieLine[]): CookieLine[][] {
  // Primeiro: tenta agrupar por expiry timestamp
  const byExpiry = new Map<number, CookieLine[]>()

  for (const cookie of cookies) {
    const key = cookie.expiry
    if (!byExpiry.has(key)) byExpiry.set(key, [])
    byExpiry.get(key)!.push(cookie)
  }

  // Se só há um expiry único, trata cada linha como uma sessão diferente
  if (byExpiry.size === 1 && cookies.length > 2) {
    // Agrupa em blocos de 2 (NetflixId + SecureNetflixId)
    const sessions: CookieLine[][] = []
    for (let i = 0; i < cookies.length; i += 2) {
      const block = cookies.slice(i, i + 2)
      if (block.length > 0) sessions.push(block)
    }
    return sessions
  }

  return Array.from(byExpiry.values())
}

function buildRawNetscape(cookies: CookieLine[]): string {
  return cookies
    .map(c =>
      `${c.domain}\t${c.includeSubdomains ? 'TRUE' : 'FALSE'}\t${c.path}\t${c.secure ? 'TRUE' : 'FALSE'}\t${c.expiry}\t${c.name}\t${c.value}`
    )
    .join('\n')
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const session = await getServerSession(req, res, authOptions)

  if (!session || session.user.role !== 'OWNER') {
    return res.status(403).json({ error: 'Unauthorized' })
  }

  const { serviceId, cookieText } = req.body

  if (!serviceId || !cookieText) {
    return res.status(400).json({ error: 'serviceId e cookieText são obrigatórios' })
  }

  // Fazer parse de todas as linhas
  const lines: string[] = String(cookieText).split('\n')
  const parsedCookies: CookieLine[] = []

  for (const line of lines) {
    const c = parseCookieLine(line)
    if (c) parsedCookies.push(c)
  }

  if (parsedCookies.length === 0) {
    return res.status(400).json({ error: 'Nenhum cookie válido encontrado. Verifique o formato (7 colunas separadas por TAB).' })
  }

  const sessions = groupCookiesIntoSessions(parsedCookies)
  const created: string[] = []
  const errors: string[] = []

  for (let i = 0; i < sessions.length; i++) {
    const sessionCookies = sessions[i]
    const sessionNum = i + 1

    try {
      const netflixId = sessionCookies.find(c => c.name === 'NetflixId')
      const secureNetflixId = sessionCookies.find(c => c.name === 'SecureNetflixId')

      if (!netflixId && !secureNetflixId) {
        errors.push(`Sessão ${sessionNum}: sem NetflixId ou SecureNetflixId`)
        continue
      }

      const mainCookie = netflixId || secureNetflixId!
      const raw = buildRawNetscape(sessionCookies)

      const extraData: Record<string, unknown> = {
        type: 'cookie',
        raw
      }

      if (netflixId) extraData.netflixId = netflixId.value
      if (secureNetflixId) extraData.secureNetflixId = secureNetflixId.value

      const otherCookies = sessionCookies.filter(
        c => c.name !== 'NetflixId' && c.name !== 'SecureNetflixId'
      )
      if (otherCookies.length > 0) {
        extraData.otherCookies = otherCookies.map(c => ({ name: c.name, value: c.value }))
      }

      await prisma.stock.create({
        data: {
          serviceId,
          username: `Cookie Session #${sessionNum}`,
          password: mainCookie.value,
          extraData: JSON.stringify(extraData)
        }
      })

      created.push(`Sessão ${sessionNum}`)
    } catch (e: any) {
      errors.push(`Sessão ${sessionNum}: ${e.message || 'erro desconhecido'}`)
    }
  }

  return res.json({
    success: true,
    created: created.length,
    sessionsDetected: sessions.length,
    errors: errors.length > 0 ? errors : undefined
  })
}
