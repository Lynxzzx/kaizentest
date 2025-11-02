import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('Testing database connection...')
    
    // Testar conexão
    await prisma.$connect()
    console.log('Database connected')
    
    // Testar query
    const count = await prisma.user.count()
    console.log('User count:', count)
    
    // Testar criação (sem salvar)
    const testUsername = `test_${Date.now()}`
    const hashedPassword = await hashPassword('test123')
    console.log('Password hashed')
    
    return res.json({
      success: true,
      databaseConnected: true,
      userCount: count,
      message: 'Tudo funcionando! Você pode criar contas.'
    })
  } catch (error: any) {
    console.error('Test error:', error)
    return res.status(500).json({
      success: false,
      databaseConnected: false,
      error: error.message || 'Erro ao testar',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
}
