import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!session || session.user.role !== 'OWNER') {
    return res.status(403).json({ error: 'Unauthorized' })
  }

  const { serviceId, accounts } = req.body

  if (!serviceId || !accounts) {
    return res.status(400).json({ error: 'ServiceId and accounts are required' })
  }

  if (!Array.isArray(accounts) || accounts.length === 0) {
    return res.status(400).json({ error: 'Accounts must be a non-empty array' })
  }

  try {
    const createdStocks = []
    const errors = []

    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i].trim()
      
      // Validar formato email:pass
      if (!account.includes(':')) {
        errors.push(`Linha ${i + 1}: Formato inválido. Use email:pass`)
        continue
      }

      const [email, password] = account.split(':').map((s: string) => s.trim())
      
      if (!email || !password) {
        errors.push(`Linha ${i + 1}: Email ou senha vazios`)
        continue
      }

      try {
        // Usar email como username (pode ser ajustado conforme necessário)
        const stock = await prisma.stock.create({
          data: {
            serviceId,
            username: email, // Usar email como username
            password,
            email
          }
        })
        createdStocks.push(stock)
      } catch (error: any) {
        errors.push(`Linha ${i + 1}: ${error.message || 'Erro ao criar conta'}`)
      }
    }

    return res.json({
      success: true,
      created: createdStocks.length,
      errors: errors.length > 0 ? errors : undefined,
      stocks: createdStocks
    })
  } catch (error: any) {
    console.error('Error creating bulk stocks:', error)
    return res.status(500).json({ error: 'Internal server error', details: error.message })
  }
}

