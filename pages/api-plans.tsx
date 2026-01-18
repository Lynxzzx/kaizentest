import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useTranslation } from '@/lib/i18n-helper'
import { useTheme } from '@/contexts/ThemeContext'
import { getThemeClasses } from '@/lib/theme-utils'
import Layout from '@/components/Layout'
import axios from 'axios'
import toast from 'react-hot-toast'
import QRCode from 'qrcode.react'

interface ApiPlan {
  id: string
  name: string
  description: string
  price: number
  duration: number
  maxGenerations: number
  features: string[]
  badge?: string
  color: string
  dbId?: string // ID do plano no banco de dados
}

interface PaymentData {
  id: string
  pixQrCodeImage?: string
  pixQrCode?: string
  pixCopyPaste?: string
  telegramLink?: string
  bitcoinAddress?: string
  bitcoinAmount?: number
  network?: string
  qrCode?: string
  originalAmount?: number
  finalAmount?: number
  discountAmount?: number
  currency?: string
  fallback?: boolean
  expiresAt?: Date
}

interface AppliedCoupon {
  code: string
  planId: string
  discountAmount: number
  finalAmount: number
}

interface Plan {
  id: string
  name: string
  description?: string
  price: number
  duration: number
  maxGenerations: number
}

const API_PLANS: ApiPlan[] = [
  {
    id: 'api-starter',
    name: 'API KAIZEN STARTER',
    description: 'Perfeito para começar a integrar nossa API.',
    price: 79.90,
    duration: 30,
    maxGenerations: 1500,
    color: 'green',
    features: [
      '🔑 1 API Key',
      '🔄 1.500 gerações / mês',
      '📦 Serviços básicos',
      '⏱️ Rate limit seguro',
      '🚫 Sem revenda explícita',
      '📊 Log básico'
    ]
  },
  {
    id: 'api-creator',
    name: 'API KAIZEN CREATOR',
    description: 'Plano mais equilibrado.',
    price: 149.90,
    duration: 30,
    maxGenerations: 5000,
    color: 'blue',
    badge: 'Mais Popular',
    features: [
      '🔑 API Key dedicada',
      '🔄 5.000 gerações / mês',
      '📦 Serviços ampliados',
      '⚡ Rate limit melhor',
      '✅ Uso comercial permitido',
      '📊 Histórico completo'
    ]
  },
  {
    id: 'api-pro',
    name: 'API KAIZEN PRO',
    description: 'Solução completa para negócios em escala.',
    price: 299.90,
    duration: 30,
    maxGenerations: 15000,
    color: 'purple',
    features: [
      '🔑 API Key exclusiva',
      '🔄 15.000 gerações / mês',
      '📦 Todos os serviços',
      '🚀 Prioridade de estoque',
      '⚡ Rate limit alto',
      '🛡️ Anti-abuso avançado',
      '💬 Suporte prioritário'
    ]
  },
  {
    id: 'api-enterprise',
    name: 'API KAIZEN ENTERPRISE',
    description: 'Estoque dedicado e limites customizados.',
    price: 0, // Sob consulta
    duration: 0,
    maxGenerations: 0,
    color: 'red',
    features: [
      '💼 Estoque dedicado',
      '📊 Limites customizados',
      '🔒 IP whitelist',
      '📋 SLA',
      '🎨 Possível whitelabel'
    ]
  }
]

export default function ApiPlans() {
  const { t } = useTranslation()
  const { data: session } = useSession()
  const router = useRouter()
  const { theme } = useTheme()
  const [loading, setLoading] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'CRYPTO' | 'CARD' | null>(null)
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null)
  const [qrCodeImageError, setQrCodeImageError] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [customerEmail, setCustomerEmail] = useState('')
  const [pendingPayment, setPendingPayment] = useState<{ plan: Plan; method: 'PIX' | 'CRYPTO' } | null>(null)
  const [checkingPayment, setCheckingPayment] = useState(false)
  const [showCardModal, setShowCardModal] = useState(false)
  const [pendingCardPayment, setPendingCardPayment] = useState<Plan | null>(null)
  const [cardNumber, setCardNumber] = useState('')
  const [cardExpMonth, setCardExpMonth] = useState('')
  const [cardExpYear, setCardExpYear] = useState('')
  const [cardCvv, setCardCvv] = useState('')
  const [cardHolderName, setCardHolderName] = useState('')
  const [cardEmail, setCardEmail] = useState('')
  const [processingCard, setProcessingCard] = useState(false)
  const [showLanguageModal, setShowLanguageModal] = useState(false)
  const [pendingBitcoinPayment, setPendingBitcoinPayment] = useState<Plan | null>(null)
  const [selectedLanguage, setSelectedLanguage] = useState<string>('pt')
  const [showManualPaymentModal, setShowManualPaymentModal] = useState(false)
  const [pendingManualPayment, setPendingManualPayment] = useState<Plan | null>(null)
  const themeClasses = getThemeClasses(theme)

  // Verificar status do pagamento periodicamente
  useEffect(() => {
    if (!paymentData?.id || !paymentMethod || checkingPayment) return

    const intervalTime = paymentMethod === 'PIX' ? 5000 : 10000
    const interval = setInterval(async () => {
      if (!paymentData?.id) return
      try {
        setCheckingPayment(true)
        const response = await axios.get(`/api/payments/check-status?paymentId=${paymentData.id}`)
        if (response.data.status === 'PAID') {
          clearInterval(interval)
          toast.success(t('paymentConfirmed'))
          setTimeout(() => window.location.reload(), 2000)
        }
      } catch (error: any) {
        console.log('Verificando pagamento...')
      } finally {
        setCheckingPayment(false)
      }
    }, intervalTime)
    return () => clearInterval(interval)
  }, [paymentData?.id, paymentMethod, checkingPayment])

  // Buscar ou criar plano no banco
  const findOrCreatePlan = async (apiPlan: ApiPlan): Promise<Plan> => {
    try {
      const response = await axios.post('/api/api-plans/find-or-create', { planId: apiPlan.id })
      return {
        id: response.data.id,
        name: response.data.name,
        description: response.data.description,
        price: response.data.price,
        duration: response.data.duration,
        maxGenerations: response.data.maxGenerations
      }
    } catch (error: any) {
      console.error('Erro ao buscar/criar plano:', error)
      throw new Error(error.response?.data?.error || 'Erro ao processar plano')
    }
  }

  const handlePayment = async (apiPlan: ApiPlan, method: 'PIX' | 'CRYPTO' | 'CARD') => {
    if (!session) {
      toast.error(t('loginToContinue'))
      router.push('/login?redirect=/api-plans')
      return
    }

    setLoading(true)
    try {
      const plan = await findOrCreatePlan(apiPlan)

      if (method === 'PIX') {
        setPendingPayment({ plan, method })
        setShowEmailModal(true)
        return
      }

      if (method === 'CARD') {
        setPendingCardPayment(plan)
        setShowCardModal(true)
        return
      }

      if (method === 'CRYPTO') {
        setPendingBitcoinPayment(plan)
        setShowLanguageModal(true)
        return
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao processar plano')
    } finally {
      setLoading(false)
    }
  }

  const handleManualPayment = async (apiPlan: ApiPlan) => {
    if (!session) {
      toast.error(t('loginToContinue'))
      router.push('/login?redirect=/api-plans')
      return
    }
    setLoading(true)
    try {
      const plan = await findOrCreatePlan(apiPlan)
      setPendingManualPayment(plan)
      setShowManualPaymentModal(true)
    } catch (error: any) {
      toast.error(error.message || 'Erro ao processar plano')
    } finally {
      setLoading(false)
    }
  }

  const createPixPayment = async (plan: Plan, email: string) => {
    setLoading(true)
    setSelectedPlan(plan)
    setPaymentMethod('PIX')
    setShowEmailModal(false)
    
    try {
      const response = await axios.post('/api/payments/create', {
        planId: plan.id,
        method: 'PIX',
        customerEmail: email
      })
      
      setPaymentData({
        id: response.data.paymentId || response.data.id,
        pixQrCodeImage: response.data.qrCodeImage || response.data.pixQrCodeImage,
        pixQrCode: response.data.pixCopyPaste || response.data.pixQrCode,
        pixCopyPaste: response.data.pixCopyPaste || response.data.pixQrCode,
        expiresAt: response.data.expiresAt ? new Date(response.data.expiresAt) : undefined,
        originalAmount: response.data.originalAmount || plan.price,
        finalAmount: response.data.finalAmount,
        discountAmount: response.data.discountAmount
      })
      setQrCodeImageError(false)
      toast.success(t('pixPaymentCreated'))
    } catch (error: any) {
      console.error('Erro ao criar pagamento PIX:', error)
      toast.error(error.response?.data?.error || error.response?.data?.message || t('errorCreatingPix'))
    } finally {
      setLoading(false)
    }
  }

  const handleEmailSubmit = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!customerEmail || !emailRegex.test(customerEmail)) {
      toast.error(t('errorInvalidEmail'))
      return
    }
    if (pendingPayment && pendingPayment.method === 'PIX') {
      createPixPayment(pendingPayment.plan, customerEmail)
    }
  }

  const formatCardNumber = (value: string) => {
    const numbers = value.replace(/\D/g, '')
    const formatted = numbers.replace(/(\d{4})(?=\d)/g, '$1 ')
    return formatted.substring(0, 19)
  }

  const createCardPayment = async () => {
    if (!pendingCardPayment) return

    const cleanCardNumber = cardNumber.replace(/\D/g, '')
    if (cleanCardNumber.length < 13 || cleanCardNumber.length > 19) {
      toast.error(t('invalidCardNumber'))
      return
    }
    if (!cardExpMonth || parseInt(cardExpMonth) < 1 || parseInt(cardExpMonth) > 12) {
      toast.error(t('invalidExpMonth'))
      return
    }
    if (!cardExpYear || cardExpYear.length !== 4) {
      toast.error(t('invalidExpYear'))
      return
    }
    if (!cardCvv || cardCvv.length < 3 || cardCvv.length > 4) {
      toast.error(t('invalidCvv'))
      return
    }
    if (!cardHolderName || cardHolderName.length < 3) {
      toast.error(t('invalidCardHolderName'))
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!cardEmail || !emailRegex.test(cardEmail)) {
      toast.error(t('errorInvalidEmail'))
      return
    }

    setProcessingCard(true)
    try {
      const response = await axios.post('/api/payments/create', {
        planId: pendingCardPayment.id,
        method: 'CARD',
        cardNumber: cleanCardNumber,
        cardExpMonth,
        cardExpYear,
        cardCvv,
        cardHolderName,
        customerEmail: cardEmail
      })

      setShowCardModal(false)
      resetCardForm()
      
      if (response.data.id || response.data.paymentId) {
        const paymentId = response.data.id || response.data.paymentId
        router.push(`/payment-status/${paymentId}`)
      } else {
        toast.error('Erro ao obter ID do pagamento')
      }
    } catch (error: any) {
      console.error('Erro ao processar pagamento via cartão:', error)
      toast.error(error.response?.data?.message || error.response?.data?.error || t('cardPaymentError'))
    } finally {
      setProcessingCard(false)
    }
  }

  const resetCardForm = () => {
    setCardNumber('')
    setCardExpMonth('')
    setCardExpYear('')
    setCardCvv('')
    setCardHolderName('')
    setCardEmail('')
    setPendingCardPayment(null)
  }

  const handleLanguageSelection = () => {
    if (!pendingBitcoinPayment) return
    const telegramLink = `https://t.me/lynxdevz?start=bitcoin_${pendingBitcoinPayment.id}_${selectedLanguage}`
    window.open(telegramLink, '_blank')
    setShowLanguageModal(false)
    setPendingBitcoinPayment(null)
    setSelectedLanguage('pt')
  }

  const redirectToTelegramManual = () => {
    if (!pendingManualPayment) return
    const telegramLink = `https://t.me/lynxdevz?start=manual_${pendingManualPayment.id}`
    window.open(telegramLink, '_blank')
    setShowManualPaymentModal(false)
    setPendingManualPayment(null)
  }

  const getColorClasses = (color: string) => {
    const colors: Record<string, string> = {
      green: 'from-green-500 to-emerald-600',
      blue: 'from-blue-500 to-cyan-600',
      purple: 'from-purple-500 to-pink-600',
      red: 'from-red-500 to-rose-600'
    }
    return colors[color] || colors.blue
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              🌐 API Kaizen
            </h1>
            <p className="text-xl text-slate-300 mb-8">
              Integre nosso estoque ao seu site ou bot
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {API_PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`relative bg-white/10 backdrop-blur-lg rounded-2xl p-6 border-2 ${
                  plan.badge ? 'border-purple-500/50 ring-4 ring-purple-500/20' : 'border-white/20'
                } hover:scale-105 transition-transform`}
              >
                {plan.badge && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-1 rounded-full text-sm font-bold">
                    {plan.badge}
                  </div>
                )}
                <div className={`w-16 h-16 rounded-full bg-gradient-to-r ${getColorClasses(plan.color)} flex items-center justify-center text-white text-2xl font-bold mb-4`}>
                  {plan.name.charAt(0)}
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                <p className="text-slate-300 text-sm mb-4">{plan.description}</p>
                <div className="mb-4">
                  {plan.price > 0 ? (
                    <div>
                      <span className="text-3xl font-bold text-white">R$ {plan.price.toFixed(2)}</span>
                      <span className="text-slate-400"> / mês</span>
                    </div>
                  ) : (
                    <div>
                      <span className="text-2xl font-bold text-white">💼 Sob consulta</span>
                    </div>
                  )}
                </div>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="text-sm text-slate-300 flex items-start">
                      <span className="mr-2">{feature}</span>
                    </li>
                  ))}
                </ul>
                {plan.id === 'api-enterprise' ? (
                  <button
                    onClick={() => window.open('https://t.me/lynxdevz', '_blank')}
                    className={`w-full py-3 rounded-lg font-semibold text-white bg-gradient-to-r ${getColorClasses(plan.color)} hover:opacity-90 transition-opacity`}
                  >
                    Falar no Telegram
                  </button>
                ) : (
                  <div className="space-y-2">
                    <button
                      onClick={() => handlePayment(plan, 'PIX')}
                      disabled={loading}
                      className="w-full py-2.5 rounded-lg text-sm font-bold text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50"
                    >
                      {t('payViaPix')}
                    </button>
                    <button
                      onClick={() => handlePayment(plan, 'CRYPTO')}
                      disabled={loading}
                      className="w-full py-2.5 rounded-lg text-sm font-bold text-white bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50"
                    >
                      {t('payViaCrypto')}
                    </button>
                    <button
                      onClick={() => handlePayment(plan, 'CARD')}
                      disabled={loading}
                      className="w-full py-2.5 rounded-lg text-sm font-bold text-white bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50"
                    >
                      💳 {t('payViaCard')}
                    </button>
                    <button
                      onClick={() => handleManualPayment(plan)}
                      disabled={loading}
                      className="w-full py-2.5 rounded-lg text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50"
                    >
                      🌍 {t('payManualInternational')}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-4">📚 Documentação da API</h2>
            <p className="text-slate-300 mb-4">
              Após assinar um plano, você receberá sua API Key e poderá acessar a documentação completa.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="bg-white/5 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-2">POST /api/v1/generate</h3>
                <p className="text-sm text-slate-300">Gerar uma conta para um serviço</p>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-2">GET /api/v1/services</h3>
                <p className="text-sm text-slate-300">Listar serviços disponíveis</p>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-2">GET /api/v1/status</h3>
                <p className="text-sm text-slate-300">Verificar status e uso da API</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Email Modal */}
      {showEmailModal && pendingPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${themeClasses.card} rounded-xl sm:rounded-2xl p-6 sm:p-8 max-w-md w-full mx-4 shadow-2xl`}>
            <h2 className={`text-xl sm:text-2xl font-bold mb-4 ${themeClasses.text.primary}`}>
              {t('informEmail')}
            </h2>
            <p className={`text-sm mb-4 ${themeClasses.text.secondary}`}>
              {t('emailRequired')}
            </p>
            <div className="mb-6">
              <label className={`block text-sm font-semibold mb-2 ${themeClasses.text.primary}`}>
                {t('emailLabel')}
              </label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder={t('emailPlaceholder')}
                className={`${themeClasses.input} w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500`}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleEmailSubmit()
                  }
                }}
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleEmailSubmit}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-lg font-semibold hover:from-primary-700 hover:to-primary-800 transition-all"
              >
                {t('continue')}
              </button>
              <button
                onClick={() => {
                  setShowEmailModal(false)
                  setPendingPayment(null)
                  setCustomerEmail('')
                }}
                className={`px-4 py-3 rounded-lg font-semibold transition-colors ${
                  theme === 'dark' 
                    ? 'bg-white/10 text-white hover:bg-white/20' 
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal - PIX */}
      {(paymentData || (paymentMethod && loading)) && selectedPlan && paymentMethod === 'PIX' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className={`${themeClasses.card} rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 max-w-md w-full mx-4 shadow-2xl my-4`}>
            <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 ${themeClasses.text.primary}`}>
              {t('paymentVia')} {t('paymentMethodPix')}
            </h2>

            {paymentData && (
              <div className={`${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'} rounded-lg p-4 mb-4`}>
                <p className={`text-sm ${themeClasses.text.secondary}`}>{selectedPlan.name}</p>
                <p className={`${themeClasses.text.primary} text-lg font-semibold`}>
                  {t('currencySymbol')} {selectedPlan.price.toFixed(2)}
                </p>
                {paymentData.discountAmount ? (
                  <p className={`text-sm ${themeClasses.text.secondary}`}>
                    {t('discount')}: -{t('currencySymbol')} {paymentData.discountAmount?.toFixed(2)}
                  </p>
                ) : null}
                <p className="text-sm text-green-400 font-semibold">
                  {t('finalPrice')}: {t('currencySymbol')} {(paymentData.finalAmount ?? selectedPlan.price).toFixed(2)}
                </p>
              </div>
            )}
            
            {loading && !paymentData ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                  <p className={`${themeClasses.text.secondary}`}>{t('creatingPixPayment')}</p>
                </div>
              </div>
            ) : paymentData && (
              <>
                {checkingPayment && (
                  <div className={`mb-4 p-3 rounded-lg ${theme === 'dark' ? 'bg-blue-500/20 border border-blue-400/30' : 'bg-blue-50 border border-blue-200'}`}>
                    <p className={`text-sm flex items-center gap-2 ${theme === 'dark' ? 'text-blue-200' : 'text-blue-800'}`}>
                      <span className="animate-spin">⏳</span>
                      {t('checkingPayment')}
                    </p>
                  </div>
                )}
                <div className="space-y-4">
                  {(paymentData.pixQrCodeImage || paymentData.pixQrCode || paymentData.pixCopyPaste) ? (
                    <>
                      <div className={`flex justify-center ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'} p-3 sm:p-4 rounded-lg`}>
                        {paymentData.pixQrCodeImage && !qrCodeImageError ? (
                          <img 
                            src={paymentData.pixQrCodeImage} 
                            alt={t('qrCodePixAlt')} 
                            className="w-48 h-48 sm:w-64 sm:h-64 object-contain mx-auto"
                            onError={() => setQrCodeImageError(true)}
                          />
                        ) : paymentData.pixCopyPaste || paymentData.pixQrCode ? (
                          <div className="flex justify-center">
                            <QRCode 
                              value={paymentData.pixCopyPaste || paymentData.pixQrCode || ''} 
                              size={256} 
                              className="w-48 h-48 sm:w-64 sm:h-64"
                            />
                          </div>
                        ) : (
                          <div className={`w-64 h-64 flex items-center justify-center ${themeClasses.text.muted}`}>
                            <p>{t('loadingQrCode')}</p>
                          </div>
                        )}
                      </div>
                      <div>
                        <label className={`block text-sm font-semibold mb-2 ${themeClasses.text.primary}`}>
                          {t('pixCodeCopyPaste')}
                        </label>
                        <textarea
                          value={paymentData.pixCopyPaste || paymentData.pixQrCode || ''}
                          readOnly
                          className={`${themeClasses.input} w-full px-4 py-3 rounded-lg font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary-500`}
                          rows={4}
                          onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                        />
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm text-blue-800 mb-2">
                          <strong>{t('instructions')}</strong> {t('instructionsText')}
                        </p>
                        <p className="text-sm text-blue-800">
                          <strong>{t('autoActivation')}</strong> {t('autoActivationText')}
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className={`${theme === 'dark' ? 'bg-yellow-500/20 border border-yellow-400/30' : 'bg-yellow-50 border border-yellow-200'} rounded-lg p-4`}>
                      <p className={`text-sm ${theme === 'dark' ? 'text-yellow-200' : 'text-yellow-800'}`}>
                        <strong>{t('waitProcessing')}</strong> {t('waitProcessingText')}
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}

            <button
              onClick={() => {
                setPaymentData(null)
                setSelectedPlan(null)
                setPaymentMethod(null)
              }}
              className={`mt-4 sm:mt-6 w-full px-4 py-2.5 sm:py-3 rounded-lg text-sm sm:text-base font-semibold transition-colors ${
                theme === 'dark' 
                  ? 'bg-white/10 text-white hover:bg-white/20' 
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }`}
            >
              {t('close')}
            </button>
          </div>
        </div>
      )}

      {/* Card Payment Modal */}
      {showCardModal && pendingCardPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className={`${themeClasses.card} rounded-xl sm:rounded-2xl p-6 sm:p-8 max-w-md w-full mx-4 shadow-2xl my-4`}>
            <h2 className={`text-xl sm:text-2xl font-bold mb-2 ${themeClasses.text.primary}`}>
              💳 {t('payViaCard')}
            </h2>
            <p className={`text-sm mb-6 ${themeClasses.text.secondary}`}>
              {t('cardPaymentDescription')}
            </p>

            <div className={`${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'} rounded-lg p-4 mb-6`}>
              <p className={`text-sm ${themeClasses.text.secondary}`}>{pendingCardPayment.name}</p>
              <p className={`${themeClasses.text.primary} text-lg font-semibold`}>
                {t('currencySymbol')} {pendingCardPayment.price.toFixed(2)}
              </p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-semibold mb-2 ${themeClasses.text.primary}`}>
                  {t('cardNumber')}
                </label>
                <input
                  type="text"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                  placeholder="0000 0000 0000 0000"
                  maxLength={19}
                  className={`${themeClasses.input} w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono`}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={`block text-sm font-semibold mb-2 ${themeClasses.text.primary}`}>
                    {t('expMonth')}
                  </label>
                  <input
                    type="text"
                    value={cardExpMonth}
                    onChange={(e) => setCardExpMonth(e.target.value.replace(/\D/g, '').substring(0, 2))}
                    placeholder="MM"
                    maxLength={2}
                    className={`${themeClasses.input} w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-center font-mono`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-semibold mb-2 ${themeClasses.text.primary}`}>
                    {t('expYear')}
                  </label>
                  <input
                    type="text"
                    value={cardExpYear}
                    onChange={(e) => setCardExpYear(e.target.value.replace(/\D/g, '').substring(0, 4))}
                    placeholder="AAAA"
                    maxLength={4}
                    className={`${themeClasses.input} w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-center font-mono`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-semibold mb-2 ${themeClasses.text.primary}`}>
                    CVV
                  </label>
                  <input
                    type="text"
                    value={cardCvv}
                    onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').substring(0, 4))}
                    placeholder="***"
                    maxLength={4}
                    className={`${themeClasses.input} w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-center font-mono`}
                  />
                </div>
              </div>

              <div>
                <label className={`block text-sm font-semibold mb-2 ${themeClasses.text.primary}`}>
                  {t('cardHolderName')}
                </label>
                <input
                  type="text"
                  value={cardHolderName}
                  onChange={(e) => setCardHolderName(e.target.value.toUpperCase())}
                  placeholder={t('cardHolderNamePlaceholder')}
                  className={`${themeClasses.input} w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 uppercase`}
                />
              </div>

              <div>
                <label className={`block text-sm font-semibold mb-2 ${themeClasses.text.primary}`}>
                  {t('emailLabel')}
                </label>
                <input
                  type="email"
                  value={cardEmail}
                  onChange={(e) => setCardEmail(e.target.value)}
                  placeholder={t('emailPlaceholder')}
                  className={`${themeClasses.input} w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className={`${theme === 'dark' ? 'bg-blue-500/20 border border-blue-400/30' : 'bg-blue-50 border border-blue-200'} rounded-lg p-2 text-center`}>
                  <p className={`text-xs font-semibold ${theme === 'dark' ? 'text-blue-200' : 'text-blue-800'}`}>
                    🔒 {t('sslEncrypted')}
                  </p>
                </div>
                <div className={`${theme === 'dark' ? 'bg-green-500/20 border border-green-400/30' : 'bg-green-50 border border-green-200'} rounded-lg p-2 text-center`}>
                  <p className={`text-xs font-semibold ${theme === 'dark' ? 'text-green-200' : 'text-green-800'}`}>
                    ✅ {t('pciCompliant')}
                  </p>
                </div>
              </div>

              <div className={`${theme === 'dark' ? 'bg-green-500/20 border border-green-400/30' : 'bg-green-50 border border-green-200'} rounded-lg p-3`}>
                <p className={`text-xs flex items-start gap-2 ${theme === 'dark' ? 'text-green-200' : 'text-green-800'}`}>
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span>{t('cardSecurityNoticeTokenized')}</span>
                </p>
                <p className={`text-xs mt-2 flex items-center gap-2 ${theme === 'dark' ? 'text-green-300' : 'text-green-700'}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  {t('pagbankSecure')}
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={createCardPayment}
                disabled={processingCard}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-700 text-white rounded-lg font-semibold hover:from-green-700 hover:to-emerald-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {processingCard ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    {t('processing')}
                  </>
                ) : (
                  <>💳 {t('payNow')}</>
                )}
              </button>
              <button
                onClick={() => {
                  setShowCardModal(false)
                  resetCardForm()
                }}
                disabled={processingCard}
                className={`px-4 py-3 rounded-lg font-semibold transition-colors ${
                  theme === 'dark' 
                    ? 'bg-white/10 text-white hover:bg-white/20' 
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                } disabled:opacity-50`}
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Language Selection Modal for Bitcoin */}
      {showLanguageModal && pendingBitcoinPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${themeClasses.card} rounded-xl sm:rounded-2xl p-6 sm:p-8 max-w-md w-full mx-4 shadow-2xl`}>
            <h2 className={`text-xl sm:text-2xl font-bold mb-4 ${themeClasses.text.primary}`}>
              {t('selectLanguage')}
            </h2>
            <p className={`text-sm mb-6 ${themeClasses.text.secondary}`}>
              {t('selectLanguageDescription')}
            </p>

            <div className={`${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'} rounded-lg p-4 mb-6`}>
              <p className={`text-sm ${themeClasses.text.secondary}`}>{pendingBitcoinPayment.name}</p>
              <p className={`${themeClasses.text.primary} text-lg font-semibold`}>
                {t('currencySymbol')} {pendingBitcoinPayment.price.toFixed(2)}
              </p>
            </div>

            <div className="mb-6">
              <label className={`block text-sm font-semibold mb-3 ${themeClasses.text.primary}`}>
                {t('yourLanguage')}
              </label>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className={`${themeClasses.input} w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500`}
              >
                <option value="pt">🇧🇷 Português (Brasil)</option>
                <option value="en">🇺🇸 English</option>
                <option value="es">🇪🇸 Español</option>
                <option value="fr">🇫🇷 Français</option>
                <option value="de">🇩🇪 Deutsch</option>
                <option value="it">🇮🇹 Italiano</option>
                <option value="other">🌍 {t('otherLanguage')}</option>
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleLanguageSelection}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-lg font-semibold hover:from-orange-700 hover:to-orange-800 transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
                {t('openTelegram')}
              </button>
              <button
                onClick={() => {
                  setShowLanguageModal(false)
                  setPendingBitcoinPayment(null)
                  setSelectedLanguage('pt')
                }}
                className={`px-4 py-3 rounded-lg font-semibold transition-colors ${
                  theme === 'dark' 
                    ? 'bg-white/10 text-white hover:bg-white/20' 
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Payment Modal */}
      {showManualPaymentModal && pendingManualPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className={`${themeClasses.card} rounded-xl sm:rounded-2xl p-6 sm:p-8 max-w-md w-full mx-4 shadow-2xl my-4`}>
            <h2 className={`text-xl sm:text-2xl font-bold mb-2 ${themeClasses.text.primary}`}>
              🌍 {t('manualPaymentInternational')}
            </h2>
            <p className={`text-sm mb-6 ${themeClasses.text.secondary}`}>
              {t('manualPaymentDescription')}
            </p>

            <div className={`${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'} rounded-lg p-4 mb-6`}>
              <p className={`text-sm ${themeClasses.text.secondary}`}>{pendingManualPayment.name}</p>
              <p className={`${themeClasses.text.primary} text-lg font-semibold`}>
                {t('currencySymbol')} {pendingManualPayment.price.toFixed(2)}
              </p>
            </div>

            <div className={`${theme === 'dark' ? 'bg-blue-500/20 border border-blue-400/30' : 'bg-blue-50 border border-blue-200'} rounded-lg p-4 mb-6`}>
              <h3 className={`text-sm font-semibold mb-3 ${theme === 'dark' ? 'text-blue-200' : 'text-blue-900'}`}>
                {t('acceptedPaymentMethods')}
              </h3>
              <ul className={`space-y-2 text-sm ${theme === 'dark' ? 'text-blue-200' : 'text-blue-800'}`}>
                <li className="flex items-center gap-2">
                  <span>💳</span>
                  <span><strong>Wise</strong> - {t('wiseDescription')}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span>₿</span>
                  <span><strong>{t('anyCryptocurrency')}</strong> - {t('cryptoDescription')}</span>
                </li>
              </ul>
            </div>

            <div className={`${theme === 'dark' ? 'bg-yellow-500/20 border border-yellow-400/30' : 'bg-yellow-50 border border-yellow-200'} rounded-lg p-4 mb-6`}>
              <p className={`text-sm ${theme === 'dark' ? 'text-yellow-200' : 'text-yellow-800'}`}>
                <strong>{t('instructions')}</strong> {t('manualPaymentInstructions')}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={redirectToTelegramManual}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
                {t('openTelegram')}
              </button>
              <button
                onClick={() => {
                  setShowManualPaymentModal(false)
                  setPendingManualPayment(null)
                }}
                className={`px-4 py-3 rounded-lg font-semibold transition-colors ${
                  theme === 'dark' 
                    ? 'bg-white/10 text-white hover:bg-white/20' 
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}