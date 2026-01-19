
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useTranslation } from '@/lib/i18n-helper'
import Layout from '@/components/Layout'
import axios from 'axios'
import toast from 'react-hot-toast'
import QRCode from 'qrcode.react'

interface Plan {
  id: string
  name: string
  description?: string
  price: number
  duration: number
  maxGenerations: number
  features?: string[] // Optional if we lack this in DB initially, but we can try to parse description lines
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

export default function ApiPlans() {
  const { t } = useTranslation()
  const { data: session } = useSession()
  const router = useRouter()
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'CRYPTO' | 'CARD' | null>(null)
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null)

  // Modals
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [customerEmail, setCustomerEmail] = useState('')
  const [pendingPayment, setPendingPayment] = useState<{ plan: Plan; method: 'PIX' | 'CRYPTO' } | null>(null)
  const [checkingPayment, setCheckingPayment] = useState(false)
  const [qrCodeImageError, setQrCodeImageError] = useState(false)

  // Card
  const [showCardModal, setShowCardModal] = useState(false)
  const [pendingCardPayment, setPendingCardPayment] = useState<Plan | null>(null)
  const [cardNumber, setCardNumber] = useState('')
  const [cardExpMonth, setCardExpMonth] = useState('')
  const [cardExpYear, setCardExpYear] = useState('')
  const [cardCvv, setCardCvv] = useState('')
  const [cardHolderName, setCardHolderName] = useState('')
  const [cardEmail, setCardEmail] = useState('')
  const [processingCard, setProcessingCard] = useState(false)

  // Crypto
  const [showLanguageModal, setShowLanguageModal] = useState(false)
  const [pendingBitcoinPayment, setPendingBitcoinPayment] = useState<Plan | null>(null)
  const [selectedLanguage, setSelectedLanguage] = useState<string>('pt')

  useEffect(() => {
    loadApiPlans()
  }, [])

  const loadApiPlans = async () => {
    try {
      // Fetch specifically API type plans
      const response = await axios.get('/api/plans?type=API')
      setPlans(response.data)
    } catch (error) {
      console.error(error)
      toast.error(t('errorLoadingPlans'))
    }
  }

  // Polling for payment status
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
        // silent check
      } finally {
        setCheckingPayment(false)
      }
    }, intervalTime)

    return () => clearInterval(interval)
  }, [paymentData?.id, paymentMethod, checkingPayment])


  const handlePayment = async (plan: Plan, method: 'PIX' | 'CRYPTO' | 'CARD') => {
    if (!session) {
      toast.error(t('loginToContinue'))
      router.push('/login?redirect=/api-plans')
      return
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
    const cleanCardNumber = cardNumber.replace(/\D/g, '')
    // ... validations same as plans.tsx ...

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
      const paymentId = response.data.id || response.data.paymentId
      router.push(`/payment-status/${paymentId}`)
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('cardPaymentError'))
    } finally {
      setProcessingCard(false)
    }
  }

  const handleLanguageSelection = () => {
    if (!pendingBitcoinPayment) return
    const telegramLink = `https://t.me/lynxdevz?start=bitcoin_${pendingBitcoinPayment.id}_${selectedLanguage}`
    window.open(telegramLink, '_blank')
    setShowLanguageModal(false)
    setPendingBitcoinPayment(null)
  }

  const formatCardNumber = (value: string) => {
    const numbers = value.replace(/\D/g, '')
    return numbers.replace(/(\d{4})(?=\d)/g, '$1 ').substring(0, 19)
  }

  return (
    <Layout>
      <div className="min-h-screen pt-12 pb-12 px-4 sm:px-6 relative overflow-hidden">
        {/* Background Effects */}
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/20 rounded-full blur-[100px] animate-pulse-slow" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-600/20 rounded-full blur-[100px] animate-pulse-slow delay-1000" />
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-6xl font-extrabold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
              API Plans
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Integrate our powerful generators directly into your applications.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {plans.map((plan, index) => (
              <div key={plan.id} className="glass-card p-6 rounded-2xl border border-white/5 hover:border-cyan-500/30 transition-all hover:-translate-y-2 group">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-xl font-bold mb-4 shadow-lg shadow-cyan-900/20">
                  {plan.name.charAt(0)}
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                <p className="text-gray-400 text-sm mb-4 min-h-[40px]">{plan.description}</p>

                <div className="mb-6">
                  <span className="text-3xl font-bold text-white">R$ {plan.price.toFixed(2)}</span>
                </div>

                <ul className="space-y-3 mb-8">
                  <li className="flex items-center gap-2 text-gray-300 text-sm">
                    <span className="text-cyan-400">⚡</span>
                    {plan.maxGenerations} Generations
                  </li>
                  <li className="flex items-center gap-2 text-gray-300 text-sm">
                    <span className="text-cyan-400">🔑</span>
                    API Key Included
                  </li>
                  <li className="flex items-center gap-2 text-gray-300 text-sm">
                    <span className="text-cyan-400">🛡️</span>
                    Premium Support
                  </li>
                </ul>

                <div className="space-y-2">
                  <button
                    onClick={() => handlePayment(plan, 'PIX')}
                    className="w-full py-2.5 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold text-sm hover:contrast-125 transition-all"
                  >
                    {t('payViaPix')}
                  </button>
                  <button
                    onClick={() => handlePayment(plan, 'CRYPTO')}
                    className="w-full py-2.5 rounded-lg bg-gradient-to-r from-orange-600 to-red-600 text-white font-bold text-sm hover:contrast-125 transition-all"
                  >
                    Crypto
                  </button>
                  <button
                    onClick={() => handlePayment(plan, 'CARD')}
                    className="w-full py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-sm hover:contrast-125 transition-all"
                  >
                    Card
                  </button>
                </div>
              </div>
            ))}

            {plans.length === 0 && !loading && (
              <div className="col-span-full text-center py-12 text-gray-500">
                No API plans found. Please check back later.
              </div>
            )}
          </div>

          <div className="glass-panel p-8 rounded-2xl border border-white/10 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-white mb-6">Documentation Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                <div className="font-mono text-cyan-400 text-xs mb-1">POST</div>
                <div className="font-bold text-white">/api/v1/generate</div>
                <p className="text-gray-400 text-xs mt-2">Generate accounts programmatically.</p>
              </div>
              <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                <div className="font-mono text-green-400 text-xs mb-1">GET</div>
                <div className="font-bold text-white">/api/v1/services</div>
                <p className="text-gray-400 text-xs mt-2">List available services and stock.</p>
              </div>
              <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                <div className="font-mono text-purple-400 text-xs mb-1">GET</div>
                <div className="font-bold text-white">/api/v1/status</div>
                <p className="text-gray-400 text-xs mt-2">Check system health and account status.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Email Modal */}
        {showEmailModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="glass-panel p-8 rounded-2xl max-w-md w-full border border-white/10">
              <h3 className="text-xl font-bold text-white mb-4">{t('informEmail')}</h3>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white mb-6 focus:border-cyan-500/50 outline-none"
                placeholder="email@example.com"
              />
              <div className="flex gap-3">
                <button onClick={handleEmailSubmit} className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white py-3 rounded-xl font-bold transition-all">Continue</button>
                <button onClick={() => setShowEmailModal(false)} className="px-6 py-3 border border-white/10 rounded-xl text-white hover:bg-white/5">Cancel</button>
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

      </div>
    </Layout>
  )
}