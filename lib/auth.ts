import bcrypt from 'bcryptjs'
import { prisma } from './prisma'

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

export async function createOwner() {
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
  }
}
