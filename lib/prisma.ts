import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Sanitiza a DATABASE_URL e garante que a URL seja válida para o MongoDB:
 * 1. Remove espaços e quebras de linha invisíveis
 * 2. Remove aspas externas acidentais
 * 3. Garante que existe uma barra "/" entre o host e os parâmetros de query
 *    (ex: @cluster.mongodb.net?retry → @cluster.mongodb.net/?retry)
 */
function getDbUrl(): string | undefined {
  const raw = process.env.DATABASE_URL
  if (!raw) return undefined

  // Passo 1: remove espaços/quebras de linha e aspas externas
  let url = raw.replace(/\s/g, '').replace(/^["'](.+)["']$/, '$1')

  // Passo 2: garante a barra entre o host/dbname e os query params
  // Só aplica se ainda não houver barra após o "://"
  const protoEnd = url.indexOf('://')
  if (protoEnd !== -1) {
    const afterProto = url.slice(protoEnd + 3)
    const slashPos = afterProto.indexOf('/')
    const queryPos = afterProto.indexOf('?')

    // Se não há barra, ou a barra só aparece depois do "?"
    if (slashPos === -1 || (queryPos !== -1 && slashPos > queryPos)) {
      if (queryPos !== -1) {
        // Insere uma barra antes do "?"
        url = url.slice(0, protoEnd + 3 + queryPos) + '/' + url.slice(protoEnd + 3 + queryPos)
      } else {
        url += '/'
      }
    }
  }

  return url
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
