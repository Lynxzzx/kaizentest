import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Verificar se já existe um OWNER com username 'Lynx'
  const existingOwner = await prisma.user.findFirst({
    where: { username: 'Lynx', role: 'OWNER' }
  })

  if (existingOwner) {
    // Atualizar a senha do owner existente
    const hashedPassword = await bcrypt.hash('Lynx', 10)
    const updated = await prisma.user.update({
      where: { id: existingOwner.id },
      data: { password: hashedPassword }
    })
    console.log('Owner atualizado com sucesso!')
    console.log('Usuário:', updated.username)
    console.log('Senha: Lynx')
    return
  }

  // Verificar se existe um usuário com username 'Lynx' mas não é OWNER
  const existingUser = await prisma.user.findUnique({
    where: { username: 'Lynx' }
  })

  if (existingUser) {
    // Deletar o usuário existente e criar novo como OWNER
    await prisma.user.delete({
      where: { id: existingUser.id }
    })
    console.log('Usuário existente removido')
  }

  // Criar novo owner
  const hashedPassword = await bcrypt.hash('Lynx', 10)

  const owner = await prisma.user.create({
    data: {
      username: 'Lynx',
      password: hashedPassword,
      role: 'OWNER'
    }
  })

  console.log('✅ Owner criado com sucesso!')
  console.log('Usuário: Lynx')
  console.log('Senha: Lynx')
  console.log('Role: OWNER')
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
