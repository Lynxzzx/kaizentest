import NextAuth, { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import { verifyPassword } from '@/lib/auth'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        try {
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
            console.log('💡 Dica: Verifique se o username no banco está exatamente como:', identifier)
            throw new Error('Invalid credentials')
          }

          console.log('✅ Usuário encontrado:', user.username)
          console.log('🔐 Verificando senha...')

          const isValid = await verifyPassword(credentials.password, user.password)

          if (!isValid) {
            console.log('❌ Senha inválida')
            throw new Error('Invalid credentials')
          }

          console.log('✅ Login bem-sucedido:', user.username)

          return {
            id: user.id,
            username: user.username,
            role: user.role
          }
        } catch (error: any) {
          console.error('❌ NextAuth authorize error:', error.message)
          
          // Verificar se é erro de conexão ou DNS
          const errorMsg = error.message?.toLowerCase() || ''
          const isConnError = 
            error.code === 'ECONNREFUSED' || 
            errorMsg.includes('connect') || 
            errorMsg.includes('dns') || 
            errorMsg.includes('resolution') || 
            errorMsg.includes('malformed label') ||
            errorMsg.includes('database connection')

          if (isConnError) {
            console.error('⚠️ Detalhes do erro de banco:', error)
            throw new Error('Erro de conexão com o banco de dados. Verifique a DATABASE_URL na Vercel.')
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
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user = {
          id: token.id as string,
          username: token.username as string,
          role: token.role as string
        }
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
