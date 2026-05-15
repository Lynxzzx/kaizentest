import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useTranslation } from '@/lib/i18n-helper'
import { useTheme } from '@/contexts/ThemeContext'
import { getThemeClasses } from '@/lib/theme-utils'
import Link from 'next/link'
import axios from 'axios'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'

interface Stats {
  overview: {
    totalUsers: number
    totalServices: number
    totalPlans: number
    totalStocks: number
    availableStocks: number
    usedStocks: number
    totalPayments: number
    paidPayments: number
    totalRevenue: number
    totalKeys: number
    usedKeys: number
    totalAccounts: number
  }
  recentUsers: Array<{
    id: string
    username: string
    email: string | null
    createdAt: string
    plan: { name: string } | null
  }>
  recentPayments: Array<{
    id: string
    amount: number
    status: string
    method: string
    createdAt: string
    paidAt?: string | null
    needsActivation?: boolean
    user: { username: string }
    plan: { name: string }
  }>
}

export default function AdminDashboard() {
  const { t, translatePlanName } = useTranslation()
  const { data: session, status } = useSession()
  const { theme } = useTheme()
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [activatingPaymentId, setActivatingPaymentId] = useState<string | null>(null)
  const themeClasses = getThemeClasses(theme)

  useEffect(() => {
    if (status === 'loading') {
      return
    }

    if (status === 'unauthenticated') {
      router.replace('/login')
      return
    }

    if (session?.user?.role !== 'OWNER') {
      router.replace('/dashboard')
    }
  }, [session, status, router])

  useEffect(() => {
    if (status !== 'authenticated') {
      return
    }

    if (session?.user?.role === 'OWNER') {
      loadStats()
      const interval = setInterval(loadStats, 30000) // Atualizar a cada 30 segundos
      return () => clearInterval(interval)
    }
  }, [session, status])

  const loadStats = async () => {
    try {
      const response = await axios.get('/api/admin/stats')
      setStats(response.data)
    } catch (error) {
      toast.error(t('errorLoadingStats'))
    } finally {
      setLoading(false)
    }
  }

  const cleanupExpiredPlans = async () => {
    try {
      toast.loading('Limpando planos expirados...')
      const response = await axios.post('/api/admin/cleanup-expired-plans')
      toast.dismiss()
      toast.success(`${response.data.cleanedCount} planos expirados foram removidos`)
      loadStats() // Recarregar estatísticas
    } catch (error: any) {
      toast.dismiss()
      toast.error(error.response?.data?.error || 'Erro ao limpar planos expirados')
    }
  }

  const checkPendingPayments = async () => {
    try {
      toast.loading('Verificando todos os pagamentos pendentes...')
      const response = await axios.post('/api/admin/check-pending-payments')
      toast.dismiss()

      const { results } = response.data

      if (results.activated > 0) {
        toast.success(`✅ ${results.activated} pagamento(s) confirmado(s) e plano(s) ativado(s)!`)
      } else if (results.stillPending > 0) {
        toast.success(`⏳ ${results.stillPending} pagamento(s) ainda pendente(s)`)
      } else {
        toast.success('Nenhum pagamento pendente encontrado')
      }

      if (results.errors > 0) {
        toast.error(`⚠️ ${results.errors} erro(s) ao verificar pagamentos`)
      }

      loadStats() // Recarregar estatísticas
    } catch (error: any) {
      toast.dismiss()
      toast.error(error.response?.data?.error || 'Erro ao verificar pagamentos pendentes')
    }
  }

  const activatePlanManually = async (paymentId: string) => {
    try {
      setActivatingPaymentId(paymentId)
      const response = await axios.post('/api/admin/payments/activate-plan', { paymentId })
      toast.success(response.data?.message || t('planActivatedManualSuccess'))
      loadStats()
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('errorActivatingPlan'))
    } finally {
      setActivatingPaymentId(null)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center text-white/55">
        <svg className="h-5 w-5 animate-spin mr-2" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25"/><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4"/></svg>
        {t('loading')}
      </div>
    )
  }

  if (session?.user?.role !== 'OWNER') return null

  const statCards = stats ? [
    { title: t('totalUsers'), value: stats.overview.totalUsers, link: '/admin/users', tone: 'violet' },
    { title: t('totalRevenue'), value: `R$ ${stats.overview.totalRevenue.toFixed(2)}`, link: '/admin/payments', tone: 'mint' },
    { title: t('confirmedPayments'), value: stats.overview.paidPayments, link: '/admin/payments', tone: 'mint' },
    { title: t('availableStocks'), value: stats.overview.availableStocks, link: '/admin/stocks', tone: 'cyan' },
    { title: t('activeServices'), value: stats.overview.totalServices, link: '/admin/services', tone: 'violet' },
    { title: t('plans'), value: stats.overview.totalPlans, link: '/admin/plans', tone: 'magenta' },
    { title: t('generatedAccounts'), value: stats.overview.totalAccounts, link: '/admin', tone: 'gold' },
    { title: t('availableKeys'), value: stats.overview.totalKeys - stats.overview.usedKeys, link: '/admin/keys', tone: 'gold' }
  ] : []

  const quickActions = [
    { href: '/admin/services', label: t('services') },
    { href: '/admin/stocks', label: t('stocks') },
    { href: '/admin/cookies', label: '🍪 Estoque Cookies', highlight: true },
    { href: '/admin/cookies?tab=gerenciamento', label: '🍪 Gerenc. Cookies', highlight: true },
    { href: '/admin/cookies?tab=servicos', label: '🍪 Serv. Cookies', highlight: true },
    { href: '/admin/plans', label: t('plans') },
    { href: '/admin/keys', label: t('keys') },
    { href: '/admin/users', label: t('users') },
    { href: '/admin/broadcast', label: t('broadcast') },
    { href: '/admin/announcement', label: 'Anúncio' },
    { href: '/admin/raffles', label: t('raffles') },
    { href: '/admin/events', label: 'Eventos' },
    { href: '/admin/coupons', label: 'Cupons' },
    { href: '/admin/feedback', label: t('feedbacks') },
    { href: '/admin/withdrawals', label: 'Resgates' },
    { href: '/admin/payments', label: 'Pagamentos' },
    { href: '/admin/abuse', label: 'Abusos' },
    { href: '/admin/security', label: 'Segurança' },
    { href: '/admin/bot-cleanup', label: 'Limpar Bots' },
    { href: '/admin/authorized-ips', label: 'IPs' },
    { href: '/admin/logs', label: 'Logs' },
    { href: '/admin/config', label: t('settings') },
    { href: '/admin/maintenance', label: t('maintenance') },
    { href: '/admin/christmas', label: 'Natal' }
  ]

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/4 top-0 h-[500px] w-[500px] rounded-full bg-aurora-violet/10 blur-[140px]" />
        <div className="absolute right-1/4 top-1/2 h-[450px] w-[450px] rounded-full bg-aurora-cyan/10 blur-[140px]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="surface-card-elevated p-7 sm:p-9 mb-6 animate-fade-up">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="eyebrow">{t('administrator')}</p>
              <h1 className="mt-2 text-display text-4xl sm:text-5xl font-bold text-gradient-aurora">{t('adminPanel')}</h1>
              <p className="mt-2 text-sm text-white/55">{t('welcome')}, <span className="text-white">{session?.user?.username}</span></p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={checkPendingPayments} className="btn btn-ghost btn-sm">Verificar pagamentos</button>
              <button onClick={cleanupExpiredPlans} className="btn btn-ghost btn-sm">Limpar planos</button>
              <button onClick={loadStats} className="btn btn-primary btn-sm">{t('update')}</button>
            </div>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-px overflow-hidden rounded-3xl bg-white/[0.06] ring-1 ring-white/10 animate-fade-up delay-100">
          {statCards.map((card, i) => (
            <Link key={i} href={card.link} className="bg-[#0c0c15]/95 p-5 transition-colors hover:bg-[#0c0c15]/70">
              <p className="eyebrow">{card.title}</p>
              <p className={`num-display mt-2 text-2xl ${card.tone === 'mint' ? 'text-aurora-mint' : card.tone === 'gold' ? 'text-gradient-gold' : card.tone === 'cyan' ? 'text-aurora-cyan' : 'text-gradient'}`}>
                {card.value}
              </p>
            </Link>
          ))}
        </div>

        <div className="surface-card p-7 mb-6 animate-fade-up delay-200">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-display text-xl font-bold text-white">{t('quickActions')}</h2>
            <p className="eyebrow">{quickActions.length} módulos</p>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {quickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className={`group rounded-2xl border p-3 text-center text-xs font-medium transition-all ${
                  (action as any).highlight
                    ? 'border-amber-400/30 bg-amber-400/8 text-amber-300 hover:border-amber-400/50 hover:bg-amber-400/12 hover:text-amber-200'
                    : 'border-white/[0.06] bg-white/[0.02] text-white/65 hover:border-white/15 hover:bg-white/[0.04] hover:text-white'
                }`}
              >
                {action.label}
              </Link>
            ))}
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fade-up delay-300">
            <div className="surface-card p-6">
              <h2 className="text-display text-lg font-bold text-white mb-4">{t('recentUsers')}</h2>
              <div className="space-y-1.5">
                {stats.recentUsers.length > 0 ? stats.recentUsers.map((u) => (
                  <div key={u.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.04] bg-white/[0.02] p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{u.username}</p>
                      <p className="text-[11px] text-white/40 truncate">{u.email || t('noEmail')} · {u.plan?.name || t('noPlan')}</p>
                    </div>
                    <p className="text-[10px] text-white/35 shrink-0">{format(new Date(u.createdAt), "dd MMM yy", { locale: ptBR })}</p>
                  </div>
                )) : <p className="text-center py-6 text-sm text-white/40">{t('noRecentUsers')}</p>}
              </div>
            </div>

            <div className="surface-card p-6">
              <h2 className="text-display text-lg font-bold text-white mb-4">{t('recentPayments')}</h2>
              <div className="space-y-1.5">
                {stats.recentPayments.length > 0 ? stats.recentPayments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.04] bg-white/[0.02] p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{p.user.username}</p>
                      <p className="text-[11px] text-white/40 truncate">{translatePlanName ? translatePlanName(p.plan.name) : p.plan.name} · {p.method}</p>
                      {p.status === 'PAID' && p.needsActivation && (
                        <button onClick={() => activatePlanManually(p.id)} disabled={activatingPaymentId === p.id}
                          className="mt-2 inline-flex items-center gap-1 rounded-lg border border-aurora-gold/40 px-2 py-0.5 text-[10px] font-semibold text-aurora-gold hover:bg-aurora-gold/10 disabled:opacity-60">
                          {activatingPaymentId === p.id ? t('activatingPlan') : t('activatePlanAuto')}
                        </button>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="num-display text-sm text-aurora-mint">R$ {p.amount.toFixed(2)}</p>
                      <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[9px] font-semibold ${p.status === 'PAID' ? 'bg-aurora-mint/15 text-aurora-mint' : p.status === 'PENDING' ? 'bg-aurora-gold/15 text-aurora-gold' : 'bg-red-500/15 text-red-300'}`}>
                        {p.status === 'PAID' ? t('paid') : p.status === 'PENDING' ? t('pending') : t('cancelled')}
                      </span>
                    </div>
                  </div>
                )) : <p className="text-center py-6 text-sm text-white/40">{t('noRecentPayments')}</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
