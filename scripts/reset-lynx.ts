
import { PrismaClient } from '@prisma/client'
// @ts-ignore
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  try {
    const username = 'Lynx'
    const newPassword = 'eliezermito1'
    
    console.log(`Buscando usuário ${username}...`)
    const user = await prisma.user.findFirst({
      where: {
        username: {
          equals: username,
          mode: 'insensitive'
        }
      }
    })

    if (!user) {
      console.error(`Usuário ${username} não encontrado!`)
      return
    }

    console.log(`Usuário encontrado: ${user.username} (${user.id})`)
    
    const hashedPassword = await bcrypt.hash(newPassword, 12)
    
    // Define tokenVersion com timestamp para garantir invalidação
    // E atualiza a senha
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        tokenVersion: Math.floor(Date.now() / 1000)
      }
    })

    console.log('✅ Senha atualizada e sessões invalidadas com sucesso!')
    console.log(`Nova versão do token: ${updatedUser.tokenVersion}`)
    
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
