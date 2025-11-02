import { ReactNode } from 'react'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useTranslation } from '@/lib/i18n-helper'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { data: session } = useSession()
  const { t, locale, changeLanguage } = useTranslation()
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200">
      <nav className="bg-white shadow-lg border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center space-x-8">
              <Link href="/" className="flex items-center space-x-2 group">
                <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-primary-800 rounded-lg flex items-center justify-center transform group-hover:scale-110 transition-transform">
                  <span className="text-white font-bold text-xl">K</span>
                </div>
                <span className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">
                  {t('siteName')}
                </span>
              </Link>
              {session && (
                <div className="hidden md:flex items-center space-x-1">
                  <Link
                    href={session.user.role === 'OWNER' ? '/admin' : '/dashboard'}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      router.pathname === '/admin' || router.pathname === '/dashboard'
                        ? 'bg-primary-600 text-white'
                        : 'text-gray-700 hover:bg-gray-100'
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
                            ? 'bg-primary-600 text-white'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {t('plans')}
                      </Link>
                      <Link
                        href="/affiliate"
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${
                          router.pathname === '/affiliate'
                            ? 'bg-primary-600 text-white'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        Afiliados
                      </Link>
                      <Link
                        href="/tickets"
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${
                          router.pathname === '/tickets'
                            ? 'bg-primary-600 text-white'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        Suporte
                      </Link>
                      <Link
                        href="/keys/redeem"
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${
                          router.pathname === '/keys/redeem'
                            ? 'bg-primary-600 text-white'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        Resgatar Chave
                      </Link>
                    </>
                  )}
                  {session.user.role === 'OWNER' && (
                    <Link
                      href="/tickets"
                      className={`px-4 py-2 rounded-lg font-medium transition-all ${
                        router.pathname === '/tickets'
                          ? 'bg-primary-600 text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      Tickets
                    </Link>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center space-x-4">
              <select
                value={locale}
                onChange={(e) => changeLanguage(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white hover:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
              >
                <option value="pt-BR">🇧🇷 PT-BR</option>
                <option value="en">🇺🇸 EN</option>
              </select>
              {session ? (
                <div className="flex items-center space-x-3">
                  <div className="hidden md:block text-right">
                    <p className="text-sm font-semibold text-gray-900">{session.user.username}</p>
                    <p className="text-xs text-gray-500">
                      {session.user.role === 'OWNER' ? 'Administrador' : 'Usuário'}
                    </p>
                  </div>
                  <button
                    onClick={() => signOut({ callbackUrl: '/' })}
                    className="px-4 py-2 bg-red-50 text-red-600 rounded-lg font-medium hover:bg-red-100 transition-colors border border-red-200"
                  >
                    {t('logout')}
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Link
                    href="/register"
                    className="px-4 py-2 text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition-colors"
                  >
                    Criar Conta
                  </Link>
                  <Link
                    href="/login"
                    className="px-6 py-2 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-lg font-medium hover:from-primary-700 hover:to-primary-800 transition-all shadow-md hover:shadow-lg"
                  >
                    {t('login')}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>
      <main className="min-h-[calc(100vh-80px)]">{children}</main>
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-600">
            <p className="font-semibold mb-2">{t('siteName')}</p>
            <p className="text-sm">© {new Date().getFullYear()} Todos os direitos reservados</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
