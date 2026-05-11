import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Atlas + Vercel: mescla parâmetros na DATABASE_URL sem apagar os que já existem.
 *
 * readPreference=secondaryPreferred: quando o primary some do topology (ex.: TLS "InternalError"
 * só em um host), leituras podem usar os secondaries — útil para GET /api/plans.
 * Escritas ainda precisam de um primary saudável; corrija o cluster no Atlas.
 *
 * Desligar o desvio: DATABASE_URL sem readPreference e defina MONGODB_READ_PREFERENCE=primary
 */
function effectiveDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL
  if (!url) return undefined

  const qIndex = url.indexOf('?')
  const base = qIndex === -1 ? url : url.substring(0, qIndex)
  const query = qIndex === -1 ? '' : url.substring(qIndex + 1)
  const params = new URLSearchParams(query)

  const addIfMissing = (key: string, value: string) => {
    if (!params.has(key)) params.set(key, value)
  }

  addIfMissing('maxPoolSize', '10')
  addIfMissing('minPoolSize', '0')
  addIfMissing('serverSelectionTimeoutMS', '45000')
  addIfMissing('connectTimeoutMS', '15000')

  const forcePrimary = process.env.MONGODB_READ_PREFERENCE === 'primary'
  if (!forcePrimary) {
    addIfMissing('readPreference', 'secondaryPreferred')
    addIfMissing('maxStalenessSeconds', '120')
  }

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
