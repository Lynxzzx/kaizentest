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
 * Agrupa cookies em sessões.
 * - Se múltiplos expiry → agrupa por expiry (cada timestamp = uma sessão)
 * - Se expiry único → agrupa em blocos de 2 (NetflixId + SecureNetflixId)
 */
function groupCookiesIntoSessions(cookies: CookieLine[]): CookieLine[][] {
  const byExpiry = new Map<number, CookieLine[]>()

  for (const cookie of cookies) {
    const key = cookie.expiry
    if (!byExpiry.has(key)) byExpiry.set(key, [])
    byExpiry.get(key)!.push(cookie)
  }

  if (byExpiry.size === 1 && cookies.length > 2) {
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

async function importSingleText(
  serviceId: string,
  cookieText: string,
  sessionLabel: string | null
): Promise<{ created: string[]; errors: string[] }> {
  const lines = String(cookieText).split('\n')
  const parsedCookies: CookieLine[] = []

  for (const line of lines) {
    const c = parseCookieLine(line)
    if (c) parsedCookies.push(c)
  }

  if (parsedCookies.length === 0) {
    return { created: [], errors: ['Nenhum cookie válido encontrado'] }
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

      // Nome da sessão: usa o nome do arquivo se disponível
      let username: string
      if (sessionLabel) {
        const clean = sessionLabel.replace(/\.txt$/i, '').trim()
        username = sessions.length === 1 ? clean : `${clean} #${sessionNum}`
        extraData.sourceFile = sessionLabel
      } else {
        username = `Cookie Session #${sessionNum}`
      }

      await prisma.stock.create({
        data: {
          serviceId,
          username,
          password: mainCookie.value,
          extraData: JSON.stringify(extraData)
        }
      })

      created.push(username)
    } catch (e: any) {
      errors.push(`Sessão ${sessionNum}: ${e.message || 'erro desconhecido'}`)
    }
  }

  return { created, errors }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const session = await getServerSession(req, res, authOptions)

  if (!session || session.user.role !== 'OWNER') {
    return res.status(403).json({ error: 'Unauthorized' })
  }

  const { serviceId, cookieText, sessionLabel, files } = req.body

  if (!serviceId) {
    return res.status(400).json({ error: 'serviceId é obrigatório' })
  }

  // ── Modo: múltiplos arquivos ────────────────────────────────────────────
  // files = [{ name: "arquivo.txt", content: "..." }, ...]
  if (Array.isArray(files) && files.length > 0) {
    const allCreated: string[] = []
    const allErrors: string[] = []
    const fileResults: Array<{ name: string; created: number; errors: number }> = []

    for (const file of files) {
      if (!file.content || typeof file.content !== 'string') {
        allErrors.push(`${file.name || 'arquivo'}: conteúdo inválido`)
        continue
      }
      const label = file.name ? String(file.name) : null
      const result = await importSingleText(serviceId, file.content, label)
      allCreated.push(...result.created)
      allErrors.push(...result.errors.map((e: string) => `${file.name}: ${e}`))
      fileResults.push({
        name: file.name || 'arquivo',
        created: result.created.length,
        errors: result.errors.length
      })
    }

    return res.json({
      success: true,
      created: allCreated.length,
      filesProcessed: files.length,
      fileResults,
      errors: allErrors.length > 0 ? allErrors : undefined
    })
  }

  // ── Modo: texto único ───────────────────────────────────────────────────
  if (!cookieText) {
    return res.status(400).json({ error: 'cookieText ou files são obrigatórios' })
  }

  const label = sessionLabel ? String(sessionLabel) : null
  const result = await importSingleText(serviceId, cookieText, label)

  if (result.created.length === 0 && result.errors.length > 0) {
    return res.status(400).json({ error: result.errors[0] })
  }

  return res.json({
    success: true,
    created: result.created.length,
    sessionsDetected: result.created.length + result.errors.length,
    errors: result.errors.length > 0 ? result.errors : undefined
  })
}
