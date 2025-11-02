import { prisma } from './prisma'
import { hashPassword } from './auth'

export async function initOwner() {
  try {
    const ownerExists = await prisma.user.findFirst({
      where: { username: 'Lynx', role: 'OWNER' }
    })

    if (!ownerExists) {
      const hashedPassword = await hashPassword('Lynx')
      await prisma.user.create({
        data: {
          username: 'Lynx',
          password: hashedPassword,
          role: 'OWNER'
        }
      })
      console.log('Owner created successfully')
    }
  } catch (error) {
    console.error('Error initializing owner:', error)
  }
}
