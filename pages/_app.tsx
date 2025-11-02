import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import { SessionProvider } from 'next-auth/react'
import Layout from '@/components/Layout'
import { Toaster } from 'react-hot-toast'
import { useEffect } from 'react'
import { initOwner } from '@/lib/init-owner'

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
    <SessionProvider session={session}>
      <Layout>
        <Component {...pageProps} />
        <Toaster position="top-right" />
      </Layout>
    </SessionProvider>
  )
}

export default App
