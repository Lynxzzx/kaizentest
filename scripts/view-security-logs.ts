
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const username = 'Lynx'
  console.log(`Buscando logs de segurança para: ${username}`)

  const logs = await prisma.securityLog.findMany({
    where: {
      username: {
        equals: username,
        mode: 'insensitive'
      }
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 20
  })

  console.log(`Encontrados ${logs.length} logs recentes:`)
  console.log('----------------------------------------')
  
  logs.forEach(log => {
    console.log(`[${log.createdAt.toISOString()}] Tipo: ${log.type} | IP: ${log.ip} | Sucesso: ${log.success} | Motivo: ${log.reason || 'N/A'}`)
  })

  // Também buscar logs de admin
  const user = await prisma.user.findUnique({ where: { username } })
  if (user) {
    console.log('\n--- Logs de Ações Administrativas ---')
    const adminLogs = await prisma.adminLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 10
    })

    adminLogs.forEach(log => {
      console.log(`[${log.createdAt.toISOString()}] Ação: ${log.action} | Alvo: ${log.targetType} ${log.targetName} | IP: ${log.ipAddress}`)
    })
  }
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
