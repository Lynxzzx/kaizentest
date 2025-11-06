import { ReactNode, useState } from 'react'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useTranslation } from '@/lib/i18n-helper'
import { useTheme } from '@/contexts/ThemeContext'
import Logo from './Logo'
import Chatbox from './Chatbox'
import BroadcastBanner from './BroadcastBanner'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { data: session } = useSession()
  const { t, locale, changeLanguage } = useTranslation()
  const { theme } = useTheme()
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [chatboxOpen, setChatboxOpen] = useState(false)

  // Classes de tema para o container principal
  const getThemeClasses = () => {
    switch (theme) {
      case 'dark':
        return 'min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white'
      case 'light':
        return 'min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 text-gray-900'
      case 'default':
        return 'min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 text-gray-900'
      default:
        return 'min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white'
    }
  }

  // Classes de tema para navbar
  const getNavbarClasses = () => {
    switch (theme) {
      case 'dark':
        return 'bg-white/10 backdrop-blur-lg shadow-lg border-b border-white/20 sticky top-0 z-50'
      case 'light':
        return 'bg-white/80 backdrop-blur-lg shadow-lg border-b border-gray-200/50 sticky top-0 z-50'
      case 'default':
        return 'bg-white shadow-lg border-b border-gray-200 sticky top-0 z-50'
      default:
        return 'bg-white/10 backdrop-blur-lg shadow-lg border-b border-white/20 sticky top-0 z-50'
    }
  }

  // Classes de tema para footer
  const getFooterClasses = () => {
    switch (theme) {
      case 'dark':
        return 'bg-slate-900/50 border-t border-white/20 mt-16'
      case 'light':
        return 'bg-white border-t border-gray-200 mt-16'
      case 'default':
        return 'bg-white border-t border-gray-200 mt-16'
      default:
        return 'bg-slate-900/50 border-t border-white/20 mt-16'
    }
  }

  // Classes de tema para texto do footer
  const getFooterTextClasses = () => {
    switch (theme) {
      case 'dark':
        return 'text-gray-300'
      case 'light':
      case 'default':
        return 'text-gray-600'
      default:
        return 'text-gray-300'
    }
  }

  return (
    <div className={getThemeClasses()}>
      <BroadcastBanner />
      <nav className={getNavbarClasses()}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 md:h-20">
            <div className="flex items-center space-x-4 md:space-x-8">
              <Logo size="md" showText={false} />
              {session && (
                <>
                  {/* Desktop Menu */}
                  <div className="hidden md:flex items-center space-x-1">
                    <Link
                      href={session.user.role === 'OWNER' ? '/admin' : '/dashboard'}
                      className={`px-4 py-2 rounded-lg font-medium transition-all ${
                        router.pathname === '/admin' || router.pathname === '/dashboard'
                          ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                          : theme === 'dark' ? 'text-gray-300 hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {session.user.role === 'OWNER' ? t('admin') : t('dashboard')}
                    </Link>
                    {session.user.role !== 'OWNER' && (
                      <>
                        <Link
                          href="/plans"
                          className={`px-4 py-2 rounded-lg font-medium transition-all ${
                            router.pathname === '/plans'
                              ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                              : theme === 'dark' ? 'text-gray-300 hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          {t('plans')}
                        </Link>
                        <Link
                          href="/affiliate"
                          className={`px-4 py-2 rounded-lg font-medium transition-all ${
                            router.pathname === '/affiliate'
                              ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                              : theme === 'dark' ? 'text-gray-300 hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          Afiliados
                        </Link>
                        <Link
                          href="/raffles"
                          className={`px-4 py-2 rounded-lg font-medium transition-all ${
                            router.pathname === '/raffles'
                              ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                              : theme === 'dark' ? 'text-gray-300 hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          🎲 Sorteios
                        </Link>
                        <Link
                          href="/tickets"
                          className={`px-4 py-2 rounded-lg font-medium transition-all ${
                            router.pathname === '/tickets'
                              ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                              : theme === 'dark' ? 'text-gray-300 hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          Suporte
                        </Link>
                    <Link
                      href="/keys/redeem"
                      className={`px-4 py-2 rounded-lg font-medium transition-all ${
                        router.pathname === '/keys/redeem'
                          ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                          : theme === 'dark' ? 'text-gray-300 hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      Resgatar Chave
                    </Link>
                    <Link
                      href="/settings"
                      className={`px-4 py-2 rounded-lg font-medium transition-all ${
                        router.pathname === '/settings'
                          ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                          : theme === 'dark' ? 'text-gray-300 hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      ⚙️ Configurações
                    </Link>
                    <button
                      onClick={() => setChatboxOpen(!chatboxOpen)}
                      className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center space-x-2 ${
                        chatboxOpen
                          ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                          : theme === 'dark' ? 'text-gray-300 hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <span>💬</span>
                      <span>Chat</span>
                    </button>
                      </>
                    )}
                    {session.user.role === 'OWNER' && (
                      <>
                    <Link
                      href="/tickets"
                      className={`px-4 py-2 rounded-lg font-medium transition-all ${
                        router.pathname === '/tickets'
                          ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                          : theme === 'dark' ? 'text-gray-300 hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      Tickets
                    </Link>
                    <Link
                      href="/settings"
                      className={`px-4 py-2 rounded-lg font-medium transition-all ${
                        router.pathname === '/settings'
                          ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                          : theme === 'dark' ? 'text-gray-300 hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      ⚙️ Configurações
                    </Link>
                    <button
                      onClick={() => setChatboxOpen(!chatboxOpen)}
                      className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center space-x-2 ${
                        chatboxOpen
                          ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                          : theme === 'dark' ? 'text-gray-300 hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <span>💬</span>
                      <span>Chat</span>
                    </button>
                      </>
                    )}
                  </div>
                  {/* Mobile Menu Button */}
                  <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className={`md:hidden p-2 rounded-lg transition-colors ${
                      theme === 'dark' ? 'text-gray-300 hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    aria-label="Toggle menu"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {mobileMenuOpen ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                      )}
                    </svg>
                  </button>
                </>
              )}
            </div>
            <div className="flex items-center space-x-2 md:space-x-4">
              <select
                value={locale}
                onChange={(e) => changeLanguage(e.target.value)}
                className={`px-2 py-1.5 md:px-3 md:py-2 rounded-lg text-xs md:text-sm hover:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors ${
                  theme === 'dark'
                    ? 'bg-white/10 border border-white/20 text-white'
                    : 'bg-white border border-gray-300 text-gray-900'
                }`}
                style={theme === 'dark' ? { colorScheme: 'dark' } : {}}
              >
                <option value="pt-BR" style={theme === 'dark' ? { backgroundColor: '#1e293b', color: '#fff' } : {}}>🇧🇷 PT-BR</option>
                <option value="en" style={theme === 'dark' ? { backgroundColor: '#1e293b', color: '#fff' } : {}}>🇺🇸 EN</option>
              </select>
              {session ? (
                <div className="flex items-center space-x-2 md:space-x-3">
                  <Link
                    href={`/profile/${session.user.username}`}
                    className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-xs">
                      {session.user.username.charAt(0).toUpperCase()}
                    </div>
                  </Link>
                  <div className="hidden md:block text-right">
                    <p className="text-sm font-semibold text-gray-900">{session.user.username}</p>
                    <p className="text-xs text-gray-500">
                      {session.user.role === 'OWNER' ? 'Administrador' : 'Usuário'}
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      // Fazer logout sem redirecionamento automático do NextAuth
                      // Isso evita o problema com localhost
                      await signOut({ redirect: false })
                      
                      // Redirecionar manualmente para a página principal usando caminho relativo
                      // Isso garante que sempre vai para a URL correta do site, não localhost
                      if (typeof window !== 'undefined') {
                        window.location.href = '/'
                      }
                    }}
                    className="px-3 py-1.5 md:px-4 md:py-2 bg-red-50 text-red-600 rounded-lg text-sm md:text-base font-medium hover:bg-red-100 transition-colors border border-red-200"
                  >
                    {t('logout')}
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Link
                    href="/register"
                    className="hidden sm:block px-3 py-1.5 md:px-4 md:py-2 text-sm md:text-base text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition-colors"
                  >
                    Criar Conta
                  </Link>
                  <Link
                    href="/login"
                    className="px-4 py-1.5 md:px-6 md:py-2 bg-gradient-to-r from-primary-600 to-primary-700 text-white text-sm md:text-base rounded-lg font-medium hover:from-primary-700 hover:to-primary-800 transition-all shadow-md hover:shadow-lg"
                  >
                    {t('login')}
                  </Link>
                </div>
              )}
            </div>
          </div>
          
          {/* Mobile Menu */}
          {mobileMenuOpen && session && (
            <div className={`md:hidden ${theme === 'dark' ? 'border-t border-white/20' : 'border-t border-gray-200'} py-4`}>
              <div className="flex flex-col space-y-2">
                  <Link
                    href={session.user.role === 'OWNER' ? '/admin' : '/dashboard'}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`px-4 py-3 rounded-lg font-medium transition-all ${
                      router.pathname === '/admin' || router.pathname === '/dashboard'
                        ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                        : theme === 'dark' ? 'text-gray-300 hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {session.user.role === 'OWNER' ? t('admin') : t('dashboard')}
                  </Link>
                  {session.user.role !== 'OWNER' && (
                    <>
                      <Link
                        href="/plans"
                        onClick={() => setMobileMenuOpen(false)}
                        className={`px-4 py-3 rounded-lg font-medium transition-all ${
                          router.pathname === '/plans'
                            ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                            : theme === 'dark' ? 'text-gray-300 hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {t('plans')}
                      </Link>
                      <Link
                        href="/affiliate"
                        onClick={() => setMobileMenuOpen(false)}
                        className={`px-4 py-3 rounded-lg font-medium transition-all ${
                          router.pathname === '/affiliate'
                            ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                            : theme === 'dark' ? 'text-gray-300 hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        Afiliados
                      </Link>
                      <Link
                        href="/raffles"
                        onClick={() => setMobileMenuOpen(false)}
                        className={`px-4 py-3 rounded-lg font-medium transition-all ${
                          router.pathname === '/raffles'
                            ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                            : theme === 'dark' ? 'text-gray-300 hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        🎲 Sorteios
                      </Link>
                      <Link
                        href="/tickets"
                        onClick={() => setMobileMenuOpen(false)}
                        className={`px-4 py-3 rounded-lg font-medium transition-all ${
                          router.pathname === '/tickets'
                            ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                            : theme === 'dark' ? 'text-gray-300 hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        Suporte
                      </Link>
                      <Link
                        href="/keys/redeem"
                        onClick={() => setMobileMenuOpen(false)}
                        className={`px-4 py-3 rounded-lg font-medium transition-all ${
                          router.pathname === '/keys/redeem'
                            ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                            : theme === 'dark' ? 'text-gray-300 hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        Resgatar Chave
                      </Link>
                      <Link
                        href="/settings"
                        onClick={() => setMobileMenuOpen(false)}
                        className={`px-4 py-3 rounded-lg font-medium transition-all ${
                          router.pathname === '/settings'
                            ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                            : theme === 'dark' ? 'text-gray-300 hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        ⚙️ Configurações
                      </Link>
                      <button
                        onClick={() => {
                          setChatboxOpen(!chatboxOpen)
                          setMobileMenuOpen(false)
                        }}
                        className={`px-4 py-3 rounded-lg font-medium transition-all flex items-center space-x-2 ${
                          chatboxOpen
                            ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                            : theme === 'dark' ? 'text-gray-300 hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <span>💬</span>
                        <span>Chat</span>
                      </button>
                    </>
                  )}
                  {session.user.role === 'OWNER' && (
                    <>
                      <Link
                        href="/tickets"
                        onClick={() => setMobileMenuOpen(false)}
                        className={`px-4 py-3 rounded-lg font-medium transition-all ${
                          router.pathname === '/tickets'
                            ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                            : theme === 'dark' ? 'text-gray-300 hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        Tickets
                      </Link>
                      <Link
                        href="/settings"
                        onClick={() => setMobileMenuOpen(false)}
                        className={`px-4 py-3 rounded-lg font-medium transition-all ${
                          router.pathname === '/settings'
                            ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                            : theme === 'dark' ? 'text-gray-300 hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        ⚙️ Configurações
                      </Link>
                      <button
                        onClick={() => {
                          setChatboxOpen(!chatboxOpen)
                          setMobileMenuOpen(false)
                        }}
                        className={`px-4 py-3 rounded-lg font-medium transition-all flex items-center space-x-2 ${
                          chatboxOpen
                            ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                            : theme === 'dark' ? 'text-gray-300 hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <span>💬</span>
                        <span>Chat</span>
                      </button>
                    </>
                  )}
                <div className={`pt-4 ${theme === 'dark' ? 'border-t border-white/20' : 'border-t border-gray-200'}`}>
                  <div className="px-4 py-2">
                    <p className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      {session.user.username}
                    </p>
                    <p className={`text-xs ${theme === 'dark' ? 'text-gray-300' : 'text-gray-500'}`}>
                      {session.user.role === 'OWNER' ? 'Administrador' : 'Usuário'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>
      <main className="min-h-[calc(100vh-80px)]">{children}</main>
      <footer className={getFooterClasses()}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className={`text-center ${getFooterTextClasses()}`}>
            <div className="flex justify-center mb-4">
              <Logo size="sm" showText={true} className="justify-center" />
            </div>
            <p className="text-sm">© {new Date().getFullYear()} Kaizen Gerador. Todos os direitos reservados</p>
          </div>
        </div>
      </footer>
      {session?.user && (
        <Chatbox isOpen={chatboxOpen} onToggle={() => setChatboxOpen(!chatboxOpen)} />
      )}
    </div>
  )
}
