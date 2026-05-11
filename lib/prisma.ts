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
 */
function effectiveDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL
  if (!url) return undefined

  const qIndex = url.indexOf('?')
  const base = qIndex === -1 ? url : url.substring(0, qIndex)
  const query = qIndex === -1 ? '' : url.substring(qIndex + 1)
  const params = new URLSearchParams(query)

  params.delete('readPreference')
  params.delete('readpreference')
  params.delete('maxStalenessSeconds')
  params.delete('maxstalenessseconds')

  const addIfMissing = (key: string, value: string) => {
    if (!params.has(key)) params.set(key, value)
  }

  addIfMissing('maxPoolSize', '10')
  addIfMissing('minPoolSize', '0')
  addIfMissing('serverSelectionTimeoutMS', '45000')
  addIfMissing('connectTimeoutMS', '15000')

  const qs = params.toString()
  return qs ? `${base}?${qs}` : base
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
