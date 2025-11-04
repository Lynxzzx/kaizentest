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
    console.log('Register API called:', { username: req.body?.username, affiliateRef: req.body?.affiliateRef })
    const { username, email, password, deviceFingerprint, affiliateRef } = req.body

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' })
    }

    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' })
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' })
    }

    // VALIDAÇÃO DE SEGURANÇA: Verificar device fingerprint
    if (deviceFingerprint) {
      const existingDevice = await prisma.user.findFirst({
        where: { deviceFingerprint }
      })

      if (existingDevice) {
        console.log('Device already has an account:', deviceFingerprint)
        return res.status(403).json({ 
          error: 'Este dispositivo já possui uma conta. Para sua segurança, cada dispositivo pode criar apenas uma conta.' 
        })
      }
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

    // Processar referência de afiliado se fornecida
    let referrerId: string | null = null
    if (affiliateRef) {
      console.log('Processing affiliate reference:', affiliateRef)
      const referrer = await prisma.user.findFirst({
        where: { affiliateCode: affiliateRef.trim().toUpperCase() }
      })

      if (referrer) {
        // VALIDAÇÃO: Não permitir auto-referência (mesmo usuário)
        // Mas não podemos verificar isso aqui porque o usuário ainda não existe
        // Verificaremos após criar o usuário
        referrerId = referrer.id
        console.log('Referrer found:', referrer.id)
      } else {
        console.log('Referrer not found for code:', affiliateRef)
      }
    }

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
        role: 'USER',
        deviceFingerprint: deviceFingerprint || null, // Armazenar device fingerprint
        referredBy: referrerId || null // Armazenar referência se existir
      }
    }).catch((err) => {
      console.error('Error creating user:', err)
      throw err
    })

    console.log('User created successfully:', user.id)

    // Processar recompensas de afiliado se houver referência
    if (referrerId && user.id !== referrerId) {
      try {
        // Verificar validações de segurança (device fingerprint)
        const referrer = await prisma.user.findUnique({
          where: { id: referrerId }
        })

        if (referrer) {
          // Verificar se são do mesmo dispositivo
          if (user.deviceFingerprint && referrer.deviceFingerprint) {
            if (user.deviceFingerprint === referrer.deviceFingerprint) {
              console.log('Same device detected, skipping affiliate reward')
              // Remover referência se for do mesmo dispositivo
              await prisma.user.update({
                where: { id: user.id },
                data: { referredBy: null }
              })
            } else {
              // Criar recompensa de afiliado
              await prisma.affiliateReward.create({
                data: {
                  userId: referrerId,
                  referredUserId: user.id,
                  rewardedGenerations: 2
                }
              })

              // Adicionar gerações bonus ao referenciador
              await prisma.user.update({
                where: { id: referrerId },
                data: {
                  bonusGenerations: {
                    increment: 2
                  }
                }
              })

              // Adicionar 2 gerações grátis ao novo usuário (vindas do afiliado)
              await prisma.user.update({
                where: { id: user.id },
                data: {
                  bonusGenerations: {
                    increment: 2
                  }
                }
              })

              console.log('Affiliate reward created successfully for new user')
            }
          } else {
            // Se não há device fingerprint, processar normalmente
            await prisma.affiliateReward.create({
              data: {
                userId: referrerId,
                referredUserId: user.id,
                rewardedGenerations: 2
              }
            })

            await prisma.user.update({
              where: { id: referrerId },
              data: {
                bonusGenerations: {
                  increment: 2
                }
              }
            })

            await prisma.user.update({
              where: { id: user.id },
              data: {
                bonusGenerations: {
                  increment: 2
                }
              }
            })

            console.log('Affiliate reward created successfully for new user (no device fingerprint)')
          }
        }
      } catch (affiliateError: any) {
        console.error('Error processing affiliate reward:', affiliateError)
        // Não falhar o registro se houver erro no afiliado
      }
    }

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
