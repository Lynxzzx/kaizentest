import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useTranslation } from '@/lib/i18n-helper'
import { useTheme } from '@/contexts/ThemeContext'
import { getThemeClasses } from '@/lib/theme-utils'
import axios from 'axios'
import toast from 'react-hot-toast'
import AdminLayout from '@/components/AdminLayout'

interface AdminLog {
  id: string
  userId: string
  action: string
  targetType: string | null
  targetId: string | null
  targetName: string | null
  details: string | null
  ipAddress: string | null
  createdAt: string
  user: {
    id: string
    username: string
    role: string
  }
}

interface Admin {
  id: string
  username: string
  role: string
}

const actionLabels: Record<string, string> = {
  USER_BAN: 'Banir usuário',
  USER_UNBAN: 'Desbanir usuário',
  USER_SET_PLAN: 'Definir plano',
  USER_SET_ROLE: 'Alterar cargo',
  USER_DELETE: 'Deletar usuário',
  USER_EDIT: 'Editar usuário',
  PLAN_CREATE: 'Criar plano',
  PLAN_EDIT: 'Editar plano',
  PLAN_DELETE: 'Deletar plano',
  SERVICE_CREATE: 'Criar serviço',
  SERVICE_EDIT: 'Editar serviço',
  SERVICE_DELETE: 'Deletar serviço',
  STOCK_ADD: 'Adicionar estoque',
  STOCK_DELETE: 'Deletar estoque',
  KEY_CREATE: 'Criar chave',
  KEY_DELETE: 'Deletar chave',
  COUPON_CREATE: 'Criar cupom',
  COUPON_EDIT: 'Editar cupom',
  COUPON_DELETE: 'Deletar cupom',
  RAFFLE_CREATE: 'Criar sorteio',
  RAFFLE_EDIT: 'Editar sorteio',
  RAFFLE_DELETE: 'Deletar sorteio',
  RAFFLE_DRAW: 'Sortear vencedor',
  WITHDRAWAL_APPROVE: 'Aprovar saque',
  WITHDRAWAL_REJECT: 'Rejeitar saque',
  CONFIG_UPDATE: 'Atualizar configuração',
  OTHER: 'Outra ação'
}

const getActionColor = (action: string): string => {
  if (action.includes('DELETE') || action.includes('BAN') || action.includes('REJECT')) {
    return 'bg-red-500/20 text-red-400 border-red-500/30'
  }
  if (action.includes('CREATE') || action.includes('ADD') || action.includes('APPROVE') || action.includes('UNBAN')) {
    return 'bg-green-500/20 text-green-400 border-green-500/30'
  }
  if (action.includes('EDIT') || action.includes('UPDATE') || action.includes('SET')) {
    return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
  }
  return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
}

const getRoleColor = (role: string): string => {
  switch (role) {
    case 'OWNER':
      return 'bg-purple-500/20 text-purple-400'
    case 'CO_OWNER':
      return 'bg-pink-500/20 text-pink-400'
    case 'ADMIN':
      return 'bg-red-500/20 text-red-400'
    case 'MODERATOR':
      return 'bg-blue-500/20 text-blue-400'
    default:
      return 'bg-gray-500/20 text-gray-400'
  }
}

export default function AdminLogs() {
  const { t } = useTranslation()
  const { data: session, status } = useSession()
  const { theme } = useTheme()
  const router = useRouter()
  const themeClasses = getThemeClasses(theme)

  const [logs, setLogs] = useState<AdminLog[]>([])
  const [admins, setAdmins] = useState<Admin[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // Filtros
  const [filterAction, setFilterAction] = useState('')
  const [filterAdmin, setFilterAdmin] = useState('')
  const [filterStartDate, setFilterStartDate] = useState('')
  const [filterEndDate, setFilterEndDate] = useState('')

  // Modal de detalhes
  const [selectedLog, setSelectedLog] = useState<AdminLog | null>(null)

  useEffect(() => {
    if (status === 'loading') return
    
    if (!session) {
      router.push('/login')
      return
    }

    // Apenas OWNER pode acessar esta página
    if (session.user.role !== 'OWNER') {
      toast.error('Acesso negado. Apenas o Owner pode ver os logs.')
      router.push('/admin')
      return
    }

    loadLogs()
  }, [session, status, page, filterAction, filterAdmin, filterStartDate, filterEndDate])

  const loadLogs = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50'
      })

      if (filterAction) params.append('action', filterAction)
      if (filterAdmin) params.append('userId', filterAdmin)
      if (filterStartDate) params.append('startDate', filterStartDate)
      if (filterEndDate) params.append('endDate', filterEndDate)

      const response = await axios.get(`/api/admin/logs?${params.toString()}`)
      setLogs(response.data.logs)
      setAdmins(response.data.admins)
      setTotalPages(response.data.pagination.totalPages)
      setTotal(response.data.pagination.total)
    } catch (error: any) {
      console.error('Erro ao carregar logs:', error)
      toast.error(error.response?.data?.error || 'Erro ao carregar logs')
    } finally {
      setLoading(false)
    }
  }

  const clearFilters = () => {
    setFilterAction('')
    setFilterAdmin('')
    setFilterStartDate('')
    setFilterEndDate('')
    setPage(1)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const parseDetails = (details: string | null): Record<string, any> | null => {
    if (!details) return null
    try {
      return JSON.parse(details)
    } catch {
      return null
    }
  }

  if (status === 'loading' || loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className={`text-2xl sm:text-3xl font-bold ${themeClasses.text.primary}`}>
              📋 Logs Administrativos
            </h1>
            <p className={`mt-1 ${themeClasses.text.secondary}`}>
              Histórico de todas as ações realizadas pelos administradores
            </p>
          </div>
          <div className={`px-4 py-2 rounded-lg ${themeClasses.card}`}>
            <span className={themeClasses.text.secondary}>Total: </span>
            <span className={`font-bold ${themeClasses.text.primary}`}>{total} registros</span>
          </div>
        </div>

        {/* Filtros */}
        <div className={`${themeClasses.card} rounded-xl p-4 sm:p-6`}>
          <h3 className={`text-lg font-semibold mb-4 ${themeClasses.text.primary}`}>🔍 Filtros</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className={`block text-sm font-medium mb-2 ${themeClasses.text.secondary}`}>
                Tipo de Ação
              </label>
              <select
                value={filterAction}
                onChange={(e) => { setFilterAction(e.target.value); setPage(1) }}
                className={`${themeClasses.input} w-full px-3 py-2 rounded-lg`}
              >
                <option value="">Todas as ações</option>
                {Object.entries(actionLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${themeClasses.text.secondary}`}>
                Administrador
              </label>
              <select
                value={filterAdmin}
                onChange={(e) => { setFilterAdmin(e.target.value); setPage(1) }}
                className={`${themeClasses.input} w-full px-3 py-2 rounded-lg`}
              >
                <option value="">Todos os admins</option>
                {admins.map((admin) => (
                  <option key={admin.id} value={admin.id}>
                    {admin.username} ({admin.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${themeClasses.text.secondary}`}>
                Data Inicial
              </label>
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => { setFilterStartDate(e.target.value); setPage(1) }}
                className={`${themeClasses.input} w-full px-3 py-2 rounded-lg`}
              />
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${themeClasses.text.secondary}`}>
                Data Final
              </label>
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => { setFilterEndDate(e.target.value); setPage(1) }}
                className={`${themeClasses.input} w-full px-3 py-2 rounded-lg`}
              />
            </div>
          </div>

          {(filterAction || filterAdmin || filterStartDate || filterEndDate) && (
            <button
              onClick={clearFilters}
              className="mt-4 px-4 py-2 bg-gray-500/20 text-gray-300 rounded-lg hover:bg-gray-500/30 transition-colors"
            >
              🗑️ Limpar Filtros
            </button>
          )}
        </div>

        {/* Lista de Logs */}
        <div className={`${themeClasses.card} rounded-xl overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'}>
                <tr>
                  <th className={`px-4 py-3 text-left text-sm font-semibold ${themeClasses.text.primary}`}>
                    Data/Hora
                  </th>
                  <th className={`px-4 py-3 text-left text-sm font-semibold ${themeClasses.text.primary}`}>
                    Admin
                  </th>
                  <th className={`px-4 py-3 text-left text-sm font-semibold ${themeClasses.text.primary}`}>
                    Ação
                  </th>
                  <th className={`px-4 py-3 text-left text-sm font-semibold ${themeClasses.text.primary}`}>
                    Alvo
                  </th>
                  <th className={`px-4 py-3 text-left text-sm font-semibold ${themeClasses.text.primary}`}>
                    IP
                  </th>
                  <th className={`px-4 py-3 text-center text-sm font-semibold ${themeClasses.text.primary}`}>
                    Detalhes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={`px-4 py-12 text-center ${themeClasses.text.secondary}`}>
                      Nenhum log encontrado
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr 
                      key={log.id} 
                      className={`${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-gray-50'} transition-colors`}
                    >
                      <td className={`px-4 py-3 text-sm ${themeClasses.text.secondary}`}>
                        {formatDate(log.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${themeClasses.text.primary}`}>
                            {log.user.username}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded ${getRoleColor(log.user.role)}`}>
                            {log.user.role}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded border ${getActionColor(log.action)}`}>
                          {actionLabels[log.action] || log.action}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-sm ${themeClasses.text.secondary}`}>
                        {log.targetName ? (
                          <span>
                            <span className="text-gray-500">{log.targetType}: </span>
                            <span className={themeClasses.text.primary}>{log.targetName}</span>
                          </span>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className={`px-4 py-3 text-sm font-mono ${themeClasses.text.secondary}`}>
                        {log.ipAddress || '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {log.details && (
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors text-sm"
                          >
                            Ver
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className={`px-4 py-3 flex items-center justify-between border-t ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
              <div className={`text-sm ${themeClasses.text.secondary}`}>
                Página {page} de {totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className={`px-3 py-1 rounded ${
                    page === 1 
                      ? 'bg-gray-500/20 text-gray-500 cursor-not-allowed' 
                      : 'bg-primary-500/20 text-primary-400 hover:bg-primary-500/30'
                  }`}
                >
                  ← Anterior
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className={`px-3 py-1 rounded ${
                    page === totalPages 
                      ? 'bg-gray-500/20 text-gray-500 cursor-not-allowed' 
                      : 'bg-primary-500/20 text-primary-400 hover:bg-primary-500/30'
                  }`}
                >
                  Próxima →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Detalhes */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`${themeClasses.card} rounded-xl p-6 max-w-lg w-full max-h-[80vh] overflow-auto`}>
            <h3 className={`text-xl font-bold mb-4 ${themeClasses.text.primary}`}>
              📝 Detalhes do Log
            </h3>
            
            <div className="space-y-4">
              <div>
                <span className={`text-sm ${themeClasses.text.secondary}`}>Data/Hora:</span>
                <p className={`font-medium ${themeClasses.text.primary}`}>
                  {formatDate(selectedLog.createdAt)}
                </p>
              </div>
              
              <div>
                <span className={`text-sm ${themeClasses.text.secondary}`}>Administrador:</span>
                <p className={`font-medium ${themeClasses.text.primary}`}>
                  {selectedLog.user.username} ({selectedLog.user.role})
                </p>
              </div>
              
              <div>
                <span className={`text-sm ${themeClasses.text.secondary}`}>Ação:</span>
                <p className={`font-medium ${themeClasses.text.primary}`}>
                  {actionLabels[selectedLog.action] || selectedLog.action}
                </p>
              </div>
              
              {selectedLog.targetName && (
                <div>
                  <span className={`text-sm ${themeClasses.text.secondary}`}>Alvo:</span>
                  <p className={`font-medium ${themeClasses.text.primary}`}>
                    {selectedLog.targetType}: {selectedLog.targetName}
                  </p>
                </div>
              )}
              
              {selectedLog.ipAddress && (
                <div>
                  <span className={`text-sm ${themeClasses.text.secondary}`}>IP:</span>
                  <p className={`font-mono ${themeClasses.text.primary}`}>
                    {selectedLog.ipAddress}
                  </p>
                </div>
              )}
              
              {selectedLog.details && (
                <div>
                  <span className={`text-sm ${themeClasses.text.secondary}`}>Detalhes:</span>
                  <pre className={`mt-2 p-3 rounded-lg ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-100'} text-sm overflow-auto`}>
                    {JSON.stringify(parseDetails(selectedLog.details), null, 2)}
                  </pre>
                </div>
              )}
            </div>
            
            <button
              onClick={() => setSelectedLog(null)}
              className={`mt-6 w-full px-4 py-2 rounded-lg ${theme === 'dark' ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-100 hover:bg-gray-200'} ${themeClasses.text.primary} transition-colors`}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

