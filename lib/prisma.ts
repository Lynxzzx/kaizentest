import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Verificar se a DATABASE_URL está configurada
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('⚠️ DATABASE_URL não está configurada no arquivo .env')
} else {
  console.log('📦 DATABASE_URL configurada:', databaseUrl.includes('mongodb+srv://') ? 'MongoDB Atlas' : databaseUrl.includes('localhost') ? 'MongoDB Local' : 'Outro')
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  // Otimizações de performance para serverless (Vercel)
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
})

// Testar conexão na inicialização (somente no servidor)
if (typeof window === 'undefined' && databaseUrl) {
  // Não bloquear a inicialização, apenas logar
  prisma.$connect()
    .then(() => {
      console.log('✅ Conectado ao banco de dados MongoDB')
    })
    .catch((error) => {
      console.error('❌ Erro ao conectar ao banco de dados:', error.message)
      if (error.message?.includes('localhost')) {
        console.error('⚠️ O Prisma está tentando conectar em localhost. Verifique se a DATABASE_URL está correta no .env')
        console.error('💡 Reinicie o servidor (Ctrl+C e depois npm run dev) após atualizar o .env')
      }
    })
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
