import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { raffleId } = req.body

  if (!raffleId) {
    return res.status(400).json({ error: 'RaffleId is required' })
  }

  try {
    // Verificar se o sorteio existe e está ativo
    const raffle = await prisma.raffle.findUnique({
      where: { id: raffleId }
    })

    if (!raffle) {
      return res.status(404).json({ error: 'Sorteio não encontrado' })
    }

    if (!raffle.isActive || raffle.isFinished) {
      return res.status(400).json({ error: 'Este sorteio não está mais ativo' })
    }

    // Verificar se o sorteio ainda não expirou
    if (new Date() >= raffle.endDate) {
      return res.status(400).json({ error: 'Este sorteio já foi finalizado' })
    }

    // Verificar se o usuário já participou
    const existingParticipant = await prisma.raffleParticipant.findUnique({
      where: {
        raffleId_userId: {
          raffleId,
          userId: session.user.id
        }
      }
    })

    if (existingParticipant) {
      return res.status(400).json({ error: 'Você já está participando deste sorteio' })
    }

    // Adicionar participante
    const participant = await prisma.raffleParticipant.create({
      data: {
        raffleId,
        userId: session.user.id
      },
      include: {
        user: {
          select: {
            id: true,
            username: true
          }
        },
        raffle: {
          include: {
            _count: {
              select: {
                participants: true
              }
            }
          }
        }
      }
    })

    return res.status(200).json({
      message: 'Você entrou no sorteio com sucesso!',
      participant,
      totalParticipants: participant.raffle._count.participants
    })
  } catch (error: any) {
    console.error('Error participating in raffle:', error)
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Você já está participando deste sorteio' })
    }
    return res.status(500).json({ error: 'Error participating in raffle', details: error.message })
  }
}

