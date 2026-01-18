import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useTranslation } from '@/lib/i18n-helper'
import { useTheme } from '@/contexts/ThemeContext'
import Layout from '@/components/Layout'
import axios from 'axios'
import toast from 'react-hot-toast'

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

export default function ApiKeys() {
  const { t } = useTranslation()
  const { data: session } = useSession()
  const router = useRouter()
  const { theme } = useTheme()
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) {
      router.push('/login')
      return
    }

    loadApiKeys()
  }, [session])

  const loadApiKeys = async () => {
    try {
      const response = await axios.get('/api/api-keys')
      setApiKeys(response.data)
    } catch (error) {
      toast.error('Erro ao carregar API keys')
    } finally {
      setLoading(false)
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copiado para a área de transferência!')
  }

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
              onClick={() => router.push('/api-plans')}
              className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity"
            >
              + Nova API Key
            </button>
          </div>

          {apiKeys.length === 0 ? (
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 border border-white/20 text-center">
              <p className="text-xl text-slate-300 mb-6">
                Você ainda não possui nenhuma API Key.
              </p>
              <button
                onClick={() => router.push('/api-plans')}
                className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-8 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity"
              >
                Assinar Plano de API
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
    </Layout>
  )
}