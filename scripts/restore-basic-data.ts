import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🔄 Iniciando restauração de dados básicos...')

  // Verificar se já existe usuário admin
  const existingOwner = await prisma.user.findFirst({
    where: { username: 'Lynx', role: 'OWNER' }
  })

  if (existingOwner) {
    console.log('✅ Usuário admin já existe:', existingOwner.username)
  } else {
    // Criar usuário admin
    const hashedPassword = await bcrypt.hash('eliezermito1', 10)
    const owner = await prisma.user.create({
      data: {
        username: 'Lynx',
        password: hashedPassword,
        role: 'OWNER',
        email: null
      }
    })
    console.log('✅ Usuário admin criado:', owner.username)
  }

  // Verificar se há dados no banco
  const userCount = await prisma.user.count()
  const planCount = await prisma.plan.count()
  const serviceCount = await prisma.service.count()

  console.log('\n📊 Status do banco de dados:')
  console.log(`   Usuários: ${userCount}`)
  console.log(`   Planos: ${planCount}`)
  console.log(`   Serviços: ${serviceCount}`)

  if (userCount === 0 || planCount === 0 || serviceCount === 0) {
    console.log('\n⚠️  ATENÇÃO: O banco de dados foi resetado e perdeu dados!')
    console.log('   Você precisa:')
    console.log('   1. Verificar se há backup no MongoDB Atlas')
    console.log('   2. Recriar planos, serviços e estoques manualmente')
    console.log('   3. Os usuários precisarão se registrar novamente')
  }

  console.log('\n✅ Restauração básica concluída!')
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

