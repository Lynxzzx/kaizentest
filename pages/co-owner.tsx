import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import axios from 'axios'
import toast from 'react-hot-toast'

interface Stats {
  affiliateCode: string | null
  totalReferrals: number
  affiliateBalance: number
  totalAffiliateEarnings: number
  commissionRate: number
  recentCommissions: Array<{
    id: string; amount: number; paymentAmount: number; buyerUsername: string; planName: string; createdAt: string
  }>
}

export default function CoOwnerPanel() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (status === 'authenticated') {
      const role = String(session?.user?.role || '').toUpperCase()
      const isCo = role === 'CO_OWNER' || role === 'CO-OWNER' || role === 'CO OWNER'
      if (!isCo) { router.push('/dashboard'); return }
      loadStats()
    }
  }, [session, status])

  const loadStats = async () => {
    try { const r = await axios.get('/api/affiliate/stats'); setStats(r.data) }
    catch (e: any) { toast.error(e.response?.data?.error || 'Erro') }
  }

  const generateCode = async () => {
    try {
      const r = await axios.post('/api/affiliate/generate-code')
      toast.success('Código gerado!'); setStats(prev => prev ? { ...prev, affiliateCode: r.data.code } : prev)
    } catch (e: any) { toast.error(e.response?.data?.error || 'Erro') }
  }

  const getLink = (code: string | null) => code && typeof window !== 'undefined' ? `${window.location.origin}/register?ref=${code}` : ''
  const copy = (text: string) => { navigator.clipboard.writeText(text); toast.success('Copiado!') }

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-0 top-0 h-[450px] w-[450px] rounded-full bg-aurora-gold/10 blur-[140px]" />
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="mb-10 animate-fade-up">
          <p className="eyebrow">Painel exclusivo</p>
          <h1 className="mt-2 text-display text-4xl sm:text-5xl font-bold text-gradient-gold">Co-Owner</h1>
          <p className="mt-3 text-sm text-white/55">Comissões maiores, ferramentas exclusivas.</p>
        </div>

        <div className="surface-card-elevated p-7 mb-6 animate-fade-up delay-100">
          <h2 className="text-display text-xl font-bold text-white mb-4">Seu link</h2>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={stats?.affiliateCode ? getLink(stats?.affiliateCode || null) : 'Nenhum código ainda'}
              className="input-premium text-mono text-[13px] truncate"
            />
            {stats?.affiliateCode ? (
              <button onClick={() => copy(getLink(stats.affiliateCode))} className="btn btn-primary btn-sm shrink-0">Copiar</button>
            ) : (
              <button onClick={generateCode} className="btn btn-primary btn-sm shrink-0">Gerar</button>
            )}
          </div>
        </div>

        {stats && (
          <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-px overflow-hidden rounded-3xl bg-white/[0.06] ring-1 ring-white/10 animate-fade-up delay-200">
            <div className="bg-[#0c0c15]/95 p-6">
              <p className="eyebrow">Saldo disponível</p>
              <p className="num-display mt-2 text-3xl text-aurora-mint">R$ {stats.affiliateBalance.toFixed(2)}</p>
            </div>
            <div className="bg-[#0c0c15]/95 p-6">
              <p className="eyebrow">Total ganho</p>
              <p className="num-display mt-2 text-3xl text-gradient">R$ {stats.totalAffiliateEarnings.toFixed(2)}</p>
            </div>
            <div className="bg-[#0c0c15]/95 p-6">
              <p className="eyebrow">Comissão</p>
              <p className="num-display mt-2 text-3xl text-gradient-gold">{stats.commissionRate}%</p>
            </div>
          </div>
        )}

        {stats && stats.recentCommissions && stats.recentCommissions.length > 0 && (
          <div className="surface-card p-7 animate-fade-up delay-300">
            <h2 className="text-display text-xl font-bold text-white mb-4">Vendas pelo seu link</h2>
            <div className="space-y-2">
              {stats.recentCommissions.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div>
                    <p className="text-sm font-semibold text-white">{c.buyerUsername} · {c.planName}</p>
                    <p className="text-[11px] text-white/40">R$ {c.paymentAmount.toFixed(2)}</p>
                  </div>
                  <p className="num-display text-lg text-aurora-mint">+R$ {c.amount.toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
