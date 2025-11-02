import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Forçar desconexão e reconexão
    await prisma.$disconnect()
    
    // Aguardar um pouco
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Reconectar
    await prisma.$connect()
    
    // Testar query
    const count = await prisma.user.count()
    
    return res.json({
      success: true,
      message: 'Conexão restabelecida com sucesso!',
      userCount: count,
      databaseUrl: process.env.DATABASE_URL?.substring(0, 30) + '...'
    })
  } catch (error: any) {
    console.error('Fix connection error:', error)
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao reconectar',
      suggestion: 'Verifique se o MongoDB Atlas está acessível e se seu IP está liberado no MongoDB Atlas.'
    })
  }
}
