import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useTranslation } from '@/lib/i18n-helper'
import { useTheme } from '@/contexts/ThemeContext'
import { getThemeClasses } from '@/lib/theme-utils'
import Layout from '@/components/Layout'
import Link from 'next/link'
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
  const themeClasses = getThemeClasses(theme)
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [apiPlans, setApiPlans] = useState<Array<{ id: string; name: string }>>([])
  const [createForm, setCreateForm] = useState({
    planId: '',
    usageType: 'SITE' as 'SITE' | 'BOT',
    identifier: ''
  })
  const [creating, setCreating] = useState(false)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })

  const totalKeys = apiKeys.length
  const activeKeys = apiKeys.filter(k => k.isActive).length
  const totalMonthly = apiKeys.reduce((acc, k) => acc + (k.monthlyGenerations || 0), 0)
  const totalUsed = apiKeys.reduce((acc, k) => acc + (k.usedGenerations || 0), 0)

  useEffect(() => {
    if (!session) {
      router.push('/login')
      return
    }

    loadApiKeys()
    loadApiPlans()
  }, [session])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY })
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

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

  const loadApiPlans = async () => {
    try {
      const response = await axios.get('/api/plans?type=API')
      setApiPlans(response.data.map((p: any) => ({ id: p.id, name: p.name })))
    } catch {}
  }

  const handleCreate = async () => {
    if (!createForm.planId) {
      toast.error('Selecione um plano de API')
      return
    }
    setCreating(true)
    try {
      const response = await axios.post('/api/api-keys', {
        planId: createForm.planId,
        usageType: createForm.usageType,
        identifier: createForm.identifier
      })
      toast.success('API key criada com sucesso!')
      setCreateForm({ planId: '', usageType: 'SITE', identifier: '' })
      loadApiKeys()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao criar API key')
    } finally {
      setCreating(false)
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
        <div className="min-h-screen bg-[#000000] flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
            <p className="mt-4 text-gray-500">Carregando...</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="min-h-screen bg-[#000000] text-gray-100 pb-20">
        {/* Advanced Background with Mouse Tracking */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div 
            className="absolute w-[1200px] h-[800px] bg-[radial-gradient(circle,rgba(79,70,229,0.15)_0%,transparent_70%)] blur-[150px] transition-all duration-1000 ease-out"
            style={{
              transform: `translate(${(mousePosition.x - 600) * 0.02}px, ${(mousePosition.y - 400) * 0.02}px)`,
              left: `${mousePosition.x - 600}px`,
              top: `${mousePosition.y - 400}px`
            }}
          />
          <div 
            className="absolute w-[1000px] h-[600px] bg-[radial-gradient(circle,rgba(236,72,153,0.1)_0%,transparent_70%)] blur-[120px] transition-all duration-1000 ease-out"
            style={{
              transform: `translate(${(mousePosition.x - 500) * -0.01}px, ${(mousePosition.y - 300) * -0.01}px)`,
              right: `${500 - mousePosition.x}px`,
              bottom: `${300 - mousePosition.y}px`
            }}
          />
          <div 
            className="absolute w-[800px] h-[800px] bg-[radial-gradient(circle,rgba(59,130,246,0.08)_0%,transparent_70%)] blur-[100px] transition-all duration-1000 ease-out"
            style={{
              transform: `translate(${(mousePosition.x - 400) * 0.015}px, ${(mousePosition.y - 400) * 0.015}px)`,
              left: `${mousePosition.x * 0.1}px`,
              bottom: `${mousePosition.y * 0.1}px`
            }}
          />
          <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
          
          {/* Floating particles effect */}
          <div className="absolute inset-0">
            {[...Array(30)].map((_, i) => (
              <div
                key={i}
                className="absolute w-1 h-1 bg-white/15 rounded-full animate-float"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 5}s`,
                  animationDuration: `${3 + Math.random() * 4}s`
                }}
              />
            ))}
          </div>
        </div>

        {/* Futuristic Navigation */}
        <nav className="fixed top-0 w-full z-50 border-b border-white/10 bg-black/20 backdrop-blur-2xl">
          <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg blur-sm opacity-75 group-hover:opacity-100 transition-opacity" />
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-xl font-bold text-white relative">
                  🔑
                </div>
              </div>
              <div>
                <h1 className="font-bold text-xl text-white">API Keys</h1>
                <p className="text-sm text-gray-400">Integração de Alto Nível</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/api-docs" className="group relative overflow-hidden px-6 py-2.5 rounded-full glass-panel border border-white/20 hover:bg-white/5 transition-all duration-300">
                <span className="relative z-10">📖 Docs</span>
                <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </Link>
              <Link href="/dashboard" className="group relative overflow-hidden px-6 py-2.5 rounded-full glass-panel border border-white/20 hover:bg-white/5 transition-all duration-300">
                <span className="relative z-10">⚡ Dashboard</span>
                <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </Link>
            </div>
          </div>
        </nav>

        <main className="relative z-10 pt-32 pb-24 px-6">
          <div className="max-w-7xl mx-auto">
            
            {/* Hero Section */}
            <div className="glass-card rounded-3xl p-8 mb-12 border border-white/10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 blur-[150px]" />
              <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-br from-pink-500/20 to-purple-500/20 blur-[150px]" />
              
              <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8">
                <div>
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-sm font-medium mb-6">
                    <span>🌐</span>
                    <span>Integração via API</span>
                  </div>
                  <h1 className="text-5xl lg:text-6xl font-bold text-white mb-4 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                    API Keys Premium
                  </h1>
                  <p className="text-xl text-gray-400 max-w-2xl mb-8">
                    Integre nosso gerador de contas premium diretamente em suas aplicações com nossa API de alto desempenho.
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <div className="glass-panel px-4 py-2 rounded-full text-sm text-indigo-200 border border-indigo-500/20 flex items-center gap-2">
                      <span className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse"></span>
                      🔐 Segurança por chave
                    </div>
                    <div className="glass-panel px-4 py-2 rounded-full text-sm text-emerald-200 border border-emerald-500/20 flex items-center gap-2">
                      <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
                      ⚡ Uso rastreado
                    </div>
                    <div className="glass-panel px-4 py-2 rounded-full text-sm text-purple-200 border border-purple-500/20 flex items-center gap-2">
                      <span className="w-2 h-2 bg-purple-400 rounded-full"></span>
                      📈 Controle de limite
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-4">
                  <Link href="/api-docs" className="group relative overflow-hidden flex items-center gap-3 px-8 py-4 rounded-2xl glass-panel border border-white/20 hover:bg-white/5 transition-all duration-300">
                    <span className="relative z-10">📖 Documentação</span>
                    <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                  <Link href="/api-plans" className="group relative overflow-hidden flex items-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold hover:shadow-2xl hover:shadow-purple-500/50 transition-all duration-500">
                    <span className="relative z-10">🚀 Assinar Plano API</span>
                    <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              <div className="glass-card p-8 rounded-3xl border border-white/10 hover:border-indigo-500/30 transition-all duration-500 hover:-translate-y-1">
                <div className="flex items-center justify-between mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center text-2xl">
                    🔑
                  </div>
                  <div className="text-right">
                    <div className="text-4xl font-bold text-white">{activeKeys}</div>
                    <div className="text-sm text-gray-400">Chaves Ativas</div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Total</span>
                    <span className="font-semibold text-white">{totalKeys}</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-emerald-500 to-teal-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${totalKeys > 0 ? (activeKeys / totalKeys) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="glass-card p-8 rounded-3xl border border-white/10 hover:border-purple-500/30 transition-all duration-500 hover:-translate-y-1">
                <div className="flex items-center justify-between mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-2xl">
                    📊
                  </div>
                  <div className="text-right">
                    <div className="text-4xl font-bold text-white">{totalUsed}</div>
                    <div className="text-sm text-gray-400">Gerações Usadas</div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Limite Mensal</span>
                    <span className="font-semibold text-white">{totalMonthly}</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${totalMonthly > 0 ? Math.min((totalUsed / totalMonthly) * 100, 100) : 0}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="glass-card p-8 rounded-3xl border border-white/10 hover:border-pink-500/30 transition-all duration-500 hover:-translate-y-1">
                <div className="flex items-center justify-between mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 flex items-center justify-center text-2xl">
                    🚀
                  </div>
                  <div className="text-right">
                    <div className="text-4xl font-bold text-white">{apiPlans.length}</div>
                    <div className="text-sm text-gray-400">Planos Disponíveis</div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Status</span>
                    <span className="font-semibold text-emerald-400">Operacional</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div className="bg-gradient-to-r from-pink-500 to-rose-500 h-2 rounded-full transition-all duration-500" style={{ width: '100%' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Create API Key Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
              <div className="lg:col-span-2 glass-card rounded-3xl p-8 border border-white/10">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-3xl font-bold text-white mb-2">Criar Nova API Key</h2>
                    <p className="text-gray-400">Configure uma nova chave de API para suas integrações</p>
                  </div>
                  <span className="px-4 py-2 rounded-full text-sm text-indigo-200 bg-indigo-500/10 border border-indigo-500/20">
                    🔐 Seguro & Rápido
                  </span>
                </div>
                
                <div className="space-y-8">
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider">
                      Plano de API
                    </label>
                    <select
                      value={createForm.planId}
                      onChange={(e) => setCreateForm({ ...createForm, planId: e.target.value })}
                      className="w-full bg-black/40 border border-white/20 rounded-2xl px-6 py-4 text-white text-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all appearance-none"
                    >
                      <option value="" className="bg-gray-900">Selecione um plano...</option>
                      {apiPlans.map((p) => (
                        <option key={p.id} value={p.id} className="bg-gray-900">
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider">
                      Tipo de Uso
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={() => setCreateForm({ ...createForm, usageType: 'SITE' })}
                        className={`group relative overflow-hidden p-6 rounded-2xl border transition-all ${createForm.usageType === 'SITE'
                          ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border-indigo-500/30'
                          : 'bg-white/5 border-white/10 hover:border-white/20'
                        }`}
                      >
                        <div className="text-center">
                          <div className="text-3xl mb-3">🌐</div>
                          <div className="font-bold text-white text-lg mb-2">Website</div>
                          <div className="text-gray-400 text-sm">Para aplicações web</div>
                        </div>
                      </button>
                      
                      <button
                        onClick={() => setCreateForm({ ...createForm, usageType: 'BOT' })}
                        className={`group relative overflow-hidden p-6 rounded-2xl border transition-all ${createForm.usageType === 'BOT'
                          ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-purple-500/30'
                          : 'bg-white/5 border-white/10 hover:border-white/20'
                        }`}
                      >
                        <div className="text-center">
                          <div className="text-3xl mb-3">🤖</div>
                          <div className="font-bold text-white text-lg mb-2">Bot</div>
                          <div className="text-gray-400 text-sm">Para bots e automações</div>
                        </div>
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider">
                      Identificador (Opcional)
                    </label>
                    <input
                      value={createForm.identifier}
                      onChange={(e) => setCreateForm({ ...createForm, identifier: e.target.value })}
                      placeholder={createForm.usageType === 'SITE' ? 'ex: meuapp.com' : 'ex: @meubot'}
                      className="w-full bg-black/40 border border-white/20 rounded-2xl px-6 py-4 text-white text-lg placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                    />
                  </div>
                  
                  <button
                    onClick={handleCreate}
                    disabled={creating || !createForm.planId}
                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-5 rounded-2xl font-bold text-lg hover:shadow-2xl hover:shadow-purple-500/50 transition-all duration-500 disabled:opacity-50"
                  >
                    {creating ? 'Criando API Key...' : '🔑 Criar API Key'}
                  </button>
                </div>
              </div>
              
              <div className="glass-card rounded-3xl p-8 border border-white/10">
                <h3 className="text-2xl font-bold text-white mb-6">💡 Boas Práticas</h3>
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-lg">
                      🔒
                    </div>
                    <div>
                      <h4 className="font-bold text-white mb-2">Segurança</h4>
                      <p className="text-gray-400 text-sm">Use uma chave por projeto e nunca compartilhe suas chaves.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center text-lg">
                      ⚡
                    </div>
                    <div>
                      <h4 className="font-bold text-white mb-2">Performance</h4>
                      <p className="text-gray-400 text-sm">Monitore seus limites antes de lançar em produção.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 flex items-center justify-center text-lg">
                      🛡️
                    </div>
                    <div>
                      <h4 className="font-bold text-white mb-2">Proteção</h4>
                      <p className="text-gray-400 text-sm">Restrinja por IP quando possível para maior segurança.</p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-8">
                  <Link href="/api-docs" className="text-indigo-400 hover:text-indigo-300 font-semibold text-sm flex items-center gap-2">
                    Ver documentação completa →
                  </Link>
                </div>
              </div>
            </div>

            {/* API Keys List */}
            {apiKeys.length === 0 ? (
              <div className="glass-card rounded-3xl p-16 text-center border border-white/10">
                <div className="text-7xl mb-8">🔑</div>
                <h3 className="text-3xl font-bold text-white mb-4">Nenhuma API Key encontrada</h3>
                <p className="text-gray-400 text-lg mb-8 max-w-md mx-auto">
                  Você ainda não possui nenhuma API Key. Crie sua primeira chave para começar a integrar nossa API.
                </p>
                <button
                  onClick={() => router.push('/api-plans')}
                  className="group relative overflow-hidden px-8 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-lg hover:shadow-2xl hover:shadow-purple-500/50 transition-all duration-500"
                >
                  <span className="relative z-10">Assinar Plano de API</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {apiKeys.map((apiKey) => (
                  <div
                    key={apiKey.id}
                    className="group glass-card rounded-3xl p-8 border border-white/10 hover:border-indigo-500/30 transition-all duration-500 hover:-translate-y-2"
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h3 className="text-2xl font-bold text-white mb-2">
                          {apiKey.name || apiKey.plan.name}
                        </h3>
                        <p className="text-gray-400 text-sm">{apiKey.plan.name}</p>
                      </div>
                      <div className="flex gap-3">
                        {apiKey.isActive ? (
                          <span className="px-4 py-2 rounded-full text-sm text-emerald-200 bg-emerald-500/10 border border-emerald-500/20 font-semibold">
                            ✓ Ativa
                          </span>
                        ) : (
                          <span className="px-4 py-2 rounded-full text-sm text-red-300 bg-red-500/10 border border-red-500/20 font-semibold">
                            ✕ Inativa
                          </span>
                        )}
                        <button
                          onClick={() => handleDelete(apiKey.id)}
                          className="group relative overflow-hidden px-4 py-2 rounded-full text-sm text-red-300 hover:text-white transition-all border border-red-500/20 bg-red-500/10 hover:bg-red-500/20"
                        >
                          <span className="relative z-10">Deletar</span>
                          <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      </div>
                    </div>

                    <div className="glass-panel rounded-2xl p-6 mb-6 border border-white/10">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-semibold text-gray-300 uppercase tracking-wider">API Key</span>
                        <button
                          onClick={() => copyToClipboard(apiKey.key)}
                          className="group relative overflow-hidden px-4 py-2 rounded-full text-sm text-indigo-400 hover:text-indigo-300 transition-all border border-indigo-500/20 bg-indigo-500/10 hover:bg-indigo-500/20"
                        >
                          <span className="relative z-10 flex items-center gap-2">📋 Copiar</span>
                          <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      </div>
                      <code className="block w-full bg-black/40 border border-white/20 rounded-xl p-4 text-white font-mono text-sm break-all">
                        {apiKey.key}
                      </code>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                      <div className="glass-panel rounded-xl p-4 border border-white/10">
                        <p className="text-gray-400 text-xs mb-2 uppercase tracking-wider">Gerações</p>
                        <p className="text-white font-bold text-xl mb-3">
                          {apiKey.usedGenerations} / {apiKey.monthlyGenerations}
                        </p>
                        <div className="w-full bg-white/10 rounded-full h-2">
                          <div 
                            className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min((apiKey.usedGenerations / apiKey.monthlyGenerations) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                      
                      <div className="glass-panel rounded-xl p-4 border border-white/10">
                        <p className="text-gray-400 text-xs mb-2 uppercase tracking-wider">Rate Limit</p>
                        <p className="text-white font-bold text-xl">{apiKey.rateLimit}</p>
                        <p className="text-gray-400 text-xs">req/min</p>
                      </div>
                      
                      <div className="glass-panel rounded-xl p-4 border border-white/10">
                        <p className="text-gray-400 text-xs mb-2 uppercase tracking-wider">Criada em</p>
                        <p className="text-white font-bold text-sm">
                          {new Date(apiKey.createdAt).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>

                    <div className="glass-panel rounded-2xl p-6 border border-white/10">
                      <p className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider">Exemplo de Uso</p>
                      <code className="block w-full bg-black/40 border border-white/20 rounded-xl p-4 text-emerald-400 font-mono text-sm overflow-x-auto">
curl -H "X-API-Key: {apiKey.key}" https://kaizengen.shop/api/v1/services
                      </code>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        <style jsx>{`
          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-20px); }
          }
          
          .animate-float {
            animation: float 6s ease-in-out infinite;
          }
          
          .glass-card {
            background: rgba(25, 25, 25, 0.3);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.1);
          }
          
          .glass-panel {
            background: rgba(25, 25, 25, 0.2);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.08);
          }
        `}</style>
      </div>
    </Layout>
  )
}