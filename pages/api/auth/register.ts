import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Configurar timeout
  res.setTimeout(25000, () => {
    res.status(408).json({ error: 'Request timeout - O servidor demorou muito para responder' })
  })

  try {
    console.log('Register API called:', { username: req.body?.username })
    const { username, email, password } = req.body

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' })
    }

    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' })
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' })
    }

    console.log('Checking existing users...')
    
    // Verificar se o username já existe
    const existingUser = await prisma.user.findUnique({
      where: { username }
    }).catch((err) => {
      console.error('Error checking username:', err)
      throw err
    })

    if (existingUser) {
      console.log('Username already exists')
      return res.status(400).json({ error: 'Username already exists' })
    }

    // Verificar se o email já existe (se fornecido)
    if (email) {
      const existingEmail = await prisma.user.findFirst({
        where: { email }
      }).catch((err) => {
        console.error('Error checking email:', err)
        throw err
      })

      if (existingEmail) {
        console.log('Email already exists')
        return res.status(400).json({ error: 'Email already exists' })
      }
    }

    console.log('User does not exist, creating...')

    // Hash da senha
    console.log('Hashing password...')
    const hashedPassword = await hashPassword(password)

    // Criar usuário
    console.log('Creating user in database...')
    const user = await prisma.user.create({
      data: {
        username,
        email: email || null,
        password: hashedPassword,
        role: 'USER'
      }
    }).catch((err) => {
      console.error('Error creating user:', err)
      throw err
    })

    console.log('User created successfully:', user.id)

    // Retornar dados sem senha
    const { password: _, ...userWithoutPassword } = user

    return res.status(201).json({
      message: 'User created successfully',
      user: userWithoutPassword
    })
  } catch (error: any) {
    console.error('Error creating user:', error)
    
    // Verificar se é erro de conexão com banco
    if (error.code === 'ECONNREFUSED' || error.message?.includes('connect')) {
      return res.status(500).json({ error: 'Erro de conexão com o banco de dados. Verifique se o MongoDB está rodando e a DATABASE_URL está correta.' })
    }
    
    // Verificar se é erro de schema/Prisma
    if (error.message?.includes('prisma') || error.message?.includes('schema')) {
      return res.status(500).json({ error: 'Erro no banco de dados. Execute: npm run db:push' })
    }
    
    return res.status(500).json({ 
      error: error.message || 'Erro ao criar usuário',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
}
