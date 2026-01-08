import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'
import {
  validateRegisterRequest,
  getClientIp,
  getUserAgent,
  logSecurityEvent
} from '@/lib/security'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Configurar timeout
  res.setTimeout(25000, () => {
    res.status(408).json({ error: 'Request timeout - O servidor demorou muito para responder' })
  })

  const ip = getClientIp(req)
  const userAgent = getUserAgent(req)

  try {
    console.log('Register API called:', { 
      username: req.body?.username, 
      affiliateRef: req.body?.affiliateRef,
      ip 
    })

    const { 
      username, 
      email, 
      password, 
      deviceFingerprint, 
      affiliateRef,
      recaptchaToken,
      honeypot,
      formStartTime
    } = req.body

    const sanitizedUsername = typeof username === 'string' ? username.trim() : ''

    // ================================================
    // 🛡️ VALIDAÇÃO DE SEGURANÇA COMPLETA
    // ================================================
    const securityCheck = await validateRegisterRequest(req, {
      username: sanitizedUsername,
      recaptchaToken,
      honeypot,
      formStartTime
    })

    if (!securityCheck.allowed) {
      console.log('🚫 Security check failed:', securityCheck.reason)
      return res.status(403).json({ 
        error: securityCheck.reason || 'Verificação de segurança falhou',
        securityBlock: true
      })
    }

    if (securityCheck.warnings.length > 0) {
      console.log('⚠️ Security warnings:', securityCheck.warnings)
    }

    // ================================================
    // 📋 VALIDAÇÕES BÁSICAS
    // ================================================
    const normalizedEmail = typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : null
    const sanitizedDeviceFingerprint = typeof deviceFingerprint === 'string' && deviceFingerprint.trim().length > 0
      ? deviceFingerprint.trim()
      : null

    if (!sanitizedUsername || !password) {
      return res.status(400).json({ error: 'Username e senha são obrigatórios' })
    }

    if (sanitizedUsername.length < 3) {
      return res.status(400).json({ error: 'Username deve ter pelo menos 3 caracteres' })
    }

    if (sanitizedUsername.length > 30) {
      return res.status(400).json({ error: 'Username deve ter no máximo 30 caracteres' })
    }

    // Validar caracteres do username
    if (!/^[a-zA-Z0-9_]+$/.test(sanitizedUsername)) {
      return res.status(400).json({ error: 'Username só pode conter letras, números e underscore' })
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres' })
    }

    if (password.length > 100) {
      return res.status(400).json({ error: 'Senha muito longa' })
    }

    // Validar email se fornecido
    if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Email inválido' })
    }

    // ================================================
    // 🔒 VALIDAÇÃO DE DEVICE FINGERPRINT
    // ================================================
    if (sanitizedDeviceFingerprint) {
      // Verificar se o IP está autorizado a criar múltiplas contas
      const authorizedIp = await prisma.authorizedIp.findUnique({
        where: { ip }
      })

      // Se o IP não está autorizado, verificar device fingerprint
      if (!authorizedIp) {
        const existingDevice = await prisma.user.findFirst({
          where: { deviceFingerprint: sanitizedDeviceFingerprint }
        })

        if (existingDevice) {
          console.log('🚫 Device already has an account:', sanitizedDeviceFingerprint)
          
          await logSecurityEvent({
            type: 'register_attempt',
            ip,
            userAgent,
            username: sanitizedUsername,
            success: false,
            reason: 'Device fingerprint já existe'
          })

          return res.status(403).json({ 
            error: 'Este dispositivo já possui uma conta. Para sua segurança, cada dispositivo pode criar apenas uma conta.' 
          })
        }
      } else {
        console.log('✅ IP autorizado detectado, permitindo múltiplas contas:', ip)
      }
    }

    // ================================================
    // 🔍 VERIFICAR USUÁRIOS EXISTENTES
    // ================================================
    console.log('Checking existing users...')
    
    // Verificar se o username já existe
    const existingUser = await prisma.user.findFirst({
      where: {
        username: {
          equals: sanitizedUsername,
          mode: 'insensitive'
        }
      }
    }).catch((err) => {
      console.error('Error checking username:', err)
      throw err
    })

    if (existingUser) {
      console.log('Username already exists')
      return res.status(400).json({ error: 'Username já existe' })
    }

    // Verificar se o email já existe (se fornecido)
    if (normalizedEmail) {
      const existingEmail = await prisma.user.findFirst({
        where: {
          email: {
            equals: normalizedEmail,
            mode: 'insensitive'
          }
        }
      }).catch((err) => {
        console.error('Error checking email:', err)
        throw err
      })

      if (existingEmail) {
        console.log('Email already exists')
        return res.status(400).json({ error: 'Email já existe' })
      }
    }

    // ================================================
    // 🔗 PROCESSAR REFERÊNCIA DE AFILIADO
    // ================================================
    console.log('User does not exist, creating...')

    let referrerId: string | null = null
    if (affiliateRef) {
      console.log('Processing affiliate reference:', affiliateRef)
      const referrer = await prisma.user.findFirst({
        where: { affiliateCode: affiliateRef.trim().toUpperCase() }
      })

      if (referrer) {
        referrerId = referrer.id
        console.log('Referrer found:', referrer.id)
      } else {
        console.log('Referrer not found for code:', affiliateRef)
      }
    }

    // ================================================
    // 🔐 CRIAR USUÁRIO
    // ================================================
    console.log('Hashing password...')
    const hashedPassword = await hashPassword(password)

    console.log('Creating user in database...')
    const user = await prisma.user.create({
      data: {
        username: sanitizedUsername,
        email: normalizedEmail,
        password: hashedPassword,
        role: 'USER',
        deviceFingerprint: sanitizedDeviceFingerprint,
        registrationIp: ip,
        lastIp: ip,
        lastIpAt: new Date(),
        referredBy: referrerId || null
      }
    }).catch((err) => {
      console.error('Error creating user:', err)
      throw err
    })

    console.log('✅ User created successfully:', user.id)

    // Log de sucesso
    await logSecurityEvent({
      type: 'register_attempt',
      ip,
      userAgent,
      username: sanitizedUsername,
      success: true,
      metadata: {
        userId: user.id,
        botScore: securityCheck.botScore,
        recaptchaScore: securityCheck.recaptchaScore
      }
    })

    // ================================================
    // 🎁 PROCESSAR RECOMPENSAS DE AFILIADO
    // ================================================
    if (referrerId && user.id !== referrerId) {
      try {
        const referrer = await prisma.user.findUnique({
          where: { id: referrerId }
        })

        if (referrer) {
          // Verificar se são do mesmo dispositivo
          if (user.deviceFingerprint && referrer.deviceFingerprint) {
            if (user.deviceFingerprint === referrer.deviceFingerprint) {
              console.log('Same device detected, skipping affiliate reward')
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

              // Adicionar 2 gerações grátis ao novo usuário
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
    
    // Log de erro
    await logSecurityEvent({
      type: 'register_attempt',
      ip,
      userAgent,
      username: req.body?.username,
      success: false,
      reason: error.message
    })
    
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
