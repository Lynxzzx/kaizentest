import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Parâmetros extras para Atlas + Vercel (serverless):
 * - maxPoolSize baixo: cada instância serverless usa poucas conexões e não esgota o cluster.
 * - timeouts explícitos: evita pendurar quando a rede oscila.
 * Se já existirem na DATABASE_URL, não duplicamos.
 */
function effectiveDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL
  if (!url) return undefined
  if (url.includes('maxPoolSize=')) return url
  const joiner = url.includes('?') ? '&' : '?'
  return `${url}${joiner}maxPoolSize=10&minPoolSize=0&serverSelectionTimeoutMS=10000&connectTimeoutMS=10000`
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

// Sempre reutilizar a mesma instância no mesmo processo (dev e produção).
// Em produção sem isso, cold starts / reavaliações podem abrir vários pools → "pool cleared" / TLS no Atlas.
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
