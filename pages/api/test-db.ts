import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Testar conexão
    await prisma.$connect()
    
    // Testar query simples
    const userCount = await prisma.user.count()
    
    return res.json({
      connected: true,
      userCount,
      message: 'Banco de dados conectado com sucesso!'
    })
  } catch (error: any) {
    console.error('Database test error:', error)
    return res.status(500).json({
      connected: false,
      error: error.message || 'Erro ao conectar ao banco de dados',
      suggestion: 'Verifique se o MongoDB está rodando e a DATABASE_URL está correta no arquivo .env'
    })
  }
}
