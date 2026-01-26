import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import { SessionProvider } from 'next-auth/react'
import Layout from '@/components/Layout'
import { Toaster } from 'react-hot-toast'
import { useEffect } from 'react'
import { initOwner } from '@/lib/init-owner'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { ChristmasProvider } from '@/contexts/ChristmasContext'
import ChristmasEffects from '@/components/ChristmasEffects'

function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  useEffect(() => {
    // Initialize owner on app start
    console.log('🚀 Iniciando aplicação...')
    initOwner().catch((error) => {
      console.error('❌ Erro ao inicializar owner:', error)
    })
  }, [])

  // Adicionar tratamento global de erros
  useEffect(() => {
    const handleError = (error: ErrorEvent) => {
      console.error('❌ Erro global capturado:', error.error)
    }

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('❌ Promise rejeitada:', event.reason)
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])

  return (
    <SessionProvider session={session} refetchInterval={5 * 60} refetchOnWindowFocus={true}>
      <ThemeProvider>
        <ChristmasProvider>
          <AuthHandler>
            <Layout>
              <Component {...pageProps} />
              <Toaster position="top-right" />
            </Layout>
          </AuthHandler>
          <ChristmasEffects />
        </ChristmasProvider>
      </ThemeProvider>
    </SessionProvider>
  )
}

// Componente auxiliar para lidar com lógica de autenticação global
import { useSession, signOut } from 'next-auth/react'

function AuthHandler({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()

  useEffect(() => {
    // Se a sessão estiver autenticada mas o usuário estiver vazio (devido ao erro no token), força logout
    if (status === 'authenticated' && !session) {
      console.log('⚠️ Sessão corrompida ou invalidada detectada (session is null). Forçando logout...')
      signOut({ callbackUrl: '/login' })
    }
    
    // Fallback: Se status for unauthenticated mas estavamos logados antes (detectado via localStorage ou cookie se quisessemos ser mais robustos)
    // Mas aqui vamos confiar no retorno nulo da session
  }, [session, status])

  return <>{children}</>
}

export default App
