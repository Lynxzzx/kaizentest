import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Layout from '@/components/Layout'
import axios from 'axios'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'

interface Withdrawal {
  id: string
  amount: number
  pixKey: string
  pixKeyType: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'REJECTED'
  adminNotes: string | null
  processedAt: string | null
  createdAt: string
  user: {
    id: string
    username: string
    email: string | null
    affiliateBalance: number
    totalAffiliateEarnings: number
  }
  processedBy: {
    id: string
    username: string
  } | null
}

interface Stats {
  pending: number
  processing: number
  completed: number
  rejected: number
  totalPendingAmount: number
  totalPaidAmount: number
}

export default function AdminWithdrawals() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('PENDING')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    if (status === 'authenticated' && session?.user?.role !== 'ADMIN' && session?.user?.role !== 'OWNER') {
      router.push('/')
      return
    }
    if (status === 'authenticated') {
      loadData()
    }
  }, [status, session, router])

  const loadData = async () => {
    try {
      setLoading(true)
      const response = await axios.get('/api/admin/withdrawals')
      setWithdrawals(response.data.withdrawals)
      setStats(response.data.stats)
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (id: string, action: 'complete' | 'reject' | 'processing', adminNotes?: string) => {
    const actionNames = {
      complete: 'marcar como concluído',
      reject: 'rejeitar',
      processing: 'marcar como em processamento'
    }

    if (action === 'complete' && !confirm(`Você já fez o PIX para o usuário? Confirma ${actionNames[action]}?`)) {
      return
    }

    if (action === 'reject' && !confirm(`Tem certeza que deseja ${actionNames[action]} este resgate? O valor será devolvido ao saldo do afiliado.`)) {
      return
    }

    try {
      setProcessing(id)
      await axios.put(`/api/admin/withdrawals/${id}`, { action, adminNotes })
      toast.success(`Resgate ${action === 'complete' ? 'concluído' : action === 'reject' ? 'rejeitado' : 'em processamento'}!`)
      loadData()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao processar')
    } finally {
      setProcessing(null)
    }
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: '⏳ Pendente' },
      PROCESSING: { bg: 'bg-blue-100', text: 'text-blue-800', label: '🔄 Processando' },
      COMPLETED: { bg: 'bg-green-100', text: 'text-green-800', label: '✅ Concluído' },
      REJECTED: { bg: 'bg-red-100', text: 'text-red-800', label: '❌ Rejeitado' }
    }
    const badge = badges[status] || badges.PENDING
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    )
  }

  const filteredWithdrawals = filter === 'ALL' 
    ? withdrawals 
    : withdrawals.filter(w => w.status === filter)

  if (status === 'loading' || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-xl">Carregando...</div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <span>💸</span>
            <span>Resgates de Afiliados</span>
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Gerencie as solicitações de resgate de saldo dos afiliados
          </p>
        </div>

        {/* Estatísticas */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4 text-center border border-yellow-200 dark:border-yellow-800">
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
              <p className="text-sm text-yellow-700 dark:text-yellow-400">Pendentes</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center border border-blue-200 dark:border-blue-800">
              <p className="text-2xl font-bold text-blue-600">{stats.processing}</p>
              <p className="text-sm text-blue-700 dark:text-blue-400">Processando</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-center border border-green-200 dark:border-green-800">
              <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
              <p className="text-sm text-green-700 dark:text-green-400">Concluídos</p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 text-center border border-red-200 dark:border-red-800">
              <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
              <p className="text-sm text-red-700 dark:text-red-400">Rejeitados</p>
            </div>
            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4 text-center border border-orange-200 dark:border-orange-800">
              <p className="text-2xl font-bold text-orange-600">R$ {stats.totalPendingAmount.toFixed(2)}</p>
              <p className="text-sm text-orange-700 dark:text-orange-400">A Pagar</p>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 text-center border border-emerald-200 dark:border-emerald-800">
              <p className="text-2xl font-bold text-emerald-600">R$ {stats.totalPaidAmount.toFixed(2)}</p>
              <p className="text-sm text-emerald-700 dark:text-emerald-400">Total Pago</p>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {['PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED', 'ALL'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                filter === f
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              {f === 'ALL' ? 'Todos' : f === 'PENDING' ? 'Pendentes' : f === 'PROCESSING' ? 'Processando' : f === 'COMPLETED' ? 'Concluídos' : 'Rejeitados'}
            </button>
          ))}
        </div>

        {/* Lista de resgates */}
        <div className="space-y-4">
          {filteredWithdrawals.length === 0 ? (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-8 text-center">
              <p className="text-gray-600 dark:text-gray-400">
                Nenhum resgate encontrado com este filtro
              </p>
            </div>
          ) : (
            filteredWithdrawals.map(withdrawal => (
              <div
                key={withdrawal.id}
                className={`bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border-l-4 ${
                  withdrawal.status === 'PENDING' ? 'border-yellow-500' :
                  withdrawal.status === 'PROCESSING' ? 'border-blue-500' :
                  withdrawal.status === 'COMPLETED' ? 'border-green-500' : 'border-red-500'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                        {withdrawal.user.username}
                      </h3>
                      {getStatusBadge(withdrawal.status)}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      <p className="text-gray-600 dark:text-gray-400">
                        <strong>Email:</strong> {withdrawal.user.email || 'N/A'}
                      </p>
                      <p className="text-gray-600 dark:text-gray-400">
                        <strong>Saldo atual:</strong> R$ {withdrawal.user.affiliateBalance?.toFixed(2) || '0.00'}
                      </p>
                      <p className="text-gray-600 dark:text-gray-400">
                        <strong>Total ganho:</strong> R$ {withdrawal.user.totalAffiliateEarnings?.toFixed(2) || '0.00'}
                      </p>
                      <p className="text-gray-600 dark:text-gray-400">
                        <strong>Solicitado:</strong> {format(new Date(withdrawal.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>

                    <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                      <p className="text-lg font-bold text-green-600 dark:text-green-400">
                        Valor: R$ {withdrawal.amount.toFixed(2)}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <strong>Chave PIX ({withdrawal.pixKeyType}):</strong>
                      </p>
                      <code className="text-sm font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded block mt-1 break-all">
                        {withdrawal.pixKey}
                      </code>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(withdrawal.pixKey)
                          toast.success('Chave PIX copiada!')
                        }}
                        className="mt-2 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                      >
                        📋 Copiar Chave
                      </button>
                    </div>

                    {withdrawal.adminNotes && (
                      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        <strong>Obs:</strong> {withdrawal.adminNotes}
                      </p>
                    )}

                    {withdrawal.processedAt && withdrawal.processedBy && (
                      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        Processado por {withdrawal.processedBy.username} em {format(new Date(withdrawal.processedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    )}
                  </div>

                  {/* Ações */}
                  {(withdrawal.status === 'PENDING' || withdrawal.status === 'PROCESSING') && (
                    <div className="flex flex-col gap-2 min-w-[200px]">
                      {withdrawal.status === 'PENDING' && (
                        <button
                          onClick={() => handleAction(withdrawal.id, 'processing')}
                          disabled={processing === withdrawal.id}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
                        >
                          🔄 Marcar Processando
                        </button>
                      )}
                      <button
                        onClick={() => handleAction(withdrawal.id, 'complete')}
                        disabled={processing === withdrawal.id}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50"
                      >
                        ✅ PIX Feito - Concluir
                      </button>
                      <button
                        onClick={() => {
                          const notes = prompt('Motivo da rejeição (opcional):')
                          handleAction(withdrawal.id, 'reject', notes || undefined)
                        }}
                        disabled={processing === withdrawal.id}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50"
                      >
                        ❌ Rejeitar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Botão atualizar */}
        <div className="mt-6 text-center">
          <button
            onClick={loadData}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
          >
            🔄 Atualizar Lista
          </button>
        </div>
      </div>
    </Layout>
  )
}

