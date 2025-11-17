import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (!session || session.user.role !== 'OWNER') {
    return res.status(403).json({ error: 'Unauthorized' })
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        role: true
      },
      orderBy: { createdAt: 'desc' }
    })

    console.log('📋 Total de usuários:', users.length)
    users.forEach(user => {
      console.log(`- ID: ${user.id} | Username: "${user.username}" | Email: ${user.email || 'N/A'} | Role: ${user.role}`)
      console.log(`  Bytes do username:`, Buffer.from(user.username).toString('hex'))
    })

    return res.json({
      total: users.length,
      users: users.map(u => ({
        id: u.id,
        username: u.username,
        usernameHex: Buffer.from(u.username).toString('hex'),
        usernameLength: u.username.length,
        email: u.email,
        role: u.role
      }))
    })
  } catch (error: any) {
    console.error('❌ Error listing usernames:', error)
    return res.status(500).json({ error: 'Internal server error', details: error.message })
  }
}

