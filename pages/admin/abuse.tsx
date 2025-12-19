import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Layout from '@/components/Layout'
import axios from 'axios'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'

interface SuspiciousGroup {
  ip?: string
  fingerprint?: string
  fullFingerprint?: string
  count: number
  users: Array<{
    id: string
    username: string
    email: string | null
    plan: string
    isBanned: boolean
    freeGenerationsUsed: number
    registrationIp?: string
    createdAt: string
  }>
}

interface AbuseData {
  stats: {
    totalUsers: number
    usersWithIp: number
    usersWithFingerprint: number
    suspiciousIpCount: number
    suspiciousFingerprintCount: number
    totalSuspiciousAccounts: number
  }
  suspiciousIps: SuspiciousGroup[]
  suspiciousFingerprints: SuspiciousGroup[]
  allUsersWithIp: Array<{
    id: string
    username: string
    email: string | null
    registrationIp: string | null
    lastIp: string | null
    lastIpAt: string | null
    deviceFingerprint: string | null
    plan: string
    isBanned: boolean
    createdAt: string
  }>
}

export default function AdminAbuse() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [data, setData] = useState<AbuseData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'ips' | 'fingerprints' | 'all'>('ips')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    if (status === 'authenticated' && !['OWNER', 'CO_OWNER', 'ADMIN'].includes(session?.user?.role || '')) {
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
      const response = await axios.get('/api/admin/abuse-detection')
      setData(response.data)
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  const banUser = async (userId: string, username: string) => {
    if (!confirm(`Tem certeza que deseja banir o usuário ${username}?`)) return

    try {
      await axios.put('/api/admin/users', {
        userId,
        isBanned: true
      })
      toast.success(`Usuário ${username} banido!`)
      loadData()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao banir usuário')
    }
  }

  const filteredAllUsers = data?.allUsersWithIp.filter(u => 
    u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.registrationIp?.includes(searchTerm) ||
    u.lastIp?.includes(searchTerm)
  ) || []

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
            <span>🔍</span>
            <span>Detecção de Abuso</span>
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Monitore contas suspeitas criadas no mesmo IP ou dispositivo
          </p>
        </div>

        {/* Estatísticas */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 text-center shadow-lg">
              <p className="text-2xl font-bold text-blue-600">{data.stats.totalUsers}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Usuários</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 text-center shadow-lg">
              <p className="text-2xl font-bold text-green-600">{data.stats.usersWithIp}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Com IP Registrado</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 text-center shadow-lg">
              <p className="text-2xl font-bold text-purple-600">{data.stats.usersWithFingerprint}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Com Fingerprint</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 text-center shadow-lg">
              <p className="text-2xl font-bold text-red-600">{data.stats.suspiciousIpCount}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">IPs Suspeitos</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 text-center shadow-lg">
              <p className="text-2xl font-bold text-orange-600">{data.stats.suspiciousFingerprintCount}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Dispositivos Suspeitos</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 text-center shadow-lg">
              <p className="text-2xl font-bold text-red-700">{data.stats.totalSuspiciousAccounts}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Contas Suspeitas</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('ips')}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              activeTab === 'ips'
                ? 'bg-red-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            🌐 IPs Suspeitos ({data?.suspiciousIps.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('fingerprints')}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              activeTab === 'fingerprints'
                ? 'bg-orange-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            📱 Dispositivos Suspeitos ({data?.suspiciousFingerprints.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              activeTab === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            👥 Todos os Usuários
          </button>
        </div>

        {/* Conteúdo baseado na tab */}
        {activeTab === 'ips' && data?.suspiciousIps && (
          <div className="space-y-6">
            {data.suspiciousIps.length === 0 ? (
              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-8 text-center">
                <p className="text-green-700 dark:text-green-300 text-lg">
                  ✅ Nenhum IP suspeito detectado
                </p>
              </div>
            ) : (
              data.suspiciousIps.map((group, idx) => (
                <div key={idx} className="bg-red-50 dark:bg-red-900/20 rounded-xl p-6 border border-red-200 dark:border-red-800">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-red-800 dark:text-red-200">
                        🌐 IP: {group.ip}
                      </h3>
                      <p className="text-sm text-red-600 dark:text-red-400">
                        {group.count} contas criadas neste IP
                      </p>
                    </div>
                    <span className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                      ⚠️ SUSPEITO
                    </span>
                  </div>
                  <div className="grid gap-2">
                    {group.users.map(user => (
                      <div
                        key={user.id}
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          user.isBanned
                            ? 'bg-gray-200 dark:bg-gray-800'
                            : 'bg-white dark:bg-gray-800'
                        }`}
                      >
                        <div>
                          <p className={`font-semibold ${user.isBanned ? 'line-through text-gray-500' : 'text-gray-900 dark:text-white'}`}>
                            {user.username} {user.isBanned && '(BANIDO)'}
                          </p>
                          <p className="text-sm text-gray-500">
                            {user.email || 'Sem email'} • {user.plan} • Gerações grátis: {user.freeGenerationsUsed}
                          </p>
                          <p className="text-xs text-gray-400">
                            Criado: {format(new Date(user.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                        {!user.isBanned && (
                          <button
                            onClick={() => banUser(user.id, user.username)}
                            className="px-3 py-1 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
                          >
                            Banir
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'fingerprints' && data?.suspiciousFingerprints && (
          <div className="space-y-6">
            {data.suspiciousFingerprints.length === 0 ? (
              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-8 text-center">
                <p className="text-green-700 dark:text-green-300 text-lg">
                  ✅ Nenhum dispositivo suspeito detectado
                </p>
              </div>
            ) : (
              data.suspiciousFingerprints.map((group, idx) => (
                <div key={idx} className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-6 border border-orange-200 dark:border-orange-800">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-orange-800 dark:text-orange-200">
                        📱 Dispositivo: {group.fingerprint}
                      </h3>
                      <p className="text-sm text-orange-600 dark:text-orange-400">
                        {group.count} contas neste dispositivo
                      </p>
                    </div>
                    <span className="bg-orange-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                      ⚠️ SUSPEITO
                    </span>
                  </div>
                  <div className="grid gap-2">
                    {group.users.map(user => (
                      <div
                        key={user.id}
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          user.isBanned
                            ? 'bg-gray-200 dark:bg-gray-800'
                            : 'bg-white dark:bg-gray-800'
                        }`}
                      >
                        <div>
                          <p className={`font-semibold ${user.isBanned ? 'line-through text-gray-500' : 'text-gray-900 dark:text-white'}`}>
                            {user.username} {user.isBanned && '(BANIDO)'}
                          </p>
                          <p className="text-sm text-gray-500">
                            {user.email || 'Sem email'} • {user.plan} • IP: {user.registrationIp || 'N/A'}
                          </p>
                          <p className="text-xs text-gray-400">
                            Criado: {format(new Date(user.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                        {!user.isBanned && (
                          <button
                            onClick={() => banUser(user.id, user.username)}
                            className="px-3 py-1 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
                          >
                            Banir
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'all' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
            <div className="p-4 border-b dark:border-gray-700">
              <input
                type="text"
                placeholder="Buscar por username, email ou IP..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Usuário</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">IP Registro</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Último IP</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Fingerprint</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Plano</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredAllUsers.map(user => (
                    <tr key={user.id} className={user.isBanned ? 'bg-red-50 dark:bg-red-900/10' : ''}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-900 dark:text-white">{user.username}</p>
                        <p className="text-sm text-gray-500">{user.email || '-'}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-gray-600 dark:text-gray-400">
                        {user.registrationIp || '-'}
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-gray-600 dark:text-gray-400">
                        {user.lastIp || '-'}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">
                        {user.deviceFingerprint || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {user.plan}
                      </td>
                      <td className="px-4 py-3">
                        {user.isBanned ? (
                          <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-semibold">
                            BANIDO
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                            ATIVO
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {!user.isBanned && (
                          <button
                            onClick={() => banUser(user.id, user.username)}
                            className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors"
                          >
                            Banir
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Botão de atualizar */}
        <div className="mt-6 text-center">
          <button
            onClick={loadData}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            🔄 Atualizar Dados
          </button>
        </div>
      </div>
    </Layout>
  )
}

