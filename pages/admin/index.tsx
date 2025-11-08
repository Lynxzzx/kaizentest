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
  const themeClasses = getThemeClasses(theme)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (session?.user?.role !== 'OWNER') {
      router.push('/dashboard')
    }
  }, [session, status, router])

  useEffect(() => {
    if (session?.user?.role === 'OWNER') {
      loadStats()
      const interval = setInterval(loadStats, 30000) // Atualizar a cada 30 segundos
      return () => clearInterval(interval)
    }
  }, [session])

  const loadStats = async () => {
    try {
      const response = await axios.get('/api/admin/stats')
      setStats(response.data)
    } catch (error) {
      toast.error('Erro ao carregar estatísticas')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className={`min-h-screen ${themeClasses.loading} flex items-center justify-center`}>
        <div className="text-center">
          <div className={`inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 ${theme === 'dark' ? 'border-purple-500' : 'border-primary-600'}`}></div>
          <p className={`mt-4 ${themeClasses.text.secondary}`}>Carregando...</p>
        </div>
      </div>
    )
  }

  if (session?.user?.role !== 'OWNER') {
    return null
  }

  const statCards = stats ? [
    {
      title: 'Total de Usuários',
      value: stats.overview.totalUsers,
      icon: '👥',
      color: 'bg-blue-500',
      link: '/admin'
    },
    {
      title: 'Receita Total',
      value: `R$ ${stats.overview.totalRevenue.toFixed(2)}`,
      icon: '💰',
      color: 'bg-green-500',
      link: '/admin'
    },
    {
      title: 'Pagamentos Confirmados',
      value: stats.overview.paidPayments,
      icon: '✅',
      color: 'bg-emerald-500',
      link: '/admin'
    },
    {
      title: 'Estoques Disponíveis',
      value: stats.overview.availableStocks,
      icon: '📦',
      color: 'bg-purple-500',
      link: '/admin/stocks'
    },
    {
      title: 'Serviços Ativos',
      value: stats.overview.totalServices,
      icon: '🛠️',
      color: 'bg-indigo-500',
      link: '/admin/services'
    },
    {
      title: 'Planos',
      value: stats.overview.totalPlans,
      icon: '📋',
      color: 'bg-pink-500',
      link: '/admin/plans'
    },
    {
      title: 'Contas Geradas',
      value: stats.overview.totalAccounts,
      icon: '🎫',
      color: 'bg-yellow-500',
      link: '/admin'
    },
    {
      title: 'Chaves Disponíveis',
      value: stats.overview.totalKeys - stats.overview.usedKeys,
      icon: '🔑',
      color: 'bg-orange-500',
      link: '/admin/keys'
    }
  ] : []

  return (
    <div className={`min-h-screen ${themeClasses.bg}`}>
      {/* Header */}
      <div className={`${theme === 'dark' ? 'bg-white/10 backdrop-blur-lg border-b border-white/20' : 'bg-white shadow-sm border-b border-gray-200'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className={`text-3xl font-bold ${themeClasses.text.primary}`}>Painel Administrativo</h1>
              <p className={`mt-1 text-sm ${themeClasses.text.muted}`}>Bem-vindo, {session?.user?.username}</p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={loadStats}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-md"
              >
                Atualizar
              </button>
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
              className={`${themeClasses.card} rounded-xl shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 p-6 border-l-4 border-transparent hover:border-primary-500`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-medium mb-1 ${themeClasses.text.secondary}`}>{card.title}</p>
                  <p className={`text-2xl font-bold ${themeClasses.text.primary}`}>{card.value}</p>
                </div>
                <div className={`${card.color} rounded-full p-3 text-2xl`}>
                  {card.icon}
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Quick Actions */}
        <div className={`${themeClasses.card} rounded-xl shadow-md p-6 mb-8`}>
          <h2 className={`text-xl font-bold mb-4 ${themeClasses.text.primary}`}>Ações Rápidas</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link
              href="/admin/services"
              className="flex flex-col items-center justify-center p-4 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all shadow-md hover:shadow-lg"
            >
              <span className="text-3xl mb-2">🛠️</span>
              <span className="font-semibold">Serviços</span>
            </Link>
            <Link
              href="/admin/stocks"
              className="flex flex-col items-center justify-center p-4 bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all shadow-md hover:shadow-lg"
            >
              <span className="text-3xl mb-2">📦</span>
              <span className="font-semibold">Estoques</span>
            </Link>
            <Link
              href="/admin/plans"
              className="flex flex-col items-center justify-center p-4 bg-gradient-to-br from-pink-500 to-pink-600 text-white rounded-lg hover:from-pink-600 hover:to-pink-700 transition-all shadow-md hover:shadow-lg"
            >
              <span className="text-3xl mb-2">📋</span>
              <span className="font-semibold">Planos</span>
            </Link>
            <Link
              href="/admin/keys"
              className="flex flex-col items-center justify-center p-4 bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all shadow-md hover:shadow-lg"
            >
              <span className="text-3xl mb-2">🔑</span>
              <span className="font-semibold">Chaves</span>
            </Link>
            <Link
              href="/admin/users"
              className="flex flex-col items-center justify-center p-4 bg-gradient-to-br from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-all shadow-md hover:shadow-lg"
            >
              <span className="text-3xl mb-2">👥</span>
              <span className="font-semibold">Usuários</span>
            </Link>
            <Link
              href="/admin/broadcast"
              className="flex flex-col items-center justify-center p-4 bg-gradient-to-br from-cyan-500 to-cyan-600 text-white rounded-lg hover:from-cyan-600 hover:to-cyan-700 transition-all shadow-md hover:shadow-lg"
            >
              <span className="text-3xl mb-2">📢</span>
              <span className="font-semibold">Broadcast</span>
            </Link>
            <Link
              href="/admin/raffles"
              className="flex flex-col items-center justify-center p-4 bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-lg hover:from-indigo-600 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg"
            >
              <span className="text-3xl mb-2">🎲</span>
              <span className="font-semibold">Sorteios</span>
            </Link>
            <Link
              href="/admin/config"
              className="flex flex-col items-center justify-center p-4 bg-gradient-to-br from-teal-500 to-teal-600 text-white rounded-lg hover:from-teal-600 hover:to-teal-700 transition-all shadow-md hover:shadow-lg"
            >
              <span className="text-3xl mb-2">⚙️</span>
              <span className="font-semibold">Configurações</span>
            </Link>
            <Link
              href="/admin/maintenance"
              className="flex flex-col items-center justify-center p-4 bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all shadow-md hover:shadow-lg"
            >
              <span className="text-3xl mb-2">🔧</span>
              <span className="font-semibold">Manutenção</span>
            </Link>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Users */}
            <div className={themeClasses.card}>
              <h2 className={`text-xl font-bold mb-4 ${themeClasses.text.primary}`}>Usuários Recentes</h2>
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
                          {user.email || 'Sem email'} • {user.plan?.name || 'Sem plano'}
                        </p>
                        <p className={`text-xs ${themeClasses.text.muted} mt-1`}>
                          {format(new Date(user.createdAt), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className={`${themeClasses.text.muted} text-center py-4`}>Nenhum usuário recente</p>
                )}
              </div>
            </div>

            {/* Recent Payments */}
            <div className={themeClasses.card}>
              <h2 className={`text-xl font-bold mb-4 ${themeClasses.text.primary}`}>Pagamentos Recentes</h2>
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
                          {payment.status === 'PAID' ? 'Pago' : payment.status === 'PENDING' ? 'Pendente' : 'Cancelado'}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className={`${themeClasses.text.muted} text-center py-4`}>Nenhum pagamento recente</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
