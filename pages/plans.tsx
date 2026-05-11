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
  code: string; planId: string; discountAmount: number; finalAmount: number
}

export default function Plans() {
  const { t, translatePlanName } = useTranslation()
  const { data: session } = useSession()
  const router = useRouter()
  const [plans, setPlans] = useState<Plan[]>([])
  const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'CRYPTO' | 'CARD' | null>(null)
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null)
  const [loading, setLoading] = useState(false)

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

  const [showLanguageModal, setShowLanguageModal] = useState(false)
  const [pendingBitcoinPayment, setPendingBitcoinPayment] = useState<Plan | null>(null)
  const [selectedLanguage, setSelectedLanguage] = useState<string>('pt')

  useEffect(() => { loadPlans() }, [])
  useEffect(() => { if (!couponPlanId && plans.length > 0) setCouponPlanId(plans[0].id) }, [plans, couponPlanId])
  useEffect(() => { setAppliedCoupon(null) }, [couponCode, couponPlanId])

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
      } catch {} finally { setCheckingPayment(false) }
    }, intervalTime)
    return () => clearInterval(interval)
  }, [paymentData?.id, paymentMethod, checkingPayment])

  const loadPlans = async () => {
    try {
      const response = await axios.get('/api/plans?type=SITE')
      setPlans(Array.isArray(response.data) ? response.data : [])
    } catch (e: any) {
      const msg =
        e.response?.data?.message ||
        e.response?.data?.error ||
        e.message ||
        t('errorLoadingPlans')
      console.error('[plans] loadPlans:', e.response?.data || e)
      toast.error(typeof msg === 'string' ? msg : t('errorLoadingPlans'))
    }
  }

  const validateCouponForPlan = async (plan: Plan, silent = false) => {
    const code = couponCode.trim().toUpperCase()
    if (!code) { toast.error(t('invalidCoupon')); return null }
    try {
      if (!silent) setCouponApplying(true)
      const response = await axios.post('/api/coupons/validate', { code, planId: plan.id })
      const data = response.data
      setAppliedCoupon({ code, planId: plan.id, discountAmount: data.discountAmount, finalAmount: data.finalAmount })
      if (!silent) toast.success(t('couponApplied'))
      return data
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('invalidCoupon'))
      setAppliedCoupon(null); return null
    } finally { if (!silent) setCouponApplying(false) }
  }

  const handlePayment = async (plan: Plan, method: 'PIX' | 'CRYPTO' | 'CARD') => {
    if (!session) { toast.error(t('loginToContinue')); router.push('/login'); return }
    if (couponCode.trim()) { const valid = await validateCouponForPlan(plan, true); if (!valid) return }

    if (method === 'PIX') { setPendingPayment({ plan, method }); setShowEmailModal(true); return }
    if (method === 'CARD') {
      setPendingCardPayment(plan)
      if (!cardEmail) { const e = (session.user as any)?.email || ''; if (e) setCardEmail(e) }
      if (!cardHolderName) { const h = (session.user as any)?.username || ''; if (h) setCardHolderName(h.toUpperCase()) }
      setShowCardModal(true); return
    }
    if (method === 'CRYPTO') { setPendingBitcoinPayment(plan); setShowLanguageModal(true); return }
  }

  const createPixPayment = async (plan: Plan, email: string) => {
    setLoading(true); setPaymentMethod('PIX'); setShowEmailModal(false)
    const normalizedCoupon = couponCode.trim().toUpperCase()
    try {
      const response = await axios.post('/api/payments/create', {
        planId: plan.id, method: 'PIX', customerEmail: email,
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
        setAppliedCoupon({ code: normalizedCoupon, planId: plan.id, discountAmount: response.data.discountAmount, finalAmount: response.data.finalAmount ?? plan.price })
      }
      toast.success(t('pixPaymentCreated'))
    } catch (error: any) { toast.error(error.response?.data?.error || t('errorCreatingPix')) }
    finally { setLoading(false) }
  }

  const handleEmailSubmit = () => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!customerEmail || !regex.test(customerEmail)) { toast.error(t('errorInvalidEmail')); return }
    if (pendingPayment?.method === 'PIX') createPixPayment(pendingPayment.plan, customerEmail)
  }

  const createCardPayment = async () => {
    if (!pendingCardPayment) return
    const cleanCardNumber = cardNumber.replace(/\D/g, '')
    if (cleanCardNumber.length < 13 || cleanCardNumber.length > 19) { toast.error(t('invalidCardNumber')); return }
    if (!cardExpMonth || !cardExpYear || !cardCvv || !cardHolderName) { toast.error('Preencha todos os campos.'); return }
    setProcessingCard(true)
    try {
      if (!(window as any).PagSeguro) {
        await new Promise<void>((resolve, reject) => {
          const existing = document.querySelector('script[src*="pagseguro.min.js"]')
          if (existing) {
            const waitFor = setInterval(() => { if ((window as any).PagSeguro) { clearInterval(waitFor); resolve() } }, 100)
            setTimeout(() => { clearInterval(waitFor); reject(new Error('Timeout SDK PagBank')) }, 10000)
            return
          }
          const script = document.createElement('script')
          script.src = 'https://assets.pagseguro.com.br/checkout-sdk-js/rc/dist/browser/pagseguro.min.js'
          script.async = true
          script.onload = () => {
            const wait = setInterval(() => { if ((window as any).PagSeguro) { clearInterval(wait); resolve() } }, 50)
            setTimeout(() => { clearInterval(wait); if ((window as any).PagSeguro) resolve(); else reject(new Error('SDK não disponível')) }, 5000)
          }
          script.onerror = () => reject(new Error('Erro SDK PagBank'))
          document.body.appendChild(script)
        })
      }
      const pk = await axios.get('/api/payments/public-key'); const publicKey = pk.data.publicKey
      if (!publicKey) { toast.error('Sem chave de criptografia.'); return }
      const PagSeguro = (window as any).PagSeguro
      const card = PagSeguro.encryptCard({
        publicKey, holder: cardHolderName.toUpperCase(), number: cleanCardNumber,
        expMonth: cardExpMonth.padStart(2, '0'),
        expYear: cardExpYear.length === 2 ? `20${cardExpYear}` : cardExpYear,
        securityCode: cardCvv
      })
      if (card.hasErrors) {
        const errList = (card.errors || []).map((e: any) => e.message || e.code || 'Erro').join(', ')
        toast.error(`Cartão inválido: ${errList}`); return
      }
      const encryptedCard = card.encryptedCard
      if (!encryptedCard) { toast.error('Erro ao criptografar.'); return }
      const response = await axios.post('/api/payments/create', {
        planId: pendingCardPayment.id, method: 'CARD', encryptedCard, cardHolderName,
        customerEmail: cardEmail, couponCode: couponCode.trim().toUpperCase() || undefined
      })
      setShowCardModal(false)
      const paymentId = response.data.id || response.data.paymentId
      if (response.data.paid) toast.success('Pagamento aprovado!')
      router.push(`/payment-status/${paymentId}`)
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.response?.data?.error || error.message || t('cardPaymentError'))
    } finally { setProcessingCard(false) }
  }

  const formatCardNumber = (value: string) => {
    const n = value.replace(/\D/g, ''); return n.replace(/(\d{4})(?=\d)/g, '$1 ').substring(0, 19)
  }

  const handleLanguageSelection = () => {
    if (!pendingBitcoinPayment) return
    window.open(`https://t.me/lynxdevz?start=bitcoin_${pendingBitcoinPayment.id}_${selectedLanguage}`, '_blank')
    setShowLanguageModal(false); setPendingBitcoinPayment(null)
  }

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/4 top-0 h-[600px] w-[600px] rounded-full bg-aurora-violet/12 blur-[140px]" />
        <div className="absolute right-1/4 top-1/3 h-[500px] w-[500px] rounded-full bg-aurora-magenta/12 blur-[140px]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
        {/* Hero */}
        <div className="mb-14 text-center animate-fade-up">
          <p className="eyebrow">Pricing</p>
          <h1 className="mt-3 text-display text-5xl sm:text-7xl font-bold">
            <span className="text-gradient">Escolha seu</span>
            <br />
            <span className="text-gradient-aurora">plano premium</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base sm:text-lg text-white/60">
            Libere todo o potencial do gerador. Gerações ilimitadas, suporte prioritário e benefícios exclusivos.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
            <a href="https://t.me/geradordecontasbr" target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M22.05 2.31a1.7 1.7 0 00-1.7-.25L2.74 9.07a1.7 1.7 0 00.08 3.18l4.5 1.42 2.5 7.78a1.69 1.69 0 002.84.66l3.94-3.69 4.94 3.6a1.7 1.7 0 002.65-1l2.43-15.86a1.7 1.7 0 00-.57-1.85zM9.94 14.78l-.8 4.62-.97-5.5L17.18 6.7l-7.24 8.08z"/></svg>
              Telegram
            </a>
            <a href="https://discord.gg/KWZ5fctz3b" target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M20.32 4.37a19.74 19.74 0 00-4.88-1.51.07.07 0 00-.08.04c-.21.38-.45.87-.61 1.25a18.27 18.27 0 00-5.5 0c-.16-.39-.4-.87-.61-1.25a.08.08 0 00-.08-.04 19.74 19.74 0 00-4.89 1.51.07.07 0 00-.03.03C.55 9.05-.32 13.58.06 18.06a.08.08 0 00.03.06 19.9 19.9 0 005.99 3.04.08.08 0 00.09-.03c.46-.63.87-1.3 1.23-2a.08.08 0 00-.04-.11 13.1 13.1 0 01-1.87-.89.08.08 0 01-.01-.13c.12-.09.25-.19.37-.29a.08.08 0 01.08-.01c3.92 1.79 8.15 1.79 12.02 0a.08.08 0 01.09.01c.12.1.24.2.37.29a.08.08 0 01-.01.13c-.6.35-1.22.64-1.87.89a.08.08 0 00-.04.11c.37.71.78 1.38 1.22 2a.08.08 0 00.09.03 19.83 19.83 0 006-3.04.08.08 0 00.03-.06c.45-5.18-.78-9.68-3.27-13.66a.07.07 0 00-.03-.03z"/></svg>
              Discord
            </a>
          </div>
        </div>

        {/* Coupon */}
        {plans.length > 0 && (
          <div className="mx-auto mb-12 max-w-3xl surface-card p-6 sm:p-7 animate-fade-up delay-100">
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h3 className="text-display text-xl font-bold text-white">Tem um cupom?</h3>
              <span className="pill pill-mint">Economize mais</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text" value={couponCode} onChange={(e) => setCouponCode(e.target.value)}
                className="input-premium uppercase tracking-widest" placeholder="PROMO50"
              />
              <select value={couponPlanId} onChange={(e) => setCouponPlanId(e.target.value)} className="input-premium sm:w-56">
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id} className="bg-[#0a0a13]">
                    {translatePlanName ? translatePlanName(plan.name) : plan.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => { const plan = plans.find(p => p.id === couponPlanId); if (plan) validateCouponForPlan(plan) }}
                disabled={!couponCode || couponApplying}
                className="btn btn-primary shrink-0"
              >
                {couponApplying ? 'Validando...' : t('applyCoupon')}
              </button>
            </div>
            {appliedCoupon && (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-aurora-mint/30 bg-aurora-mint/10 p-3.5 text-aurora-mint">
                <span className="text-sm font-semibold">
                  Desconto: −{t('currencySymbol')} {appliedCoupon.discountAmount.toFixed(2)} · Total: {t('currencySymbol')} {appliedCoupon.finalAmount.toFixed(2)}
                </span>
                <button onClick={() => setAppliedCoupon(null)} className="text-aurora-mint/70 hover:text-white">×</button>
              </div>
            )}
          </div>
        )}

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-fade-up delay-200">
          {plans.map((plan, i) => {
            const popular = i === 1
            return (
              <div
                key={plan.id}
                className={`relative overflow-hidden rounded-3xl p-7 sm:p-8 transition-all hover:-translate-y-1 ${
                  popular
                    ? 'border border-aurora-violet/50 bg-gradient-to-b from-aurora-violet/10 to-transparent shadow-glow-violet'
                    : 'surface-card'
                }`}
              >
                {popular && (
                  <>
                    <div className="pointer-events-none absolute -inset-px rounded-3xl ring-aurora opacity-60" />
                    <div className="absolute top-4 right-4">
                      <span className="pill pill-violet">⭐ Mais popular</span>
                    </div>
                  </>
                )}
                <div className="relative">
                  <h3 className="text-display text-3xl font-bold text-white">
                    {translatePlanName ? translatePlanName(plan.name) : plan.name}
                  </h3>
                  <p className="mt-2 text-sm text-white/55 min-h-[42px]">{plan.description}</p>

                  <div className="mt-6">
                    <div className="flex items-baseline gap-2">
                      <span className="text-display text-5xl font-bold text-white">
                        {t('currencySymbol')}{plan.price.toFixed(2)}
                      </span>
                      <span className="text-sm text-white/45">/ {plan.duration} {t('daysAccess')}</span>
                    </div>
                  </div>

                  <div className="mt-7 space-y-3">
                    <Feature label={plan.maxGenerations === 0 ? t('unlimitedLabel') : `${plan.maxGenerations} ${t('generations')}`} sub="Gerações disponíveis" />
                    <Feature label={t('accessAllServices')} sub="Todos os serviços premium" />
                    <Feature label="Suporte 24/7" sub="Atendimento prioritário" />
                  </div>

                  <div className="mt-7 space-y-2.5">
                    <button onClick={() => handlePayment(plan, 'PIX')} className="btn btn-primary w-full">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 7h7l-5.5 4 2 7-6.5-4.5L5.5 20l2-7L2 9h7z"/></svg>
                      Pagar com PIX
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => handlePayment(plan, 'CARD')} className="btn btn-ghost">
                        💳 Cartão
                      </button>
                      <button onClick={() => handlePayment(plan, 'CRYPTO')} className="btn btn-ghost">
                        ₿ Crypto
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* ---- MODALS ---- */}
        {showEmailModal && (
          <Modal onClose={() => setShowEmailModal(false)} title="Informe seu email">
            <input
              type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="seu@email.com" className="input-premium mb-4"
            />
            <div className="flex gap-2">
              <button onClick={handleEmailSubmit} className="btn btn-primary flex-1">Continuar</button>
              <button onClick={() => setShowEmailModal(false)} className="btn btn-ghost">Cancelar</button>
            </div>
          </Modal>
        )}

        {showLanguageModal && (
          <Modal onClose={() => setShowLanguageModal(false)} title="Selecione o idioma">
            <div className="space-y-2">
              {['pt', 'en', 'es'].map((lang) => (
                <button
                  key={lang}
                  onClick={() => { setSelectedLanguage(lang); setTimeout(handleLanguageSelection, 100) }}
                  className="btn btn-ghost w-full uppercase tracking-widest"
                >{lang}</button>
              ))}
            </div>
          </Modal>
        )}

        {(paymentData || (paymentMethod && loading)) && pendingPayment && paymentMethod === 'PIX' && (
          <Modal onClose={() => { setPaymentData(null); setPaymentMethod(null) }} title="Pagamento via PIX">
            {loading ? (
              <div className="flex flex-col items-center gap-4 py-12">
                <svg className="h-10 w-10 animate-spin text-aurora-violet" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25"/>
                  <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3"/>
                </svg>
                <p className="text-sm text-white/55">Criando pagamento PIX...</p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="text-center">
                  <p className="eyebrow">Valor final</p>
                  <p className="num-display mt-1 text-4xl text-gradient">{t('currencySymbol')}{paymentData?.finalAmount?.toFixed(2)}</p>
                  {paymentData?.discountAmount ? (
                    <p className="mt-1 text-xs text-aurora-mint font-semibold">Desconto: {t('currencySymbol')}{paymentData.discountAmount.toFixed(2)}</p>
                  ) : null}
                </div>
                {paymentData?.pixCopyPaste && (
                  <div className="flex justify-center">
                    <div className="rounded-2xl bg-white p-4">
                      <QRCode value={paymentData.pixCopyPaste} size={180} renderAs="svg" level="M" />
                    </div>
                  </div>
                )}
                <div>
                  <p className="eyebrow mb-2">Código copia e cola</p>
                  <div className="flex gap-2">
                    <input readOnly value={paymentData?.pixCopyPaste || ''} className="input-premium text-mono text-xs truncate" />
                    <button
                      onClick={() => { if (paymentData?.pixCopyPaste) { navigator.clipboard.writeText(paymentData.pixCopyPaste); toast.success('PIX copiado!') } }}
                      className="btn btn-ghost"
                    >Copiar</button>
                  </div>
                </div>
                <div className="rounded-2xl border border-aurora-cyan/30 bg-aurora-cyan/8 p-4 text-aurora-cyan">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-aurora-cyan animate-pulse" />
                    Aguardando confirmação
                  </p>
                  <p className="mt-1 text-xs text-aurora-cyan/70">Confirmaremos automaticamente quando o PIX for detectado.</p>
                </div>
              </div>
            )}
          </Modal>
        )}

        {showCardModal && (
          <Modal onClose={() => setShowCardModal(false)} title="Pagamento com Cartão" maxWidth="md">
            <form onSubmit={(e) => { e.preventDefault(); createCardPayment() }} className="space-y-3">
              <FieldLabel label="Titular">
                <input value={cardHolderName} onChange={e => setCardHolderName(e.target.value.toUpperCase())} placeholder="NOME COMPLETO" className="input-premium" required />
              </FieldLabel>
              <FieldLabel label="Email">
                <input type="email" value={cardEmail} onChange={e => setCardEmail(e.target.value)} placeholder="seu@email.com" className="input-premium" required />
              </FieldLabel>
              <FieldLabel label="Número do cartão">
                <input value={cardNumber} onChange={e => setCardNumber(formatCardNumber(e.target.value))} placeholder="0000 0000 0000 0000" className="input-premium text-mono" maxLength={19} required />
              </FieldLabel>
              <div className="grid grid-cols-2 gap-3">
                <FieldLabel label="Validade">
                  <div className="flex gap-2">
                    <input value={cardExpMonth} onChange={e => setCardExpMonth(e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="MM" className="input-premium text-center" required />
                    <input value={cardExpYear} onChange={e => setCardExpYear(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="YYYY" className="input-premium text-center" required />
                  </div>
                </FieldLabel>
                <FieldLabel label="CVV">
                  <input value={cardCvv} onChange={e => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="123" type="password" className="input-premium text-center" required />
                </FieldLabel>
              </div>
              <button type="submit" disabled={processingCard} className="btn btn-primary btn-lg w-full mt-2">
                {processingCard ? 'Processando...' : 'Pagar agora'}
              </button>
              <p className="flex items-center justify-center gap-3 pt-1 text-[11px] text-white/40">
                <span>🔒 SSL</span>
                <span>·</span>
                <span>PCI Compliance</span>
              </p>
            </form>
          </Modal>
        )}
      </div>
    </div>
  )
}

function Feature({ label, sub }: { label: string; sub: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-aurora-mint/15 text-aurora-mint">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 13l4 4L19 7"/></svg>
      </span>
      <div>
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="text-[11px] text-white/45">{sub}</p>
      </div>
    </div>
  )
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wider text-white/55">{label}</label>
      {children}
    </div>
  )
}

function Modal({ children, onClose, title, maxWidth = 'sm' }: { children: React.ReactNode; onClose: () => void; title: string; maxWidth?: 'sm' | 'md' | 'lg' }) {
  const w = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-xl' }[maxWidth]
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className={`w-full ${w} surface-card-elevated p-6 sm:p-7 my-auto animate-scale-in`}>
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-display text-2xl font-bold text-white">{title}</h3>
          <button onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/70 hover:text-white">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
