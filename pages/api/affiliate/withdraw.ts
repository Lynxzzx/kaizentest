import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

/**
 * API para solicitar resgate de saldo de afiliado
 * POST /api/affiliate/withdraw
 * Body: { amount: number, pixKey: string, pixKeyType: 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'RANDOM' }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const session = await getServerSession(req, res, authOptions)
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const { amount, pixKey, pixKeyType } = req.body

    // Validações
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Valor inválido' })
    }

    if (!pixKey || typeof pixKey !== 'string' || pixKey.trim().length < 3) {
      return res.status(400).json({ error: 'Chave PIX inválida' })
    }

    const validPixKeyTypes = ['CPF', 'CNPJ', 'EMAIL', 'PHONE', 'RANDOM']
    if (!pixKeyType || !validPixKeyTypes.includes(pixKeyType)) {
      return res.status(400).json({ error: 'Tipo de chave PIX inválido' })
    }

    // Buscar usuário com saldo
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        username: true,
        affiliateBalance: true
      }
    })

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' })
    }

    // Verificar saldo suficiente
    const balance = user.affiliateBalance || 0
    if (amount > balance) {
      return res.status(400).json({ 
        error: 'Saldo insuficiente',
        balance,
        requested: amount
      })
    }

    // Valor mínimo de resgate: R$ 10,00
    if (amount < 10) {
      return res.status(400).json({ 
        error: 'Valor mínimo de resgate é R$ 10,00'
      })
    }

    // Verificar se não há resgate pendente
    const pendingWithdrawal = await prisma.affiliateWithdrawal.findFirst({
      where: {
        userId: user.id,
        status: { in: ['PENDING', 'PROCESSING'] }
      }
    })

    if (pendingWithdrawal) {
      return res.status(400).json({ 
        error: 'Você já possui um resgate pendente. Aguarde o processamento antes de solicitar outro.'
      })
    }

    // Criar solicitação de resgate
    const withdrawal = await prisma.affiliateWithdrawal.create({
      data: {
        userId: user.id,
        amount,
        pixKey: pixKey.trim(),
        pixKeyType: pixKeyType as any,
        status: 'PENDING'
      }
    })

    // Deduzir o valor do saldo do usuário
    await prisma.user.update({
      where: { id: user.id },
      data: {
        affiliateBalance: {
          decrement: amount
        }
      }
    })

    console.log(`💰 [withdraw] Solicitação de resgate criada: ${user.username} - R$ ${amount.toFixed(2)}`)

    return res.json({
      success: true,
      message: 'Solicitação de resgate enviada com sucesso! Aguarde o processamento.',
      withdrawal: {
        id: withdrawal.id,
        amount: withdrawal.amount,
        status: withdrawal.status,
        createdAt: withdrawal.createdAt
      }
    })

  } catch (error: any) {
    console.error('Erro ao solicitar resgate:', error)
    return res.status(500).json({
      error: 'Erro interno',
      details: error.message
    })
  }
}

