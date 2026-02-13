import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useTranslation } from '@/lib/i18n-helper'
import axios from 'axios'
import toast from 'react-hot-toast'
import QRCode from 'qrcode.react'
import Link from 'next/link'

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

export default function Plans() {
  const { t, translatePlanName } = useTranslation()
  const { data: session } = useSession()
  const router = useRouter()
  const [plans, setPlans] = useState<Plan[]>([])
  const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'CRYPTO' | 'CARD' | null>(null)
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null)
  const [loading, setLoading] = useState(false)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Modals and Forms
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [customerEmail, setCustomerEmail] = useState('')
  const [pendingPayment, setPendingPayment] = useState<{ plan: Plan; method: 'PIX' | 'CRYPTO' } | null>(null)
  const [checkingPayment, setCheckingPayment] = useState(false)

  // Coupons
  const [couponCode, setCouponCode] = useState('')
  const [couponPlanId, setCouponPlanId] = useState<string>('')
  const [couponApplying, setCouponApplying] = useState(false)
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null)

  // Card Payment
  const [showCardModal, setShowCardModal] = useState(false)
  const [pendingCardPayment, setPendingCardPayment] = useState<Plan | null>(null)
  const [cardNumber, setCardNumber] = useState('')
  const [cardExpMonth, setCardExpMonth] = useState('')
  const [cardExpYear, setCardExpYear] = useState('')
  const [cardCvv, setCardCvv] = useState('')
  const [cardHolderName, setCardHolderName] = useState('')
  const [cardEmail, setCardEmail] = useState('')
  const [processingCard, setProcessingCard] = useState(false)

  // Bitcoin & Manual
  const [showLanguageModal, setShowLanguageModal] = useState(false)
  const [pendingBitcoinPayment, setPendingBitcoinPayment] = useState<Plan | null>(null)
  const [selectedLanguage, setSelectedLanguage] = useState<string>('pt')
  const [showManualPaymentModal, setShowManualPaymentModal] = useState(false)
  const [pendingManualPayment, setPendingManualPayment] = useState<Plan | null>(null)

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
  }, [couponCode, couponPlanId])

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
      } catch (error) {
        console.log('Checking payment...')
      } finally {
        setCheckingPayment(false)
      }
    }, intervalTime)
    return () => clearInterval(interval)
  }, [paymentData?.id, paymentMethod, checkingPayment])

  const loadPlans = async () => {
    try {
      const response = await axios.get('/api/plans?type=SITE')
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
      if (!silent) setCouponApplying(true)
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
      if (!silent) toast.success(t('couponApplied'))
      return data
    } catch (error: any) {
      const message = error.response?.data?.error || t('invalidCoupon')
      toast.error(message)
      setAppliedCoupon(null)
      return null
    } finally {
      if (!silent) setCouponApplying(false)
    }
  }

  const handlePayment = async (plan: Plan, method: 'PIX' | 'CRYPTO' | 'CARD') => {
    if (!session) {
      toast.error(t('loginToContinue'))
      router.push('/login')
      return
    }

    if (couponCode.trim()) {
      const valid = await validateCouponForPlan(plan, true)
      if (!valid) return
    }

    if (method === 'PIX') {
      setPendingPayment({ plan, method })
      setShowEmailModal(true)
      return
    }

    if (method === 'CARD') {
      setPendingCardPayment(plan)
      if (!cardEmail) {
        const emailFromSession = (session.user as any)?.email || ''
        if (emailFromSession) setCardEmail(emailFromSession)
      }
      if (!cardHolderName) {
        const holder = (session.user as any)?.username || ''
        if (holder) setCardHolderName(holder.toUpperCase())
      }
      setShowCardModal(true)
      return
    }

    if (method === 'CRYPTO') {
      setPendingBitcoinPayment(plan)
      setShowLanguageModal(true)
      return
    }
  }

  const createPixPayment = async (plan: Plan, email: string) => {
    setLoading(true)
    setPaymentMethod('PIX')
    setShowEmailModal(false)
    const normalizedCoupon = couponCode.trim().toUpperCase()

    try {
      const response = await axios.post('/api/payments/create', {
        planId: plan.id,
        method: 'PIX',
        customerEmail: email,
        couponCode: normalizedCoupon || undefined
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
      if (normalizedCoupon && response.data.discountAmount) {
        setAppliedCoupon({
          code: normalizedCoupon,
          planId: plan.id,
          discountAmount: response.data.discountAmount,
          finalAmount: response.data.finalAmount ?? plan.price
        })
      }
      toast.success(t('pixPaymentCreated'))
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('errorCreatingPix'))
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
    if (pendingPayment?.method === 'PIX') {
      createPixPayment(pendingPayment.plan, customerEmail)
    }
  }

  const createCardPayment = async () => {
    if (!pendingCardPayment) return
    // Simple validation
    const cleanCardNumber = cardNumber.replace(/\D/g, '')
    if (cleanCardNumber.length < 13 || cleanCardNumber.length > 19) {
      toast.error(t('invalidCardNumber'))
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
        customerEmail: cardEmail,
        couponCode: couponCode.trim().toUpperCase() || undefined
      })
      setShowCardModal(false)
      const paymentId = response.data.id || response.data.paymentId
      router.push(`/payment-status/${paymentId}`)
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('cardPaymentError'))
    } finally {
      setProcessingCard(false)
    }
  }

  const formatCardNumber = (value: string) => {
    const numbers = value.replace(/\D/g, '')
    const formatted = numbers.replace(/(\d{4})(?=\d)/g, '$1 ')
    return formatted.substring(0, 19)
  }

  const handleLanguageSelection = () => {
    if (!pendingBitcoinPayment) return
    const telegramLink = `https://t.me/lynxdevz?start=bitcoin_${pendingBitcoinPayment.id}_${selectedLanguage}`
    window.open(telegramLink, '_blank')
    setShowLanguageModal(false)
    setPendingBitcoinPayment(null)
  }

  const handleManualPayment = (plan: Plan) => {
    setPendingManualPayment(plan)
    setShowManualPaymentModal(true)
  }

  const redirectToTelegramManual = () => {
    if (!pendingManualPayment) return
    const telegramLink = `https://t.me/lynxdevz?start=manual_${pendingManualPayment.id}`
    window.open(telegramLink, '_blank')
    setShowManualPaymentModal(false)
    setPendingManualPayment(null)
  }

  return (
    <div className="min-h-screen bg-[#000000] text-gray-100 pb-20">
      {/* Advanced Background with Mouse Tracking - Reduced for Mobile */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div 
          className="absolute w-[600px] h-[400px] sm:w-[1200px] sm:h-[800px] bg-[radial-gradient(circle,rgba(79,70,229,0.15)_0%,transparent_70%)] blur-[100px] sm:blur-[150px] transition-all duration-1000 ease-out hidden sm:block"
          style={{
            transform: `translate(${(mousePosition.x - 600) * 0.02}px, ${(mousePosition.y - 400) * 0.02}px)`,
            left: `${mousePosition.x - 600}px`,
            top: `${mousePosition.y - 400}px`
          }}
        />
        <div 
          className="absolute w-[500px] h-[300px] sm:w-[1000px] sm:h-[600px] bg-[radial-gradient(circle,rgba(236,72,153,0.1)_0%,transparent_70%)] blur-[80px] sm:blur-[120px] transition-all duration-1000 ease-out hidden sm:block"
          style={{
            transform: `translate(${(mousePosition.x - 500) * -0.01}px, ${(mousePosition.y - 300) * -0.01}px)`,
            right: `${500 - mousePosition.x}px`,
            bottom: `${300 - mousePosition.y}px`
          }}
        />
        <div 
          className="absolute w-[400px] h-[400px] sm:w-[800px] sm:h-[800px] bg-[radial-gradient(circle,rgba(59,130,246,0.08)_0%,transparent_70%)] blur-[60px] sm:blur-[100px] transition-all duration-1000 ease-out hidden sm:block"
          style={{
            transform: `translate(${(mousePosition.x - 400) * 0.015}px, ${(mousePosition.y - 400) * 0.015}px)`,
            left: `${mousePosition.x * 0.1}px`,
            bottom: `${mousePosition.y * 0.1}px`
          }}
        />
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-30 sm:opacity-100" />
        
        {/* Floating particles effect - Reduced for Mobile */}
        <div className="absolute inset-0 hidden sm:block">
          {[...Array(15)].map((_, i) => (
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg blur-sm opacity-75 group-hover:opacity-100 transition-opacity" />
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-lg sm:text-xl font-bold text-white relative">
                💎
              </div>
            </div>
            <div>
              <h1 className="font-bold text-lg sm:text-xl text-white">Planos Premium</h1>
              <p className="text-xs sm:text-sm text-gray-400 hidden sm:block">Escolha seu plano ideal</p>
            </div>
          </div>
          
          {/* Desktop Navigation */}
          <div className="hidden sm:flex items-center gap-3">
            <Link href="/dashboard" className="group relative overflow-hidden px-6 py-2.5 rounded-full glass-panel border border-white/20 hover:bg-white/5 transition-all duration-300">
              <span className="relative z-10">⚡ Dashboard</span>
              <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={toggleMobileMenu}
            className="sm:hidden p-2 rounded-lg glass-panel border border-white/20 hover:bg-white/5 transition-all duration-300"
          >
            <div className="w-6 h-6 flex flex-col justify-center items-center">
              <span className={`bg-white block transition-all duration-300 ease-out h-0.5 w-6 rounded-sm ${isMobileMenuOpen ? 'rotate-45 translate-y-1' : '-translate-y-0.5'}`}></span>
              <span className={`bg-white block transition-all duration-300 ease-out h-0.5 w-6 rounded-sm my-0.5 ${isMobileMenuOpen ? 'opacity-0' : 'opacity-100'}`}></span>
              <span className={`bg-white block transition-all duration-300 ease-out h-0.5 w-6 rounded-sm ${isMobileMenuOpen ? '-rotate-45 -translate-y-1' : 'translate-y-0.5'}`}></span>
            </div>
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="sm:hidden absolute top-full left-0 w-full bg-black/95 backdrop-blur-xl border-b border-white/10">
            <div className="px-4 py-4 space-y-3">
              <Link 
                href="/dashboard" 
                className="block px-4 py-3 rounded-xl glass-panel border border-white/20 hover:bg-white/5 transition-all duration-300 text-center"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                ⚡ Dashboard
              </Link>
            </div>
          </div>
        )}
      </nav>

      <main className="relative z-10 pt-24 sm:pt-32 pb-24 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          
          {/* Hero Section */}
          <div className="text-center mb-12 sm:mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs sm:text-sm font-medium mb-6 sm:mb-8">
              <span className="relative flex h-1.5 w-1.5 sm:h-2 sm:w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 sm:h-2 sm:w-2 bg-indigo-500"></span>
              </span>
              Planos Premium
            </div>
            
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              Escolha Seu Plano
            </h1>
            <p className="text-base sm:text-xl text-gray-400 max-w-2xl sm:max-w-3xl mx-auto mb-8 sm:mb-12">
              Libere todo o potencial do gerador com nossos planos premium. Gerações ilimitadas, suporte prioritário e muito mais.
            </p>
            
            <div className="flex flex-wrap gap-3 sm:gap-4 justify-center">
              <a href="https://t.me/geradordecontasbr" target="_blank" className="group relative overflow-hidden flex items-center gap-2 sm:gap-3 px-4 py-2.5 sm:px-6 sm:py-3 bg-[#0088cc] hover:bg-[#0077b5] text-white rounded-xl sm:rounded-2xl font-semibold text-sm sm:text-base transition-all shadow-lg hover:shadow-[#0088cc]/30">
                <span className="relative z-10">📱 Telegram</span>
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
              <a href="https://discord.gg/KWZ5fctz3b" target="_blank" className="group relative overflow-hidden flex items-center gap-2 sm:gap-3 px-4 py-2.5 sm:px-6 sm:py-3 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-xl sm:rounded-2xl font-semibold text-sm sm:text-base transition-all shadow-lg hover:shadow-[#5865F2]/30">
                <span className="relative z-10">💬 Discord</span>
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            </div>
          </div>

          {/* Coupon Section */}
          {plans.length > 0 && (
            <div className="glass-card rounded-2xl sm:rounded-3xl p-6 sm:p-8 mb-12 sm:mb-16 max-w-3xl mx-auto border border-white/10">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 gap-3">
                <h3 className="text-xl sm:text-2xl font-bold text-white">Tem um cupom?</h3>
                <span className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm text-emerald-200 bg-emerald-500/10 border border-emerald-500/20">
                  💰 Economize mais
                </span>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  className="flex-1 bg-black/40 border border-white/20 rounded-xl sm:rounded-2xl px-4 sm:px-6 py-3 sm:py-4 text-white text-base sm:text-lg placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all uppercase tracking-widest"
                  placeholder="PROMO50"
                />
                <select
                  value={couponPlanId}
                  onChange={(e) => setCouponPlanId(e.target.value)}
                  className="bg-black/40 border border-white/20 rounded-xl sm:rounded-2xl px-4 sm:px-6 py-3 sm:py-4 text-white text-base sm:text-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                >
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id} className="bg-gray-900">
                      {translatePlanName ? translatePlanName(plan.name) : plan.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    const plan = plans.find(p => p.id === couponPlanId)
                    if (plan) validateCouponForPlan(plan)
                  }}
                  disabled={!couponCode || couponApplying}
                  className="group relative overflow-hidden px-6 py-3 sm:px-8 sm:py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg hover:shadow-xl sm:hover:shadow-2xl hover:shadow-purple-500/50 transition-all disabled:opacity-50"
                >
                  <span className="relative z-10">{t('applyCoupon')}</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </div>
              {appliedCoupon && (
                <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 rounded-xl sm:rounded-2xl text-emerald-300 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                  <span className="font-semibold text-sm sm:text-base">💰 Desconto aplicado: -{t('currencySymbol')} {appliedCoupon.discountAmount.toFixed(2)} • Preço final: {t('currencySymbol')} {appliedCoupon.finalAmount.toFixed(2)}</span>
                  <button onClick={() => setAppliedCoupon(null)} className="text-white hover:text-red-400 text-lg sm:text-xl self-start sm:self-auto">×</button>
                </div>
              )}
            </div>
          )}

          {/* Plans Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 mb-12 sm:mb-16">
            {plans.map((plan, index) => (
              <div key={plan.id} className={`group glass-card rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-white/10 hover:border-indigo-500/30 transition-all duration-500 hover:-translate-y-1 sm:hover:-translate-y-2 relative overflow-hidden ${index === 1 ? 'lg:scale-105 shadow-xl sm:shadow-2xl shadow-indigo-500/20' : ''}`}>
                {index === 1 && (
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                    <div className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-4 py-1.5 sm:px-6 sm:py-2 rounded-full text-xs sm:text-sm font-bold uppercase tracking-wider shadow-lg">
                      ⭐ Mais Popular
                    </div>
                  </div>
                )}

                <div className="text-center mb-6 sm:mb-8">
                  <h3 className="text-2xl sm:text-3xl font-bold text-white mb-2 sm:mb-3">{translatePlanName ? translatePlanName(plan.name) : plan.name}</h3>
                  <p className="text-gray-400 text-base sm:text-lg mb-4 sm:mb-6 min-h-[40px] sm:min-h-[60px]">{plan.description}</p>
                  
                  <div className="mb-6 sm:mb-8">
                    <span className="text-3xl sm:text-5xl font-bold text-white tracking-tight">{t('currencySymbol')}{plan.price.toFixed(2)}</span>
                    <span className="text-gray-500 ml-1 sm:ml-2 text-sm sm:text-lg">/ {plan.duration} {t('daysAccess')}</span>
                  </div>
                </div>

                <div className="space-y-3 sm:space-y-4 mb-8 sm:mb-10">
                  <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-white/5 border border-white/10">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center text-lg sm:text-xl">✓</div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-white text-base sm:text-lg">{plan.maxGenerations === 0 ? t('unlimitedLabel') : `${plan.maxGenerations} ${t('generations')}`}</div>
                      <div className="text-xs sm:text-sm text-gray-400">Gerações disponíveis</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-white/5 border border-white/10">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center text-lg sm:text-xl">✓</div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-white text-base sm:text-lg">{t('accessAllServices')}</div>
                      <div className="text-xs sm:text-sm text-gray-400">Todos os serviços premium</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-white/5 border border-white/10">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-lg sm:text-xl">✓</div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-white text-base sm:text-lg">Suporte 24/7</div>
                      <div className="text-xs sm:text-sm text-gray-400">Atendimento prioritário</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 sm:space-y-4">
                  <button
                    onClick={() => handlePayment(plan, 'PIX')}
                    className="group relative overflow-hidden w-full py-3 sm:py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg hover:shadow-xl sm:hover:shadow-2xl hover:shadow-green-500/50 transition-all"
                  >
                    <span className="relative z-10">💚 Pagar com PIX</span>
                    <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                  
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <button
                      onClick={() => handlePayment(plan, 'CARD')}
                      className="group relative overflow-hidden py-2.5 sm:py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base hover:shadow-lg hover:shadow-blue-500/50 transition-all"
                    >
                      <span className="relative z-10">💳 Cartão</span>
                      <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                    <button
                      onClick={() => handlePayment(plan, 'CRYPTO')}
                      className="group relative overflow-hidden py-2.5 sm:py-3 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base hover:shadow-lg hover:shadow-orange-500/50 transition-all"
                    >
                      <span className="relative z-10">₿ Crypto</span>
                      <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* --- MODALS --- */}

          {/* Email Modal */}
          {showEmailModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-sm">
              <div className="glass-card p-6 sm:p-8 rounded-2xl sm:rounded-3xl max-w-md w-full border border-white/10">
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6">Informe seu email</h2>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full bg-black/40 border border-white/20 rounded-xl sm:rounded-2xl px-4 sm:px-6 py-3 sm:py-4 text-white text-base sm:text-lg placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all mb-6 sm:mb-8"
                />
                <div className="flex gap-3 sm:gap-4">
                  <button onClick={handleEmailSubmit} className="flex-1 group relative overflow-hidden py-3 sm:py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg hover:shadow-lg hover:shadow-indigo-500/50 transition-all">
                    <span className="relative z-10">Continuar</span>
                    <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                  <button onClick={() => setShowEmailModal(false)} className="px-4 py-3 sm:px-6 sm:py-4 border border-white/20 rounded-xl sm:rounded-2xl text-white hover:bg-white/5 transition-all font-semibold text-sm sm:text-base">
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Language Modal (Crypto) */}
          {showLanguageModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-sm">
              <div className="glass-card p-6 sm:p-8 rounded-2xl sm:rounded-3xl max-w-sm w-full border border-white/10">
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-6 sm:mb-8 text-center">Selecione o idioma</h3>
                <div className="space-y-3 sm:space-y-4">
                  {['pt', 'en', 'es'].map((lang) => (
                    <button
                      key={lang}
                      onClick={() => { setSelectedLanguage(lang); setTimeout(handleLanguageSelection, 100); }}
                      className="group relative overflow-hidden w-full py-3 sm:py-4 rounded-xl sm:rounded-2xl border border-white/20 hover:bg-white/5 text-white font-bold text-base sm:text-lg uppercase transition-all"
                    >
                      <span className="relative z-10">{lang}</span>
                      <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
                <button onClick={() => setShowLanguageModal(false)} className="mt-6 sm:mt-8 w-full py-3 sm:py-4 text-gray-400 hover:text-white transition-colors font-semibold text-sm sm:text-base">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Payment Modal - PIX */}
          {(paymentData || (paymentMethod && loading)) && pendingPayment && paymentMethod === 'PIX' && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-sm overflow-y-auto">
              <div className="glass-card p-6 sm:p-8 rounded-2xl sm:rounded-3xl max-w-lg w-full border border-white/10">
                <div className="flex justify-between items-center mb-6 sm:mb-8">
                  <h3 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2 sm:gap-3">
                    <span className="text-green-400">❖</span> Pagamento via PIX
                  </h3>
                  <button onClick={() => { setPaymentData(null); setPaymentMethod(null); }} className="text-gray-400 hover:text-white transition-colors text-xl sm:text-2xl">
                    ×
                  </button>
                </div>

                {loading ? (
                  <div className="flex flex-col items-center justify-center py-12 sm:py-16">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4 sm:mb-6" />
                    <p className="text-gray-400 animate-pulse text-base sm:text-lg">Criando pagamento PIX...</p>
                  </div>
                ) : (
                  <div className="space-y-6 sm:space-y-8">
                    <div className="text-center">
                      <p className="text-xs sm:text-sm text-gray-400 mb-2 sm:mb-3">Valor final</p>
                      <p className="text-3xl sm:text-5xl font-bold text-white mb-1 sm:mb-2">{t('currencySymbol')}{paymentData?.finalAmount?.toFixed(2)}</p>
                      {paymentData?.discountAmount ? (
                        <p className="text-emerald-400 text-sm sm:text-lg">💰 Desconto: {t('currencySymbol')}{paymentData.discountAmount.toFixed(2)}</p>
                      ) : null}
                    </div>

                    {paymentData?.pixCopyPaste && (
                      <div className="flex justify-center">
                        <div className="bg-white p-4 sm:p-6 rounded-xl sm:rounded-2xl shadow-xl sm:shadow-2xl shadow-green-900/20">
                          <QRCode
                            value={paymentData.pixCopyPaste}
                            size={200}
                            renderAs="svg"
                            level="M"
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-3 sm:space-y-4">
                      <label className="text-xs sm:text-sm text-gray-400 block">Código PIX copia e cola</label>
                      <div className="flex gap-2 sm:gap-3">
                        <input
                          readOnly
                          value={paymentData?.pixCopyPaste || ''}
                          className="flex-1 bg-black/40 border border-white/20 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 text-xs text-gray-300 font-mono truncate focus:outline-none"
                        />
                        <button
                          onClick={() => {
                            if (paymentData?.pixCopyPaste) {
                              navigator.clipboard.writeText(paymentData.pixCopyPaste)
                              toast.success('Código PIX copiado!')
                            }
                          }}
                          className="group relative overflow-hidden px-3 py-2.5 sm:px-4 sm:py-3 bg-white/10 hover:bg-white/20 rounded-xl sm:rounded-2xl text-white transition-colors"
                        >
                          <span className="relative z-10">📋</span>
                          <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      </div>
                    </div>

                    <div className="bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-500/20 rounded-xl sm:rounded-2xl p-4 sm:p-6">
                      <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-500 animate-pulse" />
                        <span className="text-blue-400 font-bold text-base sm:text-lg">Aguardando pagamento</span>
                      </div>
                      <p className="text-xs sm:text-sm text-blue-300/80">O pagamento será confirmado automaticamente assim que o PIX for detectado.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Payment Modal - CARD */}
          {showCardModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
              <div className="glass-card p-8 rounded-3xl max-w-md w-full border border-white/10">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-2xl font-bold text-white">Pagamento com Cartão</h3>
                  <button onClick={() => setShowCardModal(false)} className="text-gray-400 hover:text-white text-2xl">×</button>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); createCardPayment(); }} className="space-y-6">
                  <div>
                    <label className="block text-sm text-gray-400 mb-3">Nome do titular</label>
                    <input
                      value={cardHolderName}
                      onChange={e => setCardHolderName(e.target.value.toUpperCase())}
                      placeholder="NOME COMPLETO"
                      className="w-full bg-black/40 border border-white/20 rounded-2xl px-6 py-4 text-white text-lg placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-400 mb-3">Email</label>
                    <input
                      type="email"
                      value={cardEmail}
                      onChange={e => setCardEmail(e.target.value)}
                      placeholder="seu@email.com"
                      className="w-full bg-black/40 border border-white/20 rounded-2xl px-6 py-4 text-white text-lg placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-400 mb-3">Número do cartão</label>
                    <input
                      value={cardNumber}
                      onChange={e => setCardNumber(formatCardNumber(e.target.value))}
                      placeholder="0000 0000 0000 0000"
                      className="w-full bg-black/40 border border-white/20 rounded-2xl px-6 py-4 text-white text-lg placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all font-mono"
                      maxLength={19}
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm text-gray-400 mb-3">Validade</label>
                      <div className="flex gap-3">
                        <input
                          value={cardExpMonth}
                          onChange={e => setCardExpMonth(e.target.value.replace(/\D/g, '').slice(0, 2))}
                          placeholder="MM"
                          className="w-full bg-black/40 border border-white/20 rounded-2xl px-4 py-4 text-white text-lg placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-center"
                          required
                        />
                        <input
                          value={cardExpYear}
                          onChange={e => setCardExpYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                          placeholder="YYYY"
                          className="w-full bg-black/40 border border-white/20 rounded-2xl px-4 py-4 text-white text-lg placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-center"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-3">CVV</label>
                      <input
                        value={cardCvv}
                        onChange={e => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="123"
                        className="w-full bg-black/40 border border-white/20 rounded-2xl px-4 py-4 text-white text-lg placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-center"
                        type="password"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={processingCard}
                    className="group relative overflow-hidden w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-bold text-lg hover:shadow-2xl hover:shadow-blue-500/50 transition-all disabled:opacity-50 mt-4"
                  >
                    <span className="relative z-10">{processingCard ? 'Processando...' : 'Pagar Agora'}</span>
                    <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>

                  <div className="flex items-center justify-center gap-4 text-sm text-gray-500 mt-4">
                    <span className="flex items-center gap-2">🔒 Seguro com SSL</span>
                    <span className="flex items-center gap-2">🛡️ PCI Compliance</span>
                  </div>
                </form>
              </div>
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
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
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