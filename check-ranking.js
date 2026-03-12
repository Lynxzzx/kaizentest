const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({ select: { username: true, role: true, weeklyGenerations: true }, orderBy: { weeklyGenerations: 'desc' }, take: 10 })
  console.table(users)
}
main().catch(console.error).finally(() => prisma.$disconnect())
