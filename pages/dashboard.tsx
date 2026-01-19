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
import { useReCaptcha } from '@/components/ReCaptcha'
import ReCaptcha from '@/components/ReCaptcha'

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

  // 📜 HISTÓRICO DE CONTAS
  const [accountHistory, setAccountHistory] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyPagination, setHistoryPagination] = useState<any>(null)
  const [showHistory, setShowHistory] = useState(false)

  // 🛡️ COOLDOWN STATE
  const [cooldownRemaining, setCooldownRemaining] = useState(0)
  const cooldownIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // 🛡️ Google reCAPTCHA v3 (invisível)
  const { isReady: recaptchaReady, executeRecaptcha, isConfigured: recaptchaConfigured } = useReCaptcha()
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null)

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

  const loadServices = async () => {
    try {
      const response = await axios.get('/api/services')
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

    // 🛡️ VERIFICAR reCAPTCHA v3
    if (!recaptchaConfigured) {
      toast.error('Verificação de segurança não configurada. Entre em contato com o suporte.')
      return
    }

    setLoading(true)

    try {
      // Executar reCAPTCHA v3 - aguardar se necessário
      let token = await executeRecaptcha('generate')

      // Se não obteve token e não está pronto, aguardar um pouco
      if (!token && !recaptchaReady) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        token = await executeRecaptcha('generate')
      }

      if (!token) {
        toast.error('Erro ao verificar segurança. Por favor, recarregue a página e tente novamente.')
        setLoading(false)
        return
      }
      setRecaptchaToken(token)

      // Continuar com a requisição
      const response = await axios.post('/api/accounts/generate', {
        serviceId: selectedService,
        recaptchaToken: token // 🛡️ Enviar token do reCAPTCHA v3
      })

      setGeneratedAccount(response.data)
      toast.success(t('accountGeneratedSuccess'))
      loadUserPlan()
      loadAccountHistory(1) // Recarregar histórico após gerar conta

      // 🛡️ RESETAR reCAPTCHA APÓS GERAÇÃO
      setRecaptchaToken(null)

      // 🛡️ INICIAR COOLDOWN APÓS GERAÇÃO BEM-SUCEDIDA
      if (response.data.cooldown?.seconds) {
        startCooldownTimer(response.data.cooldown.seconds)
      } else {
        // Se não receber do backend, usar valor padrão
        startCooldownTimer(COOLDOWN_SECONDS)
      }
    } catch (error: any) {
      const errorData = error.response?.data

      // 🛡️ RESETAR reCAPTCHA EM CASO DE ERRO
      setRecaptchaToken(null)

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
    <div className="min-h-screen bg-black text-gray-100 font-[Outfit] pb-20">
      {/* Background FX */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/10 blur-[100px]" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-600/10 blur-[100px]" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
      </div>

      <div className="max-w-7xl mx-auto px-6 pt-24 relative z-10">

        {/* Welcome Hero */}
        <div className="glass-panel rounded-3xl p-8 mb-8 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-transparent opacity-50" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-xl font-bold">
                  {session.user.username?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white leading-none mb-1">
                    {t('welcome')}, {session.user.username}
                  </h1>
                  <p className="text-sm text-gray-400">
                    {t('welcomeDesc') || 'Bem-vindo ao seu painel de controle.'}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <Link href="/plans" className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/20">
                💎 {t('viewPlans')}
              </Link>
              <Link href="/profile" className="px-5 py-2.5 glass-panel hover:bg-white/5 rounded-xl font-medium transition-all">
                👤 {t('myProfile')}
              </Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">

          {/* Plan Status Card */}
          <div className="glass-card rounded-3xl p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">📋</span>
                {t('myPlan')}
              </h2>
              {userPlan?.plan ? (
                <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded-full uppercase tracking-wider border border-emerald-500/20">
                  {t('active')}
                </span>
              ) : (
                <span className="px-3 py-1 bg-gray-700 text-gray-300 text-xs font-bold rounded-full uppercase tracking-wider">
                  {t('free')}
                </span>
              )}
            </div>

            {userPlan?.plan ? (
              <div className="space-y-6">
                <div className="p-5 rounded-2xl bg-indigo-500/5 border border-indigo-500/10">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
                      {translatePlanName ? translatePlanName(userPlan.plan.name) : userPlan.plan.name}
                    </h3>
                  </div>
                  <p className="text-gray-400 text-sm">{userPlan.plan.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">{t('expiresIn')}</p>
                    <p className="text-lg font-mono text-white">
                      {userPlan.planExpiresAt
                        ? format(new Date(userPlan.planExpiresAt), "dd/MM/yyyy", { locale: ptBR })
                        : 'N/A'}
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">{t('generationsLabel')}</p>
                    <p className="text-lg font-mono text-white">
                      {userPlan.plan.maxGenerations === 0 ? '∞' : userPlan.plan.maxGenerations}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-2xl bg-gray-800 mx-auto mb-4 flex items-center justify-center text-3xl">
                  🆓
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{t('freePlanLabel')}</h3>
                <p className="text-gray-400 text-sm mb-6">{t('youAreUsingFreePlan')}</p>
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 mb-6 text-left">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">{t('dailyGenerations')}</span>
                    <span className="font-bold text-white">2</span>
                  </div>
                </div>
                <Link href="/plans" className="block w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl font-bold hover:shadow-lg hover:shadow-indigo-500/25 transition-all">
                  {t('upgradeToPremium')}
                </Link>
              </div>
            )}
          </div>

          {/* Generator Card */}
          <div className="glass-card rounded-3xl p-8 border-t-2 border-t-indigo-500/50 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-[50px]" />

            <h2 className="text-xl font-bold flex items-center gap-2 mb-6 relative z-10">
              <span className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">⚡</span>
              {t('generateAccount')}
            </h2>

            <div className="space-y-6 relative z-10">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2 uppercase tracking-wider">{t('selectService')}</label>
                <select
                  value={selectedService}
                  onChange={(e) => setSelectedService(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all appearance-none"
                >
                  <option value="">{t('selectService')}...</option>
                  {services
                    .filter((service) => service._count.stocks > 0)
                    .map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name} • {service._count.stocks} {t('available')} {requiresPaidPlan(service) ? '🔒' : ''}
                      </option>
                    ))}
                </select>
                {selectedService && (() => {
                  const chosen = services.find((service) => service.id === selectedService)
                  if (!chosen || !requiresPaidPlan(chosen)) return null
                  const hasAccess = canAccessService(chosen)
                  return hasAccess ? (
                    <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      Liberado no seu plano
                    </p>
                  ) : (
                    <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                      Exclusivo para planos pagos
                    </p>
                  )
                })()}
              </div>

              {/* Cooldown Timer UI */}
              {cooldownRemaining > 0 && (
                <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 animate-pulse">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-orange-400 text-xl">⏳</span>
                    <span className="text-orange-200 font-bold">Aguarde {formatCooldown(cooldownRemaining)}</span>
                  </div>
                  <div className="h-1.5 w-full bg-orange-500/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-500 transition-all duration-1000 ease-linear"
                      style={{ width: `${((COOLDOWN_SECONDS - cooldownRemaining) / COOLDOWN_SECONDS) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              <ReCaptcha onVerify={(token) => setRecaptchaToken(token)} action="generate" />

              <button
                onClick={handleGenerateAccount}
                disabled={loading || !selectedService || cooldownRemaining > 0 || !recaptchaConfigured}
                className={`w-full py-4 rounded-xl font-bold text-lg transition-all transform active:scale-[0.98] ${cooldownRemaining > 0 || !recaptchaConfigured
                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-lg hover:shadow-indigo-500/25'
                  }`}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {t('generating')}
                  </span>
                ) : cooldownRemaining > 0 ? (
                  t('waitCooldown') || 'Aguarde o tempo...'
                ) : (
                  t('generateAccount')
                )}
              </button>

              {!userPlan?.plan && (
                <div className="flex justify-between text-xs px-1">
                  <span className="text-gray-500">{t('youDontHaveActivePlan')}</span>
                  <span className="text-emerald-400 font-medium">2 {t('freeGenerations')}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Generated Account Result */}
        {generatedAccount && (
          <div className="animate-slide-up mb-8">
            <div className="glass-card rounded-3xl p-1 bg-gradient-to-r from-emerald-500/50 to-teal-500/50">
              <div className="bg-[#0a0a0a] rounded-[22px] p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl">
                    ✅
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{t('accountGeneratedSuccess')}</h3>
                    <p className="text-sm text-gray-400">Use os dados abaixo para acessar</p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                    <label className="text-xs text-gray-500 uppercase tracking-widest block mb-2">{t('emailUser')}</label>
                    <div className="flex items-center gap-3">
                      <code className="flex-1 font-mono text-lg text-white truncate">
                        {generatedAccount.email || generatedAccount.username}
                      </code>
                      <button
                        onClick={() => {
                          const val = generatedAccount.email || generatedAccount.username
                          navigator.clipboard.writeText(val)
                          toast.success('Copiado!')
                        }}
                        className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                      >
                        📋
                      </button>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                    <label className="text-xs text-gray-500 uppercase tracking-widest block mb-2">{t('passwordLabel')}</label>
                    <div className="flex items-center gap-3">
                      <code className="flex-1 font-mono text-lg text-white truncate">
                        {generatedAccount.password}
                      </code>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(generatedAccount.password)
                          toast.success('Copiado!')
                        }}
                        className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                      >
                        📋
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <code className="block w-full font-mono text-emerald-300 text-center break-all select-all">
                    {generatedAccount.email || generatedAccount.username}:{generatedAccount.password}
                  </code>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Affiliate Section */}
        {userPlan?.affiliateCode && (
          <div className="glass-card rounded-3xl p-8 mb-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-pink-500/10 blur-[80px]" />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-3xl">🎁</span>
                <h2 className="text-xl font-bold text-white">{t('yourAffiliateLink')}</h2>
              </div>

              <div className="bg-black/40 border border-white/10 rounded-xl p-6 mb-4">
                <p className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">{t('linkToShare')}</p>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <div className="flex-1 w-full bg-white/5 border border-white/5 rounded-lg px-4 py-3 font-mono text-sm text-gray-300 break-all">
                    {getAffiliateLink(userPlan.affiliateCode)}
                  </div>
                  <button
                    onClick={() => copyAffiliateLink(userPlan.affiliateCode!)}
                    className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-pink-600 to-purple-600 rounded-lg font-bold hover:shadow-lg hover:shadow-pink-500/20 transition-all text-white whitespace-nowrap"
                  >
                    {t('copyLink')}
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <p className="text-sm text-blue-300 flex items-center gap-2">
                  <span className="text-lg">💡</span>
                  <strong>{t('affiliateTip')}</strong>
                </p>
                <Link
                  href="/affiliate"
                  className="text-sm font-bold text-blue-400 hover:text-blue-300 underline underline-offset-4"
                >
                  {t('viewFullAffiliateStats')} →
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* History Section */}
        <div className="glass-card rounded-3xl p-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">📜</span>
              {t('accountHistory') || 'Histórico'}
            </h2>
            <button
              onClick={() => {
                setShowHistory(!showHistory)
                if (!showHistory && accountHistory.length === 0) {
                  loadAccountHistory(1)
                }
              }}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${showHistory
                  ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                  : 'bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20'
                }`}
            >
              {showHistory ? (t('hide') || 'Ocultar') : (t('viewHistory') || 'Ver Histórico')}
            </button>
          </div>

          {showHistory && (
            <div className="animate-fade-in">
              {historyLoading ? (
                <div className="text-center py-12">
                  <div className="inline-block w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <p className="mt-4 text-gray-500">Carregando histórico...</p>
                </div>
              ) : accountHistory.length === 0 ? (
                <div className="text-center py-12 text-gray-500 bg-white/5 rounded-2xl border border-white/5">
                  <p className="text-2xl mb-2">📭</p>
                  <p>Nenhuma conta gerada ainda</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="max-h-[500px] overflow-y-auto pr-2 custom-scrollbar space-y-3">
                    {accountHistory.map((account) => (
                      <div
                        key={account.id}
                        className="p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              {account.service?.icon && (
                                <span className="text-xl">{account.service.icon}</span>
                              )}
                              <span className="font-bold text-white">
                                {account.service?.name || 'Serviço desconhecido'}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500">
                              {format(new Date(account.createdAt), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
                            </p>
                          </div>

                          <div className="flex flex-col gap-2 min-w-[200px]">
                            <div className="flex items-center gap-2 bg-black/30 p-2 rounded-lg border border-white/5">
                              <span className="text-xs text-gray-500 w-12">User:</span>
                              <code className="text-xs font-mono text-emerald-400 flex-1 truncate">{account.username}</code>
                              <button
                                onClick={() => { navigator.clipboard.writeText(account.username); toast.success('Copiado!') }}
                                className="text-gray-400 hover:text-white"
                              >
                                📋
                              </button>
                            </div>
                            {account.password && (
                              <div className="flex items-center gap-2 bg-black/30 p-2 rounded-lg border border-white/5">
                                <span className="text-xs text-gray-500 w-12">Pass:</span>
                                <code className="text-xs font-mono text-emerald-400 flex-1 truncate">{account.password}</code>
                                <button
                                  onClick={() => { navigator.clipboard.writeText(account.password); toast.success('Copiado!') }}
                                  className="text-gray-400 hover:text-white"
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

                  {/* Pagination */}
                  {historyPagination && (historyPagination.hasPrev || historyPagination.hasNext) && (
                    <div className="flex justify-center gap-4 mt-4 pt-4 border-t border-white/5">
                      <button
                        onClick={() => loadAccountHistory(historyPage - 1)}
                        disabled={!historyPagination.hasPrev || historyLoading}
                        className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-sm font-medium"
                      >
                        ← Anterior
                      </button>
                      <span className="px-4 py-2 text-sm text-gray-400">
                        Pág {historyPage} de {historyPagination.totalPages}
                      </span>
                      <button
                        onClick={() => loadAccountHistory(historyPage + 1)}
                        disabled={!historyPagination.hasNext || historyLoading}
                        className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-sm font-medium"
                      >
                        Próxima →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Available Services Grid */}
        <div className="glass-card rounded-3xl p-8">
          <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
            <span className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">🎮</span>
            {t('availableServices')}
          </h2>

          {services.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {services.map((service) => (
                <div
                  key={service.id}
                  className={`p-4 rounded-xl border transition-all duration-300 group ${service._count.stocks > 0
                      ? 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40 hover:bg-emerald-500/10'
                      : 'bg-red-500/5 border-red-500/10 opacity-75'
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl group-hover:scale-110 transition-transform">{service.icon || '⚡'}</span>
                      <div>
                        <h3 className="font-bold text-white text-sm">{service.name}</h3>
                        <p className={`text-xs ${service._count.stocks > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {service._count.stocks} {t('available')}
                        </p>
                      </div>
                    </div>
                    {service._count.stocks > 0 ? (
                      <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <p>{t('noServicesAvailable')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
