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
import AnnouncementModal from '@/components/AnnouncementModal'
import { Inter, Outfit, JetBrains_Mono } from 'next/font/google'

const sans = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-sans'
})

const display = Outfit({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  display: 'swap',
  variable: '--font-display'
})

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-mono'
})

function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  useEffect(() => {
    console.log('🚀 Iniciando aplicação...')
    initOwner().catch((error) => {
      console.error('❌ Erro ao inicializar owner:', error)
    })
  }, [])

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
      <ThemeProvider>
        <ChristmasProvider>
          <div className={`${sans.variable} ${display.variable} ${mono.variable} font-sans`}>
            <Layout>
              <Component {...pageProps} />
              <Toaster
                position="top-right"
                toastOptions={{
                  style: {
                    background: 'rgba(12, 12, 21, 0.95)',
                    color: '#e9e9f5',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    backdropFilter: 'blur(20px)',
                    borderRadius: '14px',
                    padding: '12px 16px',
                    fontSize: '14px',
                    fontWeight: 500,
                    boxShadow: '0 20px 60px -15px rgba(0,0,0,0.7)'
                  }
                }}
              />
            </Layout>
            <ChristmasEffects />
            <AnnouncementModal />
          </div>
        </ChristmasProvider>
      </ThemeProvider>
    </SessionProvider>
  )
}

export default App
