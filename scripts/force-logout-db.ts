
import { PrismaClient } from '@prisma/client'
// @ts-ignore
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  try {
    const username = 'Lynx'
    
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
    console.log(`TokenVersion atual: ${user.tokenVersion}`)
    
    // Força um novo valor de tokenVersion usando timestamp atual
    const newTokenVersion = Math.floor(Date.now() / 1000)
    
    // Atualiza também a senha para garantir
    const newPassword = 'eliezermito1'
    const hashedPassword = await bcrypt.hash(newPassword, 12)

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        tokenVersion: newTokenVersion,
        // Limpa qualquer token de reset de senha
        passwordResetToken: null,
        passwordResetExpires: null
      }
    })

    console.log('✅ DADOS ATUALIZADOS NO BANCO COM SUCESSO!')
    console.log(`Novo TokenVersion: ${updatedUser.tokenVersion}`)
    console.log('Isso deve invalidar imediatamente qualquer sessão ativa pois o token JWT antigo terá versão diferente.')
    
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
