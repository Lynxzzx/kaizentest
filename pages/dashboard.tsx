import { useEffect, useState } from 'react'
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

interface Service {
  id: string
  name: string
  description: string
  icon: string
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

export default function Dashboard() {
  const { t } = useTranslation()
  const { data: session, status } = useSession()
  const { theme } = useTheme()
  const router = useRouter()
  const [services, setServices] = useState<Service[]>([])
  const [userPlan, setUserPlan] = useState<UserPlan | null>(null)
  const [selectedService, setSelectedService] = useState<string>('')
  const [generatedAccount, setGeneratedAccount] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  // Classes de tema para o dashboard
  const getDashboardThemeClasses = () => {
    switch (theme) {
      case 'dark':
        return 'relative min-h-screen bg-[#050816] text-slate-100 bg-tech-grid py-8 sm:py-10 md:py-14 px-4 sm:px-6 lg:px-8'
      case 'light':
        return 'relative min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),transparent_55%)] from-slate-50 via-slate-100 to-slate-200 text-slate-900 py-8 sm:py-10 md:py-14 px-4 sm:px-6 lg:px-8'
      case 'default':
        return 'relative min-h-screen bg-[#020617] text-slate-100 bg-tech-grid py-8 sm:py-10 md:py-14 px-4 sm:px-6 lg:px-8'
      default:
        return 'relative min-h-screen bg-[#050816] text-slate-100 bg-tech-grid py-8 sm:py-10 md:py-14 px-4 sm:px-6 lg:px-8'
    }
  }

  const themeClasses = getThemeClasses(theme)

  const getCardClasses = () => {
    switch (theme) {
      case 'dark':
        return 'relative overflow-hidden rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-2xl p-5 sm:p-6 md:p-8 shadow-[0_25px_60px_rgba(15,23,42,0.55)]'
      case 'light':
        return 'relative overflow-hidden rounded-[28px] border border-white bg-white/90 backdrop-blur-xl p-5 sm:p-6 md:p-8 shadow-[0_25px_50px_rgba(15,23,42,0.12)]'
      case 'default':
        return 'relative overflow-hidden rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-2xl p-5 sm:p-6 md:p-8 shadow-[0_25px_60px_rgba(15,23,42,0.55)]'
      default:
        return 'relative overflow-hidden rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-2xl p-5 sm:p-6 md:p-8 shadow-[0_25px_60px_rgba(15,23,42,0.55)]'
    }
  }

  const getTextClasses = () => {
    switch (theme) {
      case 'dark':
        return { primary: 'text-slate-50', secondary: 'text-slate-300', muted: 'text-slate-400' }
      case 'light':
      case 'default':
        return { primary: 'text-slate-900', secondary: 'text-slate-600', muted: 'text-slate-500' }
      default:
        return { primary: 'text-slate-50', secondary: 'text-slate-300', muted: 'text-slate-400' }
    }
  }

  const textClasses = getTextClasses()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
    // Removido bloqueio de OWNER - agora pode usar dashboard normalmente
  }, [session, status, router])

  useEffect(() => {
    if (session) {
      loadServices()
      loadUserPlan()
    }
  }, [session])

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

    setLoading(true)
    try {
      const response = await axios.post('/api/accounts/generate', {
        serviceId: selectedService
      })
      setGeneratedAccount(response.data)
      toast.success(t('accountGeneratedSuccess'))
      loadUserPlan() // Recarregar plano para atualizar contagens
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('errorGeneratingAccount'))
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
          <p className="mt-4 text-gray-600">{t('loading')}</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className={getDashboardThemeClasses()}>
      <div className="max-w-7xl mx-auto">
        <div className={`${getCardClasses()} neon-shadow mb-8`}>
          <div className="absolute inset-0 bg-gradient-to-r from-sky-500/10 via-purple-500/10 to-cyan-400/10" />
          <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/70">{t('welcome')}</p>
              <h1 className="text-3xl md:text-4xl font-black text-white leading-tight">
                {session.user.username}
              </h1>
              <p className="text-sm text-white/70 max-w-xl">
                {t('joinTelegram')} · {t('shareYourExperience')}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/plans"
                className="inline-flex items-center rounded-2xl border border-white/20 px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/10"
              >
                <span className="mr-2">🚀</span>
                {t('viewPlans')}
              </Link>
              <Link
                href={`/profile/${session.user.username}`}
                className="inline-flex items-center rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 px-4 py-2 text-sm font-semibold text-white shadow-[0_15px_35px_rgba(99,102,241,0.45)]"
              >
                <span className="mr-2">👤</span>
                {t('viewProfile')}
              </Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 md:gap-8 mb-6 sm:mb-8">
          {/* Plan Card */}
          <div className={`${getCardClasses()} neon-shadow`}>
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h2 className={`text-xl sm:text-2xl font-bold ${textClasses.primary}`}>{t('myPlan')}</h2>
              <span className="text-3xl sm:text-4xl">📋</span>
            </div>
            {userPlan?.plan ? (
              <div className="space-y-4">
                <div className={`${theme === 'dark' ? 'bg-white/5 border border-white/20' : 'bg-gradient-to-br from-purple-50 via-blue-50 to-purple-100 border border-purple-200'} rounded-xl p-6 shadow-lg`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-blue-600">{userPlan.plan.name}</h3>
                    <span className="text-2xl">💎</span>
                  </div>
                  <p className={`${textClasses.secondary} mb-4`}>{userPlan.plan.description}</p>
                  {userPlan.planExpiresAt && (
                    <div className={`flex items-center justify-between pt-4 border-t ${theme === 'dark' ? 'border-white/20' : 'border-purple-200'}`}>
                      <span className={`text-sm font-medium ${theme === 'dark' ? 'text-purple-300' : 'text-purple-600'}`}>{t('expiresIn')}:</span>
                      <span className={`text-sm font-bold ${theme === 'dark' ? 'text-purple-200' : 'text-purple-900'}`}>
                        {format(new Date(userPlan.planExpiresAt), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                      </span>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className={`${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200'} rounded-lg p-3`}>
                    <p className={textClasses.secondary}>{t('durationLabel')}</p>
                    <p className={`font-bold ${textClasses.primary}`}>{userPlan.plan.duration} {t('days')}</p>
                  </div>
                  <div className={`${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200'} rounded-lg p-3`}>
                    <p className={textClasses.secondary}>{t('generationsLabel')}</p>
                    <p className={`font-bold ${textClasses.primary}`}>
                      {userPlan.plan.maxGenerations === 0 ? t('unlimitedLabel') : userPlan.plan.maxGenerations}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="relative inline-block mb-6">
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-blue-400 rounded-full blur-xl opacity-50"></div>
                  <div className="relative bg-gradient-to-br from-purple-100 to-blue-100 rounded-full p-6 border-4 border-purple-200">
                    <div className="text-5xl">🆓</div>
                  </div>
                </div>
                <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-blue-600 mb-2">
                  {t('freePlanLabel')}
                </h3>
                <p className={`${textClasses.secondary} mb-4`}>{t('youAreUsingFreePlan')}</p>
                <div className={`${theme === 'dark' ? 'bg-white/5 border border-white/20' : 'bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200'} rounded-lg p-4 mb-6`}>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className={textClasses.secondary}>{t('dailyGenerations')}</p>
                      <p className={`font-bold ${textClasses.primary}`}>2 {t('free')}</p>
                    </div>
                    <div>
                      <p className={textClasses.secondary}>{t('status')}</p>
                      <p className="font-bold text-green-600">{t('active')}</p>
                    </div>
                  </div>
                </div>
                <a
                  href="/plans"
                  className="inline-block bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:from-purple-700 hover:to-blue-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  {t('upgradeToPremium')}
                </a>
              </div>
            )}
          </div>

          {/* Generate Account Card */}
          <div className={`${getCardClasses()} neon-shadow`}>
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h2 className={`text-xl sm:text-2xl font-bold ${textClasses.primary}`}>{t('generateAccount')}</h2>
              <span className="text-3xl sm:text-4xl">⚡</span>
            </div>
            <div className="space-y-3 sm:space-y-4">
              <div>
                <label className={`block text-sm font-semibold mb-2 ${textClasses.primary}`}>
                  {t('selectService')}
                </label>
                <select
                  value={selectedService}
                  onChange={(e) => setSelectedService(e.target.value)}
                  className={`${getThemeClasses(theme).input} w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none`}
                  style={theme === 'dark' ? { colorScheme: 'dark' } : {}}
                >
                  <option value="" style={theme === 'dark' ? { backgroundColor: '#1e293b', color: '#fff' } : {}}>{t('selectService')}</option>
                  {services
                    .filter((service) => service._count.stocks > 0)
                    .map((service) => (
                      <option 
                        key={service.id} 
                        value={service.id}
                        style={theme === 'dark' ? { backgroundColor: '#1e293b', color: '#fff' } : {}}
                      >
                        {service.name} ({service._count.stocks} {t('available')})
                      </option>
                    ))}
                </select>
              </div>
              <button
                onClick={handleGenerateAccount}
                disabled={loading || !selectedService}
                className="w-full bg-gradient-to-r from-primary-600 to-primary-700 text-white py-3 sm:py-4 rounded-lg text-sm sm:text-base font-bold hover:from-primary-700 hover:to-primary-800 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none touch-manipulation"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t('generating')}
                  </span>
                ) : (
                  t('generateAccount')
                )}
              </button>
              {!userPlan?.plan && (
                <div className="text-sm text-center">
                  <p className="text-red-600 mb-2">
                    {t('youDontHaveActivePlan')}
                  </p>
                  <p className="text-green-600 font-medium">
                    {t('youHave2FreeGenerations')}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Generated Account */}
        {generatedAccount && (
          <div className={`${getCardClasses()} neon-shadow animate-slide-up mb-6 sm:mb-8`}>
            <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 ${textClasses.primary}`}>{t('accountGeneratedSuccess')}</h2>
            <div className={`${theme === 'dark' ? 'bg-white/5 border border-white/20' : 'bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200'} rounded-xl p-6`}>
              {/* Formato account:pass */}
              <div className="mb-6">
                <label className={`block text-sm font-semibold mb-2 ${textClasses.primary}`}>{t('accountFormat')}</label>
                <div className={`flex items-center gap-2 p-4 ${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-white rounded-lg border border-green-100'}`}>
                  <span className={`font-mono font-bold flex-1 break-all ${textClasses.primary}`}>
                    {generatedAccount.email || generatedAccount.username}:{generatedAccount.password}
                  </span>
                  <button
                    onClick={() => {
                      const fullAccount = `${generatedAccount.email || generatedAccount.username}:${generatedAccount.password}`
                      navigator.clipboard.writeText(fullAccount)
                      toast.success(t('copyFullAccount'))
                    }}
                    className="flex-shrink-0 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
                    title={t('copyFullAccount')}
                  >
                    📋
                  </button>
                </div>
              </div>

              {/* Dados separados com botões de copiar */}
              <div className="space-y-4">
                <div className={`p-4 ${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-white rounded-lg border border-green-100'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`font-semibold ${textClasses.primary}`}>
                      {generatedAccount.email ? t('emailUser') : t('usernameLabel')}
                    </span>
                    <button
                      onClick={() => {
                        const account = generatedAccount.email || generatedAccount.username
                        navigator.clipboard.writeText(account)
                        toast.success(t('emailUserCopied'))
                      }}
                      className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors shadow-sm"
                    >
                      {t('copyButton')}
                    </button>
                  </div>
                  <span className={`font-mono font-bold block break-all ${textClasses.primary}`}>
                    {generatedAccount.email || generatedAccount.username}
                  </span>
                </div>
                <div className={`p-4 ${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-white rounded-lg border border-green-100'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`font-semibold ${textClasses.primary}`}>{t('passwordLabel')}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(generatedAccount.password)
                        toast.success(t('passwordCopied'))
                      }}
                      className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors shadow-sm"
                    >
                      {t('copyButton')}
                    </button>
                  </div>
                  <span className={`font-mono font-bold block break-all ${textClasses.primary}`}>
                    {generatedAccount.password}
                  </span>
                </div>
              </div>

              {/* Mensagem de aviso */}
              <div className={`mt-6 ${theme === 'dark' ? 'bg-blue-500/20 border border-blue-400/30' : 'bg-blue-50 border border-blue-200'} rounded-lg p-4`}>
                <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-blue-200' : 'text-blue-800'}`}>
                  <strong>{t('importantInfo')}</strong>
                </p>
                <p className={`text-sm ${theme === 'dark' ? 'text-blue-300' : 'text-blue-700'}`}>
                  {t('accountNotWorkingInfo')}
                </p>
              </div>
              <div className={`mt-4 ${theme === 'dark' ? 'bg-yellow-500/20 border border-yellow-400/30' : 'bg-yellow-50 border border-yellow-200'} rounded-lg p-4`}>
                <p className={`text-sm ${theme === 'dark' ? 'text-yellow-200' : 'text-yellow-800'}`}>
                  <strong>{t('saveCredentials')}</strong>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Affiliate Link Card */}
        {userPlan?.affiliateCode && (
          <div className={`mb-6 sm:mb-8 ${getCardClasses()} neon-shadow`}>
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <div className="flex items-center gap-3">
                <span className="text-3xl sm:text-4xl">🎁</span>
                <h2 className={`text-xl sm:text-2xl font-bold ${textClasses.primary}`}>{t('yourAffiliateLink')}</h2>
              </div>
            </div>
            <div className="space-y-4">
              <div className={`${theme === 'dark' ? 'bg-white/5 border border-white/20' : 'bg-white/80 backdrop-blur-sm border border-purple-200'} rounded-xl p-4`}>
                <p className={`text-sm mb-2 font-semibold ${textClasses.secondary}`}>{t('linkToShare')}</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={getAffiliateLink(userPlan.affiliateCode)}
                    readOnly
                    className={`${getThemeClasses(theme).input} flex-1 px-3 py-2 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500`}
                  />
                  <button
                    onClick={() => copyAffiliateLink(userPlan.affiliateCode!)}
                    className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all shadow-md hover:shadow-lg font-semibold whitespace-nowrap"
                  >
                    {t('copyLink')}
                  </button>
                </div>
              </div>
              <div className={`${theme === 'dark' ? 'bg-blue-500/20 border border-blue-400/30' : 'bg-blue-50 border border-blue-200'} rounded-lg p-3`}>
                <p className={`text-xs sm:text-sm ${theme === 'dark' ? 'text-blue-200' : 'text-blue-800'}`}>
                  <strong>{t('affiliateTip')}</strong>
                </p>
              </div>
              <div className="flex justify-center">
                <Link
                  href="/affiliate"
                  className={`text-sm font-semibold hover:underline ${theme === 'dark' ? 'text-purple-300 hover:text-purple-200' : 'text-purple-600 hover:text-purple-700'}`}
                >
                  {t('viewFullAffiliateStats')}
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Available Services */}
        <div className={`mt-6 sm:mt-8 ${getCardClasses()} neon-shadow`}>
          <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 ${textClasses.primary}`}>{t('availableServices')}</h2>
          {services.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {services.map((service) => (
                <div
                  key={service.id}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    service._count.stocks > 0
                      ? theme === 'dark' 
                        ? 'border-green-400/30 bg-green-500/10 hover:bg-green-500/20' 
                        : 'border-green-200 bg-green-50 hover:bg-green-100'
                      : theme === 'dark'
                        ? 'border-red-400/30 bg-red-500/10 opacity-60'
                        : 'border-red-200 bg-red-50 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className={`font-bold ${textClasses.primary}`}>{service.name}</h3>
                      <p className={`text-sm ${textClasses.secondary}`}>{service._count.stocks} {t('available')}</p>
                    </div>
                    {service._count.stocks > 0 ? (
                      <span className="text-2xl">✅</span>
                    ) : (
                      <span className="text-2xl">❌</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className={`${textClasses.secondary} text-center py-8`}>{t('noServicesAvailable')}</p>
          )}
        </div>
      </div>
    </div>
  )
}
