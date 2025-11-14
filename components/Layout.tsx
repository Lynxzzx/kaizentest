import { ReactNode, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useTranslation } from '@/lib/i18n-helper'
import { useTheme } from '@/contexts/ThemeContext'
import { getThemeClasses } from '@/lib/theme-utils'
import Logo from './Logo'
import Chatbox from './Chatbox'
import BroadcastBanner from './BroadcastBanner'
import MaintenanceBanner from './MaintenanceBanner'

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
  const themeClasses = useMemo(() => getThemeClasses(theme), [theme])
  const isAdminRoute = router.pathname.startsWith('/admin')

  const navigationLinks = useMemo(() => {
    if (!session) return []
    if (session.user.role === 'OWNER') {
      return [
        { href: '/admin', label: t('admin'), icon: '🛰️' },
        { href: '/dashboard', label: t('dashboard'), icon: '📊' },
        { href: '/admin/services', label: t('services'), icon: '🛠️' },
        { href: '/admin/stocks', label: t('stocks'), icon: '📦' },
        { href: '/admin/plans', label: t('plans'), icon: '📋' },
        { href: '/admin/users', label: t('users'), icon: '👥' },
        { href: '/tickets', label: t('tickets'), icon: '🎟️' },
        { href: '/admin/coupons', label: t('coupons'), icon: '💸' },
        { href: '/admin/maintenance', label: t('maintenance'), icon: '🧰' }
      ]
    }
    return [
      { href: '/dashboard', label: t('dashboard'), icon: '📊' },
      { href: '/plans', label: t('plans'), icon: '💎' },
      { href: '/affiliate', label: t('affiliates'), icon: '🤝' },
      { href: '/raffles', label: t('raffles'), icon: '🎲' },
      { href: '/tickets', label: t('support'), icon: '🛟' },
      { href: '/feedback', label: t('feedbacks'), icon: '💬' },
      { href: '/keys/redeem', label: t('redeemKey'), icon: '🔑' },
      { href: '/settings', label: t('settings'), icon: '⚙️' }
    ]
  }, [session, t])

  const navLinkClasses = (href: string) => {
    const isActive = router.pathname === href || router.pathname.startsWith(`${href}/`)
    const activeClasses = theme === 'dark'
      ? 'text-white shadow-[0_20px_35px_rgba(59,130,246,0.35)] bg-white/10'
      : 'text-slate-900 shadow-[0_20px_35px_rgba(15,23,42,0.2)] bg-white'
    const idleClasses = theme === 'dark'
      ? 'text-slate-300 hover:text-white/80 hover:bg-white/5'
      : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'

    return `flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition-all duration-300 ${isActive ? activeClasses : idleClasses}`
  }

  return (
    <div className={`${isAdminRoute ? 'admin-shell' : ''} relative overflow-hidden min-h-screen ${themeClasses.bg}`}>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-gradient-to-br from-indigo-500/30 via-purple-500/20 to-cyan-400/25 blur-[160px] glow-pulse" />
        <div className="absolute bottom-[-15%] left-[-5%] w-[520px] h-[520px] bg-gradient-to-br from-cyan-500/25 via-sky-400/10 to-transparent blur-[200px] orbit-spin" />
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_1px_1px,_rgba(148,163,184,.35),transparent_40px)]" />
      </div>

      <MaintenanceBanner />
      <BroadcastBanner />

      <nav className="sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-2xl shadow-[0_25px_60px_rgba(15,23,42,0.45)] px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 md:h-20 items-center justify-between">
              <div className="flex items-center gap-4 md:gap-8">
                <Logo size="md" showText={false} />
                {session && (
                  <>
                    <div className="hidden lg:flex items-center gap-2">
                      {navigationLinks.map((item) => (
                        <Link key={item.href} href={item.href} className={navLinkClasses(item.href)}>
                          <span>{item.icon}</span>
                          <span>{item.label}</span>
                        </Link>
                      ))}
                      <button
                        onClick={() => setChatboxOpen((prev) => !prev)}
                        className={`${navLinkClasses('chat')} ${chatboxOpen ? 'ring-2 ring-cyan-400/60 ring-offset-2 ring-offset-transparent' : ''}`}
                      >
                        <span>💬</span>
                        <span>{t('chat')}</span>
                      </button>
                    </div>
                    <button
                      onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                      className="lg:hidden inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-slate-200 hover:bg-white/10 transition-colors"
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

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 rounded-2xl border border-white/10 bg-white/5 p-1">
                  <button
                    onClick={() => changeLanguage('pt-BR')}
                    className={`flex items-center gap-1 rounded-xl px-3 py-1 text-xs font-semibold transition-all ${
                      locale === 'pt-BR'
                        ? 'bg-gradient-to-r from-emerald-400/40 to-cyan-400/40 text-white'
                        : 'text-slate-200 hover:text-white'
                    }`}
                  >
                    <span>🇧🇷</span>
                    <span className="hidden sm:inline">PT</span>
                  </button>
                  <button
                    onClick={() => changeLanguage('en')}
                    className={`flex items-center gap-1 rounded-xl px-3 py-1 text-xs font-semibold transition-all ${
                      locale === 'en'
                        ? 'bg-gradient-to-r from-emerald-400/40 to-cyan-400/40 text-white'
                        : 'text-slate-200 hover:text-white'
                    }`}
                  >
                    <span>🇺🇸</span>
                    <span className="hidden sm:inline">EN</span>
                  </button>
                </div>

                {session ? (
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/profile/${session.user.username}`}
                      className="hidden md:flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-1.5 hover:bg-white/10 transition-colors"
                    >
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-400 via-sky-500 to-indigo-600 flex items-center justify-center text-sm font-bold text-white">
                        {session.user.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="text-left text-xs font-semibold text-white/80">
                        <p className="text-sm text-white">{session.user.username}</p>
                        <p className="text-[10px] uppercase tracking-wide text-white/60">
                          {session.user.role === 'OWNER' ? t('administrator') : t('user')}
                        </p>
                      </div>
                    </Link>
                    <button
                      onClick={async () => {
                        await signOut({ redirect: false })
                        if (typeof window !== 'undefined') {
                          window.location.href = '/'
                        }
                      }}
                      className="rounded-2xl border border-red-400/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/20 transition-all"
                    >
                      {t('logout')}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <Link
                      href="/register"
                      className="hidden sm:inline-flex items-center rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 transition-all"
                    >
                      {t('createAccount')}
                    </Link>
                    <Link
                      href="/login"
                      className="inline-flex items-center rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 px-5 py-2 text-sm font-semibold text-white shadow-[0_20px_35px_rgba(59,130,246,0.4)]"
                    >
                      {t('login')}
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {mobileMenuOpen && session && (
              <div className="mt-4 border-t border-white/10 pt-4 lg:hidden">
                <div className="grid gap-2">
                  {navigationLinks.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`${navLinkClasses(item.href)} border border-white/10 bg-white/5`}
                    >
                      <span>{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </div>
                <button
                  onClick={() => {
                    setChatboxOpen((prev) => !prev)
                    setMobileMenuOpen(false)
                  }}
                  className="mt-3 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-white/10"
                >
                  <span>💬</span>
                  <span>{t('chat')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="relative z-10 min-h-[calc(100vh-80px)]">{children}</main>

      <footer className="relative z-10 mt-16 border-t border-white/5 bg-white/5/20 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 text-center text-sm text-white/70">
          <div className="flex justify-center mb-3">
            <Logo size="sm" showText className="justify-center" />
          </div>
          <p>© {new Date().getFullYear()} Kaizen Gerador · {t('allRightsReserved')}</p>
        </div>
      </footer>

      {session?.user && (
        <Chatbox isOpen={chatboxOpen} onToggle={() => setChatboxOpen(!chatboxOpen)} />
      )}
    </div>
  )
}
