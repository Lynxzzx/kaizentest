import { useEffect, useState, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n-helper'
import { useTheme } from '@/contexts/ThemeContext'
import { getThemeClasses } from '@/lib/theme-utils'
import axios from 'axios'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'

interface ServicePlanRule {
  planId: string
  plan?: {
    id: string
    name: string
    price: number
  } | null
}

interface Service {
  id: string
  name: string
  description: string
  icon: string
  allowedPlans?: ServicePlanRule[]
  _count: {
    stocks: number
  }
}

interface Plan {
  id: string
  name: string
  description: string
  price: number
  duration: number
  maxGenerations: number
}

interface UserPlan {
  plan: Plan | null
  planExpiresAt: Date | null
  affiliateCode: string | null
}

// 🛡️ COOLDOWN TOTAL EM SEGUNDOS (deve corresponder ao backend)
const COOLDOWN_SECONDS = 120

export default function Dashboard() {
  const { t, translatePlanName } = useTranslation()
  const { data: session, status } = useSession()
  const { theme } = useTheme()
  const router = useRouter()
  const [services, setServices] = useState<Service[]>([])
  const [userPlan, setUserPlan] = useState<UserPlan | null>(null)
  const [selectedService, setSelectedService] = useState<string>('')
  const [generatedAccount, setGeneratedAccount] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })

  // 📜 HISTÓRICO DE CONTAS
  const [accountHistory, setAccountHistory] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyPagination, setHistoryPagination] = useState<any>(null)
  const [showHistory, setShowHistory] = useState(false)

  // 🛡️ COOLDOWN STATE
  const [cooldownRemaining, setCooldownRemaining] = useState(0)
  const cooldownIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // 🔐 CAPTCHA de digitação (somente para geração)
  const [captchaId, setCaptchaId] = useState<string | null>(null)
  const [captchaImage, setCaptchaImage] = useState<string | null>(null)
  const [captchaInput, setCaptchaInput] = useState<string>('')
  const [showCaptchaModal, setShowCaptchaModal] = useState(false)

  const requiresPaidPlan = (service: Service) => (service.allowedPlans?.length ?? 0) > 0

  const canAccessService = (service: Service) => {
    if (!requiresPaidPlan(service)) {
      return true
    }
    if (!userPlan?.plan) {
      return false
    }
    return service.allowedPlans?.some((access) => access.planId === userPlan.plan!.id) ?? false
  }

  // 🛡️ FORMATAR TEMPO DE COOLDOWN
  const formatCooldown = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // 🛡️ INICIAR TIMER DE COOLDOWN
  const startCooldownTimer = useCallback((seconds: number) => {
    // Limpar timer anterior se existir
    if (cooldownIntervalRef.current) {
      clearInterval(cooldownIntervalRef.current)
    }

    setCooldownRemaining(seconds)

    cooldownIntervalRef.current = setInterval(() => {
      setCooldownRemaining(prev => {
        if (prev <= 1) {
          if (cooldownIntervalRef.current) {
            clearInterval(cooldownIntervalRef.current)
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  // 🛡️ VERIFICAR COOLDOWN AO CARREGAR
  const checkCooldown = useCallback(async () => {
    try {
      const response = await axios.get('/api/accounts/cooldown')
      if (response.data.cooldownRemaining > 0) {
        startCooldownTimer(response.data.cooldownRemaining)
      }
    } catch (error) {
      // Ignorar erro (API pode não existir ainda)
    }
  }, [startCooldownTimer])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [session, status, router])

  useEffect(() => {
    if (session) {
      loadServices()
      loadUserPlan()
      checkCooldown()
      loadAccountHistory(1)
    }

    // Limpar timer ao desmontar
    return () => {
      if (cooldownIntervalRef.current) {
        clearInterval(cooldownIntervalRef.current)
      }
    }
  }, [session, checkCooldown])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY })
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  const loadServices = async () => {
    try {
      // Adicionar timestamp para evitar cache
      const response = await axios.get(`/api/services?_t=${Date.now()}`)
      setServices(response.data)
    } catch (error) {
      toast.error(t('errorLoadingServices'))
    }
  }

  const loadUserPlan = async () => {
    try {
      const response = await axios.get('/api/users/me')
      setUserPlan({
        plan: response.data.plan,
        planExpiresAt: response.data.planExpiresAt ? new Date(response.data.planExpiresAt) : null,
        affiliateCode: response.data.affiliateCode || null
      })
    } catch (error) {
      console.error('Error loading user plan')
    }
  }

  const loadAccountHistory = async (page: number = 1) => {
    setHistoryLoading(true)
    try {
      const response = await axios.get(`/api/accounts/history?page=${page}&limit=20`)
      setAccountHistory(response.data.accounts)
      setHistoryPagination(response.data.pagination)
      setHistoryPage(page)
    } catch (error) {
      console.error('Error loading account history:', error)
      toast.error('Erro ao carregar histórico')
    } finally {
      setHistoryLoading(false)
    }
  }

  const copyAffiliateLink = (code: string) => {
    const link = `${typeof window !== 'undefined' ? window.location.origin : ''}/register?ref=${code}`
    navigator.clipboard.writeText(link)
    toast.success(t('affiliateLinkCopied'))
  }

  const getAffiliateLink = (code: string) => {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/register?ref=${code}`
  }

  const handleGenerateAccount = async () => {
    if (!selectedService) {
      toast.error(t('selectService'))
      return
    }

    // 🛡️ VERIFICAR COOLDOWN NO FRONTEND
    if (cooldownRemaining > 0) {
      toast.error(`Aguarde ${formatCooldown(cooldownRemaining)} antes de gerar novamente.`)
      return
    }

    const service = services.find((item) => item.id === selectedService)
    if (!service) {
      toast.error(t('errorLoadingServices'))
      return
    }

    if (!canAccessService(service)) {
      toast.error('Este serviço é exclusivo para assinantes de planos pagos. Faça um upgrade para continuar.')
      router.push('/plans')
      return
    }

    setLoading(true)

    try {
      // Abrir CAPTCHA antes de enviar
      if (!captchaId || !captchaImage) {
        const { data } = await axios.get('/api/auth/captcha')
        setCaptchaId(data.id)
        setCaptchaImage(data.image)
        setCaptchaInput('')
        setShowCaptchaModal(true)
        setLoading(false)
        return
      }

      // Enviar geração com CAPTCHA
      const response = await axios.post('/api/accounts/generate', {
        serviceId: selectedService,
        captchaId,
        captchaCode: captchaInput
      })

      setGeneratedAccount(response.data)
      toast.success(t('accountGeneratedSuccess'))
      loadUserPlan()
      loadAccountHistory(1) // Recarregar histórico após gerar conta
      setCaptchaId(null)
      setCaptchaImage(null)
      setCaptchaInput('')
      setShowCaptchaModal(false)

      // 🛡️ INICIAR COOLDOWN APÓS GERAÇÃO BEM-SUCEDIDA
      if (response.data.cooldown?.seconds) {
        startCooldownTimer(response.data.cooldown.seconds)
      } else {
        // Se não receber do backend, usar valor padrão
        startCooldownTimer(COOLDOWN_SECONDS)
      }
    } catch (error: any) {
      const errorData = error.response?.data

      // Em caso de erro, solicitar novo CAPTCHA
      setCaptchaId(null)
      setCaptchaImage(null)
      setCaptchaInput('')

      // 🛡️ SE RECEBER COOLDOWN NA RESPOSTA DE ERRO
      if (errorData?.cooldownRemaining) {
        startCooldownTimer(errorData.cooldownRemaining)
      }

      toast.error(errorData?.error || t('errorGeneratingAccount'))
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
          <p className="mt-4 text-gray-500">{t('loading')}</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
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
                {session.user.username?.charAt(0).toUpperCase()}
              </div>
            </div>
            <div>
              <h1 className="font-bold text-xl text-white">{t('welcome')}, {session.user.username}</h1>
              <p className="text-sm text-gray-400">Painel de Controle</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/plans" className="group relative overflow-hidden px-6 py-2.5 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold hover:shadow-lg hover:shadow-indigo-500/50 transition-all duration-300">
              <span className="relative z-10">💎 Planos</span>
              <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </Link>
            <Link href="/profile" className="group relative overflow-hidden px-6 py-2.5 rounded-full glass-panel border border-white/20 hover:bg-white/5 transition-all duration-300">
              <span className="relative z-10">👤 Perfil</span>
              <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </Link>
          </div>
        </div>
      </nav>

      <main className="relative z-10 pt-32 pb-24 px-6">
        <div className="max-w-7xl mx-auto">
          
          {/* Hero Stats Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="glass-card p-8 rounded-3xl border border-white/10 hover:border-indigo-500/30 transition-all duration-500 hover:-translate-y-1">
              <div className="flex items-center justify-between mb-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center text-2xl">
                  📋
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-white">
                    {userPlan?.plan ? 'Premium' : 'Grátis'}
                  </div>
                  <div className="text-sm text-gray-400">Plano Atual</div>
                </div>
              </div>
              {userPlan?.plan ? (
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Plano</span>
                    <span className="font-semibold text-white">{translatePlanName ? translatePlanName(userPlan.plan.name) : userPlan.plan.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Expira</span>
                    <span className="font-semibold text-white">
                      {userPlan.planExpiresAt
                        ? format(new Date(userPlan.planExpiresAt), "dd/MM/yyyy", { locale: ptBR })
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <div className="text-2xl mb-2">🆓</div>
                  <p className="text-gray-400 text-sm mb-4">Plano gratuito ativo</p>
                  <Link href="/plans" className="text-indigo-400 hover:text-indigo-300 text-sm font-semibold">
                    Ver planos →
                  </Link>
                </div>
              )}
            </div>

            <div className="glass-card p-8 rounded-3xl border border-white/10 hover:border-purple-500/30 transition-all duration-500 hover:-translate-y-1">
              <div className="flex items-center justify-between mb-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-2xl">
                  ⚡
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-white">
                    {services.filter(s => s._count.stocks > 0).length}
                  </div>
                  <div className="text-sm text-gray-400">Serviços Ativos</div>
                </div>
              </div>
              <div className="space-y-2">
                {services.slice(0, 3).map((service) => (
                  <div key={service.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-400 flex items-center gap-2">
                      <span>{service.icon || '⚡'}</span>
                      {service.name}
                    </span>
                    <span className={`font-semibold ${service._count.stocks > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {service._count.stocks}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card p-8 rounded-3xl border border-white/10 hover:border-pink-500/30 transition-all duration-500 hover:-translate-y-1">
              <div className="flex items-center justify-between mb-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 flex items-center justify-center text-2xl">
                  🎯
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-white">
                    {userPlan?.plan?.maxGenerations === 0 ? '∞' : (userPlan?.plan?.maxGenerations || '2')}
                  </div>
                  <div className="text-sm text-gray-400">Gerações Disponíveis</div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Usadas</span>
                  <span className="font-semibold text-white">{accountHistory.length}</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min((accountHistory.length / (userPlan?.plan?.maxGenerations || 2)) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Main Generator Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            
            {/* Account Generator */}
            <div className="glass-card rounded-3xl p-8 border border-white/10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 blur-[100px]" />
              
              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-2xl">
                    ⚡
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-white mb-2">Gerador de Contas</h2>
                    <p className="text-gray-400">Gere contas premium instantaneamente</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">
                      Selecione o Serviço
                    </label>
                    <div className="relative">
                      <select
                        value={selectedService}
                        onChange={(e) => setSelectedService(e.target.value)}
                        className="w-full bg-black/40 border border-white/20 rounded-2xl px-6 py-4 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all appearance-none text-lg"
                      >
                        <option value="">Escolha um serviço...</option>
                        {services
                          .filter((service) => service._count.stocks > 0)
                          .map((service) => (
                            <option key={service.id} value={service.id}>
                              {service.icon || '⚡'} {service.name} • {service._count.stocks} disponíveis {requiresPaidPlan(service) ? '🔒' : ''}
                            </option>
                          ))}
                      </select>
                      <div className="absolute right-6 top-1/2 transform -translate-y-1/2 pointer-events-none">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                    {selectedService && (() => {
                      const chosen = services.find((service) => service.id === selectedService)
                      if (!chosen || !requiresPaidPlan(chosen)) return null
                      const hasAccess = canAccessService(chosen)
                      return hasAccess ? (
                        <p className="text-sm text-emerald-400 mt-3 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                          ✓ Serviço liberado no seu plano
                        </p>
                      ) : (
                        <p className="text-sm text-red-400 mt-3 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-red-400"></span>
                          🔒 Serviço exclusivo para planos pagos
                        </p>
                      )
                    })()}
                  </div>

                  {/* Enhanced Cooldown Timer */}
                  {cooldownRemaining > 0 && (
                    <div className="p-6 rounded-2xl bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20 animate-pulse">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <span className="text-orange-400 text-2xl">⏳</span>
                          <span className="text-orange-200 font-bold text-lg">Aguarde {formatCooldown(cooldownRemaining)}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-orange-300">Cooldown ativo</div>
                          <div className="text-xs text-orange-400">Proteção anti-spam</div>
                        </div>
                      </div>
                      <div className="h-3 w-full bg-orange-500/20 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-1000 ease-linear"
                          style={{ width: `${((COOLDOWN_SECONDS - cooldownRemaining) / COOLDOWN_SECONDS) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleGenerateAccount}
                    disabled={loading || !selectedService || cooldownRemaining > 0}
                    className={`w-full py-5 rounded-2xl font-bold text-lg transition-all transform active:scale-[0.98] ${cooldownRemaining > 0
                      ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white hover:shadow-2xl hover:shadow-purple-500/50'
                      }`}
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-3">
                        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Gerando conta...
                      </span>
                    ) : cooldownRemaining > 0 ? (
                      <span className="flex items-center justify-center gap-3">
                        <div className="w-6 h-6 border-2 border-gray-600 rounded-full" />
                        Aguarde o tempo...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-3">
                        <span className="text-2xl">⚡</span>
                        Gerar Conta Premium
                      </span>
                    )}
                  </button>

                  {!userPlan?.plan && (
                    <div className="glass-panel rounded-2xl p-6 border border-white/10">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-gray-300 font-semibold">Plano Gratuito</p>
                          <p className="text-sm text-gray-500">2 gerações diárias</p>
                        </div>
                        <Link href="/plans" className="text-indigo-400 hover:text-indigo-300 font-semibold text-sm">
                          Ver planos →
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Generated Account Display */}
            <div className="glass-card rounded-3xl p-8 border border-white/10">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center text-2xl">
                  ✅
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">Conta Gerada</h2>
                  <p className="text-gray-400">Dados de acesso gerados</p>
                </div>
              </div>

              {generatedAccount ? (
                <div className="space-y-6 animate-fade-in">
                  <div className="space-y-4">
                    <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
                      <label className="block text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">
                        Email/Usuário
                      </label>
                      <div className="flex items-center gap-4">
                        <code className="flex-1 font-mono text-lg text-white bg-black/40 px-4 py-3 rounded-xl border border-white/10">
                          {generatedAccount.email || generatedAccount.username}
                        </code>
                        <button
                          onClick={() => {
                            const val = generatedAccount.email || generatedAccount.username
                            navigator.clipboard.writeText(val)
                            toast.success('Email copiado!')
                          }}
                          className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-gray-400 hover:text-white transition-all"
                        >
                          📋
                        </button>
                      </div>
                    </div>

                    <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
                      <label className="block text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">
                        Senha
                      </label>
                      <div className="flex items-center gap-4">
                        <code className="flex-1 font-mono text-lg text-white bg-black/40 px-4 py-3 rounded-xl border border-white/10">
                          {generatedAccount.password}
                        </code>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(generatedAccount.password)
                            toast.success('Senha copiada!')
                          }}
                          className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-gray-400 hover:text-white transition-all"
                        >
                          📋
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20">
                    <label className="block text-sm font-semibold text-emerald-300 mb-3 uppercase tracking-wider">
                      Formato Completo
                    </label>
                    <code className="block w-full font-mono text-emerald-300 text-center break-all select-all bg-black/40 px-4 py-3 rounded-xl border border-emerald-500/20">
                      {generatedAccount.email || generatedAccount.username}:{generatedAccount.password}
                    </code>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-6xl mb-6 opacity-50">⚡</div>
                  <p className="text-gray-400 text-lg mb-2">Nenhuma conta gerada ainda</p>
                  <p className="text-gray-500 text-sm">Selecione um serviço e clique em gerar</p>
                </div>
              )}
            </div>
          </div>

          {/* Account History */}
          <div className="glass-card rounded-3xl p-8 border border-white/10 mb-12">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-2xl">
                  📜
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">Histórico de Contas</h2>
                  <p className="text-gray-400">Suas gerações recentes</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowHistory(!showHistory)
                  if (!showHistory && accountHistory.length === 0) {
                    loadAccountHistory(1)
                  }
                }}
                className={`group relative overflow-hidden px-6 py-3 rounded-2xl font-bold transition-all duration-300 ${showHistory
                  ? 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20'
                  : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20'
                  }`}
              >
                <span className="relative z-10">{showHistory ? 'Ocultar' : 'Ver Histórico'}</span>
                <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </button>
            </div>

            {showHistory && (
              <div className="animate-fade-in">
                {historyLoading ? (
                  <div className="text-center py-16">
                    <div className="inline-block w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <p className="mt-6 text-gray-500 text-lg">Carregando histórico...</p>
                  </div>
                ) : accountHistory.length === 0 ? (
                  <div className="text-center py-16 text-gray-500">
                    <div className="text-7xl mb-6">📭</div>
                    <p className="text-xl mb-2">Nenhuma conta gerada ainda</p>
                    <p className="text-gray-400">Suas gerações aparecerão aqui</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="max-h-[600px] overflow-y-auto pr-4 custom-scrollbar space-y-4">
                      {accountHistory.map((account) => (
                        <div
                          key={account.id}
                          className="group p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300"
                        >
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-xl">
                                {account.service?.icon || '⚡'}
                              </div>
                              <div>
                                <h4 className="font-bold text-white text-lg mb-1">
                                  {account.service?.name || 'Serviço desconhecido'}
                                </h4>
                                <p className="text-sm text-gray-400">
                                  {format(new Date(account.createdAt), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-col gap-3 min-w-[250px]">
                              <div className="flex items-center gap-3 bg-black/40 p-3 rounded-xl border border-white/10">
                                <span className="text-xs text-gray-500 font-mono">USER:</span>
                                <code className="text-sm font-mono text-emerald-400 flex-1 truncate">{account.username}</code>
                                <button
                                  onClick={() => { navigator.clipboard.writeText(account.username); toast.success('Copiado!') }}
                                  className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                                >
                                  📋
                                </button>
                              </div>
                              {account.password && (
                                <div className="flex items-center gap-3 bg-black/40 p-3 rounded-xl border border-white/10">
                                  <span className="text-xs text-gray-500 font-mono">PASS:</span>
                                  <code className="text-sm font-mono text-emerald-400 flex-1 truncate">{account.password}</code>
                                  <button
                                    onClick={() => { navigator.clipboard.writeText(account.password); toast.success('Copiado!') }}
                                    className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                                  >
                                    📋
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Enhanced Pagination */}
                    {historyPagination && (historyPagination.hasPrev || historyPagination.hasNext) && (
                      <div className="flex justify-center gap-6 mt-8 pt-6 border-t border-white/10">
                        <button
                          onClick={() => loadAccountHistory(historyPage - 1)}
                          disabled={!historyPagination.hasPrev || historyLoading}
                          className="group relative overflow-hidden px-6 py-3 rounded-2xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed font-semibold transition-all"
                        >
                          <span className="relative z-10 flex items-center gap-2">
                            ← Anterior
                          </span>
                          <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                        <span className="px-6 py-3 text-white font-semibold bg-white/10 rounded-2xl">
                          Pág {historyPage} de {historyPagination.totalPages}
                        </span>
                        <button
                          onClick={() => loadAccountHistory(historyPage + 1)}
                          disabled={!historyPagination.hasNext || historyLoading}
                          className="group relative overflow-hidden px-6 py-3 rounded-2xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed font-semibold transition-all"
                        >
                          <span className="relative z-10 flex items-center gap-2">
                            Próxima →
                          </span>
                          <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Affiliate Section */}
          {userPlan?.affiliateCode && (
            <div className="glass-card rounded-3xl p-8 border border-white/10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-pink-500/20 to-purple-500/20 blur-[150px]" />
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-500 flex items-center justify-center text-2xl">
                      🎁
                    </div>
                    <div>
                      <h2 className="text-3xl font-bold text-white mb-2">Programa de Afiliados</h2>
                      <p className="text-gray-400">Compartilhe e ganhe comissões</p>
                    </div>
                  </div>
                  <Link
                    href="/affiliate"
                    className="group relative overflow-hidden px-6 py-3 rounded-2xl bg-gradient-to-r from-pink-600 to-purple-600 text-white font-semibold hover:shadow-lg hover:shadow-pink-500/50 transition-all duration-300"
                  >
                    <span className="relative z-10">Ver Estatísticas →</span>
                    <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </Link>
                </div>

                <div className="bg-black/40 border border-white/10 rounded-2xl p-6 mb-6">
                  <p className="text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wider">Seu Link de Afiliado</p>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-xl px-4 py-3 font-mono text-sm text-gray-300 truncate">
                      {getAffiliateLink(userPlan.affiliateCode!)}
                    </div>
                    <button
                      onClick={() => copyAffiliateLink(userPlan.affiliateCode!)}
                      className="group relative overflow-hidden px-6 py-3 bg-gradient-to-r from-pink-600 to-purple-600 rounded-xl font-bold text-white hover:shadow-lg hover:shadow-pink-500/20 transition-all"
                    >
                      <span className="relative z-10">📋 Copiar</span>
                      <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="glass-panel rounded-xl p-6 border border-white/10 text-center">
                    <div className="text-2xl mb-3">💰</div>
                    <div className="text-2xl font-bold text-white mb-1">40%</div>
                    <div className="text-sm text-gray-400">Comissão Normal</div>
                  </div>
                  <div className="glass-panel rounded-xl p-6 border border-white/10 text-center">
                    <div className="text-2xl mb-3">👑</div>
                    <div className="text-2xl font-bold text-white mb-1">50%</div>
                    <div className="text-sm text-gray-400">Comissão Co-Owner</div>
                  </div>
                  <div className="glass-panel rounded-xl p-6 border border-white/10 text-center">
                    <div className="text-2xl mb-3">⚡</div>
                    <div className="text-2xl font-bold text-white mb-1">Instantâneo</div>
                    <div className="text-sm text-gray-400">Pagamento</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Enhanced Captcha Modal */}
      <CaptchaModal
        open={showCaptchaModal}
        image={captchaImage}
        value={captchaInput}
        onChange={setCaptchaInput}
        onRefresh={async () => {
          try {
            const { data } = await axios.get('/api/auth/captcha')
            setCaptchaId(data.id)
            setCaptchaImage(data.image)
            setCaptchaInput('')
          } catch {
            toast.error('Erro ao atualizar CAPTCHA. Tente novamente.')
          }
        }}
        onConfirm={handleGenerateAccount}
        onClose={() => {
          setShowCaptchaModal(false)
          setCaptchaId(null)
          setCaptchaImage(null)
          setCaptchaInput('')
        }}
      />

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
        
        .animate-fade-in {
          animation: fadeIn 0.5s ease-out;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 3px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 3px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      `}</style>
    </div>
  )
}

function CaptchaModal({
  open,
  image,
  value,
  onChange,
  onRefresh,
  onConfirm,
  onClose
}: {
  open: boolean
  image: string | null
  value: string
  onChange: (v: string) => void
  onRefresh: () => void
  onConfirm: () => void
  onClose: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[#0a0a0a] border border-white/20 rounded-3xl p-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-white">Verificação de Segurança</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl transition-colors"
            >
              ×
            </button>
          </div>
          
          <p className="text-gray-400 mb-6">Digite os caracteres exibidos para continuar a geração.</p>
          
          <div className="flex items-center gap-4 mb-6">
            {image ? (
              <img src={image} alt="CAPTCHA" className="rounded-2xl border border-white/20 bg-white/5" />
            ) : (
              <div className="w-[200px] h-[60px] rounded-2xl bg-white/10 animate-pulse" />
            )}
            <button
              onClick={onRefresh}
              className="group relative overflow-hidden px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold transition-all"
            >
              <span className="relative z-10">🔄 Atualizar</span>
              <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </div>
          
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-black/40 border border-white/20 rounded-2xl px-6 py-4 text-white text-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all mb-6"
            placeholder="Digite os caracteres (A-Z, 2-9)"
          />
          
          <div className="flex justify-end gap-4">
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-semibold transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold hover:shadow-lg hover:shadow-indigo-500/50 transition-all"
            >
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}