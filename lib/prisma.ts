import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Atlas + Vercel: mescla parâmetros na DATABASE_URL sem apagar os que já existem.
 *
 * NÃO usar readPreference=secondary (ou similar) aqui: o Prisma usa transações em
 * escritas (ex.: payment.create) e o MongoDB exige primary — senão:
 * "read preference in a transaction must be primary".
 *
 * Removemos readPreference/maxStalenessSeconds se vierem na URL por engano.
 *
 * Evitamos URLSearchParams na query inteira: ele pode re-codificar valores e, em
 * alguns ambientes, contribuir para falhas de handshake TLS com mongodb+srv.
 */
function effectiveDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL
  if (!url) return undefined

  const qIndex = url.indexOf('?')
  let base = qIndex === -1 ? url : url.slice(0, qIndex)
  const rawQuery = qIndex === -1 ? '' : url.slice(qIndex + 1)

  const pairs: string[] = []
  const seenKeys = new Set<string>()

  if (rawQuery) {
    for (const part of rawQuery.split('&')) {
      if (!part) continue
      const eq = part.indexOf('=')
      const keyRaw = eq === -1 ? part : part.slice(0, eq)
      const key = keyRaw.toLowerCase()
      if (key === 'readpreference' || key === 'maxstalenessseconds') {
        continue
      }
      pairs.push(part)
      seenKeys.add(key)
    }
  }

  const addIfMissing = (key: string, value: string) => {
    if (!seenKeys.has(key.toLowerCase())) {
      pairs.push(`${key}=${value}`)
      seenKeys.add(key.toLowerCase())
    }
  }

  addIfMissing('maxPoolSize', '10')
  addIfMissing('minPoolSize', '0')
  addIfMissing('serverSelectionTimeoutMS', '45000')
  addIfMissing('connectTimeoutMS', '15000')

  // FIX: Garantir que exista uma barra entre o host e os parâmetros
  // O MongoDB exige: mongodb+srv://host/dbname?params ou mongodb+srv://host/?params
  const protocolEndIndex = base.indexOf('://')
  if (protocolEndIndex !== -1) {
    const afterProtocol = base.slice(protocolEndIndex + 3)
    if (!afterProtocol.includes('/')) {
      base += '/'
    }
  }

  if (pairs.length === 0) return base
  return `${base}?${pairs.join('&')}`
}

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('⚠️ DATABASE_URL não está configurada no arquivo .env')
} else {
  console.log(
    '📦 DATABASE_URL:',
    databaseUrl.includes('mongodb+srv://') ? 'MongoDB Atlas' : databaseUrl.includes('localhost') ? 'MongoDB Local' : 'Outro'
  )
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: effectiveDatabaseUrl(),
      },
    },
  })

globalForPrisma.prisma = prisma
