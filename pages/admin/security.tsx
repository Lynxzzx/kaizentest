import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Layout from '@/components/Layout'
import { useTranslation } from '@/lib/i18n-helper'
import { useTheme } from '@/contexts/ThemeContext'
import { getThemeClasses } from '@/lib/theme-utils'
import axios from 'axios'
import toast from 'react-hot-toast'

interface BannedIp {
  id: string
  ip: string
  reason: string
  bannedBy?: {
    id: string
    username: string
  }
  expiresAt: string | null
  createdAt: string
  totalAttempts: number
  lastActivity: string | null
  lastActivityType: string | null
}

interface SecurityLog {
  id: string
  type: string
  ip: string
  userAgent: string | null
  username: string | null
  success: boolean
  reason: string | null
  createdAt: string
}

export default function SecurityAdmin() {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const { data: session, status } = useSession()
  const router = useRouter()
  const themeClasses = getThemeClasses(theme)

  const [bannedIps, setBannedIps] = useState<BannedIp[]>([])
  const [securityLogs, setSecurityLogs] = useState<SecurityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'banned' | 'logs'>('banned')

  // Form para banir IP
  const [newIp, setNewIp] = useState('')
  const [banReason, setBanReason] = useState('')
  const [banDuration, setBanDuration] = useState<string>('0') // 0 = permanente
  const [banning, setBanning] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    if (session?.user) {
      loadData()
    }
  }, [session])

  const loadData = async () => {
    setLoading(true)
    try {
      const [ipsRes, logsRes] = await Promise.all([
        axios.get('/api/admin/banned-ips'),
        axios.get('/api/admin/security-logs')
      ])
      
      setBannedIps(ipsRes.data)
      setSecurityLogs(logsRes.data)
    } catch (error: any) {
      console.error('Erro ao carregar dados:', error)
      if (error.response?.status === 403) {
        toast.error('Sem permissão para acessar esta página')
        router.push('/dashboard')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleBanIp = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newIp.trim()) {
      toast.error('Digite um IP')
      return
    }
    
    if (!banReason.trim()) {
      toast.error('Digite um motivo')
      return
    }

    setBanning(true)
    try {
      await axios.post('/api/admin/banned-ips', {
        ip: newIp.trim(),
        reason: banReason.trim(),
        duration: parseInt(banDuration) || 0
      })
      
      toast.success('IP banido com sucesso!')
      setNewIp('')
      setBanReason('')
      setBanDuration('0')
      loadData()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao banir IP')
    } finally {
      setBanning(false)
    }
  }

  const handleUnbanIp = async (ip: string) => {
    if (!confirm(`Deseja realmente desbanir o IP ${ip}?`)) return

    try {
      await axios.delete('/api/admin/banned-ips', {
        data: { ip }
      })
      
      toast.success('IP desbanido com sucesso!')
      loadData()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao desbanir IP')
    }
  }

  const handleQuickBan = async (ip: string) => {
    const reason = prompt('Motivo do banimento:')
    if (!reason) return

    try {
      await axios.post('/api/admin/banned-ips', {
        ip,
        reason,
        duration: 0
      })
      
      toast.success('IP banido com sucesso!')
      loadData()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao banir IP')
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('pt-BR')
  }

  const getLogTypeLabel = (type: string) => {
    const labels: Record<string, { text: string; color: string }> = {
      register_attempt: { text: 'Registro', color: 'bg-blue-500' },
      login_attempt: { text: 'Login', color: 'bg-green-500' },
      bot_detected: { text: 'Bot Detectado', color: 'bg-red-500' },
      rate_limit: { text: 'Rate Limit', color: 'bg-yellow-500' },
      blocked: { text: 'Bloqueado', color: 'bg-purple-500' }
    }
    return labels[type] || { text: type, color: 'bg-gray-500' }
  }

  if (status === 'loading' || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className={`text-3xl font-bold ${themeClasses.text.primary}`}>
            🛡️ Segurança
          </h1>
          <p className={themeClasses.text.secondary}>
            Gerencie IPs banidos e visualize logs de segurança
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab('banned')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              activeTab === 'banned'
                ? 'bg-primary-600 text-white'
                : `${themeClasses.card} ${themeClasses.text.secondary} hover:bg-primary-600/10`
            }`}
          >
            🚫 IPs Banidos ({bannedIps.length})
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              activeTab === 'logs'
                ? 'bg-primary-600 text-white'
                : `${themeClasses.card} ${themeClasses.text.secondary} hover:bg-primary-600/10`
            }`}
          >
            📋 Logs de Segurança
          </button>
        </div>

        {/* Tab: IPs Banidos */}
        {activeTab === 'banned' && (
          <div className="space-y-6">
            {/* Formulário para banir IP */}
            <div className={`${themeClasses.card} rounded-xl p-6`}>
              <h2 className={`text-xl font-bold mb-4 ${themeClasses.text.primary}`}>
                ➕ Banir Novo IP
              </h2>
              <form onSubmit={handleBanIp} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${themeClasses.text.secondary}`}>
                    Endereço IP
                  </label>
                  <input
                    type="text"
                    value={newIp}
                    onChange={(e) => setNewIp(e.target.value)}
                    placeholder="Ex: 192.168.1.1"
                    className={`${themeClasses.input} w-full px-4 py-2 rounded-lg`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${themeClasses.text.secondary}`}>
                    Motivo
                  </label>
                  <input
                    type="text"
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                    placeholder="Ex: Atividade suspeita"
                    className={`${themeClasses.input} w-full px-4 py-2 rounded-lg`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${themeClasses.text.secondary}`}>
                    Duração
                  </label>
                  <select
                    value={banDuration}
                    onChange={(e) => setBanDuration(e.target.value)}
                    className={`${themeClasses.input} w-full px-4 py-2 rounded-lg`}
                  >
                    <option value="0">Permanente</option>
                    <option value="1">1 hora</option>
                    <option value="24">24 horas</option>
                    <option value="168">7 dias</option>
                    <option value="720">30 dias</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={banning}
                    className="w-full bg-red-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700 transition-all disabled:opacity-50"
                  >
                    {banning ? 'Banindo...' : '🚫 Banir IP'}
                  </button>
                </div>
              </form>
            </div>

            {/* Lista de IPs banidos */}
            <div className={`${themeClasses.card} rounded-xl overflow-hidden`}>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className={`${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}>
                    <tr>
                      <th className={`px-4 py-3 text-left ${themeClasses.text.primary}`}>IP</th>
                      <th className={`px-4 py-3 text-left ${themeClasses.text.primary}`}>Motivo</th>
                      <th className={`px-4 py-3 text-left ${themeClasses.text.primary}`}>Banido por</th>
                      <th className={`px-4 py-3 text-left ${themeClasses.text.primary}`}>Tentativas</th>
                      <th className={`px-4 py-3 text-left ${themeClasses.text.primary}`}>Expira em</th>
                      <th className={`px-4 py-3 text-left ${themeClasses.text.primary}`}>Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {bannedIps.length === 0 ? (
                      <tr>
                        <td colSpan={6} className={`px-4 py-8 text-center ${themeClasses.text.muted}`}>
                          Nenhum IP banido
                        </td>
                      </tr>
                    ) : (
                      bannedIps.map((ban) => (
                        <tr key={ban.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className={`px-4 py-3 ${themeClasses.text.primary} font-mono`}>
                            {ban.ip}
                          </td>
                          <td className={`px-4 py-3 ${themeClasses.text.secondary}`}>
                            {ban.reason}
                          </td>
                          <td className={`px-4 py-3 ${themeClasses.text.secondary}`}>
                            {ban.bannedBy?.username || 'Sistema'}
                          </td>
                          <td className={`px-4 py-3 ${themeClasses.text.secondary}`}>
                            <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-sm">
                              {ban.totalAttempts} tentativas
                            </span>
                          </td>
                          <td className={`px-4 py-3 ${themeClasses.text.secondary}`}>
                            {ban.expiresAt ? formatDate(ban.expiresAt) : (
                              <span className="text-red-500 font-semibold">Permanente</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleUnbanIp(ban.ip)}
                              className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-all"
                            >
                              ✓ Desbanir
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Logs de Segurança */}
        {activeTab === 'logs' && (
          <div className={`${themeClasses.card} rounded-xl overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={`${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}>
                  <tr>
                    <th className={`px-4 py-3 text-left ${themeClasses.text.primary}`}>Tipo</th>
                    <th className={`px-4 py-3 text-left ${themeClasses.text.primary}`}>IP</th>
                    <th className={`px-4 py-3 text-left ${themeClasses.text.primary}`}>Username</th>
                    <th className={`px-4 py-3 text-left ${themeClasses.text.primary}`}>Status</th>
                    <th className={`px-4 py-3 text-left ${themeClasses.text.primary}`}>Motivo</th>
                    <th className={`px-4 py-3 text-left ${themeClasses.text.primary}`}>Data</th>
                    <th className={`px-4 py-3 text-left ${themeClasses.text.primary}`}>Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {securityLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className={`px-4 py-8 text-center ${themeClasses.text.muted}`}>
                        Nenhum log de segurança
                      </td>
                    </tr>
                  ) : (
                    securityLogs.map((log) => {
                      const typeInfo = getLogTypeLabel(log.type)
                      return (
                        <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="px-4 py-3">
                            <span className={`${typeInfo.color} text-white px-2 py-1 rounded text-xs`}>
                              {typeInfo.text}
                            </span>
                          </td>
                          <td className={`px-4 py-3 ${themeClasses.text.primary} font-mono text-sm`}>
                            {log.ip}
                          </td>
                          <td className={`px-4 py-3 ${themeClasses.text.secondary}`}>
                            {log.username || '-'}
                          </td>
                          <td className="px-4 py-3">
                            {log.success ? (
                              <span className="text-green-500">✓ Sucesso</span>
                            ) : (
                              <span className="text-red-500">✗ Falha</span>
                            )}
                          </td>
                          <td className={`px-4 py-3 ${themeClasses.text.secondary} text-sm max-w-xs truncate`}>
                            {log.reason || '-'}
                          </td>
                          <td className={`px-4 py-3 ${themeClasses.text.muted} text-sm`}>
                            {formatDate(log.createdAt)}
                          </td>
                          <td className="px-4 py-3">
                            {!bannedIps.some(b => b.ip === log.ip) && (
                              <button
                                onClick={() => handleQuickBan(log.ip)}
                                className="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700 transition-all"
                              >
                                🚫 Banir
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

