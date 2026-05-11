import { useEffect, useState, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n-helper'
import axios from 'axios'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'

interface ServicePlanRule {
  planId: string
  plan?: { id: string; name: string; price: number } | null
}

interface Service {
  id: string
  name: string
  description: string
  icon: string
  allowedPlans?: ServicePlanRule[]
  _count: { stocks: number }
}

interface Plan {
  id: string
  name: string
  description: string
  price: number
  duration: number
  maxGenerations: number
}

interface UserPlan {
  plan: Plan | null
  planExpiresAt: Date | null
  affiliateCode: string | null
}

const COOLDOWN_SECONDS = 120

export default function Dashboard() {
  const { t, translatePlanName } = useTranslation()
  const { data: session, status } = useSession()
  const router = useRouter()
  const [services, setServices] = useState<Service[]>([])
  const [userPlan, setUserPlan] = useState<UserPlan | null>(null)
  const [selectedService, setSelectedService] = useState<string>('')
  const [generatedAccount, setGeneratedAccount] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const [accountHistory, setAccountHistory] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyPagination, setHistoryPagination] = useState<any>(null)
  const [showHistory, setShowHistory] = useState(false)

  const [cooldownRemaining, setCooldownRemaining] = useState(0)
  const cooldownIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const [captchaId, setCaptchaId] = useState<string | null>(null)
  const [captchaImage, setCaptchaImage] = useState<string | null>(null)
  const [captchaInput, setCaptchaInput] = useState<string>('')
  const [showCaptchaModal, setShowCaptchaModal] = useState(false)

  const requiresPaidPlan = (s: Service) => (s.allowedPlans?.length ?? 0) > 0
  const canAccessService = (s: Service) => {
    if (!requiresPaidPlan(s)) return true
    if (!userPlan?.plan) return false
    return s.allowedPlans?.some((a) => a.planId === userPlan.plan!.id) ?? false
  }

  const formatCooldown = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const startCooldownTimer = useCallback((seconds: number) => {
    if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current)
    setCooldownRemaining(seconds)
    cooldownIntervalRef.current = setInterval(() => {
      setCooldownRemaining(prev => {
        if (prev <= 1) {
          if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  const checkCooldown = useCallback(async () => {
    try {
      const response = await axios.get('/api/accounts/cooldown')
      if (response.data.cooldownRemaining > 0) startCooldownTimer(response.data.cooldownRemaining)
    } catch {}
  }, [startCooldownTimer])

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [session, status, router])

  useEffect(() => {
    if (session) {
      loadServices()
      loadUserPlan()
      checkCooldown()
      loadAccountHistory(1)
    }
    return () => { if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current) }
  }, [session, checkCooldown])

  const loadServices = async () => {
    try {
      const response = await axios.get(`/api/services?_t=${Date.now()}`)
      setServices(response.data)
    } catch { toast.error(t('errorLoadingServices')) }
  }

  const loadUserPlan = async () => {
    try {
      const response = await axios.get('/api/users/me')
      setUserPlan({
        plan: response.data.plan,
        planExpiresAt: response.data.planExpiresAt ? new Date(response.data.planExpiresAt) : null,
        affiliateCode: response.data.affiliateCode || null
      })
    } catch {}
  }

  const loadAccountHistory = async (page: number = 1) => {
    setHistoryLoading(true)
    try {
      const response = await axios.get(`/api/accounts/history?page=${page}&limit=20`)
      setAccountHistory(response.data.accounts)
      setHistoryPagination(response.data.pagination)
      setHistoryPage(page)
    } catch { toast.error('Erro ao carregar histórico') }
    finally { setHistoryLoading(false) }
  }

  const copyAffiliateLink = (code: string) => {
    const link = `${typeof window !== 'undefined' ? window.location.origin : ''}/register?ref=${code}`
    navigator.clipboard.writeText(link)
    toast.success(t('affiliateLinkCopied'))
  }
  const getAffiliateLink = (code: string) => {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/register?ref=${code}`
  }

  const handleGenerateAccount = async () => {
    if (!selectedService) { toast.error(t('selectService')); return }
    if (cooldownRemaining > 0) { toast.error(`Aguarde ${formatCooldown(cooldownRemaining)} antes de gerar.`); return }
    const service = services.find((it) => it.id === selectedService)
    if (!service) { toast.error(t('errorLoadingServices')); return }
    if (!canAccessService(service)) {
      toast.error('Este serviço é exclusivo para planos pagos.')
      router.push('/plans'); return
    }
    setLoading(true)
    try {
      if (!captchaId || !captchaImage) {
        const { data } = await axios.get('/api/auth/captcha')
        setCaptchaId(data.id); setCaptchaImage(data.image); setCaptchaInput('')
        setShowCaptchaModal(true); setLoading(false); return
      }
      const response = await axios.post('/api/accounts/generate', {
        serviceId: selectedService, captchaId, captchaCode: captchaInput
      })
      setGeneratedAccount(response.data)
      toast.success(t('accountGeneratedSuccess'))
      loadUserPlan(); loadAccountHistory(1)
      setCaptchaId(null); setCaptchaImage(null); setCaptchaInput(''); setShowCaptchaModal(false)
      if (response.data.cooldown?.seconds) startCooldownTimer(response.data.cooldown.seconds)
      else startCooldownTimer(COOLDOWN_SECONDS)
    } catch (error: any) {
      const errorData = error.response?.data
      setCaptchaId(null); setCaptchaImage(null); setCaptchaInput('')
      if (errorData?.cooldownRemaining) startCooldownTimer(errorData.cooldownRemaining)
      toast.error(errorData?.error || t('errorGeneratingAccount'))
    } finally { setLoading(false) }
  }

  if (status === 'loading') {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
        <div className="flex items-center gap-3 text-white/55">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25"/>
            <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4"/>
          </svg>
          {t('loading')}
        </div>
      </div>
    )
  }
  if (!session) return null

  const planActive = !!userPlan?.plan
  const planLabel = planActive ? (translatePlanName ? translatePlanName(userPlan!.plan!.name) : userPlan!.plan!.name) : 'Free'
  const activeStocksCount = services.filter(s => s._count.stocks > 0).length

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-0 top-0 h-[500px] w-[500px] rounded-full bg-aurora-violet/10 blur-[140px]" />
        <div className="absolute right-0 top-1/4 h-[450px] w-[450px] rounded-full bg-aurora-cyan/10 blur-[140px]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        {/* Header */}
        <div className="mb-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 animate-fade-up">
          <div>
            <p className="eyebrow">Painel pessoal</p>
            <h1 className="mt-2 text-display text-4xl sm:text-5xl font-bold text-gradient">
              Bem-vindo, <span className="text-gradient-aurora">{session.user.username}</span>
            </h1>
            <p className="mt-2 text-sm text-white/55">Gere contas premium em segundos.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/plans" className="btn btn-ghost btn-sm">Ver planos</Link>
            <Link href="/profile" className="btn btn-ghost btn-sm">Perfil</Link>
          </div>
        </div>

        {/* Stats strip */}
        <div className="mb-8 grid grid-cols-2 lg:grid-cols-3 gap-px overflow-hidden rounded-3xl bg-white/[0.06] ring-1 ring-white/10 animate-fade-up delay-100">
          <div className="bg-[#0c0c15]/95 p-6 sm:p-8">
            <p className="eyebrow">Plano</p>
            <p className="num-display mt-2 text-3xl sm:text-4xl text-gradient">{planLabel}</p>
            {planActive && (
              <p className="mt-2 text-xs text-white/55">
                {userPlan!.planExpiresAt
                  ? `Expira em ${format(new Date(userPlan!.planExpiresAt), 'dd/MM/yyyy', { locale: ptBR })}`
                  : 'Permanente ∞'}
              </p>
            )}
            {!planActive && <p className="mt-2 text-xs text-aurora-mint">2 gerações diárias grátis</p>}
          </div>
          <div className="bg-[#0c0c15]/95 p-6 sm:p-8">
            <p className="eyebrow">Serviços disponíveis</p>
            <p className="num-display mt-2 text-3xl sm:text-4xl text-gradient">{activeStocksCount}</p>
            <p className="mt-2 text-xs text-white/55">com estoque ativo</p>
          </div>
          <div className="bg-[#0c0c15]/95 p-6 sm:p-8 col-span-2 lg:col-span-1">
            <p className="eyebrow">Gerações totais</p>
            <p className="num-display mt-2 text-3xl sm:text-4xl text-gradient">{accountHistory.length}</p>
            <p className="mt-2 text-xs text-white/55">no seu histórico</p>
          </div>
        </div>

        {/* Generator + Result */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 mb-8 animate-fade-up delay-200">
          {/* Generator */}
          <div className="lg:col-span-3 surface-card-elevated p-6 sm:p-8 relative overflow-hidden">
            <div className="pointer-events-none absolute -right-32 -top-32 h-72 w-72 rounded-full bg-aurora-violet/20 blur-3xl" />
            <div className="flex items-center gap-3 mb-6 relative">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-aurora-violet to-aurora-magenta text-xl">⚡</div>
              <div>
                <h2 className="text-display text-2xl font-bold text-white">Gerador</h2>
                <p className="text-xs text-white/55">Selecione o serviço e gere instantaneamente</p>
              </div>
            </div>

            <div className="space-y-4 relative">
              <div>
                <label className="mb-2 block text-[12px] font-semibold uppercase tracking-wider text-white/55">Serviço</label>
                <div className="relative">
                  <select
                    value={selectedService}
                    onChange={(e) => setSelectedService(e.target.value)}
                    className="input-premium appearance-none pr-10"
                  >
                    <option value="">Escolha um serviço...</option>
                    {services.filter(s => s._count.stocks > 0).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.icon || '⚡'} {s.name} · {s._count.stocks} disponíveis {requiresPaidPlan(s) ? '· 🔒' : ''}
                      </option>
                    ))}
                  </select>
                  <svg className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                </div>
                {selectedService && (() => {
                  const chosen = services.find(s => s.id === selectedService)
                  if (!chosen || !requiresPaidPlan(chosen)) return null
                  const access = canAccessService(chosen)
                  return access ? (
                    <p className="mt-2 text-[12px] text-aurora-mint flex items-center gap-2">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-aurora-mint" />
                      Serviço liberado no seu plano
                    </p>
                  ) : (
                    <p className="mt-2 text-[12px] text-rose-300 flex items-center gap-2">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-400" />
                      Exclusivo para planos pagos
                    </p>
                  )
                })()}
              </div>

              {cooldownRemaining > 0 && (
                <div className="rounded-2xl border border-amber-400/30 bg-amber-400/8 p-4">
                  <div className="flex items-center justify-between text-amber-200">
                    <span className="text-sm font-bold flex items-center gap-2">
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                      Cooldown ativo · {formatCooldown(cooldownRemaining)}
                    </span>
                    <span className="text-xs text-amber-200/70">Anti-spam</span>
                  </div>
                  <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-white/8">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-1000 ease-linear"
                      style={{ width: `${((COOLDOWN_SECONDS - cooldownRemaining) / COOLDOWN_SECONDS) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              <button
                onClick={handleGenerateAccount}
                disabled={loading || !selectedService || cooldownRemaining > 0}
                className="btn btn-primary btn-lg w-full"
              >
                {loading ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25"/>
                      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4"/>
                    </svg>
                    Gerando...
                  </>
                ) : cooldownRemaining > 0 ? (
                  <>Aguarde {formatCooldown(cooldownRemaining)}</>
                ) : (
                  <>
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/></svg>
                    Gerar Conta Premium
                  </>
                )}
              </button>

              {!planActive && (
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
                  <div>
                    <p className="text-sm font-semibold text-white">Plano gratuito</p>
                    <p className="text-[12px] text-white/45">2 gerações por dia</p>
                  </div>
                  <Link href="/plans" className="btn btn-ghost btn-sm">Upgrade →</Link>
                </div>
              )}
            </div>
          </div>

          {/* Result */}
          <div className="lg:col-span-2 surface-card p-6 sm:p-7">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-aurora-mint to-aurora-cyan text-xl">✓</div>
              <div>
                <h2 className="text-display text-2xl font-bold text-white">Resultado</h2>
                <p className="text-xs text-white/55">Conta gerada</p>
              </div>
            </div>

            {generatedAccount ? (
              <div className="space-y-3 animate-scale-in">
                <CredField label="Email / Usuário" value={generatedAccount.email || generatedAccount.username} />
                <CredField label="Senha" value={generatedAccount.password} type="password" />
                <div className="rounded-2xl border border-aurora-mint/30 bg-aurora-mint/8 p-3.5">
                  <p className="eyebrow text-aurora-mint mb-2">Formato completo</p>
                  <code className="block break-all rounded-xl bg-black/40 px-3 py-2.5 text-[13px] text-mono text-aurora-mint border border-aurora-mint/20 select-all">
                    {generatedAccount.email || generatedAccount.username}:{generatedAccount.password}
                  </code>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-2xl text-white/30">
                  ⚡
                </div>
                <p className="text-sm text-white/55">Nenhuma conta gerada ainda</p>
                <p className="text-[12px] text-white/35">Selecione um serviço e clique em gerar</p>
              </div>
            )}
          </div>
        </div>

        {/* History */}
        <div className="surface-card p-6 sm:p-8 mb-8 animate-fade-up delay-300">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-aurora-violet to-aurora-cyan text-base">📜</div>
              <div>
                <h2 className="text-display text-xl font-bold text-white">Histórico</h2>
                <p className="text-[12px] text-white/55">Gerações recentes</p>
              </div>
            </div>
            <button
              onClick={() => { setShowHistory(!showHistory); if (!showHistory && accountHistory.length === 0) loadAccountHistory(1) }}
              className={`btn btn-sm ${showHistory ? 'btn-ghost' : 'btn-primary'}`}
            >
              {showHistory ? 'Ocultar' : 'Ver histórico'}
            </button>
          </div>

          {showHistory && (
            <div className="animate-fade-up">
              {historyLoading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-white/55">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25"/><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4"/></svg>
                  Carregando...
                </div>
              ) : accountHistory.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="text-5xl mb-3 opacity-40">📭</div>
                  <p className="text-sm text-white/55">Nenhuma conta gerada ainda</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                    {accountHistory.map((account) => (
                      <div key={account.id} className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 hover:bg-white/[0.04] transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] text-base">
                            {account.service?.icon || '⚡'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{account.service?.name || 'Serviço'}</p>
                            <p className="text-[11px] text-white/45">{format(new Date(account.createdAt), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}</p>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1.5 min-w-[260px]">
                          <CredInline label="USER" value={account.username} />
                          {account.password && <CredInline label="PASS" value={account.password} />}
                        </div>
                      </div>
                    ))}
                  </div>
                  {historyPagination && (historyPagination.hasPrev || historyPagination.hasNext) && (
                    <div className="mt-6 flex items-center justify-center gap-3 border-t border-white/[0.06] pt-5">
                      <button
                        onClick={() => loadAccountHistory(historyPage - 1)}
                        disabled={!historyPagination.hasPrev || historyLoading}
                        className="btn btn-ghost btn-sm disabled:opacity-30"
                      >← Anterior</button>
                      <span className="text-[12px] text-white/55">
                        Página <span className="text-white font-semibold">{historyPage}</span> de {historyPagination.totalPages}
                      </span>
                      <button
                        onClick={() => loadAccountHistory(historyPage + 1)}
                        disabled={!historyPagination.hasNext || historyLoading}
                        className="btn btn-ghost btn-sm disabled:opacity-30"
                      >Próxima →</button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Affiliate */}
        {userPlan?.affiliateCode && (
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-aurora-magenta/10 via-aurora-violet/10 to-aurora-cyan/10 p-7 sm:p-10 animate-fade-up delay-400">
            <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-aurora-magenta/30 blur-3xl" />
            <div className="relative">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-aurora-magenta to-aurora-violet text-2xl">🎁</div>
                  <div>
                    <h2 className="text-display text-2xl font-bold text-white">Programa de Afiliados</h2>
                    <p className="text-xs text-white/55">Compartilhe e ganhe comissões</p>
                  </div>
                </div>
                <Link href="/affiliate" className="btn btn-primary btn-sm">Ver estatísticas →</Link>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-4 mb-5">
                <p className="eyebrow mb-2">Seu link</p>
                <div className="flex items-center gap-3">
                  <code className="flex-1 truncate rounded-xl bg-white/[0.04] px-3 py-2.5 text-[13px] text-mono text-white/85 border border-white/8">
                    {getAffiliateLink(userPlan.affiliateCode!)}
                  </code>
                  <button onClick={() => copyAffiliateLink(userPlan.affiliateCode!)} className="btn btn-primary btn-sm shrink-0">Copiar</button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <MiniStat label="Comissão" value="40%" hint="Normal" icon="💰" />
                <MiniStat label="Co-Owner" value="50%" hint="VIP" icon="👑" />
                <MiniStat label="Pagamento" value="Instant" hint="On-chain" icon="⚡" />
              </div>
            </div>
          </div>
        )}
      </div>

      <CaptchaModal
        open={showCaptchaModal}
        image={captchaImage}
        value={captchaInput}
        onChange={setCaptchaInput}
        onRefresh={async () => {
          try {
            const { data } = await axios.get('/api/auth/captcha')
            setCaptchaId(data.id); setCaptchaImage(data.image); setCaptchaInput('')
          } catch { toast.error('Erro ao atualizar CAPTCHA') }
        }}
        onConfirm={handleGenerateAccount}
        onClose={() => { setShowCaptchaModal(false); setCaptchaId(null); setCaptchaImage(null); setCaptchaInput('') }}
      />
    </div>
  )
}

function CredField({ label, value, type = 'text' }: { label: string; value: string; type?: 'text' | 'password' }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3.5">
      <p className="eyebrow mb-2">{label}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 break-all rounded-xl bg-black/40 px-3 py-2 text-[13px] text-mono text-white border border-white/8">
          {value}
        </code>
        <button
          onClick={() => { navigator.clipboard.writeText(value); toast.success('Copiado!') }}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/70 hover:text-white hover:bg-white/[0.08]"
          title="Copiar"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

function CredInline({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-black/30 px-2.5 py-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-white/35">{label}</span>
      <code className="flex-1 truncate text-[12.5px] text-mono text-aurora-mint">{value}</code>
      <button
        onClick={() => { navigator.clipboard.writeText(value); toast.success('Copiado!') }}
        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-white/40 hover:text-white"
        title="Copiar"
      >
        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
      </button>
    </div>
  )
}

function MiniStat({ label, value, hint, icon }: { label: string; value: string; hint: string; icon: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xl">{icon}</span>
        <span className="pill pill-violet">{hint}</span>
      </div>
      <p className="num-display text-2xl text-white">{value}</p>
      <p className="text-[11px] text-white/45 mt-0.5">{label}</p>
    </div>
  )
}

function CaptchaModal({ open, image, value, onChange, onRefresh, onConfirm, onClose }: {
  open: boolean
  image: string | null
  value: string
  onChange: (v: string) => void
  onRefresh: () => void
  onConfirm: () => void
  onClose: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="w-full max-w-md surface-card-elevated p-6 sm:p-7 animate-scale-in">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="eyebrow">Verificação</p>
            <h3 className="text-display text-2xl font-bold text-white mt-1">Confirme que é você</h3>
          </div>
          <button onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/70 hover:text-white">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <p className="text-sm text-white/55 mb-4">Digite os caracteres mostrados para continuar.</p>
        <div className="flex items-center gap-3 mb-5">
          {image ? (
            <img src={image} alt="CAPTCHA" className="rounded-xl border border-white/10 bg-white/5" />
          ) : (
            <div className="h-[60px] w-[200px] animate-pulse rounded-xl bg-white/10" />
          )}
          <button onClick={onRefresh} className="btn btn-ghost btn-sm" title="Atualizar">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 019-9 9.7 9.7 0 016.7 2.6L21 8M3 12v-5M3 12a9 9 0 009 9 9.7 9.7 0 006.7-2.6L21 16M21 12v5"/></svg>
          </button>
        </div>
        <input
          type="text" value={value} onChange={(e) => onChange(e.target.value)}
          className="input-premium text-mono text-center text-lg tracking-[0.3em] mb-5"
          placeholder="A-Z, 2-9" autoFocus
        />
        <div className="flex gap-2">
          <button onClick={onClose} className="btn btn-ghost flex-1">Cancelar</button>
          <button onClick={onConfirm} className="btn btn-primary flex-1">Confirmar</button>
        </div>
      </div>
    </div>
  )
}
