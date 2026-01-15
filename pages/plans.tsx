import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useTranslation } from '@/lib/i18n-helper'
import { useTheme } from '@/contexts/ThemeContext'
import { getThemeClasses } from '@/lib/theme-utils'
import axios from 'axios'
import toast from 'react-hot-toast'
import QRCode from 'qrcode.react'

interface Plan {
  id: string
  name: string
  description: string
  price: number
  duration: number
  maxGenerations: number
}

interface PaymentData {
  id: string
  pixQrCodeImage?: string  // Imagem base64 completa do QR code
  pixQrCode?: string       // Código copia e cola (para gerar QR code se não tiver imagem)
  pixCopyPaste?: string   // Código copia e cola
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

export default function Plans() {
  const { t } = useTranslation()
  const { data: session } = useSession()
  const { theme } = useTheme()
  const router = useRouter()
  const [plans, setPlans] = useState<Plan[]>([])
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'CRYPTO' | 'CARD' | null>(null)
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null)
  const [loading, setLoading] = useState(false)
  const [qrCodeImageError, setQrCodeImageError] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [customerEmail, setCustomerEmail] = useState('')
  const [pendingPayment, setPendingPayment] = useState<{ plan: Plan; method: 'PIX' | 'CRYPTO' } | null>(null)
  const [checkingPayment, setCheckingPayment] = useState(false)
  const [couponCode, setCouponCode] = useState('')
  const [couponPlanId, setCouponPlanId] = useState<string>('')
  const [couponApplying, setCouponApplying] = useState(false)
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null)
  const [showCardModal, setShowCardModal] = useState(false)
  const [pendingCardPayment, setPendingCardPayment] = useState<Plan | null>(null)
  const [cardNumber, setCardNumber] = useState('')
  const [cardExpMonth, setCardExpMonth] = useState('')
  const [cardExpYear, setCardExpYear] = useState('')
  const [cardCvv, setCardCvv] = useState('')
  const [cardHolderName, setCardHolderName] = useState('')
  const [cardEmail, setCardEmail] = useState('')
  const [processingCard, setProcessingCard] = useState(false)
  const themeClasses = getThemeClasses(theme)

  useEffect(() => {
    loadPlans()
  }, [])

  useEffect(() => {
    if (!couponPlanId && plans.length > 0) {
      setCouponPlanId(plans[0].id)
    }
  }, [plans, couponPlanId])

  useEffect(() => {
    setAppliedCoupon(null)
  }, [couponCode])

  useEffect(() => {
    setAppliedCoupon(null)
  }, [couponPlanId])

  // Verificar status do pagamento (PIX e Bitcoin) periodicamente
  // Isso substitui a necessidade de cron jobs no Vercel
  useEffect(() => {
    if (!paymentData?.id || !paymentMethod || checkingPayment) {
      return
    }

    // Verificar a cada 5 segundos para PIX, 10 segundos para Bitcoin
    const intervalTime = paymentMethod === 'PIX' ? 5000 : 10000
    
    const interval = setInterval(async () => {
      if (!paymentData?.id) return

      try {
        setCheckingPayment(true)
        
        // Usar a nova API unificada de verificação de status
        const response = await axios.get(`/api/payments/check-status?paymentId=${paymentData.id}`)

        if (response.data.status === 'PAID') {
          clearInterval(interval)
          toast.success(t('paymentConfirmed'))
          // Recarregar a página após 2 segundos para atualizar o plano do usuário
          setTimeout(() => {
            window.location.reload()
          }, 2000)
        }
      } catch (error: any) {
        // Ignorar erros silenciosamente (pode ser que o pagamento ainda não foi confirmado)
        console.log('Verificando pagamento...')
      } finally {
        setCheckingPayment(false)
      }
    }, intervalTime)

    // Limpar intervalo quando o componente desmontar ou o pagamento mudar
    return () => clearInterval(interval)
  }, [paymentData?.id, paymentMethod, checkingPayment])

  const loadPlans = async () => {
    try {
      const response = await axios.get('/api/plans')
      setPlans(response.data)
    } catch (error) {
      toast.error(t('errorLoadingPlans'))
    }
  }

  const validateCouponForPlan = async (plan: Plan, silent = false) => {
    const trimmedCode = couponCode.trim().toUpperCase()
    if (!trimmedCode) {
      toast.error(t('invalidCoupon'))
      return null
    }

    try {
      if (!silent) {
        setCouponApplying(true)
      }
      const response = await axios.post('/api/coupons/validate', {
        code: trimmedCode,
        planId: plan.id
      })

      const data = response.data
      setAppliedCoupon({
        code: trimmedCode,
        planId: plan.id,
        discountAmount: data.discountAmount,
        finalAmount: data.finalAmount
      })

      if (!silent) {
        toast.success(t('couponApplied'))
      }

      return data
    } catch (error: any) {
      const message = error.response?.data?.error || t('invalidCoupon')
      toast.error(message)
      setAppliedCoupon(null)
      return null
    } finally {
      if (!silent) {
        setCouponApplying(false)
      }
    }
  }

  const handlePayment = async (plan: Plan, method: 'PIX' | 'CRYPTO' | 'CARD') => {
    if (!session) {
      toast.error(t('loginToContinue'))
      router.push('/login')
      return
    }

    const trimmedCoupon = couponCode.trim()
    const normalizedCoupon = trimmedCoupon ? trimmedCoupon.toUpperCase() : ''
    if (trimmedCoupon) {
      const valid = await validateCouponForPlan(plan, true)
      if (!valid) {
        return
      }
    }

    // Para PIX, pedir email do cliente primeiro (obrigatório no PagSeguro)
    if (method === 'PIX') {
      // Sempre mostrar modal para coletar email (mesmo que o usuário tenha email cadastrado)
      // Isso garante que o email seja válido e diferente do email do vendedor
      setPendingPayment({ plan, method })
      setShowEmailModal(true)
      return
    }

    // Para cartão, mostrar modal para coletar dados do cartão
    if (method === 'CARD') {
      setPendingCardPayment(plan)
      setShowCardModal(true)
      return
    }

    if (method === 'CRYPTO') {
      // Para criptomoedas, criar pagamento via Binance
      setLoading(true)
      setSelectedPlan(plan)
      setPaymentMethod(method)
      
      try {
        console.log('🚀 Criando pagamento via criptomoedas...')
        const response = await axios.post('/api/payments/create', {
          planId: plan.id,
          method: 'BITCOIN', // Usar BITCOIN internamente para manter compatibilidade
          couponCode: normalizedCoupon || undefined
        })
        
        console.log('✅ Resposta recebida:', response.data)
        console.log('✅ Status HTTP:', response.status)
        console.log('✅ Tem bitcoinAddress?', !!response.data.bitcoinAddress)
        console.log('✅ Tem fallback?', !!response.data.fallback)
        
        // SEMPRE verificar primeiro se tem bitcoinAddress (sucesso Binance)
        if (response.data.bitcoinAddress) {
          console.log('✅ Dados Binance recebidos com sucesso!')
          console.log('📋 Dados completos:', JSON.stringify(response.data, null, 2))
          setPaymentData({
            ...response.data,
            originalAmount: response.data.originalAmount || plan.price,
            finalAmount: response.data.finalAmount ?? response.data.originalAmount ?? plan.price,
            discountAmount: response.data.discountAmount || 0
          })
          if (normalizedCoupon && response.data.discountAmount) {
            setAppliedCoupon({
              code: normalizedCoupon,
              planId: plan.id,
              discountAmount: response.data.discountAmount,
              finalAmount: response.data.finalAmount ?? plan.price
            })
          }
          setQrCodeImageError(false)
          toast.success(t('cryptoPaymentCreated'))
          // Garantir que o modal apareça
          setPaymentMethod('CRYPTO')
          setSelectedPlan(plan)
        } else {
          // Sem bitcoinAddress - mostrar erro mas NÃO redirecionar
          console.error('❌ Resposta não contém bitcoinAddress')
          console.error('❌ Resposta completa:', response.data)
          console.error('❌ Keys na resposta:', Object.keys(response.data))
          toast.error(t('errorIncompletePaymentData'))
          setLoading(false)
        }
      } catch (error: any) {
        console.error('❌ Erro HTTP ao criar pagamento:', error)
        console.error('❌ Status HTTP:', error.response?.status)
        console.error('❌ Error response data:', error.response?.data)
        console.error('❌ Error message:', error.message)
        
        // NUNCA redirecionar para Telegram automaticamente
        // Sempre mostrar erro ao usuário
        const errorMessage = error.response?.data?.error || error.response?.data?.details || error.message || t('errorCreatingPayment')
        toast.error(errorMessage)
        setLoading(false)
        
        // Se ainda assim tiver bitcoinAddress no erro (caso raro), usar
        if (error.response?.data?.bitcoinAddress) {
          console.log('⚠️ Erro HTTP mas tem bitcoinAddress, usando dados')
          setPaymentData(error.response.data)
          setPaymentMethod('CRYPTO')
          setSelectedPlan(plan)
        }
      }
      return
    }
  }

  const createPixPayment = async (plan: Plan, email: string) => {
    setLoading(true)
    setSelectedPlan(plan)
    setPaymentMethod('PIX')
    setShowEmailModal(false)
    const normalizedCoupon = couponCode.trim().toUpperCase()
    
    try {
      const response = await axios.post('/api/payments/create', {
        planId: plan.id,
        method: 'PIX',
        customerEmail: email, // Enviar email do cliente
        couponCode: normalizedCoupon || undefined
      })
      
      // Mapear dados da resposta para o formato esperado
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
      if (normalizedCoupon && response.data.discountAmount) {
        setAppliedCoupon({
          code: normalizedCoupon,
          planId: plan.id,
          discountAmount: response.data.discountAmount,
          finalAmount: response.data.finalAmount ?? plan.price
        })
      }
      setQrCodeImageError(false) // Resetar erro quando criar novo pagamento
      
      // Log para debug
      console.log('Payment data received:', {
        hasPixQrCodeImage: !!response.data.qrCodeImage || !!response.data.pixQrCodeImage,
        pixQrCodeImageLength: (response.data.qrCodeImage || response.data.pixQrCodeImage)?.length || 0,
        pixQrCodeImagePreview: (response.data.qrCodeImage || response.data.pixQrCodeImage)?.substring(0, 100) || 'null',
        hasPixCopyPaste: !!response.data.pixCopyPaste || !!response.data.pixQrCode,
        pixCopyPasteLength: (response.data.pixCopyPaste || response.data.pixQrCode)?.length || 0
      })
      
      toast.success(t('pixPaymentCreated'))
    } catch (error: any) {
      console.error('Erro ao criar pagamento PIX:', error)
      toast.error(error.response?.data?.error || error.response?.data?.message || t('errorCreatingPix'))
    } finally {
      setLoading(false)
    }
  }

  const handleEmailSubmit = () => {
    // Validar email
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
    return formatted.substring(0, 19) // Máximo 16 dígitos + 3 espaços
  }

  const createCardPayment = async () => {
    if (!pendingCardPayment) return

    // Validar dados do cartão
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
    const normalizedCoupon = couponCode.trim().toUpperCase()

    try {
      // Enviar pagamento - os dados são processados diretamente pelo PagBank
      // O PagBank usa criptografia SSL e não armazena dados em nossos servidores
      const response = await axios.post('/api/payments/create', {
        planId: pendingCardPayment.id,
        method: 'CARD',
        cardNumber: cleanCardNumber,
        cardExpMonth,
        cardExpYear,
        cardCvv,
        cardHolderName,
        customerEmail: cardEmail,
        couponCode: normalizedCoupon || undefined
      })

      // Sempre redirecionar para página de status do pagamento
      setShowCardModal(false)
      resetCardForm()
      
      // Redirecionar para página de status
      if (response.data.id || response.data.paymentId) {
        const paymentId = response.data.id || response.data.paymentId
        router.push(`/payment-status/${paymentId}`)
      } else {
        toast.error('Erro ao obter ID do pagamento')
      }
    } catch (error: any) {
      console.error('Erro ao processar pagamento via cartão:', error)
      const errorMessage = error.response?.data?.message || error.response?.data?.error || t('cardPaymentError')
      toast.error(errorMessage)
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

  return (
    <div className={`min-h-screen ${themeClasses.bg} py-6 sm:py-8 md:py-12 px-4 sm:px-6 lg:px-8`}>
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8 sm:mb-12">
          <h1 className={`text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4 px-2 ${themeClasses.text.primary}`}>{t('plans')}</h1>
          <p className={`text-base sm:text-lg md:text-xl max-w-2xl mx-auto px-4 ${themeClasses.text.secondary}`}>
            {t('plansDescription')}
          </p>
          
          {/* Botões Telegram e Discord */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center mt-6 sm:mt-8">
            <a
              href="https://t.me/geradordecontasbr"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
              </svg>
              <span>{t('joinTelegram')}</span>
            </a>
            <a
              href="https://discord.gg/KWZ5fctz3b"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-lg font-semibold hover:from-indigo-600 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              <span>{t('joinDiscord')}</span>
            </a>
          </div>
          <p className={`text-sm sm:text-base mt-3 sm:mt-4 px-4 ${themeClasses.text.secondary} max-w-2xl mx-auto`}>
            {t('freeKeys')}
          </p>
        </div>

        {plans.length > 0 && (
          <div className={`${themeClasses.card} rounded-2xl shadow-xl p-6 mb-8`}>
            <h3 className={`text-xl font-semibold mb-2 ${themeClasses.text.primary}`}>{t('enterCoupon')}</h3>
            <p className={`${themeClasses.text.secondary} text-sm mb-4`}>
              {t('couponPlaceholder')}
            </p>
            <div className="flex flex-col md:flex-row gap-3">
              <input
                type="text"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                className={`${themeClasses.input} flex-1 px-4 py-3 rounded-xl uppercase tracking-widest`}
                placeholder="PROMO50"
              />
              <select
                value={couponPlanId}
                onChange={(e) => setCouponPlanId(e.target.value)}
                className={`${themeClasses.input} md:w-56 px-4 py-3 rounded-xl`}
              >
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    const plan = plans.find((p) => p.id === couponPlanId)
                    if (!plan) {
                      toast.error(t('noPlansAvailable'))
                      return
                    }
                    await validateCouponForPlan(plan)
                  }}
                  disabled={!couponCode.trim() || couponApplying}
                  className="px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold rounded-xl hover:from-indigo-600 hover:to-purple-600 transition-all disabled:opacity-50"
                >
                  {couponApplying ? '...' : t('applyCoupon')}
                </button>
                {appliedCoupon && (
                  <button
                    onClick={() => setAppliedCoupon(null)}
                    className={`px-4 py-3 rounded-xl font-semibold ${theme === 'dark' ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                  >
                    {t('removeCoupon')}
                  </button>
                )}
              </div>
            </div>
            {appliedCoupon && (
              <div className="mt-4 text-sm">
                <p className={themeClasses.text.secondary}>
                  {t('discount')}: -{t('currencySymbol')} {appliedCoupon.discountAmount.toFixed(2)} • {t('finalPrice')}: {t('currencySymbol')} {appliedCoupon.finalAmount.toFixed(2)}
                </p>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8 mb-6 sm:mb-8">
          {plans.map((plan, index) => (
            <div
              key={plan.id}
              className={`${themeClasses.card} border-2 transition-all transform hover:-translate-y-2 hover:shadow-2xl ${
                index === 1 ? 'border-purple-500 sm:scale-105' : theme === 'dark' ? 'border-white/20 hover:border-purple-500' : 'border-gray-200 hover:border-primary-300'
              }`}
            >
              {index === 1 && (
                <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white text-center py-1.5 sm:py-2 rounded-lg mb-3 sm:mb-4 -mt-2 mx-4 sm:mx-8">
                  <span className="font-bold text-xs sm:text-sm">{t('mostPopular')}</span>
                </div>
              )}
              <h3 className={`text-xl sm:text-2xl font-bold mb-2 ${themeClasses.text.primary}`}>{plan.name}</h3>
              <p className={`text-sm sm:text-base mb-4 sm:mb-6 min-h-[60px] ${themeClasses.text.secondary}`}>{plan.description}</p>
              <div className="mb-4 sm:mb-6">
                <div className="flex items-baseline mb-2">
                  <span className={`text-3xl sm:text-4xl font-extrabold ${themeClasses.text.primary}`}>{t('currencySymbol')}</span>
                  <span className={`text-4xl sm:text-5xl font-extrabold ml-1 ${themeClasses.text.primary}`}>{plan.price.toFixed(2)}</span>
                </div>
                <p className={`${themeClasses.text.muted} text-xs sm:text-sm`}>{t('or')} {plan.duration} {t('daysAccess')}</p>
              </div>
              <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
                <div className={`flex items-center ${themeClasses.text.secondary}`}>
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{plan.duration} {t('daysAccess')}</span>
                </div>
                <div className={`flex items-center ${themeClasses.text.secondary}`}>
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{plan.maxGenerations === 0 ? t('unlimitedLabel') : `${plan.maxGenerations} ${t('generations')}`}</span>
                </div>
                <div className={`flex items-center ${themeClasses.text.secondary}`}>
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{t('accessAllServices')}</span>
                </div>
              </div>
              <div className="space-y-2 sm:space-y-3">
                <button
                  onClick={() => handlePayment(plan, 'PIX')}
                  disabled={loading}
                  className={`w-full py-2.5 sm:py-3 rounded-lg text-sm sm:text-base font-bold transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 touch-manipulation ${
                    index === 1
                      ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white hover:from-primary-700 hover:to-primary-800'
                      : 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800'
                  }`}
                >
                  {t('payViaPix')}
                </button>
                <button
                  onClick={() => handlePayment(plan, 'CRYPTO')}
                  disabled={loading}
                  className="w-full py-2.5 sm:py-3 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-lg text-sm sm:text-base font-bold hover:from-orange-700 hover:to-orange-800 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 touch-manipulation"
                >
                  {t('payViaCrypto')}
                </button>
                <button
                  onClick={() => handlePayment(plan, 'CARD')}
                  disabled={loading}
                  className="w-full py-2.5 sm:py-3 bg-gradient-to-r from-green-600 to-emerald-700 text-white rounded-lg text-sm sm:text-base font-bold hover:from-green-700 hover:to-emerald-800 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 touch-manipulation"
                >
                  💳 {t('payViaCard')}
                </button>
              </div>
            </div>
          ))}
        </div>

        {plans.length === 0 && (
          <div className="text-center py-12">
            <p className={`${themeClasses.text.secondary} text-lg`}>{t('noPlansAvailable')}</p>
          </div>
        )}
      </div>

      {/* Email Modal - Para coletar email do cliente antes de criar pagamento PIX */}
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

            {/* Plan info */}
            <div className={`${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'} rounded-lg p-4 mb-6`}>
              <p className={`text-sm ${themeClasses.text.secondary}`}>{pendingCardPayment.name}</p>
              <p className={`${themeClasses.text.primary} text-lg font-semibold`}>
                {t('currencySymbol')} {pendingCardPayment.price.toFixed(2)}
              </p>
              {appliedCoupon && appliedCoupon.planId === pendingCardPayment.id && (
                <>
                  <p className={`text-sm ${themeClasses.text.secondary}`}>
                    {t('discount')}: -{t('currencySymbol')} {appliedCoupon.discountAmount.toFixed(2)}
                  </p>
                  <p className="text-sm text-green-400 font-semibold">
                    {t('finalPrice')}: {t('currencySymbol')} {appliedCoupon.finalAmount.toFixed(2)}
                  </p>
                </>
              )}
            </div>
            
            <div className="space-y-4">
              {/* Card Number */}
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

              {/* Expiration and CVV */}
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

              {/* Card Holder Name */}
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

              {/* Email */}
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

              {/* Security Badges */}
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

              {/* Security Notice */}
              <div className={`${theme === 'dark' ? 'bg-green-500/20 border border-green-400/30' : 'bg-green-50 border border-green-200'} rounded-lg p-3`}>
                <p className={`text-xs flex items-start gap-2 ${theme === 'dark' ? 'text-green-200' : 'text-green-800'}`}>
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span>
                    {t('cardSecurityNoticeTokenized')}
                  </span>
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
                  <>
                    💳 {t('payNow')}
                  </>
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

      {/* Payment Modal */}
      {(paymentData || (paymentMethod && loading)) && selectedPlan && paymentMethod && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className={`${themeClasses.card} rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 max-w-md w-full mx-4 shadow-2xl my-4`}>
            <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 ${themeClasses.text.primary}`}>
              {t('paymentVia')} {paymentMethod === 'PIX' ? t('paymentMethodPix') : paymentMethod === 'CARD' ? t('paymentMethodCard') : t('paymentMethodCrypto')}
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
            
            {paymentMethod === 'PIX' && (loading && !paymentData ? (
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
                        // Exibir imagem base64 diretamente (QR code oficial do Asaas)
                        <img 
                          src={paymentData.pixQrCodeImage} 
                          alt={t('qrCodePixAlt')} 
                          className="w-48 h-48 sm:w-64 sm:h-64 object-contain mx-auto"
                          onError={(e) => {
                            console.error('Erro ao carregar imagem QR code')
                            console.error('Image src length:', paymentData.pixQrCodeImage?.length)
                            console.error('Image src preview:', paymentData.pixQrCodeImage?.substring(0, 100))
                            setQrCodeImageError(true)
                          }}
                          onLoad={() => {
                            console.log('QR code image loaded successfully')
                          }}
                        />
                      ) : paymentData.pixCopyPaste || paymentData.pixQrCode ? (
                        // Gerar QR code a partir do código copia e cola como fallback
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
                    {paymentData.pixCopyPaste && (
                      <div className="mt-4">
                        <label className={`block text-sm font-semibold mb-2 ${themeClasses.text.primary}`}>
                          {t('pixCodeCopyPaste')}
                        </label>
                        <textarea
                          value={paymentData.pixCopyPaste}
                          readOnly
                          className={`${themeClasses.input} w-full px-4 py-3 rounded-lg font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary-500`}
                          rows={4}
                          onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
              </>
            ))}

            {paymentMethod === 'CRYPTO' && paymentData && (
              <div className="space-y-4">
                {checkingPayment && (
                  <div className={`mb-4 p-3 rounded-lg ${theme === 'dark' ? 'bg-orange-500/20 border border-orange-400/30' : 'bg-orange-50 border border-orange-200'}`}>
                    <p className={`text-sm flex items-center gap-2 ${theme === 'dark' ? 'text-orange-200' : 'text-orange-800'}`}>
                      <span className="animate-spin">⏳</span>
                      {t('checkingPayment')}
                    </p>
                  </div>
                )}
                {paymentData.fallback ? (
                  <div className={`${theme === 'dark' ? 'bg-yellow-500/20 border border-yellow-400/30' : 'bg-yellow-50 border border-yellow-200'} rounded-lg p-4`}>
                    <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-yellow-200' : 'text-yellow-800'}`}>
                      <strong>{t('attention')}</strong> {t('autoPaymentUnavailable')}
                    </p>
                    <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-yellow-200' : 'text-yellow-800'}`}>
                      {t('contactTelegram')}
                    </p>
                    <a
                      href={paymentData.telegramLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block w-full text-center bg-blue-500 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-600 transition-colors"
                    >
                      {t('openTelegram')}
                    </a>
                  </div>
                ) : (
                  <>
                    <div className={`${theme === 'dark' ? 'bg-blue-500/20 border border-blue-400/30' : 'bg-blue-50 border border-blue-200'} rounded-lg p-4`}>
                      <p className={`text-sm font-semibold mb-2 ${theme === 'dark' ? 'text-blue-200' : 'text-blue-900'}`}>{t('amountToPay')}</p>
                      <p className={`text-2xl font-bold mb-1 ${theme === 'dark' ? 'text-blue-100' : 'text-blue-900'}`}>
                        {paymentData.bitcoinAmount?.toFixed(8)} {paymentData.currency || 'BTC'}
                      </p>
                      <p className={`text-sm ${theme === 'dark' ? 'text-blue-300' : 'text-blue-700'}`}>
                        ({t('currencySymbol')} {(paymentData.finalAmount ?? paymentData.originalAmount ?? selectedPlan.price).toFixed(2)})
                      </p>
                      {paymentData.discountAmount ? (
                        <p className={`text-xs ${theme === 'dark' ? 'text-green-300' : 'text-green-700'}`}>
                          {t('discount')}: -{t('currencySymbol')} {paymentData.discountAmount.toFixed(2)}
                        </p>
                      ) : null}
                    </div>
                    
                    <div>
                      <label className={`block text-sm font-semibold mb-2 ${themeClasses.text.primary}`}>
                        {t('bitcoinAddress')}
                      </label>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <input
                          type="text"
                          value={paymentData.bitcoinAddress || ''}
                          readOnly
                          className={`${themeClasses.input} flex-1 px-4 py-3 rounded-lg font-mono text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-500`}
                          onClick={(e) => (e.target as HTMLInputElement).select()}
                        />
                        <button
                          onClick={() => {
                            if (paymentData.bitcoinAddress) {
                              navigator.clipboard.writeText(paymentData.bitcoinAddress)
                              toast.success(t('addressCopied'))
                            }
                          }}
                          className="px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium whitespace-nowrap"
                        >
                          {t('copyButton')}
                        </button>
                      </div>
                    </div>

                    {paymentData.qrCode && (
                      <div className={`flex justify-center ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'} p-4 rounded-lg`}>
                        <QRCode 
                          value={paymentData.qrCode} 
                          size={256} 
                          className="w-48 h-48 sm:w-64 sm:h-64"
                        />
                      </div>
                    )}

                    <div className={`${theme === 'dark' ? 'bg-green-500/20 border border-green-400/30' : 'bg-green-50 border border-green-200'} rounded-lg p-4`}>
                      <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-green-200' : 'text-green-800'}`}>
                        <strong>{t('network')}</strong> {paymentData.network || t('bitcoin')}
                      </p>
                      <p className={`text-xs ${theme === 'dark' ? 'text-green-300' : 'text-green-700'}`}>
                        {t('sendExactly')} <strong>{paymentData.bitcoinAmount?.toFixed(8)} {paymentData.currency || 'BTC'}</strong> {t('toAddressAbove')}
                        {t('paymentProcessed')}
                      </p>
                    </div>

                    <div className={`${theme === 'dark' ? 'bg-yellow-500/20 border border-yellow-400/30' : 'bg-yellow-50 border border-yellow-200'} rounded-lg p-4`}>
                      <p className={`text-sm ${theme === 'dark' ? 'text-yellow-200' : 'text-yellow-800'}`}>
                        <strong>{t('important')}</strong> {t('importantText')}
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}

            <button
              onClick={() => {
                setPaymentData(null)
                setSelectedPlan(null)
                setPaymentMethod(null)
              }}
              className={`mt-4 sm:mt-6 w-full px-4 py-2.5 sm:py-3 rounded-lg text-sm sm:text-base font-semibold transition-colors touch-manipulation ${
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
    </div>
  )
}


