import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Sanitiza a DATABASE_URL removendo aspas externas e espaços/quebras de linha
 * que possam ter sido copiados acidentalmente ao configurar a variável de ambiente.
 */
function getDbUrl(): string | undefined {
  const raw = process.env.DATABASE_URL
  if (!raw) return undefined
  // 1. Remove todos os espaços e quebras de linha invisíveis
  // 2. Remove aspas externas se existirem (ex: "minha-url" → minha-url)
  return raw.replace(/\s/g, '').replace(/^["'](.+)["']$/, '$1')
}

const dbUrl = getDbUrl()

if (!dbUrl) {
  console.error('⚠️ DATABASE_URL não está configurada')
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: { db: { url: dbUrl } },
  })

globalForPrisma.prisma = prisma
