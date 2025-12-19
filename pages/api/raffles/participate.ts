import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import { simpleRateLimit, getClientIp } from '@/lib/api-protection'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // 🛡️ RATE LIMITING: Máximo 10 participações por hora
  const rateCheck = await simpleRateLimit(req, 10, 60)
  if (!rateCheck.allowed) {
    return res.status(429).json({ error: rateCheck.error })
  }

  const { raffleId } = req.body

  if (!raffleId) {
    return res.status(400).json({ error: 'RaffleId is required' })
  }

  // 🛡️ Validar formato do ID
  if (typeof raffleId !== 'string' || raffleId.length < 10) {
    return res.status(400).json({ error: 'Invalid raffleId format' })
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

    // 🛡️ Verificar se usuário está banido
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isBanned: true }
    })

    if (user?.isBanned) {
      return res.status(403).json({ error: 'Usuários banidos não podem participar de sorteios.' })
    }

    // 🛡️ Verificar participações por device fingerprint (anti multi-conta)
    const currentUserFull = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { deviceFingerprint: true }
    })

    if (currentUserFull?.deviceFingerprint) {
      const sameDeviceParticipants = await prisma.raffleParticipant.findMany({
        where: {
          raffleId,
          user: {
            deviceFingerprint: currentUserFull.deviceFingerprint
          }
        }
      })

      if (sameDeviceParticipants.length >= 2) {
        // Log tentativa suspeita
        try {
          await prisma.securityLog.create({
            data: {
              type: 'bot_detected',
              ip: getClientIp(req),
              username: session.user.id,
              success: false,
              reason: 'Múltiplas participações em sorteio do mesmo dispositivo',
              metadata: JSON.stringify({
                action: 'raffle_multi_account',
                raffleId,
                existingParticipants: sameDeviceParticipants.length
              })
            }
          })
        } catch (e) {}

        return res.status(403).json({ 
          error: 'Detectamos múltiplas contas do mesmo dispositivo. Contate o suporte.' 
        })
      }
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

    // Log participação
    try {
      await prisma.securityLog.create({
        data: {
          type: 'register_attempt',
          ip: getClientIp(req),
          username: session.user.id,
          success: true,
          reason: 'Participação em sorteio',
          metadata: JSON.stringify({
            action: 'raffle_participate',
            raffleId,
            raffleName: raffle.title
          })
        }
      })
    } catch (e) {}

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
