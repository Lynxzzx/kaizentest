import NextAuth, { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import { verifyPassword } from '@/lib/auth'
import { BUILD_TIME } from '@/lib/build-info'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials, req) {
        try {
          // Capturar IP
          const ip = req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress || 'unknown'
          const ipAddress = Array.isArray(ip) ? ip[0] : (typeof ip === 'string' ? ip.split(',')[0] : 'unknown')

          if (!credentials?.username || !credentials?.password) {
            throw new Error('Username and password required')
          }

          const identifier = credentials.username.trim()
          const normalizedIdentifier = identifier.toLowerCase()
          const isEmail = identifier.includes('@')

          console.log('🔐 Tentativa de login:', { identifier, isEmail })

          // Primeiro tentar busca exata por username
          let user = await prisma.user.findUnique({
            where: { username: identifier }
          })

          console.log('🔍 Busca exata por username:', user ? '✅ Encontrado' : '❌ Não encontrado')

          // Se não encontrar, tentar busca case-insensitive
          if (!user) {
            console.log('🔍 Tentando busca case-insensitive...')
            user = await prisma.user.findFirst({
              where: isEmail
                ? {
                    OR: [
                      {
                        username: {
                          equals: identifier,
                          mode: 'insensitive'
                        }
                      },
                      {
                        email: {
                          equals: normalizedIdentifier,
                          mode: 'insensitive'
                        }
                      }
                    ]
                  }
                : {
                    username: {
                      equals: identifier,
                      mode: 'insensitive'
                    }
                  }
            })
            console.log('🔍 Busca case-insensitive:', user ? '✅ Encontrado' : '❌ Não encontrado')
          }

          if (!user) {
            console.log('❌ Usuário não encontrado após todas as tentativas')
            // Log failed attempt
            await prisma.securityLog.create({
              data: {
                type: 'login_attempt',
                ip: ipAddress,
                username: identifier,
                success: false,
                reason: 'User not found',
                metadata: JSON.stringify({ identifier, isEmail })
              }
            })
            console.log('💡 Dica: Verifique se o username no banco está exatamente como:', identifier)
            throw new Error('Invalid credentials')
          }

          console.log('✅ Usuário encontrado:', user.username)
          console.log('🔐 Verificando senha...')

          const isValid = await verifyPassword(credentials.password, user.password)

          if (!isValid) {
            console.log('❌ Senha inválida')
             // Log failed attempt (wrong password)
             await prisma.securityLog.create({
              data: {
                type: 'login_attempt',
                ip: ipAddress,
                username: user.username,
                success: false,
                reason: 'Invalid password',
                metadata: JSON.stringify({ identifier })
              }
            })
            throw new Error('Invalid credentials')
          }

          console.log('✅ Login bem-sucedido:', user.username)

          // Log successful login
          await prisma.securityLog.create({
            data: {
              type: 'login_attempt',
              ip: ipAddress,
              username: user.username,
              success: true
            }
          })

          return {
            id: user.id,
            username: user.username,
            role: user.role,
            tokenVersion: user.tokenVersion
          }
        } catch (error: any) {
          console.error('❌ NextAuth authorize error:', error.message)
          // Verificar se é erro de conexão
          if (error.code === 'ECONNREFUSED' || error.message?.includes('connect')) {
            throw new Error('Erro de conexão com o banco de dados')
          }
          throw error
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.username = user.username
        token.role = user.role
        token.tokenVersion = user.tokenVersion || 0
      }

      // Validar sessão a cada requisição
      if (token?.id) {
        // Verificar se houve novo deploy (apenas para Lynx)
        const isLynx = (token.username as string)?.toLowerCase() === 'lynx';
        if (isLynx && typeof token.iat === 'number' && typeof BUILD_TIME === 'number' && BUILD_TIME > 0) {
          // Se o token foi emitido antes do último deploy (com 10s de tolerância)
          if (token.iat < (BUILD_TIME - 10)) {
            console.log(`🔒 Novo deploy detectado. Forçando re-login para Lynx. (Build: ${BUILD_TIME}, Token: ${token.iat})`)
            return { ...token, error: 'NewDeployLogout' }
          }
        }

        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { tokenVersion: true }
          })
          
          const dbVersion = dbUser?.tokenVersion || 0
          const tokenVersion = token.tokenVersion || 0

          console.log(`🔍 Validando sessão para ${token.username}: DB v${dbVersion} vs Token v${tokenVersion}`)

          // Se o usuário não existir ou a versão do token mudou, invalida a sessão
          if (!dbUser || dbVersion !== tokenVersion) {
            console.log(`❌ Sessão inválida para ${token.username}: Versão do token incompatível (DB: ${dbVersion}, Token: ${tokenVersion})`)
            return { ...token, error: 'RefreshAccessTokenError' } // Retorna token inválido
          }
        } catch (error) {
          console.error('Error validating session:', error)
        }
      }

      return token
    },
    async session({ session, token }) {
      if (!token || token.error) {
        console.log('⚠️ Sessão rejeitada devido a erro no token')
        return null as any // Retorna null para invalidar a sessão no frontend
      }

      session.user = {
        id: token.id as string,
        username: token.username as string,
        role: token.role as string,
        tokenVersion: token.tokenVersion as number
      }
      
      return session
    }
  },
  pages: {
    signIn: '/login',
    signOut: '/' // Sempre redireciona para a página principal ao fazer logout
  },
  session: {
    strategy: 'jwt'
  },
  secret: process.env.NEXTAUTH_SECRET
}

export default NextAuth(authOptions)
