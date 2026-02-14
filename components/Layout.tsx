import { ReactNode, useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useTranslation } from '@/lib/i18n-helper'
import Logo from './Logo'
import BroadcastBanner from './BroadcastBanner'
import MaintenanceBanner from './MaintenanceBanner'
import { Outfit } from 'next/font/google'

interface LayoutProps {
  children: ReactNode
}

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap'
})

export default function Layout({ children }: LayoutProps) {
  const { data: session } = useSession()
  const { t, locale, changeLanguage } = useTranslation()
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const isAdminRoute = router.pathname.startsWith('/admin')

  const navigationLinks = useMemo(() => {
    if (!session) return []
    const rawRole = String(session.user.role || '').toUpperCase()
    const isOwner = rawRole === 'OWNER'
    const isCoOwner = rawRole === 'CO_OWNER' || rawRole === 'CO-OWNER' || rawRole === 'CO OWNER'
    if (isOwner) {
      return [
        { href: '/admin', label: t('admin'), icon: '🛰️' },
        { href: '/dashboard', label: t('dashboard'), icon: '📊' },
        { href: '/admin/services', label: t('services'), icon: '🛠️' },
        { href: '/admin/stocks', label: t('stocks'), icon: '📦' },
        { href: '/admin/plans', label: t('plans'), icon: '📋' },
        { href: '/admin/users', label: t('users'), icon: '👥' },
        { href: '/tickets', label: t('tickets'), icon: '🎟️' },
        { href: '/admin/coupons', label: t('coupons'), icon: '💸' },
        { href: '/admin/maintenance', label: t('maintenance'), icon: '🧰' },
        { href: '/admin/christmas', label: 'Natal', icon: '🎄' }
      ]
    }
    const base = [
      { href: '/dashboard', label: t('dashboard'), icon: '📊' },
      { href: '/plans', label: t('plans'), icon: '💎' },
      { href: '/api-plans', label: 'API', icon: '🌐' },
      { href: '/api-keys', label: 'API Keys', icon: '🔑' },
      { href: '/tickets', label: t('support'), icon: '🛟' },
      { href: '/affiliate', label: t('affiliates'), icon: '🤝' },
      { href: '/raffles', label: t('raffles'), icon: '🎲' },
      { href: '/feedback', label: t('feedbacks'), icon: '💬' },
      { href: '/keys/redeem', label: t('redeemKey'), icon: '🔑' },
      { href: '/settings', label: t('settings'), icon: '⚙️' }
    ]
    if (isCoOwner) {
      return [{ href: '/co-owner', label: 'Co-Owner', icon: '🧭' }, ...base]
    }
    return base
  }, [session, t])

  const navLinkClasses = (href: string) => {
    const isActive = router.pathname === href || router.pathname.startsWith(`${href}/`)
    return `flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-300 ${isActive
      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
      : 'text-gray-400 hover:text-white hover:bg-white/5'
      }`
  }

  // 🌍 Detectar idioma pela região e aplicar automaticamente (uma vez)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem('preferredLocale')
    if (stored) return
    ;(async () => {
      try {
        const res = await fetch('/api/geo')
        const data = await res.json()
        const suggested = data?.suggestedLocale as string
        if (suggested && suggested !== locale) {
          changeLanguage(suggested)
          window.localStorage.setItem('preferredLocale', suggested)
        }
      } catch {}
    })()
  }, [locale, changeLanguage])

  const languages: Array<{ code: 'pt-BR' | 'en' | 'es'; label: string; flag: string; title: string }> = [
    { code: 'pt-BR', label: 'Português', flag: 'br', title: 'Português (Brasil)' },
    { code: 'en', label: 'English', flag: 'us', title: 'English (US)' },
    { code: 'es', label: 'Español', flag: 'es', title: 'Español (ES)' }
  ]

  return (
    <div className={`min-h-screen bg-black text-gray-100 ${isAdminRoute ? 'admin-shell' : ''} ${outfit.className}`}>
      {/* Global Background Effects - Shared across all pages via Layout */}
      {!isAdminRoute && (
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-indigo-600/10 blur-[120px]" />
          <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-purple-600/10 blur-[120px]" />
          <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center bg-fixed [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
        </div>
      )}

      <div className="relative z-50">
        <MaintenanceBanner />
        <BroadcastBanner />
      </div>

      <nav className="sticky top-0 z-40 w-full border-b border-white/5 bg-black/50 backdrop-blur-xl supports-[backdrop-filter]:bg-black/20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-8">
              <Logo size="md" showText={false} />

              {/* Desktop Navigation */}
              {session && (
                <div className="hidden lg:flex items-center gap-1">
                  {navigationLinks.slice(0, 5).map((item) => (
                    <Link key={item.href} href={item.href} className={navLinkClasses(item.href)}>
                      <span className="opacity-70">{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  ))}
                  {/* Dropdown for more items if needed could go here, for now just simple list or limited */}
                </div>
              )}
            </div>

            <div className="flex items-center gap-4">
              {/* Language Switcher - Visível e com bandeiras */}
              <div className="flex items-center bg-white/5 rounded-xl px-2 py-1 border border-white/10">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      changeLanguage(lang.code)
                      if (typeof window !== 'undefined') {
                        window.localStorage.setItem('preferredLocale', lang.code)
                      }
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      locale === lang.code ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-300 hover:text-white hover:bg-white/10'
                    }`}
                    title={lang.title}
                    aria-label={lang.title}
                  >
                    <img
                      src={`https://flagcdn.com/24x18/${lang.flag}.png`}
                      alt={lang.title}
                      width={24}
                      height={18}
                      className="rounded-[3px] border border-white/10"
                    />
                    <span className="hidden sm:inline">{lang.label}</span>
                  </button>
                ))}
              </div>

              {session ? (
                <div className="flex items-center gap-4">
                  <div className="hidden md:flex items-center gap-3 pl-4 border-l border-white/10">
                    <div className="text-right">
                      <p className="text-sm font-bold text-white leading-none">{session.user.username}</p>
                      <p className="text-[10px] uppercase font-bold tracking-wider text-indigo-400">
                        {String(session.user.role || '').toUpperCase() === 'OWNER'
                          ? 'Admin'
                          : (String(session.user.role || '').toUpperCase().includes('CO') ? 'Co-Owner' : 'Membro')}
                      </p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 p-[2px]">
                      <div className="w-full h-full rounded-full bg-black flex items-center justify-center text-sm font-bold text-white">
                        {session.user.username?.charAt(0).toUpperCase()}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="lg:hidden p-2 text-gray-400 hover:text-white bg-white/5 rounded-lg"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {mobileMenuOpen ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                      )}
                    </svg>
                  </button>

                  <div className="hidden md:flex items-center gap-2">
                    <Link
                      href="/profile"
                      className="flex items-center justify-center w-10 h-10 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all"
                      title="Perfil"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </Link>
                    <button
                      onClick={async () => {
                        await signOut({ redirect: false })
                        if (typeof window !== 'undefined') {
                          window.location.href = '/'
                        }
                      }}
                      className="flex items-center justify-center w-10 h-10 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all"
                      title={t('logout')}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Link href="/login" className="px-5 py-2 text-sm font-bold text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all">
                    {t('login')}
                  </Link>
                  <Link href="/register" className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-lg shadow-indigo-500/20">
                    {t('createAccount')}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-white/10 bg-black/95 backdrop-blur-xl absolute w-full left-0">
            <div className="px-4 py-6 space-y-1">
              {navigationLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-base font-medium text-gray-300 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                >
                  <span className="text-xl">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
              <Link
                href="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-base font-medium text-gray-300 hover:text-white hover:bg-white/5 rounded-xl transition-all"
              >
                <span className="text-xl">👤</span>
                Perfil
              </Link>
              <div className="pt-4 mt-4 border-t border-white/10">
                <button
                  onClick={() => signOut()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 text-red-400 font-bold bg-red-500/10 rounded-xl hover:bg-red-500/20 transition-all"
                >
                  {t('logout')}
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      <main className="relative z-10 min-h-[calc(100vh-80px)]">
        {children}
      </main>

      {!isAdminRoute && (
        <footer className="relative z-10 border-t border-white/5 bg-black text-center py-12">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex justify-center mb-6">
              <Logo size="sm" showText className="opacity-50 grayscale hover:grayscale-0 transition-all" />
            </div>
            <p className="text-gray-500 text-sm">
              © {new Date().getFullYear()} Kaizen Gens. {t('allRightsReserved')}
            </p>
          </div>
        </footer>
      )}
    </div>
  )
}

