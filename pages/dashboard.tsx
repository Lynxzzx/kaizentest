import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n-helper'
import { useTheme } from '@/contexts/ThemeContext'
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
  const getThemeClasses = () => {
    switch (theme) {
      case 'dark':
        return 'min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white py-6 sm:py-8 md:py-12 px-4 sm:px-6 lg:px-8'
      case 'light':
        return 'min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 text-gray-900 py-6 sm:py-8 md:py-12 px-4 sm:px-6 lg:px-8'
      case 'default':
        return 'min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 text-gray-900 py-6 sm:py-8 md:py-12 px-4 sm:px-6 lg:px-8'
      default:
        return 'min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white py-6 sm:py-8 md:py-12 px-4 sm:px-6 lg:px-8'
    }
  }

  const getCardClasses = () => {
    switch (theme) {
      case 'dark':
        return 'bg-white/10 backdrop-blur-lg rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 md:p-8 border border-white/20'
      case 'light':
        return 'bg-white rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 md:p-8 border border-gray-200'
      case 'default':
        return 'bg-white rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 md:p-8 border border-gray-200'
      default:
        return 'bg-white/10 backdrop-blur-lg rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 md:p-8 border border-white/20'
    }
  }

  const getTextClasses = () => {
    switch (theme) {
      case 'dark':
        return { primary: 'text-white', secondary: 'text-gray-300', muted: 'text-gray-400' }
      case 'light':
      case 'default':
        return { primary: 'text-gray-900', secondary: 'text-gray-600', muted: 'text-gray-500' }
      default:
        return { primary: 'text-white', secondary: 'text-gray-300', muted: 'text-gray-400' }
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
      toast.error('Erro ao carregar serviços')
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
    toast.success('Link de afiliado copiado!')
  }

  const getAffiliateLink = (code: string) => {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/register?ref=${code}`
  }

  const handleGenerateAccount = async () => {
    if (!selectedService) {
      toast.error('Selecione um serviço')
      return
    }

    setLoading(true)
    try {
      const response = await axios.post('/api/accounts/generate', {
        serviceId: selectedService
      })
      setGeneratedAccount(response.data)
      toast.success('Conta gerada com sucesso!')
      loadUserPlan() // Recarregar plano para atualizar contagens
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao gerar conta')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className={getThemeClasses()}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 sm:mb-8 flex justify-between items-center">
          <div>
            <h1 className={`text-2xl sm:text-3xl md:text-4xl font-bold mb-2 ${textClasses.primary}`}>
              {t('dashboard')}
            </h1>
            <p className={`text-sm sm:text-base ${textClasses.secondary}`}>Bem-vindo, {session.user.username}!</p>
          </div>
          <Link
            href={`/profile/${session.user.username}`}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all shadow-md"
          >
            <span>👤</span>
            <span className="font-bold">Ver Perfil</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 md:gap-8 mb-6 sm:mb-8">
          {/* Plan Card */}
          <div className={getCardClasses()}>
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h2 className={`text-xl sm:text-2xl font-bold ${textClasses.primary}`}>{t('myPlan')}</h2>
              <span className="text-3xl sm:text-4xl">📋</span>
            </div>
            {userPlan?.plan ? (
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-purple-50 via-blue-50 to-purple-100 rounded-xl p-6 border border-purple-200 shadow-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-blue-600">{userPlan.plan.name}</h3>
                    <span className="text-2xl">💎</span>
                  </div>
                  <p className="text-gray-700 mb-4">{userPlan.plan.description}</p>
                  {userPlan.planExpiresAt && (
                    <div className="flex items-center justify-between pt-4 border-t border-purple-200">
                      <span className="text-sm text-purple-600 font-medium">Expira em:</span>
                      <span className="text-sm font-bold text-purple-900">
                        {format(new Date(userPlan.planExpiresAt), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                      </span>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-3 border border-gray-200">
                    <p className="text-gray-600">Duração</p>
                    <p className="font-bold text-gray-900">{userPlan.plan.duration} dias</p>
                  </div>
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-3 border border-gray-200">
                    <p className="text-gray-600">Gerações</p>
                    <p className="font-bold text-gray-900">
                      {userPlan.plan.maxGenerations === 0 ? 'Ilimitadas' : userPlan.plan.maxGenerations}
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
                  Plano Free
                </h3>
                <p className="text-gray-600 mb-4">Você está usando o plano gratuito</p>
                <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg p-4 mb-6 border border-purple-200">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Gerações diárias</p>
                      <p className="font-bold text-gray-900">2 grátis</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Status</p>
                      <p className="font-bold text-green-600">Ativo</p>
                    </div>
                  </div>
                </div>
                <a
                  href="/plans"
                  className="inline-block bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:from-purple-700 hover:to-blue-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  Upgrade para Premium
                </a>
              </div>
            )}
          </div>

          {/* Generate Account Card */}
          <div className={getCardClasses()}>
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h2 className={`text-xl sm:text-2xl font-bold ${textClasses.primary}`}>{t('generateAccount')}</h2>
              <span className="text-3xl sm:text-4xl">⚡</span>
            </div>
            <div className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t('selectService')}
                </label>
                <select
                  value={selectedService}
                  onChange={(e) => setSelectedService(e.target.value)}
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none bg-white"
                >
                  <option value="">Selecione um serviço</option>
                  {services
                    .filter((service) => service._count.stocks > 0)
                    .map((service) => (
                      <option key={service.id} value={service.id}>
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
                    Gerando...
                  </span>
                ) : (
                  t('generateAccount')
                )}
              </button>
              {!userPlan?.plan && (
                <div className="text-sm text-center">
                  <p className="text-red-600 mb-2">
                    Você não possui um plano ativo
                  </p>
                  <p className="text-green-600 font-medium">
                    💡 Você tem 2 gerações grátis por dia!
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Generated Account */}
        {generatedAccount && (
          <div className={`${getCardClasses()} animate-slide-up mb-6 sm:mb-8`}>
            <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 ${textClasses.primary}`}>Conta Gerada com Sucesso! ✅</h2>
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
              {/* Formato account:pass */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Conta (formato: account:pass):</label>
                <div className="flex items-center gap-2 p-4 bg-white rounded-lg border border-green-100">
                  <span className="font-mono font-bold text-gray-900 flex-1 break-all">
                    {generatedAccount.email || generatedAccount.username}:{generatedAccount.password}
                  </span>
                  <button
                    onClick={() => {
                      const fullAccount = `${generatedAccount.email || generatedAccount.username}:${generatedAccount.password}`
                      navigator.clipboard.writeText(fullAccount)
                      toast.success('Conta completa copiada!')
                    }}
                    className="flex-shrink-0 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
                    title="Copiar conta completa"
                  >
                    📋
                  </button>
                </div>
              </div>

              {/* Dados separados com botões de copiar */}
              <div className="space-y-4">
                <div className="p-4 bg-white rounded-lg border border-green-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-700">
                      {generatedAccount.email ? 'Email/Usuário:' : 'Usuário:'}
                    </span>
                    <button
                      onClick={() => {
                        const account = generatedAccount.email || generatedAccount.username
                        navigator.clipboard.writeText(account)
                        toast.success('Email/Usuário copiado!')
                      }}
                      className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors shadow-sm"
                    >
                      📋 Copiar
                    </button>
                  </div>
                  <span className="font-mono font-bold text-gray-900 block break-all">
                    {generatedAccount.email || generatedAccount.username}
                  </span>
                </div>
                <div className="p-4 bg-white rounded-lg border border-green-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-700">Senha:</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(generatedAccount.password)
                        toast.success('Senha copiada!')
                      }}
                      className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors shadow-sm"
                    >
                      📋 Copiar
                    </button>
                  </div>
                  <span className="font-mono font-bold text-gray-900 block break-all">
                    {generatedAccount.password}
                  </span>
                </div>
              </div>

              {/* Mensagem de aviso */}
              <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800 mb-2">
                  <strong>ℹ️ Informação Importante:</strong>
                </p>
                <p className="text-sm text-blue-700">
                  Se a conta não funcionar, não há problema! Você pode gerar novamente. Às vezes o estoque pode estar vencendo ou alguém pode ter trocado a senha.
                </p>
              </div>
              <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  <strong>⚠️ Importante:</strong> Salve estas credenciais em um local seguro. Elas não serão exibidas novamente.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Affiliate Link Card */}
        {userPlan?.affiliateCode && (
          <div className="mb-6 sm:mb-8 bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 md:p-8 border border-purple-200">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <div className="flex items-center gap-3">
                <span className="text-3xl sm:text-4xl">🎁</span>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Seu Link de Afiliado</h2>
              </div>
            </div>
            <div className="space-y-4">
              <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-purple-200">
                <p className="text-sm text-gray-600 mb-2 font-semibold">Link para compartilhar:</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={getAffiliateLink(userPlan.affiliateCode)}
                    readOnly
                    className="flex-1 px-3 py-2 bg-white border border-purple-200 rounded-lg text-sm font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    onClick={() => copyAffiliateLink(userPlan.affiliateCode!)}
                    className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all shadow-md hover:shadow-lg font-semibold whitespace-nowrap"
                  >
                    📋 Copiar Link
                  </button>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs sm:text-sm text-blue-800">
                  <strong>💡 Dica:</strong> Compartilhe este link com seus amigos! Quando eles se cadastrarem através do seu link, você ganha 2 gerações grátis e eles também ganham 2 gerações grátis!
                </p>
              </div>
              <div className="flex justify-center">
                <Link
                  href="/affiliate"
                  className="text-sm text-purple-600 hover:text-purple-700 font-semibold hover:underline"
                >
                  Ver estatísticas completas de afiliados →
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Available Services */}
        <div className={`mt-6 sm:mt-8 ${getCardClasses()}`}>
          <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 ${textClasses.primary}`}>Serviços Disponíveis</h2>
          {services.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {services.map((service) => (
                <div
                  key={service.id}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    service._count.stocks > 0
                      ? 'border-green-200 bg-green-50 hover:bg-green-100'
                      : 'border-red-200 bg-red-50 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-gray-900">{service.name}</h3>
                      <p className="text-sm text-gray-600">{service._count.stocks} disponíveis</p>
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
            <p className="text-gray-600 text-center py-8">Nenhum serviço disponível no momento.</p>
          )}
        </div>
      </div>
    </div>
  )
}
