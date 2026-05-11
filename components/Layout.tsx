import { ReactNode, useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useTranslation } from '@/lib/i18n-helper'
import Logo from './Logo'
import BroadcastBanner from './BroadcastBanner'
import MaintenanceBanner from './MaintenanceBanner'

interface LayoutProps {
  children: ReactNode
}

type NavItem = { href: string; label: string; icon: ReactNode }

const Icon = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <rect x="3" y="3" width="7" height="9" rx="2" /><rect x="14" y="3" width="7" height="5" rx="2" />
      <rect x="14" y="12" width="7" height="9" rx="2" /><rect x="3" y="16" width="7" height="5" rx="2" />
    </svg>
  ),
  plans: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path d="M12 2l3 6 6 .9-4.5 4.3 1 6.3L12 16.8 6.5 19.5l1-6.3L3 8.9 9 8l3-6z" />
    </svg>
  ),
  api: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path d="M8 9l-5 3 5 3M16 9l5 3-5 3M14 4l-4 16" />
    </svg>
  ),
  key: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <circle cx="8" cy="15" r="4" /><path d="M10.85 12.15L19 4M19 8l-4-4M15 12l-2-2" />
    </svg>
  ),
  support: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
    </svg>
  ),
  affiliate: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75M9 11a4 4 0 100-8 4 4 0 000 8z" />
    </svg>
  ),
  raffles: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8" cy="8" r="1.5" fill="currentColor" />
      <circle cx="16" cy="8" r="1.5" fill="currentColor" /><circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="8" cy="16" r="1.5" fill="currentColor" /><circle cx="16" cy="16" r="1.5" fill="currentColor" />
    </svg>
  ),
  feedback: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path d="M12 2l3 6 6 1-4.5 4.3 1 6.3-5.5-3-5.5 3 1-6.3L3 9l6-1 3-6z" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06A2 2 0 014.27 16.97l.06-.06A1.65 1.65 0 004.66 15 1.65 1.65 0 003.15 14H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9c.34 1 1 1.5 1.51 1.5H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  user: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  ),
  menu: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  ),
  close: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  ),
  twitter: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M22 5.92a8.2 8.2 0 01-2.36.65 4.12 4.12 0 001.81-2.27 8.22 8.22 0 01-2.6.99 4.1 4.1 0 00-7.07 3.74A11.65 11.65 0 013 4.79a4.1 4.1 0 001.27 5.47 4.07 4.07 0 01-1.86-.51v.05a4.1 4.1 0 003.29 4.02 4.1 4.1 0 01-1.85.07 4.1 4.1 0 003.83 2.85A8.23 8.23 0 012 18.4a11.62 11.62 0 006.29 1.84c7.55 0 11.68-6.25 11.68-11.67l-.01-.53A8.27 8.27 0 0022 5.92z"/>
    </svg>
  ),
  discord: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M20.32 4.37a19.74 19.74 0 00-4.88-1.51.07.07 0 00-.08.04c-.21.38-.45.87-.61 1.25a18.27 18.27 0 00-5.5 0c-.16-.39-.4-.87-.61-1.25a.08.08 0 00-.08-.04 19.74 19.74 0 00-4.89 1.51.07.07 0 00-.03.03C.55 9.05-.32 13.58.06 18.06a.08.08 0 00.03.06 19.9 19.9 0 005.99 3.04.08.08 0 00.09-.03c.46-.63.87-1.3 1.23-2a.08.08 0 00-.04-.11 13.1 13.1 0 01-1.87-.89.08.08 0 01-.01-.13c.12-.09.25-.19.37-.29a.08.08 0 01.08-.01c3.92 1.79 8.15 1.79 12.02 0a.08.08 0 01.09.01c.12.1.24.2.37.29a.08.08 0 01-.01.13c-.6.35-1.22.64-1.87.89a.08.08 0 00-.04.11c.37.71.78 1.38 1.22 2a.08.08 0 00.09.03 19.83 19.83 0 006-3.04.08.08 0 00.03-.06c.45-5.18-.78-9.68-3.27-13.66a.07.07 0 00-.03-.03zM8.02 15.33c-1.18 0-2.16-1.08-2.16-2.41 0-1.32.96-2.41 2.16-2.41 1.21 0 2.18 1.09 2.16 2.41 0 1.33-.96 2.41-2.16 2.41zm7.97 0c-1.18 0-2.16-1.08-2.16-2.41 0-1.32.96-2.41 2.16-2.41 1.21 0 2.18 1.09 2.16 2.41 0 1.33-.95 2.41-2.16 2.41z"/>
    </svg>
  )
}

const PUBLIC_ROUTES = ['/', '/login', '/register', '/forgot-password', '/reset-password', '/api-docs']

export default function Layout({ children }: LayoutProps) {
  const { data: session } = useSession()
  const { t, locale, changeLanguage } = useTranslation()
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const isAdminRoute = router.pathname.startsWith('/admin')
  const isPublic = PUBLIC_ROUTES.includes(router.pathname) || router.pathname === '/api-plans'

  const role = String(session?.user?.role || '').toUpperCase()
  const isOwner = role === 'OWNER'
  const isCoOwner = role === 'CO_OWNER' || role === 'CO-OWNER' || role === 'CO OWNER'

  const userNav: NavItem[] = useMemo(() => ([
    { href: '/dashboard',     label: t('dashboard'),  icon: Icon.dashboard },
    { href: '/plans',         label: t('plans'),      icon: Icon.plans },
    { href: '/api-plans',     label: 'API',           icon: Icon.api },
    { href: '/api-keys',      label: 'API Keys',      icon: Icon.key },
    { href: '/tickets',       label: t('support'),    icon: Icon.support },
    { href: '/affiliate',     label: t('affiliates'), icon: Icon.affiliate },
    { href: '/raffles',       label: t('raffles'),    icon: Icon.raffles },
    { href: '/feedback',      label: t('feedbacks'),  icon: Icon.feedback },
    { href: '/keys/redeem',   label: t('redeemKey'),  icon: Icon.key },
    { href: '/settings',      label: t('settings'),   icon: Icon.settings }
  ]), [t])

  const ownerNav: NavItem[] = useMemo(() => ([
    { href: '/admin',           label: t('admin'),     icon: Icon.shield },
    { href: '/dashboard',       label: t('dashboard'), icon: Icon.dashboard },
    { href: '/admin/services',  label: t('services'),  icon: Icon.dashboard },
    { href: '/admin/stocks',    label: t('stocks'),    icon: Icon.api },
    { href: '/admin/plans',     label: t('plans'),     icon: Icon.plans },
    { href: '/admin/users',     label: t('users'),     icon: Icon.user },
    { href: '/tickets',         label: t('tickets'),   icon: Icon.support }
  ]), [t])

  const coOwnerNav: NavItem[] = useMemo(() => ([
    { href: '/co-owner', label: 'Co-Owner', icon: Icon.shield },
    ...userNav
  ]), [userNav])

  const nav = !session ? [] : isOwner ? ownerNav : isCoOwner ? coOwnerNav : userNav

  const isActive = (href: string) =>
    href === '/'
      ? router.pathname === '/'
      : router.pathname === href || router.pathname.startsWith(`${href}/`)

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

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [mobileMenuOpen])

  const languages: Array<{ code: 'pt-BR' | 'en' | 'es'; label: string; flag: string }> = [
    { code: 'pt-BR', label: 'PT', flag: 'br' },
    { code: 'en',    label: 'EN', flag: 'us' },
    { code: 'es',    label: 'ES', flag: 'es' }
  ]

  return (
    <div className={`relative min-h-screen text-[var(--c-text)]`}>
      {/* Top banners */}
      <div className="relative z-50">
        <MaintenanceBanner />
        <BroadcastBanner />
      </div>

      {/* Top navigation */}
      <header
        className={`sticky top-0 z-40 w-full transition-all duration-300 ${
          scrolled
            ? 'border-b border-white/10 bg-[rgba(6,6,12,0.7)] backdrop-blur-2xl'
            : 'border-b border-transparent bg-transparent'
        }`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 lg:gap-8">
            <Logo size="md" showText />
            {session && (
              <nav className="hidden lg:flex items-center gap-0.5">
                {nav.slice(0, 6).map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group relative inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-medium transition-all ${
                      isActive(item.href)
                        ? 'text-white'
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    {isActive(item.href) && (
                      <span className="absolute inset-0 -z-10 rounded-xl bg-white/[0.06] ring-1 ring-inset ring-white/10" />
                    )}
                    <span className="opacity-80">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                ))}
              </nav>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Language switcher (compact pill) */}
            <div className="hidden sm:flex items-center rounded-full border border-white/10 bg-white/[0.03] p-1 backdrop-blur-md">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    changeLanguage(lang.code)
                    if (typeof window !== 'undefined') {
                      window.localStorage.setItem('preferredLocale', lang.code)
                    }
                  }}
                  className={`relative flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-all ${
                    locale === lang.code ? 'bg-white text-[#06060c]' : 'text-white/55 hover:text-white'
                  }`}
                  title={lang.label}
                >
                  <img
                    src={`https://flagcdn.com/20x15/${lang.flag}.png`}
                    alt={lang.label}
                    width={16}
                    height={12}
                    className="rounded-[2px]"
                  />
                  {lang.label}
                </button>
              ))}
            </div>

            {session ? (
              <div className="flex items-center gap-2">
                <div className="hidden md:flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.03] py-1 pl-1 pr-3 backdrop-blur-md">
                  <span className="relative inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-full">
                    <span className="absolute inset-0 bg-gradient-to-br from-aurora-violet via-aurora-magenta to-aurora-cyan" />
                    <span className="absolute inset-[1.5px] rounded-full bg-[#0a0a13]" />
                    <span className="relative text-xs font-bold text-white">
                      {session.user.username?.charAt(0).toUpperCase()}
                    </span>
                  </span>
                  <div className="leading-tight">
                    <p className="text-[12.5px] font-semibold text-white truncate max-w-[120px]">{session.user.username}</p>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-aurora-violet">
                      {isOwner ? 'Admin' : isCoOwner ? 'Co-Owner' : 'Member'}
                    </p>
                  </div>
                </div>

                <Link
                  href="/profile"
                  className="hidden md:inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.07] hover:text-white transition-all"
                  title="Perfil"
                >
                  {Icon.user}
                </Link>

                <button
                  onClick={async () => {
                    await signOut({ redirect: false })
                    if (typeof window !== 'undefined') window.location.href = '/'
                  }}
                  className="hidden md:inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 hover:text-rose-200 transition-all"
                  title={t('logout')}
                >
                  {Icon.logout}
                </button>

                <button
                  onClick={() => setMobileMenuOpen(true)}
                  className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-white"
                  aria-label="Menu"
                >
                  {Icon.menu}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="hidden sm:inline-flex btn btn-ghost btn-sm"
                >
                  {t('login')}
                </Link>
                <Link
                  href="/register"
                  className="btn btn-primary btn-sm"
                >
                  {t('createAccount')}
                </Link>
                <button
                  onClick={() => setMobileMenuOpen(true)}
                  className="sm:hidden inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-white"
                  aria-label="Menu"
                >
                  {Icon.menu}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      <div
        className={`fixed inset-0 z-[60] transition-opacity duration-300 ${
          mobileMenuOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <div
          className="absolute inset-0 bg-black/70 backdrop-blur-md"
          onClick={() => setMobileMenuOpen(false)}
        />
        <aside
          className={`absolute right-0 top-0 flex h-full w-full max-w-sm flex-col border-l border-white/10 bg-[#06060c]/95 backdrop-blur-2xl transition-transform duration-400 ease-out ${
            mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <Logo size="md" />
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/80"
            >
              {Icon.close}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-4">
            {session ? (
              <>
                <div className="mb-4 px-2">
                  <p className="eyebrow">Conta</p>
                  <div className="mt-2 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <span className="relative inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full">
                      <span className="absolute inset-0 bg-gradient-to-br from-aurora-violet via-aurora-magenta to-aurora-cyan" />
                      <span className="absolute inset-[1.5px] rounded-full bg-[#0a0a13]" />
                      <span className="relative text-sm font-bold text-white">
                        {session.user.username?.charAt(0).toUpperCase()}
                      </span>
                    </span>
                    <div className="leading-tight">
                      <p className="text-sm font-semibold text-white">{session.user.username}</p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-aurora-violet">
                        {isOwner ? 'Administrator' : isCoOwner ? 'Co-Owner' : 'Member'}
                      </p>
                    </div>
                  </div>
                </div>

                <p className="eyebrow px-2 mb-2">Navegação</p>
                <nav className="space-y-1">
                  {nav.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                        isActive(item.href)
                          ? 'bg-white/[0.06] text-white ring-1 ring-inset ring-white/10'
                          : 'text-white/65 hover:text-white hover:bg-white/[0.03]'
                      }`}
                    >
                      <span className="opacity-80">{item.icon}</span>
                      {item.label}
                    </Link>
                  ))}
                </nav>

                <div className="mt-4 border-t border-white/10 pt-4 space-y-1">
                  <Link
                    href="/profile"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/65 hover:text-white hover:bg-white/[0.03] transition-all"
                  >
                    <span className="opacity-80">{Icon.user}</span>
                    Perfil
                  </Link>
                  <button
                    onClick={async () => {
                      await signOut({ redirect: false })
                      if (typeof window !== 'undefined') window.location.href = '/'
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-300 hover:bg-rose-500/10 transition-all"
                  >
                    <span className="opacity-80">{Icon.logout}</span>
                    {t('logout')}
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-2 px-1">
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="btn btn-ghost w-full"
                >
                  {t('login')}
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="btn btn-primary w-full"
                >
                  {t('createAccount')}
                </Link>
                <div className="mt-4 grid gap-1">
                  <Link href="/plans" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-3 py-2 text-sm text-white/70 hover:bg-white/[0.04]">Planos</Link>
                  <Link href="/api-docs" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-3 py-2 text-sm text-white/70 hover:bg-white/[0.04]">API Docs</Link>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-white/10 px-5 py-3">
            <div className="flex items-center justify-between">
              <span className="eyebrow">Idioma</span>
              <div className="flex items-center gap-1">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      changeLanguage(lang.code)
                      if (typeof window !== 'undefined') window.localStorage.setItem('preferredLocale', lang.code)
                    }}
                    className={`rounded-md px-2 py-1 text-[11px] font-bold uppercase ${
                      locale === lang.code ? 'bg-white text-[#06060c]' : 'text-white/55 hover:text-white'
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>

      <main className="relative z-10 min-h-[calc(100vh-64px)]">
        {children}
      </main>

      {!isAdminRoute && (
        <footer className="relative z-10 mt-24 border-t border-white/[0.06]">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
              <div className="md:col-span-2">
                <Logo size="md" />
                <p className="mt-4 max-w-sm text-sm text-white/55">
                  {locale === 'pt-BR'
                    ? 'A plataforma definitiva de geração de contas premium. Velocidade absurda, qualidade incomparável.'
                    : locale === 'es'
                      ? 'La plataforma definitiva de generación de cuentas premium. Velocidad absurda, calidad incomparable.'
                      : 'The ultimate premium account generation platform. Absurd speed, unmatched quality.'}
                </p>
                <div className="mt-5 flex items-center gap-2">
                  <a href="#" className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-white/70 hover:text-white hover:bg-white/[0.06] transition-all">
                    {Icon.discord}
                  </a>
                  <a href="#" className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-white/70 hover:text-white hover:bg-white/[0.06] transition-all">
                    {Icon.twitter}
                  </a>
                </div>
              </div>
              <div>
                <p className="eyebrow">Produto</p>
                <ul className="mt-4 space-y-2 text-sm">
                  <li><Link href="/plans" className="text-white/65 hover:text-white">Planos</Link></li>
                  <li><Link href="/api-plans" className="text-white/65 hover:text-white">API</Link></li>
                  <li><Link href="/api-docs" className="text-white/65 hover:text-white">Documentação</Link></li>
                  <li><Link href="/raffles" className="text-white/65 hover:text-white">Sorteios</Link></li>
                </ul>
              </div>
              <div>
                <p className="eyebrow">Suporte</p>
                <ul className="mt-4 space-y-2 text-sm">
                  <li><Link href="/tickets" className="text-white/65 hover:text-white">Tickets</Link></li>
                  <li><Link href="/feedback" className="text-white/65 hover:text-white">Feedback</Link></li>
                  <li><Link href="/affiliate" className="text-white/65 hover:text-white">Afiliados</Link></li>
                  <li><Link href="/settings" className="text-white/65 hover:text-white">Configurações</Link></li>
                </ul>
              </div>
            </div>
            <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-white/[0.06] pt-6 text-xs text-white/45 sm:flex-row sm:items-center">
              <p>© {new Date().getFullYear()} Kaizen Gens. {t('allRightsReserved')}</p>
              <p className="flex items-center gap-1.5">
                <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-aurora-mint" />
                All systems operational
              </p>
            </div>
          </div>
        </footer>
      )}
    </div>
  )
}
