import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useTranslation } from '@/lib/i18n-helper'
import { useTheme } from '@/contexts/ThemeContext'
import { getThemeClasses } from '@/lib/theme-utils'
import axios from 'axios'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'

interface Payment {
  id: string
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED'
  method: 'PIX' | 'BITCOIN' | 'CARD'
  amount: number
  finalAmount: number
  discountValue: number
  createdAt: string
  paidAt?: string | null
  user: {
    id: string
    username: string
    email: string | null
  }
  plan: {
    id: string
    name: string
    price: number
  }
  coupon?: {
    code: string
  } | null
}

interface PaymentFilters {
  startDate?: string
  endDate?: string
  status?: string
  method?: string
  search?: string
}

export default function AdminPayments() {
  const { t } = useTranslation()
  const { data: session, status } = useSession()
  const { theme } = useTheme()
  const router = useRouter()
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<PaymentFilters>({})
  const [stats, setStats] = useState({
    total: 0,
    paid: 0,
    pending: 0,
    totalRevenue: 0,
    todayRevenue: 0
  })
  const themeClasses = getThemeClasses(theme)

  useEffect(() => {
    if (status === 'loading') return

    if (status === 'unauthenticated') {
      router.replace('/login')
      return
    }

    if (session?.user?.role !== 'OWNER') {
      router.replace('/dashboard')
    }
  }, [session, status, router])

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role === 'OWNER') {
      loadPayments()
    }
  }, [status, session, filters])

  const loadPayments = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      
      if (filters.startDate) params.append('startDate', filters.startDate)
      if (filters.endDate) params.append('endDate', filters.endDate)
      if (filters.status) params.append('status', filters.status)
      if (filters.method) params.append('method', filters.method)
      if (filters.search) params.append('search', filters.search)

      const response = await axios.get(`/api/admin/payments?${params.toString()}`)
      setPayments(response.data.payments || [])
      setStats(response.data.stats || stats)
    } catch (error: any) {
      console.error('Erro ao carregar pagamentos:', error)
      toast.error(error.response?.data?.error || 'Erro ao carregar pagamentos')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { text: string; color: string; bgColor: string }> = {
      PAID: {
        text: 'Pago',
        color: theme === 'dark' ? 'text-green-300' : 'text-green-800',
        bgColor: theme === 'dark' ? 'bg-green-500/20 border-green-400/30' : 'bg-green-100 border-green-200'
      },
      PENDING: {
        text: 'Pendente',
        color: theme === 'dark' ? 'text-yellow-300' : 'text-yellow-800',
        bgColor: theme === 'dark' ? 'bg-yellow-500/20 border-yellow-400/30' : 'bg-yellow-100 border-yellow-200'
      },
      EXPIRED: {
        text: 'Expirado',
        color: theme === 'dark' ? 'text-orange-300' : 'text-orange-800',
        bgColor: theme === 'dark' ? 'bg-orange-500/20 border-orange-400/30' : 'bg-orange-100 border-orange-200'
      },
      CANCELLED: {
        text: 'Cancelado',
        color: theme === 'dark' ? 'text-red-300' : 'text-red-800',
        bgColor: theme === 'dark' ? 'bg-red-500/20 border-red-400/30' : 'bg-red-100 border-red-200'
      }
    }

    const badge = badges[status] || badges.PENDING
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${badge.bgColor} ${badge.color}`}>
        {badge.text}
      </span>
    )
  }

  const getMethodBadge = (method: string) => {
    const methods: Record<string, { text: string; icon: string }> = {
      PIX: { text: 'PIX', icon: '📱' },
      BITCOIN: { text: 'Bitcoin', icon: '₿' },
      CARD: { text: 'Cartão', icon: '💳' }
    }

    const methodInfo = methods[method] || { text: method, icon: '💰' }
    return (
      <span className="inline-flex items-center gap-1 text-sm">
        <span>{methodInfo.icon}</span>
        <span>{methodInfo.text}</span>
      </span>
    )
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  return (
    <div className={`min-h-screen ${themeClasses.bg} py-6 sm:py-8 px-4 sm:px-6 lg:px-8`}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className={`text-2xl sm:text-3xl md:text-4xl font-bold mb-2 ${themeClasses.text.primary}`}>
            💰 Pagamentos
          </h1>
          <p className={`text-sm sm:text-base ${themeClasses.text.secondary}`}>
            Controle completo de todas as vendas realizadas
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className={`${themeClasses.card} p-4 rounded-lg`}>
            <p className={`text-sm ${themeClasses.text.secondary} mb-1`}>Total de Vendas</p>
            <p className={`text-2xl font-bold ${themeClasses.text.primary}`}>{stats.total}</p>
          </div>
          <div className={`${themeClasses.card} p-4 rounded-lg`}>
            <p className={`text-sm ${themeClasses.text.secondary} mb-1`}>Pagas</p>
            <p className={`text-2xl font-bold text-green-500`}>{stats.paid}</p>
          </div>
          <div className={`${themeClasses.card} p-4 rounded-lg`}>
            <p className={`text-sm ${themeClasses.text.secondary} mb-1`}>Pendentes</p>
            <p className={`text-2xl font-bold text-yellow-500`}>{stats.pending}</p>
          </div>
          <div className={`${themeClasses.card} p-4 rounded-lg`}>
            <p className={`text-sm ${themeClasses.text.secondary} mb-1`}>Receita Total</p>
            <p className={`text-2xl font-bold text-green-500`}>{formatCurrency(stats.totalRevenue)}</p>
          </div>
          <div className={`${themeClasses.card} p-4 rounded-lg`}>
            <p className={`text-sm ${themeClasses.text.secondary} mb-1`}>Receita Hoje</p>
            <p className={`text-2xl font-bold text-blue-500`}>{formatCurrency(stats.todayRevenue)}</p>
          </div>
        </div>

        {/* Filters */}
        <div className={`${themeClasses.card} p-4 sm:p-6 mb-6`}>
          <h2 className={`text-lg font-semibold mb-4 ${themeClasses.text.primary}`}>Filtros</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className={`block text-sm font-medium mb-2 ${themeClasses.text.secondary}`}>
                Data Inicial
              </label>
              <input
                type="date"
                value={filters.startDate || ''}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className={`${themeClasses.input} w-full px-3 py-2 rounded-lg`}
              />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-2 ${themeClasses.text.secondary}`}>
                Data Final
              </label>
              <input
                type="date"
                value={filters.endDate || ''}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className={`${themeClasses.input} w-full px-3 py-2 rounded-lg`}
              />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-2 ${themeClasses.text.secondary}`}>
                Status
              </label>
              <select
                value={filters.status || ''}
                onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined })}
                className={`${themeClasses.input} w-full px-3 py-2 rounded-lg`}
              >
                <option value="">Todos</option>
                <option value="PAID">Pago</option>
                <option value="PENDING">Pendente</option>
                <option value="EXPIRED">Expirado</option>
                <option value="CANCELLED">Cancelado</option>
              </select>
            </div>
            <div>
              <label className={`block text-sm font-medium mb-2 ${themeClasses.text.secondary}`}>
                Método
              </label>
              <select
                value={filters.method || ''}
                onChange={(e) => setFilters({ ...filters, method: e.target.value || undefined })}
                className={`${themeClasses.input} w-full px-3 py-2 rounded-lg`}
              >
                <option value="">Todos</option>
                <option value="PIX">PIX</option>
                <option value="BITCOIN">Bitcoin</option>
                <option value="CARD">Cartão</option>
              </select>
            </div>
            <div>
              <label className={`block text-sm font-medium mb-2 ${themeClasses.text.secondary}`}>
                Buscar
              </label>
              <input
                type="text"
                placeholder="Usuário, ID..."
                value={filters.search || ''}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className={`${themeClasses.input} w-full px-3 py-2 rounded-lg`}
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={loadPayments}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors"
            >
              🔍 Filtrar
            </button>
            <button
              onClick={() => {
                setFilters({})
                setTimeout(loadPayments, 100)
              }}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                theme === 'dark' 
                  ? 'bg-white/10 text-white hover:bg-white/20' 
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }`}
            >
              🔄 Limpar
            </button>
          </div>
        </div>

        {/* Payments Table */}
        {loading ? (
          <div className={`${themeClasses.card} p-12 text-center`}>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className={themeClasses.text.secondary}>Carregando pagamentos...</p>
          </div>
        ) : payments.length === 0 ? (
          <div className={`${themeClasses.card} p-12 text-center`}>
            <p className={`text-lg ${themeClasses.text.secondary}`}>Nenhum pagamento encontrado</p>
          </div>
        ) : (
          <div className={`${themeClasses.card} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={`${theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'}`}>
                  <tr>
                    <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${themeClasses.text.secondary}`}>
                      ID
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${themeClasses.text.secondary}`}>
                      Usuário
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${themeClasses.text.secondary}`}>
                      Plano
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${themeClasses.text.secondary}`}>
                      Método
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${themeClasses.text.secondary}`}>
                      Valor
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${themeClasses.text.secondary}`}>
                      Status
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${themeClasses.text.secondary}`}>
                      Data
                    </th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${theme === 'dark' ? 'divide-white/10' : 'divide-gray-200'}`}>
                  {payments.map((payment) => (
                    <tr key={payment.id} className={`hover:${theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'}`}>
                      <td className={`px-4 py-3 whitespace-nowrap text-sm font-mono ${themeClasses.text.primary}`}>
                        {payment.id.substring(0, 8)}...
                      </td>
                      <td className={`px-4 py-3 whitespace-nowrap text-sm ${themeClasses.text.primary}`}>
                        <div>
                          <div className="font-medium">{payment.user.username}</div>
                          {payment.user.email && (
                            <div className={`text-xs ${themeClasses.text.secondary}`}>{payment.user.email}</div>
                          )}
                        </div>
                      </td>
                      <td className={`px-4 py-3 whitespace-nowrap text-sm ${themeClasses.text.primary}`}>
                        {t.translatePlanName ? t.translatePlanName(payment.plan.name) : payment.plan.name}
                      </td>
                      <td className={`px-4 py-3 whitespace-nowrap text-sm ${themeClasses.text.primary}`}>
                        {getMethodBadge(payment.method)}
                      </td>
                      <td className={`px-4 py-3 whitespace-nowrap text-sm ${themeClasses.text.primary}`}>
                        <div>
                          <div className="font-semibold">{formatCurrency(payment.finalAmount)}</div>
                          {payment.discountValue > 0 && (
                            <div className={`text-xs ${themeClasses.text.secondary}`}>
                              Desconto: {formatCurrency(payment.discountValue)}
                            </div>
                          )}
                          {payment.coupon && (
                            <div className={`text-xs text-blue-500`}>
                              Cupom: {payment.coupon.code}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className={`px-4 py-3 whitespace-nowrap text-sm`}>
                        {getStatusBadge(payment.status)}
                      </td>
                      <td className={`px-4 py-3 whitespace-nowrap text-sm ${themeClasses.text.primary}`}>
                        <div>
                          <div>{format(new Date(payment.createdAt), 'dd/MM/yyyy', { locale: ptBR })}</div>
                          <div className={`text-xs ${themeClasses.text.secondary}`}>
                            {format(new Date(payment.createdAt), 'HH:mm', { locale: ptBR })}
                          </div>
                          {payment.paidAt && (
                            <div className={`text-xs text-green-500 mt-1`}>
                              Pago: {format(new Date(payment.paidAt), 'dd/MM HH:mm', { locale: ptBR })}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
