import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const session = await getServerSession(req, res, authOptions)

    if (!session || (session.user.role !== 'OWNER' && session.user.role !== 'ADMIN')) {
        return res.status(401).json({ error: 'Unauthorized' })
    }

    // GET - List all events
    if (req.method === 'GET') {
        try {
            const events = await prisma.event.findMany({
                orderBy: { createdAt: 'desc' },
                include: {
                    createdBy: { select: { id: true, username: true } },
                    _count: { select: { participants: true } }
                }
            })
            return res.status(200).json(events)
        } catch (error: any) {
            console.error('Error fetching events:', error)
            return res.status(500).json({ error: 'Failed to fetch events', details: error.message })
        }
    }

    // POST - Create event
    if (req.method === 'POST') {
        const { title, description, type, prize, prizeType, prizePlanId, questions, maxParticipants, endDate } = req.body

        if (!title || !prize || !endDate) {
            return res.status(400).json({ error: 'Title, prize and endDate are required' })
        }

        const endDateObj = new Date(endDate)
        if (isNaN(endDateObj.getTime()) || endDateObj <= new Date()) {
            return res.status(400).json({ error: 'End date must be a valid future date' })
        }

        try {
            // Validate questions JSON if it's a quiz
            let questionsData = null
            if (type === 'QUIZ' && questions) {
                if (typeof questions === 'string') {
                    questionsData = questions
                } else {
                    questionsData = JSON.stringify(questions)
                }
            }

            const event = await prisma.event.create({
                data: {
                    title,
                    description: description || null,
                    type: type || 'QUIZ',
                    prize,
                    prizeType: prizeType || 'CUSTOM',
                    prizePlanId: prizeType === 'PLAN' ? prizePlanId : null,
                    questions: questionsData,
                    maxParticipants: maxParticipants ? Number(maxParticipants) : null,
                    endDate: endDateObj,
                    createdById: session.user.id
                },
                include: {
                    createdBy: { select: { id: true, username: true } },
                    _count: { select: { participants: true } }
                }
            })

            return res.status(201).json(event)
        } catch (error: any) {
            console.error('Error creating event:', error)
            return res.status(500).json({ error: 'Failed to create event', details: error.message })
        }
    }

    // PUT - Update event
    if (req.method === 'PUT') {
        const { id, title, description, type, prize, prizeType, questions, maxParticipants, endDate, isActive, status } = req.body

        if (!id) {
            return res.status(400).json({ error: 'Event ID is required' })
        }

        try {
            const existing = await prisma.event.findUnique({ where: { id } })
            if (!existing) {
                return res.status(404).json({ error: 'Event not found' })
            }

            const updateData: any = {}
            if (title !== undefined) updateData.title = title
            if (description !== undefined) updateData.description = description || null
            if (type !== undefined) updateData.type = type
            if (prize !== undefined) updateData.prize = prize
            if (prizeType !== undefined) updateData.prizeType = prizeType
            if (maxParticipants !== undefined) updateData.maxParticipants = maxParticipants ? Number(maxParticipants) : null
            if (endDate !== undefined) updateData.endDate = new Date(endDate)
            if (isActive !== undefined) updateData.isActive = Boolean(isActive)
            if (status !== undefined) updateData.status = status

            if (questions !== undefined) {
                updateData.questions = typeof questions === 'string' ? questions : JSON.stringify(questions)
            }

            // If ending the event, pick a winner
            if (status === 'ENDED' && existing.status !== 'ENDED') {
                const participants = await prisma.eventParticipation.findMany({
                    where: { eventId: id },
                    orderBy: existing.type === 'QUIZ' ? { score: 'desc' } : { createdAt: 'asc' }
                })

                if (participants.length > 0) {
                    if (existing.type === 'QUIZ') {
                        // Winner is the one with highest score
                        updateData.winnerId = participants[0].userId
                        updateData.winnerScore = participants[0].score
                    } else {
                        // Random winner for CHALLENGE/GIVEAWAY
                        const randomIdx = Math.floor(Math.random() * participants.length)
                        updateData.winnerId = participants[randomIdx].userId
                    }
                }

                updateData.isActive = false
            }

            const updated = await prisma.event.update({
                where: { id },
                data: updateData,
                include: {
                    createdBy: { select: { id: true, username: true } },
                    _count: { select: { participants: true } }
                }
            })

            return res.status(200).json(updated)
        } catch (error: any) {
            console.error('Error updating event:', error)
            return res.status(500).json({ error: 'Failed to update event', details: error.message })
        }
    }

    // DELETE - Delete event
    if (req.method === 'DELETE') {
        const { id } = req.query

        if (!id || typeof id !== 'string') {
            return res.status(400).json({ error: 'Event ID is required' })
        }

        try {
            await prisma.event.delete({ where: { id } })
            return res.status(200).json({ message: 'Event deleted successfully' })
        } catch (error: any) {
            console.error('Error deleting event:', error)
            return res.status(500).json({ error: 'Failed to delete event', details: error.message })
        }
    }

    return res.status(405).json({ error: 'Method not allowed' })
}
