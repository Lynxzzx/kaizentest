import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!session || (session.user.role !== 'OWNER' && session.user.role !== 'ADMIN')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { raffleId } = req.body

  if (!raffleId) {
    return res.status(400).json({ error: 'RaffleId is required' })
  }

  try {
    // Buscar sorteio
    const raffle = await prisma.raffle.findUnique({
      where: { id: raffleId },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true
              }
            }
          }
        },
        prizePlan: true
      }
    })

    if (!raffle) {
      return res.status(404).json({ error: 'Sorteio não encontrado' })
    }

    if (raffle.isFinished) {
      return res.status(400).json({ error: 'Este sorteio já foi finalizado' })
    }

    if (raffle.participants.length === 0) {
      return res.status(400).json({ error: 'Não há participantes neste sorteio' })
    }

    // Sortear ganhador aleatório
    const randomIndex = Math.floor(Math.random() * raffle.participants.length)
    const winner = raffle.participants[randomIndex].user

    // Atualizar sorteio com ganhador
    const updatedRaffle = await prisma.raffle.update({
      where: { id: raffleId },
      data: {
        winnerId: winner.id,
        isFinished: true,
        isActive: false
      },
      include: {
        winner: {
          select: {
            id: true,
            username: true,
            email: true
          }
        },
        prizePlan: true
      }
    })

    // Entregar prêmio ao ganhador
    if (raffle.prizeType === 'PLAN' && raffle.prizePlanId && raffle.prizePlan) {
      // Ativar plano para o ganhador
      const plan = raffle.prizePlan
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + plan.duration)

      await prisma.user.update({
        where: { id: winner.id },
        data: {
          planId: plan.id,
          planExpiresAt: expiresAt
        }
      })
    } else if (raffle.prizeType === 'GENERATIONS') {
      // Adicionar gerações grátis
      const generations = parseInt(raffle.prize) || 10 // Padrão 10 se não especificado
      await prisma.user.update({
        where: { id: winner.id },
        data: {
          bonusGenerations: {
            increment: generations
          }
        }
      })
    }

    return res.status(200).json({
      message: 'Sorteio realizado com sucesso!',
      raffle: updatedRaffle,
      winner: {
        id: winner.id,
        username: winner.username,
        email: winner.email
      }
    })
  } catch (error: any) {
    console.error('Error drawing raffle:', error)
    return res.status(500).json({ error: 'Error drawing raffle', details: error.message })
  }
}

