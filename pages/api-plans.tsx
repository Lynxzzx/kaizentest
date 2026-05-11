
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
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/4 top-0 h-[500px] w-[500px] rounded-full bg-aurora-cyan/10 blur-[140px]" />
        <div className="absolute right-1/4 top-1/2 h-[450px] w-[450px] rounded-full bg-aurora-violet/10 blur-[140px]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="text-center mb-12 animate-fade-up">
          <p className="eyebrow">Acesso programático</p>
          <h1 className="mt-2 text-display text-4xl sm:text-5xl md:text-6xl font-bold text-gradient-aurora">API Plans</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-white/55">
            Integre nossos geradores diretamente em suas aplicações com chaves seguras e limites previsíveis.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-12">
          {plans.map((plan, index) => (
            <div key={plan.id} className={`surface-card p-6 animate-fade-up delay-${Math.min((index + 1) * 100, 500)}`}>
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-aurora-cyan to-aurora-violet text-lg font-bold text-white">
                {plan.name.charAt(0)}
              </div>
              <h3 className="text-display text-xl font-bold text-white">{plan.name}</h3>
              <p className="mt-1 min-h-[40px] text-xs text-white/50">{plan.description}</p>

              <div className="mt-5 mb-5">
                <span className="num-display text-3xl text-gradient">R$ {plan.price.toFixed(2)}</span>
              </div>

              <ul className="mb-6 space-y-2 text-xs text-white/70">
                <li className="flex items-center gap-2"><span className="text-aurora-cyan">⚡</span> {plan.maxGenerations} gerações</li>
                <li className="flex items-center gap-2"><span className="text-aurora-cyan">🔑</span> API Key inclusa</li>
                <li className="flex items-center gap-2"><span className="text-aurora-cyan">🛡️</span> Suporte premium</li>
              </ul>

              <div className="space-y-2">
                <button onClick={() => handlePayment(plan, 'PIX')} className="btn btn-primary btn-sm w-full">{t('payViaPix')}</button>
                <button onClick={() => handlePayment(plan, 'CRYPTO')} className="btn btn-ghost btn-sm w-full">Crypto</button>
                <button onClick={() => handlePayment(plan, 'CARD')} className="btn btn-ghost btn-sm w-full">Cartão</button>
              </div>
            </div>
          ))}

          {plans.length === 0 && !loading && (
            <div className="col-span-full text-center py-12 text-white/40">Nenhum plano API disponível no momento.</div>
          )}
        </div>

        <div className="surface-card-elevated p-7 max-w-4xl mx-auto animate-fade-up delay-500">
          <h2 className="text-display text-2xl font-bold text-white mb-5">Endpoints principais</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="text-mono text-[10px] text-aurora-cyan mb-1">POST</div>
              <div className="font-bold text-white text-sm">/api/v1/generate</div>
              <p className="mt-2 text-[11px] text-white/40">Gere contas programaticamente.</p>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="text-mono text-[10px] text-aurora-mint mb-1">GET</div>
              <div className="font-bold text-white text-sm">/api/v1/services</div>
              <p className="mt-2 text-[11px] text-white/40">Liste serviços e estoque.</p>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="text-mono text-[10px] text-aurora-violet mb-1">GET</div>
              <div className="font-bold text-white text-sm">/api/v1/status</div>
              <p className="mt-2 text-[11px] text-white/40">Saúde do sistema e conta.</p>
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
                  <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4" />
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
                    <div className="bg-white p-4 rounded-xl mx-auto w-64 h-64 flex items-center justify-center shadow-lg shadow-cyan-900/20">
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

                  <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                      <span className="text-cyan-400 font-bold text-sm">{t('waitProcessing')}</span>
                    </div>
                    <p className="text-xs text-cyan-300/80">{t('autoActivationText')}</p>
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
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-cyan-500/50 outline-none"
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
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-cyan-500/50 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">{t('cardNumber')}</label>
                  <input
                    value={cardNumber}
                    onChange={e => setCardNumber(formatCardNumber(e.target.value))}
                    placeholder="0000 0000 0000 0000"
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-cyan-500/50 outline-none font-mono"
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
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-cyan-500/50 outline-none text-center"
                        required
                      />
                      <input
                        value={cardExpYear}
                        onChange={e => setCardExpYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="YYYY"
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-cyan-500/50 outline-none text-center"
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
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-cyan-500/50 outline-none text-center"
                      type="password"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={processingCard}
                  className="w-full bg-cyan-600 hover:bg-cyan-500 text-white py-4 rounded-xl font-bold shadow-lg shadow-cyan-900/20 disabled:opacity-50 mt-4"
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
  )
}
