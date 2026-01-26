
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useTheme } from '@/contexts/ThemeContext'
import { getThemeClasses } from '@/lib/theme-utils'
import axios from 'axios'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'

export default function AdminLogs() {
  const { data: session, status } = useSession()
  const { theme } = useTheme()
  const themeClasses = getThemeClasses(theme)
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<'admin' | 'security'>('admin')
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login')
    } else if (status === 'authenticated' && session?.user?.role !== 'OWNER') {
      router.replace('/dashboard')
    }
  }, [status, session, router])

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role === 'OWNER') {
      fetchLogs()
    }
  }, [status, session, activeTab, page]) // Reload when tab or page changes

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const response = await axios.get('/api/admin/logs', {
        params: {
          type: activeTab,
          page,
          search
        }
      })
      setLogs(response.data.logs)
      setTotalPages(response.data.pagination.pages)
    } catch (error) {
      toast.error('Erro ao carregar logs')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchLogs()
  }

  if (status === 'loading' || (status === 'authenticated' && session?.user?.role !== 'OWNER')) {
    return null
  }

  return (
    <div className={`min-h-screen ${themeClasses.bg} p-4 sm:p-6 lg:p-8`}>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className={`text-3xl font-bold ${themeClasses.text.primary}`}>Logs do Sistema</h1>
            <p className={`mt-2 ${themeClasses.text.secondary}`}>
              Visualize as ações administrativas e eventos de segurança
            </p>
          </div>
          <Link
            href="/admin"
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              theme === 'dark' 
                ? 'bg-white/10 text-white hover:bg-white/20' 
                : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
            }`}
          >
            Voltar
          </Link>
        </div>

        <div className={`${themeClasses.card} neon-shadow p-6`}>
          {/* Tabs */}
          <div className="flex space-x-4 mb-6 border-b border-gray-700/50 pb-4">
            <button
              onClick={() => { setActiveTab('admin'); setPage(1); }}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                activeTab === 'admin'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                  : `${themeClasses.text.muted} hover:bg-white/5`
              }`}
            >
              Ações Administrativas
            </button>
            <button
              onClick={() => { setActiveTab('security'); setPage(1); }}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                activeTab === 'security'
                  ? 'bg-red-600 text-white shadow-lg shadow-red-500/30'
                  : `${themeClasses.text.muted} hover:bg-white/5`
              }`}
            >
              Logs de Segurança
            </button>
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="mb-6">
            <div className="flex gap-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por usuário, IP, tipo..."
                className={`flex-1 px-4 py-2 rounded-lg border ${
                  theme === 'dark' 
                    ? 'bg-black/30 border-white/10 text-white focus:border-indigo-500' 
                    : 'bg-white border-gray-300 text-gray-900 focus:border-indigo-500'
                } focus:outline-none focus:ring-1 focus:ring-indigo-500`}
              />
              <button
                type="submit"
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors"
              >
                Buscar
              </button>
            </div>
          </form>

          {/* Table */}
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
              <p className={`mt-4 ${themeClasses.text.muted}`}>Carregando logs...</p>
            </div>
          ) : logs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className={`border-b ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
                    <th className={`p-4 font-semibold ${themeClasses.text.secondary}`}>Data</th>
                    <th className={`p-4 font-semibold ${themeClasses.text.secondary}`}>
                      {activeTab === 'admin' ? 'Usuário' : 'IP / Usuário'}
                    </th>
                    <th className={`p-4 font-semibold ${themeClasses.text.secondary}`}>Ação / Tipo</th>
                    <th className={`p-4 font-semibold ${themeClasses.text.secondary}`}>Detalhes</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${theme === 'dark' ? 'divide-white/5' : 'divide-gray-100'}`}>
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-white/5 transition-colors">
                      <td className={`p-4 whitespace-nowrap ${themeClasses.text.muted}`}>
                        {format(new Date(log.createdAt), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                      </td>
                      <td className={`p-4 ${themeClasses.text.primary}`}>
                        {activeTab === 'admin' ? (
                          <div className="flex flex-col">
                            <span className="font-medium">{log.user?.username || 'Sistema'}</span>
                            <span className="text-xs opacity-70">{log.ipAddress}</span>
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            <span className="font-medium">{log.ip}</span>
                            {log.username && <span className="text-xs opacity-70">{log.username}</span>}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                          activeTab === 'admin'
                            ? 'bg-blue-100 text-blue-800'
                            : log.success 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                        }`}>
                          {activeTab === 'admin' ? log.action : log.type}
                        </span>
                      </td>
                      <td className={`p-4 ${themeClasses.text.muted} text-sm`}>
                        {activeTab === 'admin' ? (
                          <div>
                            {log.targetType && <span className="font-medium text-indigo-400">[{log.targetType}] </span>}
                            {log.targetName}
                            {log.details && (
                              <details className="mt-1 cursor-pointer">
                                <summary className="text-xs opacity-70 hover:opacity-100">Ver JSON</summary>
                                <pre className="mt-1 text-xs bg-black/30 p-2 rounded overflow-x-auto max-w-xs">
                                  {JSON.stringify(JSON.parse(log.details || '{}'), null, 2)}
                                </pre>
                              </details>
                            )}
                          </div>
                        ) : (
                          <div>
                            {log.reason && <div className="text-red-400">{log.reason}</div>}
                            {log.metadata && (
                              <details className="mt-1 cursor-pointer">
                                <summary className="text-xs opacity-70 hover:opacity-100">Ver Metadata</summary>
                                <pre className="mt-1 text-xs bg-black/30 p-2 rounded overflow-x-auto max-w-xs">
                                  {JSON.stringify(JSON.parse(log.metadata || '{}'), null, 2)}
                                </pre>
                              </details>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className={themeClasses.text.muted}>Nenhum log encontrado.</p>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-6 gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className={`px-3 py-1 rounded ${
                  page === 1 
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'hover:bg-white/10'
                } ${themeClasses.text.primary}`}
              >
                Anterior
              </button>
              <span className={`px-3 py-1 ${themeClasses.text.secondary}`}>
                Página {page} de {totalPages}
              </span>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
                className={`px-3 py-1 rounded ${
                  page === totalPages 
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'hover:bg-white/10'
                } ${themeClasses.text.primary}`}
              >
                Próxima
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
