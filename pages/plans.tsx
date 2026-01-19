
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useTranslation } from '@/lib/i18n-helper'
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
    <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 relative overflow-hidden">

      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary-600/20 rounded-full blur-[100px] animate-pulse-slow" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-600/20 rounded-full blur-[100px] animate-pulse-slow delay-1000" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
            {t('plans')}
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            {t('plansDescription')}
          </p>

          <div className="flex flex-wrap gap-4 justify-center mt-8">
            <a href="https://t.me/geradordecontasbr" target="_blank" className="flex items-center gap-2 px-6 py-3 bg-[#0088cc] hover:bg-[#0077b5] text-white rounded-xl transition-all shadow-lg hover:shadow-[#0088cc]/30">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" /></svg>
              Telegram
            </a>
            <a href="https://discord.gg/KWZ5fctz3b" target="_blank" className="flex items-center gap-2 px-6 py-3 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-xl transition-all shadow-lg hover:shadow-[#5865F2]/30">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" /></svg>
              Discord
            </a>
          </div>
        </div>

        {plans.length > 0 && (
          <div className="glass-panel p-8 mb-12 max-w-2xl mx-auto rounded-2xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            <h3 className="text-xl font-bold mb-4 text-white">{t('enterCoupon')}</h3>
            <div className="flex flex-col md:flex-row gap-4">
              <input
                type="text"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 uppercase tracking-widest"
                placeholder="PROMO50"
              />
              <select
                value={couponPlanId}
                onChange={(e) => setCouponPlanId(e.target.value)}
                className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50"
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
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:contrast-125 transition-all disabled:opacity-50"
              >
                {t('applyCoupon')}
              </button>
            </div>
            {appliedCoupon && (
              <div className="mt-4 p-3 bg-green-500/20 border border-green-500/30 rounded-lg text-green-300 text-sm flex justify-between items-center">
                <span>{t('discount')}: -{t('currencySymbol')} {appliedCoupon.discountAmount.toFixed(2)} • {t('finalPrice')}: {t('currencySymbol')} {appliedCoupon.finalAmount.toFixed(2)}</span>
                <button onClick={() => setAppliedCoupon(null)} className="text-white hover:text-red-400">×</button>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {plans.map((plan, index) => (
            <div key={plan.id} className={`glass-card p-8 rounded-2xl border border-white/5 relative group hover:border-blue-500/30 transition-all duration-300 hover:-translate-y-2 ${index === 1 ? 'lg:scale-105 shadow-2xl shadow-blue-500/20' : ''}`}>
              {index === 1 && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-blue-500 to-purple-500 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg">
                  {t('mostPopular')}
                </div>
              )}

              <h3 className="text-2xl font-bold mb-2 text-white">{translatePlanName ? translatePlanName(plan.name) : plan.name}</h3>
              <p className="text-gray-400 mb-6 min-h-[50px]">{plan.description}</p>

              <div className="mb-8">
                <span className="text-4xl font-bold text-white tracking-tight">{t('currencySymbol')}{plan.price.toFixed(2)}</span>
                <span className="text-gray-500 ml-2">/ {plan.duration} {t('daysAccess')}</span>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex items-center gap-3 text-gray-300">
                  <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-400">✓</div>
                  <span>{plan.maxGenerations === 0 ? t('unlimitedLabel') : `${plan.maxGenerations} ${t('generations')}`}</span>
                </div>
                <div className="flex items-center gap-3 text-gray-300">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">✓</div>
                  <span>{t('accessAllServices')}</span>
                </div>
                <div className="flex items-center gap-3 text-gray-300">
                  <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400">✓</div>
                  <span>Support 24/7</span>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => handlePayment(plan, 'PIX')}
                  className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl font-bold text-white hover:contrast-125 transition-all shadow-lg shadow-green-900/20"
                >
                  {t('payViaPix')}
                </button>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handlePayment(plan, 'CARD')}
                    className="py-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl font-bold text-white hover:contrast-125 transition-all text-sm"
                  >
                    {t('payViaCard')}
                  </button>
                  <button
                    onClick={() => handlePayment(plan, 'CRYPTO')}
                    className="py-3 bg-gradient-to-r from-orange-600 to-red-600 rounded-xl font-bold text-white hover:contrast-125 transition-all text-sm"
                  >
                    Crypto
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* --- MODALS --- */}

        {/* Email Modal */}
        {showEmailModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="glass-panel p-8 rounded-2xl max-w-md w-full border border-white/10">
              <h2 className="text-2xl font-bold mb-4 text-white">{t('informEmail')}</h2>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white mb-6 focus:border-blue-500/50 outline-none"
              />
              <div className="flex gap-4">
                <button onClick={handleEmailSubmit} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold transition-all">
                  {t('continue')}
                </button>
                <button onClick={() => setShowEmailModal(false)} className="px-6 py-3 border border-white/10 rounded-xl text-white hover:bg-white/5 transition-all">
                  {t('cancel')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Language Modal (Crypto) */}
        {showLanguageModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="glass-panel p-8 rounded-2xl max-w-sm w-full border border-white/10">
              <h3 className="text-xl font-bold text-white mb-6 text-center">Select Language</h3>
              <div className="space-y-3">
                {['pt', 'en', 'es'].map((lang) => (
                  <button
                    key={lang}
                    onClick={() => { setSelectedLanguage(lang); setTimeout(handleLanguageSelection, 100); }}
                    className="w-full py-3 rounded-xl border border-white/10 hover:bg-white/5 text-white uppercase font-bold transition-all"
                  >
                    {lang}
                  </button>
                ))}
              </div>
              <button onClick={() => setShowLanguageModal(false)} className="mt-6 w-full py-3 text-gray-400 hover:text-white transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Payment Modal - PIX */}
        {(paymentData || (paymentMethod && loading)) && pendingPayment && paymentMethod === 'PIX' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
            <div className="glass-panel p-8 rounded-2xl max-w-md w-full border border-white/10 transform transition-all animate-fadeIn">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                  <span className="text-green-400">❖</span> {t('paymentVia')} {t('paymentMethodPix')}
                </h3>
                <button onClick={() => { setPaymentData(null); setPaymentMethod(null); }} className="text-gray-400 hover:text-white transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-gray-400 animate-pulse">{t('creatingPixPayment')}</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="text-center">
                    <p className="text-sm text-gray-400 mb-2">{t('finalPrice')}</p>
                    <p className="text-4xl font-bold text-white">{t('currencySymbol')}{paymentData?.finalAmount?.toFixed(2)}</p>
                    {paymentData?.discountAmount ? (
                      <p className="text-green-400 text-sm mt-1">{t('discount')}: {t('currencySymbol')}{paymentData.discountAmount.toFixed(2)}</p>
                    ) : null}
                  </div>

                  {paymentData?.pixCopyPaste && (
                    <div className="bg-white p-4 rounded-xl mx-auto w-64 h-64 flex items-center justify-center shadow-lg shadow-green-900/20">
                      <QRCode
                        value={paymentData.pixCopyPaste}
                        size={200}
                        renderAs="svg"
                        level="M"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-sm text-gray-400 block">{t('pixCodeCopyPaste')}</label>
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={paymentData?.pixCopyPaste || ''}
                        className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-300 font-mono truncate focus:outline-none"
                      />
                      <button
                        onClick={() => {
                          if (paymentData?.pixCopyPaste) {
                            navigator.clipboard.writeText(paymentData.pixCopyPaste)
                            toast.success('Copiado!')
                          }
                        }}
                        className="bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg text-white transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 012 2v8a2 2 0 01-2 2h-8a2 2 0 01-2-2v-8a2 2 0 012-2z" /></svg>
                      </button>
                    </div>
                  </div>

                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                      <span className="text-blue-400 font-bold text-sm">{t('waitProcessing')}</span>
                    </div>
                    <p className="text-xs text-blue-300/80">{t('autoActivationText')}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Payment Modal - CARD */}
        {showCardModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
            <div className="glass-panel p-8 rounded-2xl max-w-md w-full border border-white/10 transform transition-all animate-fadeIn">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white">{t('payViaCard')}</h3>
                <button onClick={() => setShowCardModal(false)} className="text-gray-400 hover:text-white">✕</button>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); createCardPayment(); }} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">{t('cardHolderName')}</label>
                  <input
                    value={cardHolderName}
                    onChange={e => setCardHolderName(e.target.value.toUpperCase())}
                    placeholder={t('cardHolderNamePlaceholder')}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500/50 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">{t('email')}</label>
                  <input
                    type="email"
                    value={cardEmail}
                    onChange={e => setCardEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500/50 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">{t('cardNumber')}</label>
                  <input
                    value={cardNumber}
                    onChange={e => setCardNumber(formatCardNumber(e.target.value))}
                    placeholder="0000 0000 0000 0000"
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500/50 outline-none font-mono"
                    maxLength={19}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">{t('expMonth')} / {t('expYear')}</label>
                    <div className="flex gap-2">
                      <input
                        value={cardExpMonth}
                        onChange={e => setCardExpMonth(e.target.value.replace(/\D/g, '').slice(0, 2))}
                        placeholder="MM"
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500/50 outline-none text-center"
                        required
                      />
                      <input
                        value={cardExpYear}
                        onChange={e => setCardExpYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="YYYY"
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500/50 outline-none text-center"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">CVV</label>
                    <input
                      value={cardCvv}
                      onChange={e => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="123"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500/50 outline-none text-center"
                      type="password"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={processingCard}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-bold shadow-lg shadow-blue-900/20 disabled:opacity-50 mt-4"
                >
                  {processingCard ? t('waitProcessing') : t('pay')}
                </button>

                <div className="flex items-center justify-center gap-2 text-xs text-gray-500 mt-4">
                  <span>🔒 {t('sslEncrypted')}</span>
                  <span>🛡️ {t('pciCompliant')}</span>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
