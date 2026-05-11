import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useTranslation } from '@/lib/i18n-helper'
import { useTheme } from '@/contexts/ThemeContext'
import { getThemeClasses } from '@/lib/theme-utils'
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

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

  // Mobile menu handlers
  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

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
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center text-white/55">
        <svg className="h-5 w-5 animate-spin mr-2" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25"/><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4"/></svg>
        Carregando...
      </div>
    )
  }

  return (
      <div className="relative">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/4 top-0 h-[500px] w-[500px] rounded-full bg-aurora-violet/10 blur-[140px]" />
          <div className="absolute right-1/4 top-1/2 h-[450px] w-[450px] rounded-full bg-aurora-cyan/10 blur-[140px]" />
        </div>

        <main className="relative z-10 py-10 sm:py-14 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto">
            
            {/* Hero Section */}
            <div className="glass-card rounded-2xl sm:rounded-3xl p-6 sm:p-8 mb-8 sm:mb-12 border border-white/10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 sm:w-96 sm:h-96 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 blur-[100px] sm:blur-[150px]" />
              <div className="absolute bottom-0 left-0 w-48 h-48 sm:w-96 sm:h-96 bg-gradient-to-br from-pink-500/20 to-purple-500/20 blur-[100px] sm:blur-[150px]" />
              
              <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6 sm:gap-8">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs sm:text-sm font-medium mb-4 sm:mb-6">
                    <span>🌐</span>
                    <span>Integração via API</span>
                  </div>
                  <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold text-white mb-3 sm:mb-4 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                    API Keys Premium
                  </h1>
                  <p className="text-base sm:text-xl text-gray-400 max-w-2xl mb-6 sm:mb-8">
                    Integre nosso gerador de contas premium diretamente em suas aplicações com nossa API de alto desempenho.
                  </p>
                  <div className="flex flex-wrap gap-2 sm:gap-4">
                    <div className="glass-panel px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm text-indigo-200 border border-indigo-500/20 flex items-center gap-1 sm:gap-2">
                      <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-indigo-400 rounded-full animate-pulse"></span>
                      🔐 Segurança por chave
                    </div>
                    <div className="glass-panel px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm text-emerald-200 border border-emerald-500/20 flex items-center gap-1 sm:gap-2">
                      <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-emerald-400 rounded-full"></span>
                      ⚡ Uso rastreado
                    </div>
                    <div className="glass-panel px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm text-purple-200 border border-purple-500/20 flex items-center gap-1 sm:gap-2">
                      <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-purple-400 rounded-full"></span>
                      📈 Controle de limite
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-3 sm:gap-4 w-full sm:w-auto">
                  <Link href="/api-docs" className="group relative overflow-hidden flex items-center gap-2 sm:gap-3 px-6 py-3 sm:px-8 sm:py-4 rounded-xl sm:rounded-2xl glass-panel border border-white/20 hover:bg-white/5 transition-all duration-300 text-center">
                    <span className="relative z-10">📖 Documentação</span>
                    <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                  <Link href="/api-plans" className="group relative overflow-hidden flex items-center gap-2 sm:gap-3 px-6 py-3 sm:px-8 sm:py-4 rounded-xl sm:rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold hover:shadow-xl sm:hover:shadow-2xl hover:shadow-purple-500/50 transition-all duration-500 text-center">
                    <span className="relative z-10">🚀 Assinar Plano API</span>
                    <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-12">
              <div className="glass-card p-6 sm:p-8 rounded-2xl sm:rounded-3xl border border-white/10 hover:border-indigo-500/30 transition-all duration-500 hover:-translate-y-1">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center text-xl sm:text-2xl">
                    🔑
                  </div>
                  <div className="text-right">
                    <div className="text-2xl sm:text-4xl font-bold text-white">{activeKeys}</div>
                    <div className="text-xs sm:text-sm text-gray-400">Chaves Ativas</div>
                  </div>
                </div>
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-gray-400">Total</span>
                    <span className="font-semibold text-white">{totalKeys}</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-1.5 sm:h-2">
                    <div 
                      className="bg-gradient-to-r from-emerald-500 to-teal-500 h-1.5 sm:h-2 rounded-full transition-all duration-500"
                      style={{ width: `${totalKeys > 0 ? (activeKeys / totalKeys) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="glass-card p-6 sm:p-8 rounded-2xl sm:rounded-3xl border border-white/10 hover:border-purple-500/30 transition-all duration-500 hover:-translate-y-1">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-xl sm:text-2xl">
                    📊
                  </div>
                  <div className="text-right">
                    <div className="text-2xl sm:text-4xl font-bold text-white">{totalUsed}</div>
                    <div className="text-xs sm:text-sm text-gray-400">Gerações Usadas</div>
                  </div>
                </div>
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-gray-400">Limite Mensal</span>
                    <span className="font-semibold text-white">{totalMonthly}</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-1.5 sm:h-2">
                    <div 
                      className="bg-gradient-to-r from-purple-500 to-pink-500 h-1.5 sm:h-2 rounded-full transition-all duration-500"
                      style={{ width: `${totalMonthly > 0 ? Math.min((totalUsed / totalMonthly) * 100, 100) : 0}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="glass-card p-6 sm:p-8 rounded-2xl sm:rounded-3xl border border-white/10 hover:border-pink-500/30 transition-all duration-500 hover:-translate-y-1">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 flex items-center justify-center text-xl sm:text-2xl">
                    🚀
                  </div>
                  <div className="text-right">
                    <div className="text-2xl sm:text-4xl font-bold text-white">{apiPlans.length}</div>
                    <div className="text-xs sm:text-sm text-gray-400">Planos Disponíveis</div>
                  </div>
                </div>
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-gray-400">Status</span>
                    <span className="font-semibold text-emerald-400">Operacional</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-1.5 sm:h-2">
                    <div className="bg-gradient-to-r from-pink-500 to-rose-500 h-1.5 sm:h-2 rounded-full transition-all duration-500" style={{ width: '100%' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Create API Key Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 mb-8 sm:mb-12">
              <div className="lg:col-span-2 glass-card rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-white/10">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 gap-4">
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Criar Nova API Key</h2>
                    <p className="text-gray-400 text-sm sm:text-base">Configure uma nova chave de API para suas integrações</p>
                  </div>
                  <span className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm text-indigo-200 bg-indigo-500/10 border border-indigo-500/20">
                    🔐 Seguro & Rápido
                  </span>
                </div>
                
                <div className="space-y-6 sm:space-y-8">
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-3 sm:mb-4 uppercase tracking-wider">
                      Plano de API
                    </label>
                    <select
                      value={createForm.planId}
                      onChange={(e) => setCreateForm({ ...createForm, planId: e.target.value })}
                      className="w-full bg-black/40 border border-white/20 rounded-xl sm:rounded-2xl px-4 sm:px-6 py-3 sm:py-4 text-white text-base sm:text-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all appearance-none"
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
                    <label className="block text-sm font-semibold text-gray-300 mb-3 sm:mb-4 uppercase tracking-wider">
                      Tipo de Uso
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <button
                        onClick={() => setCreateForm({ ...createForm, usageType: 'SITE' })}
                        className={`group relative overflow-hidden p-4 sm:p-6 rounded-xl sm:rounded-2xl border transition-all ${createForm.usageType === 'SITE'
                          ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border-indigo-500/30'
                          : 'bg-white/5 border-white/10 hover:border-white/20'
                        }`}
                      >
                        <div className="text-center">
                          <div className="text-2xl sm:text-3xl mb-2 sm:mb-3">🌐</div>
                          <div className="font-bold text-white text-base sm:text-lg mb-1 sm:mb-2">Website</div>
                          <div className="text-gray-400 text-xs sm:text-sm">Para aplicações web</div>
                        </div>
                      </button>
                      
                      <button
                        onClick={() => setCreateForm({ ...createForm, usageType: 'BOT' })}
                        className={`group relative overflow-hidden p-4 sm:p-6 rounded-xl sm:rounded-2xl border transition-all ${createForm.usageType === 'BOT'
                          ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-purple-500/30'
                          : 'bg-white/5 border-white/10 hover:border-white/20'
                        }`}
                      >
                        <div className="text-center">
                          <div className="text-2xl sm:text-3xl mb-2 sm:mb-3">🤖</div>
                          <div className="font-bold text-white text-base sm:text-lg mb-1 sm:mb-2">Bot</div>
                          <div className="text-gray-400 text-xs sm:text-sm">Para bots e automações</div>
                        </div>
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-3 sm:mb-4 uppercase tracking-wider">
                      Identificador (Opcional)
                    </label>
                    <input
                      value={createForm.identifier}
                      onChange={(e) => setCreateForm({ ...createForm, identifier: e.target.value })}
                      placeholder={createForm.usageType === 'SITE' ? 'ex: meuapp.com' : 'ex: @meubot'}
                      className="w-full bg-black/40 border border-white/20 rounded-xl sm:rounded-2xl px-4 sm:px-6 py-3 sm:py-4 text-white text-base sm:text-lg placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                    />
                  </div>
                  
                  <button
                    onClick={handleCreate}
                    disabled={creating || !createForm.planId}
                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 sm:py-5 rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg hover:shadow-xl sm:hover:shadow-2xl hover:shadow-purple-500/50 transition-all duration-500 disabled:opacity-50"
                  >
                    {creating ? 'Criando API Key...' : '🔑 Criar API Key'}
                  </button>
                </div>
              </div>
              
              <div className="glass-card rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-white/10">
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6">💡 Boas Práticas</h3>
                <div className="space-y-4 sm:space-y-6">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-base sm:text-lg">
                      🔒
                    </div>
                    <div>
                      <h4 className="font-bold text-white mb-1 sm:mb-2 text-base sm:text-lg">Segurança</h4>
                      <p className="text-gray-400 text-xs sm:text-sm">Use uma chave por projeto e nunca compartilhe suas chaves.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center text-base sm:text-lg">
                      ⚡
                    </div>
                    <div>
                      <h4 className="font-bold text-white mb-1 sm:mb-2 text-base sm:text-lg">Performance</h4>
                      <p className="text-gray-400 text-xs sm:text-sm">Monitore seus limites antes de lançar em produção.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 flex items-center justify-center text-base sm:text-lg">
                      🛡️
                    </div>
                    <div>
                      <h4 className="font-bold text-white mb-1 sm:mb-2 text-base sm:text-lg">Proteção</h4>
                      <p className="text-gray-400 text-xs sm:text-sm">Restrinja por IP quando possível para maior segurança.</p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 sm:mt-8">
                  <Link href="/api-docs" className="text-indigo-400 hover:text-indigo-300 font-semibold text-xs sm:text-sm flex items-center gap-2">
                    Ver documentação completa →
                  </Link>
                </div>
              </div>
            </div>

            {/* API Keys List */}
            {apiKeys.length === 0 ? (
              <div className="glass-card rounded-2xl sm:rounded-3xl p-8 sm:p-16 text-center border border-white/10">
                <div className="text-5xl sm:text-7xl mb-6 sm:mb-8">🔑</div>
                <h3 className="text-2xl sm:text-3xl font-bold text-white mb-3 sm:mb-4">Nenhuma API Key encontrada</h3>
                <p className="text-gray-400 text-base sm:text-lg mb-6 sm:mb-8 max-w-md mx-auto">
                  Você ainda não possui nenhuma API Key. Crie sua primeira chave para começar a integrar nossa API.
                </p>
                <button
                  onClick={() => router.push('/api-plans')}
                  className="group relative overflow-hidden px-6 py-3 sm:px-8 sm:py-4 rounded-xl sm:rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-base sm:text-lg hover:shadow-xl sm:hover:shadow-2xl hover:shadow-purple-500/50 transition-all duration-500"
                >
                  <span className="relative z-10">Assinar Plano de API</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
                {apiKeys.map((apiKey) => (
                  <div
                    key={apiKey.id}
                    className="group glass-card rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-white/10 hover:border-indigo-500/30 transition-all duration-500 hover:-translate-y-1 sm:hover:-translate-y-2"
                  >
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-4 sm:mb-6 gap-4">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-xl sm:text-2xl font-bold text-white mb-1 sm:mb-2">
                          {apiKey.name || apiKey.plan.name}
                        </h3>
                        <p className="text-gray-400 text-xs sm:text-sm">{apiKey.plan.name}</p>
                      </div>
                      <div className="flex gap-2 sm:gap-3 flex-shrink-0">
                        {apiKey.isActive ? (
                          <span className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm text-emerald-200 bg-emerald-500/10 border border-emerald-500/20 font-semibold">
                            ✓ Ativa
                          </span>
                        ) : (
                          <span className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm text-red-300 bg-red-500/10 border border-red-500/20 font-semibold">
                            ✕ Inativa
                          </span>
                        )}
                        <button
                          onClick={() => handleDelete(apiKey.id)}
                          className="group relative overflow-hidden px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm text-red-300 hover:text-white transition-all border border-red-500/20 bg-red-500/10 hover:bg-red-500/20"
                        >
                          <span className="relative z-10">Deletar</span>
                          <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      </div>
                    </div>

                    <div className="glass-panel rounded-xl sm:rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6 border border-white/10">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-4 gap-3">
                        <span className="text-xs sm:text-sm font-semibold text-gray-300 uppercase tracking-wider">API Key</span>
                        <button
                          onClick={() => copyToClipboard(apiKey.key)}
                          className="group relative overflow-hidden px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm text-indigo-400 hover:text-indigo-300 transition-all border border-indigo-500/20 bg-indigo-500/10 hover:bg-indigo-500/20"
                        >
                          <span className="relative z-10 flex items-center gap-1 sm:gap-2">📋 Copiar</span>
                          <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      </div>
                      <code className="block w-full bg-black/40 border border-white/20 rounded-lg sm:rounded-xl p-3 sm:p-4 text-white font-mono text-xs sm:text-sm break-all">
                        {apiKey.key}
                      </code>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-4 sm:mb-6">
                      <div className="glass-panel rounded-lg sm:rounded-xl p-3 sm:p-4 border border-white/10">
                        <p className="text-gray-400 text-xs mb-1 sm:mb-2 uppercase tracking-wider">Gerações</p>
                        <p className="text-white font-bold text-base sm:text-xl mb-2 sm:mb-3">
                          {apiKey.usedGenerations} / {apiKey.monthlyGenerations}
                        </p>
                        <div className="w-full bg-white/10 rounded-full h-1.5 sm:h-2">
                          <div 
                            className="bg-gradient-to-r from-indigo-500 to-purple-500 h-1.5 sm:h-2 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min((apiKey.usedGenerations / apiKey.monthlyGenerations) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                      
                      <div className="glass-panel rounded-lg sm:rounded-xl p-3 sm:p-4 border border-white/10">
                        <p className="text-gray-400 text-xs mb-1 sm:mb-2 uppercase tracking-wider">Rate Limit</p>
                        <p className="text-white font-bold text-base sm:text-xl">{apiKey.rateLimit}</p>
                        <p className="text-gray-400 text-xs">req/min</p>
                      </div>
                      
                      <div className="glass-panel rounded-lg sm:rounded-xl p-3 sm:p-4 border border-white/10">
                        <p className="text-gray-400 text-xs mb-1 sm:mb-2 uppercase tracking-wider">Criada em</p>
                        <p className="text-white font-bold text-xs sm:text-sm">
                          {new Date(apiKey.createdAt).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>

                    <div className="glass-panel rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-white/10">
                      <p className="text-xs sm:text-sm font-semibold text-gray-300 mb-3 sm:mb-4 uppercase tracking-wider">Exemplo de Uso</p>
                      <code className="block w-full bg-black/40 border border-white/20 rounded-lg sm:rounded-xl p-3 sm:p-4 text-emerald-400 font-mono text-xs sm:text-sm overflow-x-auto">
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
          
          @media (max-width: 640px) {
            .glass-card {
              backdrop-filter: blur(15px);
              background: rgba(25, 25, 25, 0.4);
            }
            
            .glass-panel {
              backdrop-filter: blur(8px);
              background: rgba(25, 25, 25, 0.3);
            }
          }
          
          /* Touch-friendly improvements */
          @media (hover: none) and (pointer: coarse) {
            .group:hover {
              transform: none !important;
            }
            
            button:active {
              transform: scale(0.98);
            }
          }
        `}</style>
      </div>
  )
}