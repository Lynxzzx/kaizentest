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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

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
      {/* Advanced Background with Mouse Tracking - Hidden on Mobile */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute w-[1200px] h-[800px] bg-[radial-gradient(circle,rgba(79,70,229,0.15)_0%,transparent_70%)] blur-[150px] transition-all duration-1000 ease-out hidden sm:block"
          style={{
            transform: `translate(${(mousePosition.x - 600) * 0.02}px, ${(mousePosition.y - 400) * 0.02}px)`,
            left: `${mousePosition.x - 600}px`,
            top: `${mousePosition.y - 400}px`
          }}
        />
        <div
          className="absolute w-[1000px] h-[600px] bg-[radial-gradient(circle,rgba(236,72,153,0.1)_0%,transparent_70%)] blur-[120px] transition-all duration-1000 ease-out hidden sm:block"
          style={{
            transform: `translate(${(mousePosition.x - 500) * -0.01}px, ${(mousePosition.y - 300) * -0.01}px)`,
            right: `${500 - mousePosition.x}px`,
            bottom: `${300 - mousePosition.y}px`
          }}
        />
        <div
          className="absolute w-[800px] h-[800px] bg-[radial-gradient(circle,rgba(59,130,246,0.08)_0%,transparent_70%)] blur-[100px] transition-all duration-1000 ease-out hidden sm:block"
          style={{
            transform: `translate(${(mousePosition.x - 400) * 0.015}px, ${(mousePosition.y - 400) * 0.015}px)`,
            left: `${mousePosition.x * 0.1}px`,
            bottom: `${mousePosition.y * 0.1}px`
          }}
        />
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />

        {/* Floating particles effect - Hidden on Mobile */}
        <div className="absolute inset-0">
          {[...Array(30)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white/15 rounded-full animate-float hidden sm:block"
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

      {/* Mobile-Optimized Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/10 bg-black/20 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg blur-sm opacity-75 group-hover:opacity-100 transition-opacity" />
              <div className="w-10 sm:w-12 h-10 sm:h-12 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-lg sm:text-xl font-bold text-white relative">
                {session.user.username?.charAt(0).toUpperCase()}
              </div>
            </div>
            <div className="hidden sm:block">
              <h1 className="font-bold text-lg sm:text-xl text-white">{t('welcome')}, {session.user.username}</h1>
              <p className="text-xs sm:text-sm text-gray-400">Painel de Controle</p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden sm:flex items-center gap-3">
            <Link href="/plans" className="group relative overflow-hidden px-4 sm:px-6 py-2.5 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold hover:shadow-lg hover:shadow-indigo-500/50 transition-all duration-300">
              <span className="relative z-10">💎 Planos</span>
              <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </Link>
            <Link href="/profile" className="group relative overflow-hidden px-4 sm:px-6 py-2.5 rounded-full glass-panel border border-white/20 hover:bg-white/5 transition-all duration-300">
              <span className="relative z-10">👤 Perfil</span>
              <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="sm:hidden p-2 rounded-lg glass-panel border border-white/10"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <div className="w-6 h-6 flex flex-col justify-center items-center">
              <span className={`bg-white block transition-all duration-300 ease-out h-0.5 w-6 rounded-sm ${isMobileMenuOpen ? 'rotate-45 translate-y-1' : '-translate-y-0.5'}`}></span>
              <span className={`bg-white block transition-all duration-300 ease-out h-0.5 w-6 rounded-sm my-0.5 ${isMobileMenuOpen ? 'opacity-0' : 'opacity-100'}`}></span>
              <span className={`bg-white block transition-all duration-300 ease-out h-0.5 w-6 rounded-sm ${isMobileMenuOpen ? '-rotate-45 -translate-y-1' : 'translate-y-0.5'}`}></span>
            </div>
          </button>
        </div>

        {/* Mobile Menu */}
        <div className={`sm:hidden absolute top-16 left-0 right-0 bg-black/95 backdrop-blur-xl border-t border-white/10 transition-all duration-300 ${isMobileMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
          <div className="p-4 space-y-3">
            <div className="glass-panel rounded-xl p-3 border border-white/10 mb-4">
              <p className="text-white font-semibold">{session.user.username}</p>
              <p className="text-gray-400 text-sm">Painel de Controle</p>
            </div>
            <Link href="/plans" className="block w-full text-center py-3 px-4 rounded-xl glass-panel border border-white/10 text-white font-medium">
              💎 Planos
            </Link>
            <Link href="/profile" className="block w-full text-center py-3 px-4 rounded-xl glass-panel border border-white/10 text-white font-medium">
              👤 Perfil
            </Link>
            <div className="pt-3 border-t border-white/10">
              <Link href="/tickets" className="block py-2 text-white/70 hover:text-white">🎫 Suporte</Link>
              <Link href="/api-keys" className="block py-2 text-white/70 hover:text-white">🔑 API Keys</Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="relative z-10 pt-20 sm:pt-32 pb-16 sm:pb-24 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">

          {/* Mobile-Optimized Hero Stats Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-12">
            <div className="glass-card p-4 sm:p-8 rounded-2xl sm:rounded-3xl border border-white/10 hover:border-indigo-500/30 transition-all duration-500 hover:-translate-y-1">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 sm:w-14 h-10 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center text-lg sm:text-2xl">
                  📋
                </div>
                <div className="text-right">
                  <div className="text-2xl sm:text-3xl font-bold text-white">
                    {userPlan?.plan ? 'Premium' : 'Grátis'}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-400">Plano Atual</div>
                </div>
              </div>
              {userPlan?.plan ? (
                <div className="space-y-3">
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-gray-400">Plano</span>
                    <span className="font-semibold text-white">{translatePlanName ? translatePlanName(userPlan.plan.name) : userPlan.plan.name}</span>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-gray-400">{userPlan.planExpiresAt ? 'Expira' : 'Validade'}</span>
                    <span className={`font-semibold ${userPlan.planExpiresAt ? 'text-white' : 'text-emerald-400'}`}>
                      {userPlan.planExpiresAt
                        ? format(new Date(userPlan.planExpiresAt), "dd/MM/yyyy", { locale: ptBR })
                        : 'Permanente ♾️'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-2">
                  <div className="text-lg sm:text-2xl mb-2">🆓</div>
                  <p className="text-gray-400 text-xs sm:text-sm mb-2">Plano gratuito ativo</p>
                  <Link href="/plans" className="text-indigo-400 hover:text-indigo-300 text-xs sm:text-sm font-semibold">
                    Ver planos →
                  </Link>
                </div>
              )}
            </div>

            <div className="glass-card p-4 sm:p-8 rounded-2xl sm:rounded-3xl border border-white/10 hover:border-purple-500/30 transition-all duration-500 hover:-translate-y-1">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 sm:w-14 h-10 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-lg sm:text-2xl">
                  ⚡
                </div>
                <div className="text-right">
                  <div className="text-2xl sm:text-3xl font-bold text-white">
                    {services.filter(s => s._count.stocks > 0).length}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-400">Serviços Ativos</div>
                </div>
              </div>
              <div className="space-y-2">
                {services.slice(0, 3).map((service) => (
                  <div key={service.id} className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="text-gray-400 flex items-center gap-1 sm:gap-2">
                      <span>{service.icon || '⚡'}</span>
                      <span className="truncate">{service.name}</span>
                    </span>
                    <span className={`font-semibold ${service._count.stocks > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {service._count.stocks}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card p-4 sm:p-8 rounded-2xl sm:rounded-3xl border border-white/10 hover:border-pink-500/30 transition-all duration-500 hover:-translate-y-1">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 sm:w-14 h-10 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 flex items-center justify-center text-lg sm:text-2xl">
                  🎯
                </div>
                <div className="text-right">
                  <div className="text-2xl sm:text-3xl font-bold text-white">
                    {userPlan?.plan?.maxGenerations === 0 ? '∞' : (userPlan?.plan?.maxGenerations || '2')}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-400">Gerações Disponíveis</div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-xs sm:text-sm">
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

          {/* Mobile-Optimized Main Generator Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 mb-8 sm:mb-12">

            {/* Account Generator */}
            <div className="glass-card rounded-2xl sm:rounded-3xl p-4 sm:p-8 border border-white/10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 sm:w-64 h-32 sm:h-64 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 blur-[50px] sm:blur-[100px]" />

              <div className="relative z-10">
                <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
                  <div className="w-10 sm:w-16 h-10 sm:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-lg sm:text-2xl">
                    ⚡
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-3xl font-bold text-white mb-1 sm:mb-2">Gerador de Contas</h2>
                    <p className="text-gray-400 text-sm sm:text-base">Gere contas premium instantaneamente</p>
                  </div>
                </div>

                <div className="space-y-4 sm:space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2 sm:mb-3 uppercase tracking-wider">
                      Selecione o Serviço
                    </label>
                    <div className="relative">
                      <select
                        value={selectedService}
                        onChange={(e) => setSelectedService(e.target.value)}
                        className="w-full bg-black/40 border border-white/20 rounded-xl sm:rounded-2xl px-4 sm:px-6 py-3 sm:py-4 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all appearance-none text-sm sm:text-lg"
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
                      <div className="absolute right-3 sm:right-6 top-1/2 transform -translate-y-1/2 pointer-events-none">
                        <svg className="w-4 sm:w-5 h-4 sm:h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                    {selectedService && (() => {
                      const chosen = services.find((service) => service.id === selectedService)
                      if (!chosen || !requiresPaidPlan(chosen)) return null
                      const hasAccess = canAccessService(chosen)
                      return hasAccess ? (
                        <p className="text-xs sm:text-sm text-emerald-400 mt-2 sm:mt-3 flex items-center gap-2">
                          <span className="w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                          ✓ Serviço liberado no seu plano
                        </p>
                      ) : (
                        <p className="text-xs sm:text-sm text-red-400 mt-2 sm:mt-3 flex items-center gap-2">
                          <span className="w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full bg-red-400"></span>
                          🔒 Serviço exclusivo para planos pagos
                        </p>
                      )
                    })()}
                  </div>

                  {/* Enhanced Cooldown Timer */}
                  {cooldownRemaining > 0 && (
                    <div className="p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20 animate-pulse">
                      <div className="flex items-center justify-between mb-3 sm:mb-4">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <span className="text-orange-400 text-lg sm:text-2xl">⏳</span>
                          <span className="text-orange-200 font-bold text-base sm:text-lg">Aguarde {formatCooldown(cooldownRemaining)}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-xs sm:text-sm text-orange-300">Cooldown ativo</div>
                          <div className="text-xs text-orange-400">Proteção anti-spam</div>
                        </div>
                      </div>
                      <div className="h-2 sm:h-3 w-full bg-orange-500/20 rounded-full overflow-hidden">
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
                    className={`w-full py-3 sm:py-5 rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg transition-all transform active:scale-[0.98] ${cooldownRemaining > 0
                      ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white hover:shadow-2xl hover:shadow-purple-500/50'
                      }`}
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2 sm:gap-3">
                        <div className="w-4 sm:w-6 h-4 sm:h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Gerando conta...
                      </span>
                    ) : cooldownRemaining > 0 ? (
                      <span className="flex items-center justify-center gap-2 sm:gap-3">
                        <div className="w-4 sm:w-6 h-4 sm:h-6 border-2 border-gray-600 rounded-full" />
                        Aguarde o tempo...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2 sm:gap-3">
                        <span className="text-lg sm:text-2xl">⚡</span>
                        Gerar Conta Premium
                      </span>
                    )}
                  </button>

                  {!userPlan?.plan && (
                    <div className="glass-panel rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-white/10">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-gray-300 font-semibold text-sm sm:text-base">Plano Gratuito</p>
                          <p className="text-gray-500 text-xs sm:text-sm">2 gerações diárias</p>
                        </div>
                        <Link href="/plans" className="text-indigo-400 hover:text-indigo-300 font-semibold text-xs sm:text-sm">
                          Ver planos →
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Generated Account Display */}
            <div className="glass-card rounded-2xl sm:rounded-3xl p-4 sm:p-8 border border-white/10">
              <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
                <div className="w-10 sm:w-16 h-10 sm:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center text-lg sm:text-2xl">
                  ✅
                </div>
                <div>
                  <h2 className="text-xl sm:text-3xl font-bold text-white mb-1 sm:mb-2">Conta Gerada</h2>
                  <p className="text-gray-400 text-sm sm:text-base">Dados de acesso gerados</p>
                </div>
              </div>

              {generatedAccount ? (
                <div className="space-y-4 sm:space-y-6 animate-fade-in">
                  <div className="space-y-3 sm:space-y-4">
                    <div className="p-3 sm:p-5 rounded-lg sm:rounded-xl bg-white/5 border border-white/10">
                      <label className="block text-xs sm:text-sm font-semibold text-gray-300 mb-2 sm:mb-3 uppercase tracking-wider">
                        Email/Usuário
                      </label>
                      <div className="flex items-center gap-2 sm:gap-4">
                        <code className="flex-1 font-mono text-base sm:text-lg text-white bg-black/40 px-3 sm:px-4 py-2 sm:py-3 rounded-lg sm:rounded-xl border border-white/10 text-xs sm:text-sm">
                          {generatedAccount.email || generatedAccount.username}
                        </code>
                        <button
                          onClick={() => {
                            const val = generatedAccount.email || generatedAccount.username
                            navigator.clipboard.writeText(val)
                            toast.success('Email copiado!')
                          }}
                          className="p-2 sm:p-3 bg-white/10 hover:bg-white/20 rounded-lg sm:rounded-xl text-gray-400 hover:text-white transition-colors"
                        >
                          📋
                        </button>
                      </div>
                    </div>

                    <div className="p-3 sm:p-5 rounded-lg sm:rounded-xl bg-white/5 border border-white/10">
                      <label className="block text-xs sm:text-sm font-semibold text-gray-300 mb-2 sm:mb-3 uppercase tracking-wider">
                        Senha
                      </label>
                      <div className="flex items-center gap-2 sm:gap-4">
                        <code className="flex-1 font-mono text-base sm:text-lg text-white bg-black/40 px-3 sm:px-4 py-2 sm:py-3 rounded-lg sm:rounded-xl border border-white/10 text-xs sm:text-sm">
                          {generatedAccount.password}
                        </code>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(generatedAccount.password)
                            toast.success('Senha copiada!')
                          }}
                          className="p-2 sm:p-3 bg-white/10 hover:bg-white/20 rounded-lg sm:rounded-xl text-gray-400 hover:text-white transition-colors"
                        >
                          📋
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 sm:p-5 rounded-lg sm:rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20">
                    <label className="block text-xs sm:text-sm font-semibold text-emerald-300 mb-2 sm:mb-3 uppercase tracking-wider">
                      Formato Completo
                    </label>
                    <code className="block w-full font-mono text-emerald-300 text-center break-all select-all bg-black/40 px-3 sm:px-4 py-2 sm:py-3 rounded-lg sm:rounded-xl border border-emerald-500/20 text-xs sm:text-sm">
                      {generatedAccount.email || generatedAccount.username}:{generatedAccount.password}
                    </code>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 sm:py-12">
                  <div className="text-4xl sm:text-6xl mb-4 sm:mb-6 opacity-50">⚡</div>
                  <p className="text-gray-400 text-sm sm:text-lg mb-2">Nenhuma conta gerada ainda</p>
                  <p className="text-gray-500 text-xs sm:text-sm">Selecione um serviço e clique em gerar</p>
                </div>
              )}
            </div>
          </div>

          {/* Account History - Mobile Optimized */}
          <div className="glass-card rounded-2xl sm:rounded-3xl p-4 sm:p-8 border border-white/10 mb-8 sm:mb-12">
            <div className="flex items-center justify-between mb-6 sm:mb-8">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 sm:w-16 h-10 sm:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-lg sm:text-2xl">
                  📜
                </div>
                <div>
                  <h2 className="text-xl sm:text-3xl font-bold text-white mb-1 sm:mb-2">Histórico de Contas</h2>
                  <p className="text-gray-400 text-sm sm:text-base">Suas gerações recentes</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowHistory(!showHistory)
                  if (!showHistory && accountHistory.length === 0) {
                    loadAccountHistory(1)
                  }
                }}
                className={`group relative overflow-hidden px-4 sm:px-6 py-2 sm:py-3 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base transition-all ${showHistory
                  ? 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20'
                  : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20'
                  }`}
              >
                <span className="relative z-10">{showHistory ? 'Ocultar' : 'Ver Histórico'}</span>
                <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </div>

            {showHistory && (
              <div className="animate-fade-in">
                {historyLoading ? (
                  <div className="text-center py-8 sm:py-12">
                    <div className="inline-block w-6 sm:w-12 h-6 sm:h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <p className="mt-4 sm:mt-6 text-gray-500 text-sm sm:text-lg">Carregando histórico...</p>
                  </div>
                ) : accountHistory.length === 0 ? (
                  <div className="text-center py-8 sm:py-12 text-gray-500">
                    <div className="text-4xl sm:text-7xl mb-4 sm:mb-6">📭</div>
                    <p className="text-sm sm:text-xl mb-2">Nenhuma conta gerada ainda</p>
                    <p className="text-gray-400 text-xs sm:text-sm">Suas gerações aparecerão aqui</p>
                  </div>
                ) : (
                  <div className="space-y-3 sm:space-y-4">
                    <div className="max-h-[400px] sm:max-h-[600px] overflow-y-auto pr-2 custom-scrollbar space-y-3 sm:space-y-4">
                      {accountHistory.map((account) => (
                        <div
                          key={account.id}
                          className="group p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300"
                        >
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6">
                            <div className="flex items-center gap-3 sm:gap-4">
                              <div className="w-8 sm:w-12 h-8 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-base sm:text-xl">
                                {account.service?.icon || '⚡'}
                              </div>
                              <div>
                                <h4 className="font-bold text-white text-sm sm:text-base mb-1">
                                  {account.service?.name || 'Serviço desconhecido'}
                                </h4>
                                <p className="text-xs sm:text-sm text-gray-400">
                                  {format(new Date(account.createdAt), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-col gap-2 sm:gap-3 min-w-[200px]">
                              <div className="flex items-center gap-2 sm:gap-3 bg-black/40 p-2 sm:p-3 rounded-lg sm:rounded-xl border border-white/10">
                                <span className="text-xs text-gray-500 font-mono">USER:</span>
                                <code className="text-xs sm:text-sm font-mono text-emerald-400 flex-1 truncate">{account.username}</code>
                                <button
                                  onClick={() => { navigator.clipboard.writeText(account.username); toast.success('Copiado!') }}
                                  className="p-1.5 sm:p-2 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                                >
                                  📋
                                </button>
                              </div>
                              {account.password && (
                                <div className="flex items-center gap-2 sm:gap-3 bg-black/40 p-2 sm:p-3 rounded-lg sm:rounded-xl border border-white/10">
                                  <span className="text-xs text-gray-500 font-mono">PASS:</span>
                                  <code className="text-xs sm:text-sm font-mono text-emerald-400 flex-1 truncate">{account.password}</code>
                                  <button
                                    onClick={() => { navigator.clipboard.writeText(account.password); toast.success('Copiado!') }}
                                    className="p-1.5 sm:p-2 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
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
                      <div className="flex justify-center gap-3 sm:gap-4 mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-white/10">
                        <button
                          onClick={() => loadAccountHistory(historyPage - 1)}
                          disabled={!historyPagination.hasPrev || historyLoading}
                          className="group relative overflow-hidden px-4 sm:px-6 py-2 sm:py-3 rounded-lg sm:rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed font-semibold text-sm transition-all"
                        >
                          <span className="relative z-10 flex items-center gap-2">← Anterior</span>
                          <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                        <span className="px-4 sm:px-6 py-2 sm:py-3 text-white font-semibold bg-white/10 rounded-lg sm:rounded-xl">
                          Pág {historyPage} de {historyPagination.totalPages}
                        </span>
                        <button
                          onClick={() => loadAccountHistory(historyPage + 1)}
                          disabled={!historyPagination.hasNext || historyLoading}
                          className="group relative overflow-hidden px-4 sm:px-6 py-2 sm:py-3 rounded-lg sm:rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed font-semibold text-sm transition-all"
                        >
                          <span className="relative z-10 flex items-center gap-2">Próxima →</span>
                          <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Affiliate Section - Mobile Optimized */}
          {userPlan?.affiliateCode && (
            <div className="glass-card rounded-2xl sm:rounded-3xl p-4 sm:p-8 border border-white/10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 sm:w-96 h-48 sm:h-96 bg-gradient-to-br from-pink-500/20 to-purple-500/20 blur-[80px] sm:blur-[150px]" />

              <div className="relative z-10">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 gap-4 sm:gap-0">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-10 sm:w-16 h-10 sm:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-r from-pink-500 to-purple-500 flex items-center justify-center text-lg sm:text-2xl">
                      🎁
                    </div>
                    <div>
                      <h2 className="text-xl sm:text-3xl font-bold text-white mb-1 sm:mb-2">Programa de Afiliados</h2>
                      <p className="text-gray-400 text-sm sm:text-base">Compartilhe e ganhe comissões</p>
                    </div>
                  </div>
                  <Link
                    href="/affiliate"
                    className="group relative overflow-hidden px-4 sm:px-6 py-2 sm:py-3 rounded-xl sm:rounded-2xl bg-gradient-to-r from-pink-600 to-purple-600 text-white font-bold hover:shadow-lg hover:shadow-pink-500/50 transition-all duration-300"
                  >
                    <span className="relative z-10">Ver Estatísticas →</span>
                    <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                </div>

                <div className="bg-black/40 border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6 mb-6">
                  <p className="text-xs sm:text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">Seu Link de Afiliado</p>
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 sm:py-3 font-mono text-xs sm:text-sm text-gray-300 truncate">
                      {getAffiliateLink(userPlan.affiliateCode!)}
                    </div>
                    <button
                      onClick={() => copyAffiliateLink(userPlan.affiliateCode!)}
                      className="group relative overflow-hidden px-3 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-pink-600 to-purple-600 rounded-lg sm:rounded-xl font-bold text-white hover:shadow-lg hover:shadow-pink-500/20 transition-all"
                    >
                      <span className="relative z-10">📋 Copiar</span>
                      <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                  <div className="glass-panel rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-white/10 text-center">
                    <div className="text-xl sm:text-2xl mb-2 sm:mb-3">💰</div>
                    <div className="text-xl sm:text-2xl font-bold text-white mb-1">40%</div>
                    <div className="text-xs sm:text-sm text-gray-400">Comissão Normal</div>
                  </div>
                  <div className="glass-panel rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-white/10 text-center">
                    <div className="text-xl sm:text-2xl mb-2 sm:mb-3">👑</div>
                    <div className="text-xl sm:text-2xl font-bold text-white mb-1">50%</div>
                    <div className="text-xs sm:text-sm text-gray-400">Comissão Co-Owner</div>
                  </div>
                  <div className="glass-panel rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-white/10 text-center">
                    <div className="text-xl sm:text-2xl mb-2 sm:mb-3">⚡</div>
                    <div className="text-xl sm:text-2xl font-bold text-white mb-1">Instantâneo</div>
                    <div className="text-xs sm:text-sm text-gray-400">Pagamento</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Enhanced Captcha Modal - Mobile Optimized */}
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
          width: 4px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 2px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 2px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
        
        /* Mobile-specific optimizations */
        @media (max-width: 640px) {
          .glass-panel {
            backdrop-filter: blur(12px);
          }
          
          .glass-card {
            backdrop-filter: blur(8px);
          }
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[#0a0a0a] border border-white/20 rounded-2xl sm:rounded-3xl p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10" />
        <div className="relative z-10">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl sm:text-2xl font-bold text-white">Verificação de Segurança</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl transition-colors">
              ×
            </button>
          </div>

          <p className="text-gray-400 mb-6 text-sm sm:text-base">Digite os caracteres exibidos para continuar a geração.</p>

          <div className="flex items-center gap-4 mb-6">
            {image ? (
              <img src={image} alt="CAPTCHA" className="rounded-lg sm:rounded-xl border border-white/10 bg-white/5" />
            ) : (
              <div className="w-[160px] sm:w-[200px] h-[60px] rounded-lg sm:rounded-xl bg-white/10 animate-pulse" />
            )}
            <button
              onClick={onRefresh}
              className="group relative overflow-hidden px-3 sm:px-4 py-2 sm:py-3 rounded-lg sm:rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold transition-all"
            >
              <span className="relative z-10">🔄</span>
              <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </div>

          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-black/40 border border-white/20 rounded-xl sm:rounded-2xl px-4 sm:px-6 py-3 sm:py-4 text-white text-sm sm:text-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all mb-6"
            placeholder="Digite os caracteres (A-Z, 2-9)"
          />

          <div className="flex gap-4">
            <button
              onClick={onClose}
              className="flex-1 group relative overflow-hidden py-3 sm:py-4 rounded-xl sm:rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-all font-semibold"
            >
              <span className="relative z-10">Cancelar</span>
              <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 group relative overflow-hidden py-3 sm:py-4 rounded-xl sm:rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold hover:shadow-lg hover:shadow-indigo-500/50 transition-all"
            >
              <span className="relative z-10">Confirmar</span>
              <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}