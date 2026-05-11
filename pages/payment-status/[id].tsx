import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useTranslation } from '@/lib/i18n-helper'
import axios from 'axios'
import toast from 'react-hot-toast'

interface PaymentStatusT {
  id: string
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED' | 'DECLINED'
  method: string
  amount: number
  finalAmount: number
  createdAt: string
  paidAt?: string | null
  plan: { name: string }
  user: { username: string }
}

const STATUS_MAP: Record<string, { icon: string; title: string; message: string; pill: string; ring: string }> = {
  PAID:       { icon: '✓', title: 'Pagamento aprovado',     message: 'Seu pagamento foi confirmado. Plano ativado!',                    pill: 'pill-mint',  ring: 'border-aurora-mint/40 bg-aurora-mint/8'   },
  PENDING:    { icon: '⏳', title: 'Aguardando confirmação', message: 'Seu pagamento está sendo processado.',                            pill: 'pill-gold',  ring: 'border-aurora-gold/40 bg-aurora-gold/8'   },
  DECLINED:   { icon: '✕', title: 'Pagamento recusado',     message: 'Verifique os dados do cartão e tente novamente.',                 pill: 'pill-rose',  ring: 'border-rose-500/40 bg-rose-500/8'         },
  CANCELLED:  { icon: '○', title: 'Pagamento cancelado',    message: 'Este pagamento foi cancelado.',                                   pill: 'pill-rose',  ring: 'border-white/15 bg-white/[0.03]'          },
  EXPIRED:    { icon: '⌛', title: 'Pagamento expirado',     message: 'O prazo expirou. Realize um novo pagamento.',                     pill: 'pill-rose',  ring: 'border-orange-500/40 bg-orange-500/8'     }
}

export default function PaymentStatusPage() {
  const { translatePlanName } = useTranslation()
  const router = useRouter()
  const { id } = router.query
  const [payment, setPayment] = useState<PaymentStatusT | null>(null)
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    if (!id || typeof id !== 'string') return
    loadPaymentStatus()
    const interval = setInterval(() => {
      if (payment && (payment.status === 'PENDING' || payment.status === 'DECLINED')) check()
    }, 3000)
    return () => clearInterval(interval)
  }, [id, payment?.status])

  const loadPaymentStatus = async () => {
    if (!id || typeof id !== 'string') return
    try { setLoading(true); const r = await axios.get(`/api/payments/status/${id}`); setPayment(r.data) }
    catch (e: any) { toast.error(e.response?.data?.error || 'Erro ao carregar') }
    finally { setLoading(false) }
  }

  const check = async () => {
    if (!id || typeof id !== 'string') return
    try {
      setChecking(true)
      const r = await axios.get(`/api/payments/status/${id}`)
      const newStatus = r.data.status
      if (newStatus !== payment?.status) {
        setPayment(r.data)
        if (newStatus === 'PAID') { toast.success('Pagamento confirmado!'); setTimeout(() => window.location.reload(), 2000) }
        else if (newStatus === 'DECLINED' || newStatus === 'CANCELLED') toast.error('Pagamento recusado/cancelado')
      }
    } catch {} finally { setChecking(false) }
  }

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center text-white/55">
        <svg className="h-5 w-5 animate-spin mr-2" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25"/><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4"/></svg>
        Carregando status...
      </div>
    )
  }

  if (!payment) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center p-4">
        <div className="surface-card-elevated max-w-md w-full p-8 text-center animate-fade-up">
          <p className="text-display text-2xl font-bold text-white">Pagamento não encontrado</p>
          <p className="mt-2 text-sm text-white/55">Este pagamento não foi encontrado ou você não tem permissão.</p>
          <button onClick={() => router.push('/plans')} className="btn btn-primary mt-6 w-full">Voltar para Planos</button>
        </div>
      </div>
    )
  }

  const info = STATUS_MAP[payment.status] || STATUS_MAP['CANCELLED']

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-1/4 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-aurora-violet/12 blur-[140px]" />
      </div>
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="surface-card-elevated p-7 sm:p-9 animate-fade-up">
          <div className={`rounded-2xl border p-7 text-center ${info.ring}`}>
            <div className="text-6xl mb-3">{info.icon}</div>
            <h1 className="text-display text-3xl font-bold text-white">{info.title}</h1>
            <p className="mt-2 text-sm text-white/65">{info.message}</p>
            {payment.status === 'PENDING' && checking && (
              <div className="mt-4 inline-flex items-center gap-2 text-xs text-white/55">
                <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25"/><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4"/></svg>
                Verificando status...
              </div>
            )}
          </div>

          <div className="mt-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
            <h2 className="text-display text-lg font-bold text-white mb-4">Detalhes</h2>
            <Row label="ID" value={<code className="text-mono text-xs">{payment.id.substring(0, 8)}...</code>} />
            <Row label="Plano" value={translatePlanName ? translatePlanName(payment.plan.name) : payment.plan.name} />
            <Row label="Método" value={payment.method === 'CARD' ? '💳 Cartão' : payment.method === 'PIX' ? '⚡ PIX' : payment.method === 'BITCOIN' ? '₿ Bitcoin' : payment.method} />
            <Row label="Valor" value={<span className="num-display text-xl text-gradient">R$ {payment.finalAmount.toFixed(2)}</span>} />
            {payment.paidAt && <Row label="Pago em" value={new Date(payment.paidAt).toLocaleString('pt-BR')} />}
            <Row label="Criado em" value={new Date(payment.createdAt).toLocaleString('pt-BR')} last />
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-2">
            {payment.status === 'PAID' && (
              <button onClick={() => router.push('/dashboard')} className="btn btn-primary flex-1">Ir para Dashboard</button>
            )}
            {(payment.status === 'DECLINED' || payment.status === 'CANCELLED' || payment.status === 'EXPIRED') && (
              <button onClick={() => router.push('/plans')} className="btn btn-primary flex-1">Tentar novamente</button>
            )}
            {payment.status === 'PENDING' && (
              <button onClick={check} disabled={checking} className="btn btn-primary flex-1">{checking ? 'Verificando...' : 'Verificar status'}</button>
            )}
            <button onClick={() => router.push('/plans')} className="btn btn-ghost">Voltar</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, last = false }: { label: string; value: React.ReactNode; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-2 py-2.5 ${!last ? 'border-b border-white/[0.05]' : ''}`}>
      <span className="text-[12.5px] text-white/55">{label}</span>
      <span className="text-[13px] text-white text-right">{value}</span>
    </div>
  )
}
