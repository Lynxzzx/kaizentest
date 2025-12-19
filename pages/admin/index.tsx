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
  const { t } = useTranslation()
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
      <div className={`min-h-screen ${themeClasses.loading} flex items-center justify-center`}>
        <div className="text-center">
          <div className={`inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 ${theme === 'dark' ? 'border-purple-500' : 'border-primary-600'}`}></div>
          <p className={`mt-4 ${themeClasses.text.secondary}`}>{t('loading')}</p>
        </div>
      </div>
    )
  }

  if (session?.user?.role !== 'OWNER') {
    return null
  }

  const statCards = stats ? [
    {
      title: t('totalUsers'),
      value: stats.overview.totalUsers,
      icon: '👥',
      color: 'bg-blue-500',
      link: '/admin'
    },
    {
      title: t('totalRevenue'),
      value: `R$ ${stats.overview.totalRevenue.toFixed(2)}`,
      icon: '💰',
      color: 'bg-green-500',
      link: '/admin'
    },
    {
      title: t('confirmedPayments'),
      value: stats.overview.paidPayments,
      icon: '✅',
      color: 'bg-emerald-500',
      link: '/admin'
    },
    {
      title: t('availableStocks'),
      value: stats.overview.availableStocks,
      icon: '📦',
      color: 'bg-purple-500',
      link: '/admin/stocks'
    },
    {
      title: t('activeServices'),
      value: stats.overview.totalServices,
      icon: '🛠️',
      color: 'bg-indigo-500',
      link: '/admin/services'
    },
    {
      title: t('plans'),
      value: stats.overview.totalPlans,
      icon: '📋',
      color: 'bg-pink-500',
      link: '/admin/plans'
    },
    {
      title: t('generatedAccounts'),
      value: stats.overview.totalAccounts,
      icon: '🎫',
      color: 'bg-yellow-500',
      link: '/admin'
    },
    {
      title: t('availableKeys'),
      value: stats.overview.totalKeys - stats.overview.usedKeys,
      icon: '🔑',
      color: 'bg-orange-500',
      link: '/admin/keys'
    }
  ] : []

  const quickActions = [
    { href: '/admin/services', icon: '🛠️', label: t('services'), gradient: 'from-sky-500 via-indigo-500 to-blue-600' },
    { href: '/admin/stocks', icon: '📦', label: t('stocks'), gradient: 'from-purple-500 via-fuchsia-500 to-pink-500' },
    { href: '/admin/plans', icon: '📋', label: t('plans'), gradient: 'from-pink-500 via-rose-500 to-orange-500' },
    { href: '/admin/keys', icon: '🔑', label: t('keys'), gradient: 'from-amber-500 via-orange-500 to-red-500' },
    { href: '/admin/users', icon: '👥', label: t('users'), gradient: 'from-emerald-500 via-teal-500 to-sky-500' },
    { href: '/admin/broadcast', icon: '📢', label: t('broadcast'), gradient: 'from-cyan-500 via-blue-500 to-indigo-600' },
    { href: '/admin/raffles', icon: '🎲', label: t('raffles'), gradient: 'from-indigo-500 via-purple-500 to-pink-500' },
    { href: '/admin/feedback', icon: '💬', label: t('feedbacks'), gradient: 'from-teal-500 via-emerald-500 to-lime-500' },
    { href: '/admin/withdrawals', icon: '💸', label: 'Resgates', gradient: 'from-green-500 via-emerald-500 to-teal-500' },
    { href: '/admin/abuse', icon: '🔍', label: 'Abusos', gradient: 'from-red-600 via-red-500 to-orange-500' },
    { href: '/admin/logs', icon: '📋', label: 'Logs', gradient: 'from-slate-500 via-gray-600 to-zinc-700' },
    { href: '/admin/config', icon: '⚙️', label: t('settings'), gradient: 'from-slate-600 via-slate-700 to-slate-900' },
    { href: '/admin/maintenance', icon: '🧰', label: t('maintenance'), gradient: 'from-orange-500 via-amber-500 to-yellow-500' },
    { href: '/admin/christmas', icon: '🎄', label: 'Natal', gradient: 'from-red-500 via-red-600 to-green-600' }
  ]

  return (
    <div className={`admin-shell relative min-h-screen overflow-hidden ${themeClasses.bg}`}>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-[-20%] right-[-5%] w-[520px] h-[520px] bg-gradient-to-br from-indigo-500/25 via-fuchsia-500/15 to-cyan-400/20 blur-[200px]" />
        <div className="absolute bottom-[-25%] left-[-10%] w-[540px] h-[540px] bg-gradient-to-br from-sky-400/20 via-transparent to-emerald-400/15 blur-[220px]" />
      </div>
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className={`${themeClasses.card} neon-shadow`}>
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/15 via-transparent to-cyan-400/10" />
          <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/70">{t('administrator')}</p>
              <h1 className="text-3xl md:text-4xl font-black text-white leading-tight">
                {t('adminPanel')}
              </h1>
              <p className="text-sm text-white/60">
                {t('welcome')}, {session?.user?.username}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={checkPendingPayments}
                className="inline-flex items-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500/20 transition-all"
                title="Verificar e ativar pagamentos pendentes (PIX e Bitcoin)"
              >
                <span className="mr-2">💰</span>
                Verificar Pagamentos
              </button>
              <button
                onClick={cleanupExpiredPlans}
                className="inline-flex items-center rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15 transition-all"
                title="Remover planos expirados"
              >
                <span className="mr-2">🧹</span>
                Limpar Planos
              </button>
              <button
                onClick={loadStats}
                className="inline-flex items-center rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15 transition-all"
              >
                <span className="mr-2">🔄</span>
                {t('update')}
              </button>
              <Link
                href="/admin"
                className="inline-flex items-center rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 px-4 py-2 text-sm font-semibold text-white shadow-[0_15px_30px_rgba(15,23,42,0.45)]"
              >
                <span className="mr-2">📈</span>
                {t('dashboard')}
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statCards.map((card, index) => (
            <Link
              key={index}
              href={card.link}
              className={`${themeClasses.card} neon-shadow group overflow-hidden`}
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br from-indigo-500/20 via-transparent to-cyan-400/15" />
              <div className="relative z-10 flex items-center justify-between">
                <div>
                  <p className={`text-xs uppercase tracking-widest ${themeClasses.text.secondary}`}>{card.title}</p>
                  <p className={`text-3xl font-black ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{card.value}</p>
                </div>
                <div className={`rounded-2xl px-3 py-2 text-xl shadow-inner ${theme === 'dark' ? 'bg-white/10 text-white' : 'bg-slate-900/5 text-slate-900'}`}>
                  <span>{card.icon}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Quick Actions */}
        <div className={`${themeClasses.card} neon-shadow p-6 mb-8`}>
          <h2 className={`text-xl font-bold mb-4 ${themeClasses.text.primary}`}>{t('quickActions')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {quickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${action.gradient} text-white p-4 shadow-lg transition-transform hover:-translate-y-1`}
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-30 bg-white/40 transition-opacity" />
                <div className="relative z-10 flex flex-col items-center text-center space-y-2">
                  <span className="text-3xl">{action.icon}</span>
                  <span className="text-sm font-semibold">{action.label}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Users */}
            <div className={`${themeClasses.card} neon-shadow`}>
              <h2 className={`text-xl font-bold mb-4 ${themeClasses.text.primary}`}>{t('recentUsers')}</h2>
              <div className="space-y-3">
                {stats.recentUsers.length > 0 ? (
                  stats.recentUsers.map((user) => (
                    <div
                      key={user.id}
                      className={`flex items-center justify-between p-3 ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-50 hover:bg-gray-100'} rounded-lg transition-colors`}
                    >
                      <div>
                        <p className={`font-semibold ${themeClasses.text.primary}`}>{user.username}</p>
                        <p className={`text-sm ${themeClasses.text.muted}`}>
                          {user.email || t('noEmail')} • {user.plan?.name || t('noPlan')}
                        </p>
                        <p className={`text-xs ${themeClasses.text.muted} mt-1`}>
                          {format(new Date(user.createdAt), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className={`${themeClasses.text.muted} text-center py-4`}>{t('noRecentUsers')}</p>
                )}
              </div>
            </div>

            {/* Recent Payments */}
            <div className={`${themeClasses.card} neon-shadow`}>
              <h2 className={`text-xl font-bold mb-4 ${themeClasses.text.primary}`}>{t('recentPayments')}</h2>
              <div className="space-y-3">
                {stats.recentPayments.length > 0 ? (
                  stats.recentPayments.map((payment) => (
                    <div
                      key={payment.id}
                      className={`flex items-center justify-between p-3 ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-50 hover:bg-gray-100'} rounded-lg transition-colors`}
                    >
                      <div>
                        <p className={`font-semibold ${themeClasses.text.primary}`}>{payment.user.username}</p>
                        <p className={`text-sm ${themeClasses.text.muted}`}>
                          {payment.plan.name} • {payment.method}
                        </p>
                        <p className={`text-xs ${themeClasses.text.muted} mt-1`}>
                          {format(new Date(payment.createdAt), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600">R$ {payment.amount.toFixed(2)}</p>
                        <span
                          className={`inline-block px-2 py-1 rounded-full text-xs ${
                            payment.status === 'PAID'
                              ? 'bg-green-100 text-green-800'
                              : payment.status === 'PENDING'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {payment.status === 'PAID' ? t('paid') : payment.status === 'PENDING' ? t('pending') : t('cancelled')}
                        </span>
                        {payment.status === 'PAID' && payment.needsActivation && (
                          <div className="mt-2 space-y-1">
                            <p className={`text-xs ${themeClasses.text.muted}`}>{t('planActivationPending')}</p>
                            <button
                              onClick={() => activatePlanManually(payment.id)}
                              disabled={activatingPaymentId === payment.id}
                              className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1 text-xs font-semibold transition ${
                                theme === 'dark'
                                  ? 'border-amber-400/60 text-amber-200 hover:bg-amber-400/10 disabled:opacity-60'
                                  : 'border-amber-500 text-amber-700 hover:bg-amber-50 disabled:opacity-60'
                              }`}
                            >
                              <span>⚡</span>
                              {activatingPaymentId === payment.id ? t('activatingPlan') : t('activatePlanAuto')}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className={`${themeClasses.text.muted} text-center py-4`}>{t('noRecentPayments')}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
