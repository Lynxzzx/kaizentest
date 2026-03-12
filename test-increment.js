const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const user = await prisma.user.findFirst()
  console.log('Testing increment on user:', user.username)
  try {
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { weeklyGenerations: { increment: 1 } }
    })
    console.log('Success!', updated.weeklyGenerations)
  } catch (e) {
    console.error('Error incrementing:', e.message)
  }
}
main().finally(() => prisma.$disconnect())
