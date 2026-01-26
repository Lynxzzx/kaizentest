
import { prisma } from '../lib/prisma'

async function main() {
  const username = 'Lynx'
  
  console.log(`Buscando usuário ${username}...`)
  const user = await prisma.user.findUnique({
    where: { username }
  })

  if (!user) {
    console.error(`Usuário ${username} não encontrado!`)
    return
  }

  console.log(`Usuário encontrado. TokenVersion atual: ${user.tokenVersion || 0}`)
  console.log('Incrementando tokenVersion para forçar logout de todas as sessões...')

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      tokenVersion: {
        increment: 1
      }
    }
  })

  console.log(`Sucesso! Novo TokenVersion: ${updatedUser.tokenVersion}`)
  console.log('Todas as sessões ativas deste usuário serão invalidadas na próxima requisição.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
