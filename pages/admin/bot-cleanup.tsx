import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useTheme } from '@/contexts/ThemeContext'
import { getThemeClasses } from '@/lib/theme-utils'
import axios from 'axios'
import toast from 'react-hot-toast'

interface SuspiciousUser {
  id: string
  username: string
  email?: string
  registrationIp?: string
  createdAt: string
  hasPayments: boolean
  hasGenerations: boolean
  hasPlan: boolean
  isBanned: boolean
}

interface SuspiciousIp {
  ip: string
  count: number
  users: SuspiciousUser[]
}

interface SuspiciousFingerprint {
  fingerprint: string
  count: number
  users: SuspiciousUser[]
}

interface BurstCreation {
  time: string
  count: number
  users: {
    id: string
    username: string
    registrationIp: string
    hasPayments: boolean
    isBanned: boolean
  }[]
}

interface Stats {
  totalUsers: number
  usersWithPayments: number
  usersWithGenerations: number
  usersWithPlans: number
  bannedUsers: number
  suspiciousIpsCount: number
  suspiciousFingerprintsCount: number
  suspiciousUsernamesCount: number
  burstCreationsCount: number
}

export default function BotCleanup() {
  const { theme } = useTheme()
  const { data: session, status } = useSession()
  const router = useRouter()
  const themeClasses = getThemeClasses(theme)

  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [stats, setStats] = useState<Stats | null>(null)
  const [suspiciousIps, setSuspiciousIps] = useState<SuspiciousIp[]>([])
  const [suspiciousFingerprints, setSuspiciousFingerprints] = useState<SuspiciousFingerprint[]>([])
  const [suspiciousUsernames, setSuspiciousUsernames] = useState<SuspiciousUser[]>([])
  const [burstCreations, setBurstCreations] = useState<BurstCreation[]>([])
  
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  const [banIps, setBanIps] = useState(true)
  const [activeTab, setActiveTab] = useState<'ips' | 'fingerprints' | 'usernames' | 'bursts'>('ips')

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
      const response = await axios.get('/api/admin/bot-accounts')
      setStats(response.data.stats)
      setSuspiciousIps(response.data.suspiciousIps)
      setSuspiciousFingerprints(response.data.suspiciousFingerprints)
      setSuspiciousUsernames(response.data.suspiciousUsernames)
      setBurstCreations(response.data.burstCreations)
    } catch (error: any) {
      console.error('Erro ao carregar dados:', error)
      if (error.response?.status === 403) {
        toast.error('Apenas OWNER e CO_OWNER podem acessar esta página')
        router.push('/dashboard')
      } else {
        toast.error('Erro ao carregar dados')
      }
    } finally {
      setLoading(false)
    }
  }

  const toggleUser = (userId: string) => {
    const newSelected = new Set(selectedUsers)
    if (newSelected.has(userId)) {
      newSelected.delete(userId)
    } else {
      newSelected.add(userId)
    }
    setSelectedUsers(newSelected)
  }

  const selectAllFromIp = (ip: string) => {
    const ipData = suspiciousIps.find(s => s.ip === ip)
    if (!ipData) return
    
    const newSelected = new Set(selectedUsers)
    ipData.users.forEach(user => {
      if (!user.hasPayments) {
        newSelected.add(user.id)
      }
    })
    setSelectedUsers(newSelected)
  }

  const selectAllSuspicious = () => {
    const newSelected = new Set<string>()
    
    // Adicionar de IPs suspeitos
    suspiciousIps.forEach(ip => {
      ip.users.forEach(user => {
        if (!user.hasPayments) {
          newSelected.add(user.id)
        }
      })
    })
    
    // Adicionar de usernames suspeitos
    suspiciousUsernames.forEach(user => {
      if (!user.hasPayments) {
        newSelected.add(user.id)
      }
    })
    
    setSelectedUsers(newSelected)
    toast.success(`${newSelected.size} contas selecionadas`)
  }

  const clearSelection = () => {
    setSelectedUsers(new Set())
  }

  const handleDeleteSelected = async () => {
    if (selectedUsers.size === 0) {
      toast.error('Nenhuma conta selecionada')
      return
    }

    const confirmMsg = `Tem certeza que deseja DELETAR ${selectedUsers.size} contas?\n\n` +
      `${banIps ? '⚠️ Os IPs também serão BANIDOS!' : ''}\n\n` +
      `Esta ação NÃO pode ser desfeita!`
    
    if (!confirm(confirmMsg)) return

    setDeleting(true)
    try {
      const response = await axios.delete('/api/admin/bot-accounts', {
        data: {
          userIds: Array.from(selectedUsers),
          banIp: banIps
        }
      })

      toast.success(response.data.message)
      
      if (response.data.skippedWithPayments > 0) {
        toast.error(`${response.data.skippedWithPayments} contas com pagamentos foram ignoradas`)
      }
      
      if (response.data.bannedIps > 0) {
        toast.success(`${response.data.bannedIps} IPs banidos`)
      }

      setSelectedUsers(new Set())
      loadData()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao deletar contas')
    } finally {
      setDeleting(false)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('pt-BR')
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center text-white/55">
        <svg className="h-5 w-5 animate-spin mr-2" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25"/><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4"/></svg>
        Carregando...
      </div>
    )
  }

  return (
      <div className="mx-auto max-w-7xl px-4 py-10 sm:py-14">
        <div className="mb-8">
          <h1 className={`text-3xl font-bold ${themeClasses.text.primary}`}>
            🤖 Limpeza de Contas de Bots
          </h1>
          <p className={themeClasses.text.secondary}>
            Identifique e remova contas criadas automaticamente por bots
          </p>
        </div>

        {/* Estatísticas */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <div className={`${themeClasses.card} rounded-xl p-4 text-center`}>
              <div className={`text-3xl font-bold ${themeClasses.text.primary}`}>
                {stats.totalUsers}
              </div>
              <div className={`text-sm ${themeClasses.text.muted}`}>Total Usuários</div>
            </div>
            <div className={`${themeClasses.card} rounded-xl p-4 text-center`}>
              <div className="text-3xl font-bold text-red-500">
                {stats.suspiciousIpsCount}
              </div>
              <div className={`text-sm ${themeClasses.text.muted}`}>IPs Suspeitos</div>
            </div>
            <div className={`${themeClasses.card} rounded-xl p-4 text-center`}>
              <div className="text-3xl font-bold text-yellow-500">
                {stats.suspiciousUsernamesCount}
              </div>
              <div className={`text-sm ${themeClasses.text.muted}`}>Nomes Suspeitos</div>
            </div>
            <div className={`${themeClasses.card} rounded-xl p-4 text-center`}>
              <div className="text-3xl font-bold text-green-500">
                {stats.usersWithPayments}
              </div>
              <div className={`text-sm ${themeClasses.text.muted}`}>Com Pagamentos</div>
            </div>
            <div className={`${themeClasses.card} rounded-xl p-4 text-center`}>
              <div className="text-3xl font-bold text-purple-500">
                {stats.burstCreationsCount}
              </div>
              <div className={`text-sm ${themeClasses.text.muted}`}>Rajadas</div>
            </div>
          </div>
        )}

        {/* Ações em massa */}
        <div className={`${themeClasses.card} rounded-xl p-4 mb-6 flex flex-wrap items-center gap-4`}>
          <button
            onClick={selectAllSuspicious}
            className="bg-yellow-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-yellow-700 transition-all"
          >
            ⚡ Selecionar Todos Suspeitos
          </button>
          <button
            onClick={clearSelection}
            className={`${themeClasses.input} px-4 py-2 rounded-lg font-semibold`}
          >
            ✕ Limpar Seleção
          </button>
          
          <div className="flex items-center gap-2 ml-auto">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={banIps}
                onChange={(e) => setBanIps(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <span className={themeClasses.text.secondary}>Banir IPs também</span>
            </label>
          </div>

          <div className={`text-lg font-bold ${themeClasses.text.primary}`}>
            {selectedUsers.size} selecionadas
          </div>

          <button
            onClick={handleDeleteSelected}
            disabled={deleting || selectedUsers.size === 0}
            className="bg-red-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-red-700 transition-all disabled:opacity-50"
          >
            {deleting ? '🔄 Deletando...' : `🗑️ Deletar ${selectedUsers.size} Contas`}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('ips')}
            className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-all ${
              activeTab === 'ips'
                ? 'bg-red-600 text-white'
                : `${themeClasses.card} ${themeClasses.text.secondary}`
            }`}
          >
            🌐 IPs Suspeitos ({suspiciousIps.length})
          </button>
          <button
            onClick={() => setActiveTab('fingerprints')}
            className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-all ${
              activeTab === 'fingerprints'
                ? 'bg-orange-600 text-white'
                : `${themeClasses.card} ${themeClasses.text.secondary}`
            }`}
          >
            👆 Fingerprints ({suspiciousFingerprints.length})
          </button>
          <button
            onClick={() => setActiveTab('usernames')}
            className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-all ${
              activeTab === 'usernames'
                ? 'bg-yellow-600 text-white'
                : `${themeClasses.card} ${themeClasses.text.secondary}`
            }`}
          >
            👤 Nomes Suspeitos ({suspiciousUsernames.length})
          </button>
          <button
            onClick={() => setActiveTab('bursts')}
            className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-all ${
              activeTab === 'bursts'
                ? 'bg-purple-600 text-white'
                : `${themeClasses.card} ${themeClasses.text.secondary}`
            }`}
          >
            ⚡ Rajadas ({burstCreations.length})
          </button>
        </div>

        {/* Tab: IPs Suspeitos */}
        {activeTab === 'ips' && (
          <div className="space-y-4">
            {suspiciousIps.length === 0 ? (
              <div className={`${themeClasses.card} rounded-xl p-8 text-center ${themeClasses.text.muted}`}>
                Nenhum IP suspeito encontrado (mais de 2 contas por IP)
              </div>
            ) : (
              suspiciousIps.map((ipData) => (
                <div key={ipData.ip} className={`${themeClasses.card} rounded-xl overflow-hidden`}>
                  <div className={`${theme === 'dark' ? 'bg-red-900/30' : 'bg-red-50'} px-4 py-3 flex items-center justify-between`}>
                    <div>
                      <span className={`font-mono font-bold ${themeClasses.text.primary}`}>
                        🌐 {ipData.ip}
                      </span>
                      <span className="ml-2 bg-red-600 text-white px-2 py-1 rounded text-sm">
                        {ipData.count} contas
                      </span>
                    </div>
                    <button
                      onClick={() => selectAllFromIp(ipData.ip)}
                      className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                    >
                      Selecionar Todas
                    </button>
                  </div>
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {ipData.users.map((user) => (
                      <div 
                        key={user.id} 
                        className={`px-4 py-2 flex items-center gap-4 ${
                          selectedUsers.has(user.id) ? 'bg-red-100 dark:bg-red-900/20' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedUsers.has(user.id)}
                          onChange={() => toggleUser(user.id)}
                          disabled={user.hasPayments}
                          className="w-4 h-4"
                        />
                        <span className={`font-medium ${themeClasses.text.primary}`}>
                          {user.username}
                        </span>
                        <span className={`text-sm ${themeClasses.text.muted}`}>
                          {formatDate(user.createdAt)}
                        </span>
                        {user.hasPayments && (
                          <span className="bg-green-500 text-white px-2 py-0.5 rounded text-xs">
                            💰 Pagou
                          </span>
                        )}
                        {user.isBanned && (
                          <span className="bg-gray-500 text-white px-2 py-0.5 rounded text-xs">
                            Banido
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab: Fingerprints */}
        {activeTab === 'fingerprints' && (
          <div className="space-y-4">
            {suspiciousFingerprints.length === 0 ? (
              <div className={`${themeClasses.card} rounded-xl p-8 text-center ${themeClasses.text.muted}`}>
                Nenhum fingerprint suspeito encontrado
              </div>
            ) : (
              suspiciousFingerprints.map((fpData, idx) => (
                <div key={idx} className={`${themeClasses.card} rounded-xl overflow-hidden`}>
                  <div className={`${theme === 'dark' ? 'bg-orange-900/30' : 'bg-orange-50'} px-4 py-3`}>
                    <span className={`font-mono ${themeClasses.text.primary}`}>
                      👆 {fpData.fingerprint}
                    </span>
                    <span className="ml-2 bg-orange-600 text-white px-2 py-1 rounded text-sm">
                      {fpData.count} contas
                    </span>
                  </div>
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {fpData.users.map((user) => (
                      <div 
                        key={user.id} 
                        className={`px-4 py-2 flex items-center gap-4 ${
                          selectedUsers.has(user.id) ? 'bg-orange-100 dark:bg-orange-900/20' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedUsers.has(user.id)}
                          onChange={() => toggleUser(user.id)}
                          disabled={user.hasPayments}
                          className="w-4 h-4"
                        />
                        <span className={`font-medium ${themeClasses.text.primary}`}>
                          {user.username}
                        </span>
                        {user.hasPayments && (
                          <span className="bg-green-500 text-white px-2 py-0.5 rounded text-xs">
                            💰 Pagou
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab: Usernames Suspeitos */}
        {activeTab === 'usernames' && (
          <div className={`${themeClasses.card} rounded-xl overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={`${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}>
                  <tr>
                    <th className="px-4 py-3 text-left w-12"></th>
                    <th className={`px-4 py-3 text-left ${themeClasses.text.primary}`}>Username</th>
                    <th className={`px-4 py-3 text-left ${themeClasses.text.primary}`}>IP</th>
                    <th className={`px-4 py-3 text-left ${themeClasses.text.primary}`}>Data</th>
                    <th className={`px-4 py-3 text-left ${themeClasses.text.primary}`}>Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {suspiciousUsernames.length === 0 ? (
                    <tr>
                      <td colSpan={5} className={`px-4 py-8 text-center ${themeClasses.text.muted}`}>
                        Nenhum username suspeito encontrado
                      </td>
                    </tr>
                  ) : (
                    suspiciousUsernames.map((user) => (
                      <tr 
                        key={user.id}
                        className={selectedUsers.has(user.id) ? 'bg-yellow-100 dark:bg-yellow-900/20' : ''}
                      >
                        <td className="px-4 py-2">
                          <input
                            type="checkbox"
                            checked={selectedUsers.has(user.id)}
                            onChange={() => toggleUser(user.id)}
                            disabled={user.hasPayments}
                            className="w-4 h-4"
                          />
                        </td>
                        <td className={`px-4 py-2 font-medium ${themeClasses.text.primary}`}>
                          {user.username}
                        </td>
                        <td className={`px-4 py-2 font-mono text-sm ${themeClasses.text.secondary}`}>
                          {user.registrationIp || '-'}
                        </td>
                        <td className={`px-4 py-2 text-sm ${themeClasses.text.muted}`}>
                          {formatDate(user.createdAt)}
                        </td>
                        <td className="px-4 py-2">
                          {user.hasPayments && (
                            <span className="bg-green-500 text-white px-2 py-0.5 rounded text-xs mr-1">
                              💰 Pagou
                            </span>
                          )}
                          {user.isBanned && (
                            <span className="bg-gray-500 text-white px-2 py-0.5 rounded text-xs">
                              Banido
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab: Criações em Rajada */}
        {activeTab === 'bursts' && (
          <div className="space-y-4">
            {burstCreations.length === 0 ? (
              <div className={`${themeClasses.card} rounded-xl p-8 text-center ${themeClasses.text.muted}`}>
                Nenhuma criação em rajada detectada (mais de 3 contas por minuto)
              </div>
            ) : (
              burstCreations.map((burst, idx) => (
                <div key={idx} className={`${themeClasses.card} rounded-xl overflow-hidden`}>
                  <div className={`${theme === 'dark' ? 'bg-purple-900/30' : 'bg-purple-50'} px-4 py-3`}>
                    <span className={themeClasses.text.primary}>
                      ⚡ {new Date(burst.time).toLocaleString('pt-BR')}
                    </span>
                    <span className="ml-2 bg-purple-600 text-white px-2 py-1 rounded text-sm">
                      {burst.count} contas em 1 minuto
                    </span>
                  </div>
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {burst.users.map((user) => (
                      <div 
                        key={user.id} 
                        className={`px-4 py-2 flex items-center gap-4 ${
                          selectedUsers.has(user.id) ? 'bg-purple-100 dark:bg-purple-900/20' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedUsers.has(user.id)}
                          onChange={() => toggleUser(user.id)}
                          disabled={user.hasPayments}
                          className="w-4 h-4"
                        />
                        <span className={`font-medium ${themeClasses.text.primary}`}>
                          {user.username}
                        </span>
                        <span className={`font-mono text-sm ${themeClasses.text.muted}`}>
                          {user.registrationIp}
                        </span>
                        {user.hasPayments && (
                          <span className="bg-green-500 text-white px-2 py-0.5 rounded text-xs">
                            💰 Pagou
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
  )
}

