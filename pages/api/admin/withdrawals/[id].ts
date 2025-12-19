import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

/**
 * API para admin processar uma solicitação de resgate
 * PUT /api/admin/withdrawals/[id]
 * Body: { action: 'complete' | 'reject' | 'processing', adminNotes?: string }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const session = await getServerSession(req, res, authOptions)
  if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'OWNER')) {
    return res.status(403).json({ error: 'Forbidden - Admin only' })
  }

  try {
    const { id } = req.query
    const { action, adminNotes } = req.body

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'ID inválido' })
    }

    const validActions = ['complete', 'reject', 'processing']
    if (!action || !validActions.includes(action)) {
      return res.status(400).json({ error: 'Ação inválida' })
    }

    // Buscar o resgate
    const withdrawal = await prisma.affiliateWithdrawal.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            affiliateBalance: true
          }
        }
      }
    })

    if (!withdrawal) {
      return res.status(404).json({ error: 'Resgate não encontrado' })
    }

    // Verificar se o resgate pode ser processado
    if (withdrawal.status === 'COMPLETED') {
      return res.status(400).json({ error: 'Este resgate já foi concluído' })
    }

    if (withdrawal.status === 'REJECTED') {
      return res.status(400).json({ error: 'Este resgate já foi rejeitado' })
    }

    let newStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'REJECTED'
    let message: string

    switch (action) {
      case 'complete':
        newStatus = 'COMPLETED'
        message = 'Resgate marcado como concluído!'
        break
      case 'reject':
        newStatus = 'REJECTED'
        message = 'Resgate rejeitado'
        // Se rejeitado, devolver o valor ao saldo do usuário
        await prisma.user.update({
          where: { id: withdrawal.userId },
          data: {
            affiliateBalance: {
              increment: withdrawal.amount
            }
          }
        })
        break
      case 'processing':
        newStatus = 'PROCESSING'
        message = 'Resgate marcado como em processamento'
        break
      default:
        return res.status(400).json({ error: 'Ação inválida' })
    }

    // Atualizar o resgate
    const updatedWithdrawal = await prisma.affiliateWithdrawal.update({
      where: { id },
      data: {
        status: newStatus,
        processedById: session.user.id,
        processedAt: action === 'complete' || action === 'reject' ? new Date() : undefined,
        adminNotes: adminNotes || undefined
      },
      include: {
        user: {
          select: {
            id: true,
            username: true
          }
        }
      }
    })

    console.log(`💰 [admin-withdrawal] ${action.toUpperCase()}: ${withdrawal.user.username} - R$ ${withdrawal.amount.toFixed(2)}`)

    return res.json({
      success: true,
      message,
      withdrawal: updatedWithdrawal
    })

  } catch (error: any) {
    console.error('Erro ao processar resgate:', error)
    return res.status(500).json({
      error: 'Erro interno',
      details: error.message
    })
  }
}

