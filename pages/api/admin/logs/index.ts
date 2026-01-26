
import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (!session || session.user.role !== 'OWNER') {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { type, page = '1', limit = '50', search } = req.query
    const pageNum = parseInt(page as string)
    const limitNum = parseInt(limit as string)
    const skip = (pageNum - 1) * limitNum

    let logs
    let total

    if (type === 'security') {
      const where: any = {}
      if (search) {
        where.OR = [
          { username: { contains: search as string, mode: 'insensitive' } },
          { ip: { contains: search as string } },
          { type: { contains: search as string, mode: 'insensitive' } }
        ]
      }

      logs = await prisma.securityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limitNum,
        skip
      })
      total = await prisma.securityLog.count({ where })

    } else {
      // Admin logs (default)
      const where: any = {}
      if (search) {
        where.OR = [
          { targetType: { contains: search as string, mode: 'insensitive' } },
          { targetName: { contains: search as string, mode: 'insensitive' } },
          { ipAddress: { contains: search as string } }
        ]
        // Search by username requires joining, which prisma doesn't support easily in simple where
        // So we might filter by userId if we fetch users matching the name first, but let's keep it simple for now
      }

      logs = await prisma.adminLog.findMany({
        where,
        include: {
          user: {
            select: { username: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limitNum,
        skip
      })
      total = await prisma.adminLog.count({ where })
    }

    return res.status(200).json({
      logs,
      pagination: {
        total,
        pages: Math.ceil(total / limitNum),
        page: pageNum,
        limit: limitNum
      }
    })

  } catch (error: any) {
    console.error('Error fetching logs:', error)
    return res.status(500).json({ error: 'Error fetching logs' })
  }
}
