import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import axios from 'axios'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'

interface AffiliateStats {
  affiliateCode: string | null
  totalReferrals: number
  totalRewards: number
  bonusGenerations: number
  affiliateBalance: number
  totalAffiliateEarnings: number
  commissionRate: number
  recentReferrals: Array<{ id: string; username: string; createdAt: string }>
  recentRewards: Array<{ id: string; rewardedGenerations: number; createdAt: string; user: { username: string } }>
  recentCommissions: Array<{ id: string; amount: number; paymentAmount: number; buyerUsername: string; planName: string; paidAt: string; createdAt: string }>
  recentWithdrawals: Array<{ id: string; amount: number; status: string; createdAt: string; processedAt: string | null }>
}

const statusPill: Record<string, string> = {
  PENDING: 'pill pill-gold',
  PROCESSING: 'pill pill-cyan',
  COMPLETED: 'pill pill-mint',
  REJECTED: 'pill pill-rose'
}
const statusLabel: Record<string, string> = {
  PENDING: '⏳ Pendente',
  PROCESSING: '🔄 Processando',
  COMPLETED: '✅ Pago',
  REJECTED: '❌ Rejeitado'
}

export default function Affiliate() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [stats, setStats] = useState<AffiliateStats | null>(null)
  const [redeemCode, setRedeemCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [pixKey, setPixKey] = useState('')
  const [pixKeyType, setPixKeyType] = useState<'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'RANDOM'>('CPF')
  const [withdrawing, setWithdrawing] = useState(false)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)

  useEffect(() => { if (status === 'unauthenticated') router.push('/login') }, [status, router])
  useEffect(() => { if (session) loadStats() }, [session])

  const loadStats = async () => {
    try { const r = await axios.get('/api/affiliate/stats'); setStats(r.data) }
    catch { toast.error('Erro ao carregar estatísticas') }
  }

  const generateCode = async () => {
    setGenerating(true)
    try { await axios.post('/api/affiliate/generate-code'); toast.success('Código gerado!'); loadStats() }
    catch (error: any) { toast.error(error.response?.data?.error || 'Erro ao gerar') }
    finally { setGenerating(false) }
  }

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!redeemCode.trim()) { toast.error('Digite um código'); return }
    setLoading(true)
    try {
      const r = await axios.post('/api/affiliate/redeem', { code: redeemCode.trim() })
      toast.success(r.data.message || 'Código resgatado!')
      setRedeemCode(''); loadStats()
    } catch (error: any) { toast.error(error.response?.data?.error || 'Erro ao resgatar') }
    finally { setLoading(false) }
  }

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount)
    if (isNaN(amount) || amount < 10) { toast.error('Mínimo R$ 10,00'); return }
    if (!pixKey.trim()) { toast.error('Digite a chave PIX'); return }
    if (amount > (stats?.affiliateBalance || 0)) { toast.error('Saldo insuficiente'); return }
    setWithdrawing(true)
    try {
      const r = await axios.post('/api/affiliate/withdraw', { amount, pixKey: pixKey.trim(), pixKeyType })
      toast.success(r.data.message || 'Solicitação enviada!')
      setShowWithdrawModal(false); setWithdrawAmount(''); setPixKey(''); loadStats()
    } catch (error: any) { toast.error(error.response?.data?.error || 'Erro') }
    finally { setWithdrawing(false) }
  }

  const copy = (t: string, msg = 'Copiado!') => { navigator.clipboard.writeText(t); toast.success(msg) }
  const getLink = (code: string) => `${typeof window !== 'undefined' ? window.location.origin : ''}/register?ref=${code}`

  if (status === 'loading') return null
  if (!session) return null

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-0 top-0 h-[500px] w-[500px] rounded-full bg-aurora-mint/10 blur-[140px]" />
        <div className="absolute right-0 top-1/3 h-[500px] w-[500px] rounded-full bg-aurora-violet/10 blur-[140px]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="mb-10 animate-fade-up">
          <p className="eyebrow">Programa de afiliados</p>
          <h1 className="mt-2 text-display text-5xl sm:text-6xl font-bold">
            <span className="text-gradient">Indique e </span>
            <span className="text-gradient-aurora">ganhe</span>
          </h1>
          <p className="mt-3 text-base text-white/55">Ganhe comissões + 2 gerações grátis por indicação.</p>
        </div>

        {/* Stats overview */}
        {stats && (
          <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-px overflow-hidden rounded-3xl bg-white/[0.06] ring-1 ring-white/10 animate-fade-up delay-100">
            <Stat label="Saldo disponível" value={`R$ ${stats.affiliateBalance.toFixed(2)}`} hint="Pronto para sacar" accent="mint" />
            <Stat label="Total ganho" value={`R$ ${stats.totalAffiliateEarnings.toFixed(2)}`} hint={`${stats.commissionRate}% por venda`} accent="violet" />
            <Stat label="Indicados" value={String(stats.totalReferrals)} hint="Membros via seu link" accent="cyan" />
            <Stat label="Gerações grátis" value={String(stats.bonusGenerations)} hint="Bônus por indicação" accent="gold" />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6 animate-fade-up delay-200">
          {/* Code & Link */}
          <div className="surface-card-elevated p-7">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-display text-xl font-bold text-white">Seu código</h2>
              <span className="text-3xl">🎁</span>
            </div>
            {stats?.affiliateCode ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-aurora-violet/30 bg-aurora-violet/8 p-5">
                  <p className="eyebrow mb-2">Código único</p>
                  <div className="flex items-center gap-2">
                    <code className="text-display text-3xl font-bold text-gradient-aurora flex-1">{stats.affiliateCode}</code>
                    <button onClick={() => copy(stats.affiliateCode!, 'Código copiado!')} className="btn btn-ghost btn-sm">Copiar</button>
                  </div>
                </div>
                <div>
                  <p className="eyebrow mb-2">Link de afiliado</p>
                  <div className="flex items-center gap-2">
                    <input readOnly value={getLink(stats.affiliateCode)} className="input-premium text-mono text-[12.5px] truncate" />
                    <button onClick={() => copy(getLink(stats.affiliateCode!), 'Link copiado!')} className="btn btn-primary btn-sm shrink-0">Copiar link</button>
                  </div>
                </div>
                <div className="rounded-2xl border border-aurora-cyan/30 bg-aurora-cyan/8 p-4">
                  <p className="text-sm text-aurora-cyan">
                    <strong>Como funciona:</strong> compartilhe e ganhe 2 gerações grátis + {stats.commissionRate}% de comissão por cada venda.
                  </p>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center">
                <p className="text-sm text-white/55 mb-4">Você ainda não possui um código</p>
                <button onClick={generateCode} disabled={generating} className="btn btn-primary">{generating ? 'Gerando...' : 'Gerar meu código'}</button>
              </div>
            )}
          </div>

          {/* Redeem */}
          <div className="surface-card p-7">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-display text-xl font-bold text-white">Resgatar código</h2>
              <span className="text-3xl">🎫</span>
            </div>
            <form onSubmit={handleRedeem} className="space-y-4">
              <div>
                <label className="mb-2 block text-[12px] font-semibold uppercase tracking-wider text-white/55">Código de afiliado</label>
                <input
                  type="text" value={redeemCode}
                  onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                  className="input-premium text-mono text-center text-lg tracking-[0.25em]"
                  placeholder="XXXX-XXXX" maxLength={12} required
                />
              </div>
              <button type="submit" disabled={loading || !redeemCode.trim()} className="btn btn-gold w-full">
                {loading ? 'Resgatando...' : 'Resgatar código'}
              </button>
              <p className="text-center text-xs text-white/45">Ganhe 2 gerações grátis ao resgatar!</p>
            </form>
          </div>
        </div>

        {/* Withdraw CTA */}
        {stats && (
          <div className="surface-card p-7 mb-6 animate-fade-up delay-300">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="eyebrow">Saldo</p>
                <p className="num-display text-4xl text-gradient-aurora mt-1">R$ {stats.affiliateBalance.toFixed(2)}</p>
              </div>
              <button
                onClick={() => setShowWithdrawModal(true)}
                disabled={stats.affiliateBalance < 10}
                className="btn btn-primary btn-lg"
              >
                {stats.affiliateBalance >= 10 ? '💸 Solicitar resgate' : 'Mínimo R$ 10,00'}
              </button>
            </div>
          </div>
        )}

        {/* Tables */}
        {stats && stats.recentCommissions && stats.recentCommissions.length > 0 && (
          <Section title="Comissões recentes">
            {stats.recentCommissions.map((c) => (
              <Row key={c.id}
                left={
                  <div>
                    <p className="text-sm font-semibold text-white">{c.buyerUsername} · {c.planName}</p>
                    <p className="text-[11px] text-white/40">{format(new Date(c.createdAt), "dd 'de' MMM yyyy", { locale: ptBR })} · R$ {c.paymentAmount.toFixed(2)}</p>
                  </div>
                }
                right={<span className="num-display text-lg text-aurora-mint">+R$ {c.amount.toFixed(2)}</span>}
              />
            ))}
          </Section>
        )}

        {stats && stats.recentWithdrawals && stats.recentWithdrawals.length > 0 && (
          <Section title="Seus resgates">
            {stats.recentWithdrawals.map((w) => (
              <Row key={w.id}
                left={
                  <div>
                    <p className="text-sm font-semibold text-white">R$ {w.amount.toFixed(2)}</p>
                    <p className="text-[11px] text-white/40">{format(new Date(w.createdAt), "dd 'de' MMM yyyy", { locale: ptBR })}</p>
                  </div>
                }
                right={<span className={statusPill[w.status] || statusPill.PENDING}>{statusLabel[w.status] || statusLabel.PENDING}</span>}
              />
            ))}
          </Section>
        )}

        {stats && stats.recentReferrals.length > 0 && (
          <Section title="Indicações recentes">
            {stats.recentReferrals.map((r) => (
              <Row key={r.id}
                left={
                  <div>
                    <p className="text-sm font-semibold text-white">{r.username}</p>
                    <p className="text-[11px] text-white/40">{format(new Date(r.createdAt), "dd 'de' MMM yyyy", { locale: ptBR })}</p>
                  </div>
                }
                right={<span className="num-display text-aurora-mint">+2 gerações</span>}
              />
            ))}
          </Section>
        )}
      </div>

      {/* Withdraw Modal */}
      {showWithdrawModal && stats && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="surface-card-elevated w-full max-w-md p-7 animate-scale-in">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-display text-2xl font-bold text-white">💸 Solicitar resgate</h3>
              <button onClick={() => setShowWithdrawModal(false)} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/70 hover:text-white">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="rounded-2xl border border-aurora-mint/30 bg-aurora-mint/8 p-3 mb-4">
              <p className="text-xs text-aurora-mint">Saldo: <strong>R$ {stats.affiliateBalance.toFixed(2)}</strong></p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wider text-white/55">Valor</label>
                <input type="number" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="Mínimo R$ 10,00" min="10" max={stats.affiliateBalance} step="0.01"
                  className="input-premium" />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wider text-white/55">Tipo PIX</label>
                <select value={pixKeyType} onChange={(e) => setPixKeyType(e.target.value as any)} className="input-premium">
                  <option value="CPF" className="bg-[#0a0a13]">CPF</option>
                  <option value="CNPJ" className="bg-[#0a0a13]">CNPJ</option>
                  <option value="EMAIL" className="bg-[#0a0a13]">E-mail</option>
                  <option value="PHONE" className="bg-[#0a0a13]">Telefone</option>
                  <option value="RANDOM" className="bg-[#0a0a13]">Aleatória</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wider text-white/55">Chave PIX</label>
                <input type="text" value={pixKey} onChange={(e) => setPixKey(e.target.value)} placeholder="Digite sua chave" className="input-premium" />
              </div>
              <div className="rounded-xl border border-aurora-gold/30 bg-aurora-gold/8 p-3">
                <p className="text-[12px] text-aurora-gold">⚠️ Pagamento manual pelo admin. Aguarde processamento.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={handleWithdraw} disabled={withdrawing} className="btn btn-primary flex-1">
                  {withdrawing ? 'Enviando...' : 'Confirmar'}
                </button>
                <button onClick={() => setShowWithdrawModal(false)} className="btn btn-ghost">Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, hint, accent }: { label: string; value: string; hint: string; accent: 'mint' | 'violet' | 'cyan' | 'gold' }) {
  const color: Record<string, string> = { mint: 'text-aurora-mint', violet: 'text-aurora-violet', cyan: 'text-aurora-cyan', gold: 'text-aurora-gold' }
  return (
    <div className="bg-[#0c0c15]/95 p-5">
      <p className="eyebrow">{label}</p>
      <p className={`num-display mt-2 text-2xl ${color[accent]}`}>{value}</p>
      <p className="mt-1 text-[11px] text-white/45">{hint}</p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="surface-card p-7 mb-5 animate-fade-up">
      <h2 className="text-display text-xl font-bold text-white mb-4">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function Row({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3.5 hover:bg-white/[0.04] transition-colors">
      <div className="min-w-0 flex-1">{left}</div>
      <div className="shrink-0">{right}</div>
    </div>
  )
}
