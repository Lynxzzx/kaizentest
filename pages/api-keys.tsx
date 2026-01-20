import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useTranslation } from '@/lib/i18n-helper'
import { useTheme } from '@/contexts/ThemeContext'
import Layout from '@/components/Layout'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Dialog } from '@headlessui/react'

interface ApiKey {
  id: string
  key: string
  name?: string
  monthlyGenerations: number
  usedGenerations: number
  rateLimit: number
  isActive: boolean
  createdAt: string
  plan: {
    name: string
    price: number
  }
}

interface UserData {
  plan?: {
    id: string
    name: string
    maxGenerations: number
  }
  planExpiresAt?: string
  apiPlan?: {
    id: string
    name: string
    maxGenerations: number
  }
  apiPlanExpiresAt?: string
}

export default function ApiKeys() {
  const { t } = useTranslation()
  const { data: session } = useSession()
  const router = useRouter()
  const { theme } = useTheme()
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [userData, setUserData] = useState<UserData | null>(null)
  
  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!session) {
      router.push('/login')
      return
    }

    Promise.all([loadApiKeys(), loadUserData()])
      .finally(() => setLoading(false))
  }, [session])

  const loadApiKeys = async () => {
    try {
      const response = await axios.get('/api/api-keys')
      setApiKeys(response.data)
    } catch (error) {
      toast.error('Erro ao carregar API keys')
    }
  }

  const loadUserData = async () => {
    try {
      const response = await axios.get('/api/users/me')
      setUserData(response.data)
    } catch (error) {
      console.error('Erro ao carregar dados do usuário:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar esta API key?')) return

    try {
      await axios.delete(`/api/api-keys/${id}`)
      toast.success('API key deletada')
      loadApiKeys()
    } catch (error) {
      toast.error('Erro ao deletar API key')
    }
  }

  const handleCreateKey = async () => {
    if (!selectedPlanId) {
      toast.error('Selecione um plano')
      return
    }

    setCreating(true)
    try {
      await axios.post('/api/api-keys', {
        planId: selectedPlanId,
        name: newKeyName || 'Minha API Key'
      })
      toast.success('API Key criada com sucesso!')
      setIsCreateModalOpen(false)
      setNewKeyName('')
      loadApiKeys()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao criar API key')
    } finally {
      setCreating(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copiado para a área de transferência!')
  }

  const getActivePlans = () => {
    const plans = []
    const now = new Date()

    if (userData?.plan && userData.planExpiresAt && new Date(userData.planExpiresAt) > now) {
      plans.push({ ...userData.plan, source: 'Plano Principal' })
    }

    if (userData?.apiPlan && userData.apiPlanExpiresAt && new Date(userData.apiPlanExpiresAt) > now) {
      plans.push({ ...userData.apiPlan, source: 'Plano de API' })
    }

    return plans
  }

  const activePlans = getActivePlans()
  const hasActivePlans = activePlans.length > 0

  // Auto-select plan if only one exists when opening modal
  useEffect(() => {
    if (isCreateModalOpen && activePlans.length === 1) {
      setSelectedPlanId(activePlans[0].id)
    }
  }, [isCreateModalOpen, activePlans])

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 py-12 px-4">
          <div className="max-w-6xl mx-auto text-center">
            <p className="text-white">Carregando...</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-4xl font-bold text-white">🔑 Minhas API Keys</h1>
            <button
              onClick={() => hasActivePlans ? setIsCreateModalOpen(true) : router.push('/api-plans')}
              className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity"
            >
              {hasActivePlans ? '+ Nova API Key' : 'Assinar Plano de API'}
            </button>
          </div>

          {apiKeys.length === 0 ? (
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 border border-white/20 text-center">
              <p className="text-xl text-slate-300 mb-6">
                Você ainda não possui nenhuma API Key.
              </p>
              <button
                onClick={() => hasActivePlans ? setIsCreateModalOpen(true) : router.push('/api-plans')}
                className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-8 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity"
              >
                {hasActivePlans ? 'Gerar Minha Primeira Key' : 'Assinar Plano de API'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {apiKeys.map((apiKey) => (
                <div
                  key={apiKey.id}
                  className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-white mb-2">
                        {apiKey.name || apiKey.plan.name}
                      </h3>
                      <p className="text-slate-300 text-sm">{apiKey.plan.name}</p>
                    </div>
                    <div className="flex gap-2">
                      {apiKey.isActive ? (
                        <span className="bg-green-500/20 text-green-300 px-3 py-1 rounded-full text-sm">
                          Ativa
                        </span>
                      ) : (
                        <span className="bg-red-500/20 text-red-300 px-3 py-1 rounded-full text-sm">
                          Inativa
                        </span>
                      )}
                      <button
                        onClick={() => handleDelete(apiKey.id)}
                        className="bg-red-500/20 text-red-300 px-3 py-1 rounded-full text-sm hover:bg-red-500/30 transition-colors"
                      >
                        Deletar
                      </button>
                    </div>
                  </div>

                  <div className="bg-white/5 rounded-lg p-4 mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-slate-300 text-sm">API Key:</span>
                      <button
                        onClick={() => copyToClipboard(apiKey.key)}
                        className="text-purple-400 hover:text-purple-300 text-sm"
                      >
                        Copiar
                      </button>
                    </div>
                    <code className="text-white font-mono text-sm break-all">
                      {apiKey.key}
                    </code>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-slate-400 text-xs mb-1">Gerações Mensais</p>
                      <p className="text-white">
                        {apiKey.usedGenerations} / {apiKey.monthlyGenerations}
                      </p>
                      <div className="w-full bg-white/10 rounded-full h-2 mt-2">
                        <div
                          className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full"
                          style={{
                            width: `${Math.min((apiKey.usedGenerations / apiKey.monthlyGenerations) * 100, 100)}%`
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs mb-1">Rate Limit</p>
                      <p className="text-white">{apiKey.rateLimit} req/min</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs mb-1">Criada em</p>
                      <p className="text-white text-sm">
                        {new Date(apiKey.createdAt).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-white/10">
                    <p className="text-slate-400 text-xs mb-2">Exemplo de uso:</p>
                    <code className="block bg-black/30 rounded p-2 text-xs text-slate-300 overflow-x-auto">
                      curl -H "X-API-Key: {apiKey.key}" https://kaizengen.shop/api/v1/services
                    </code>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Criação de Key */}
      <Dialog
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/70" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto max-w-sm rounded-2xl bg-slate-800 p-6 border border-white/10 shadow-xl w-full">
            <Dialog.Title className="text-lg font-bold text-white mb-4">Nova API Key</Dialog.Title>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Nome da Key (Opcional)
                </label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="Ex: Integração Site"
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              {activePlans.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Plano Associado
                  </label>
                  <select
                    value={selectedPlanId}
                    onChange={(e) => setSelectedPlanId(e.target.value)}
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="">Selecione um plano</option>
                    {activePlans.map(plan => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} ({plan.source})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 px-4 py-2 rounded-lg bg-white/5 text-slate-300 hover:bg-white/10 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateKey}
                  disabled={creating}
                  className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {creating ? 'Criando...' : 'Criar Key'}
                </button>
              </div>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </Layout>
  )
}
