import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const dbUrl = process.env.DATABASE_URL || 'NOT_SET'
  const hasDbUrl = dbUrl !== 'NOT_SET'
  const isAtlas = dbUrl.includes('mongodb+srv://')
  const isLocalhost = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')
  
  return res.json({
    hasDatabaseUrl: hasDbUrl,
    isAtlas: isAtlas,
    isLocalhost: isLocalhost,
    databaseUrlPreview: hasDbUrl 
      ? `${dbUrl.substring(0, 20)}...${dbUrl.substring(dbUrl.length - 10)}` 
      : 'NOT_SET',
    message: isLocalhost 
      ? '⚠️ URL aponta para localhost. Você precisa configurar MongoDB Atlas ou ter MongoDB local rodando.'
      : isAtlas
      ? '✅ URL do MongoDB Atlas configurada'
      : '⚠️ DATABASE_URL não está configurada corretamente'
  })
}
