import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import axios from 'axios'
import toast from 'react-hot-toast'
import { format, isPast } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'

interface Plan { id: string; name: string; description: string | null; price: number; duration: number }
interface Raffle {
  id: string; title: string; description: string | null; prize: string
  prizeType: 'PLAN' | 'GENERATIONS' | 'CUSTOM'
  prizePlanId: string | null
  prizePlan: Plan | null
  endDate: string
  isActive: boolean; isFinished: boolean
  winnerId: string | null
  winner: { id: string; username: string } | null
  _count: { participants: number }
  createdAt: string
}

function timeLeft(endDate: Date): { d: number; h: number; m: number; s: number; expired: boolean } {
  const diff = endDate.getTime() - Date.now()
  if (diff <= 0) return { d: 0, h: 0, m: 0, s: 0, expired: true }
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  return { d, h, m, s, expired: false }
}

export default function Raffles() {
  const { data: session } = useSession()
  const router = useRouter()
  const [raffles, setRaffles] = useState<Raffle[]>([])
  const [loading, setLoading] = useState(true)
  const [participating, setParticipating] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    loadRaffles()
    const i = setInterval(loadRaffles, 30000)
    const t = setInterval(() => setTick(p => p + 1), 1000)
    return () => { clearInterval(i); clearInterval(t) }
  }, [])

  const loadRaffles = async () => {
    try { const r = await axios.get('/api/raffles?active=true'); setRaffles(r.data) }
    catch { toast.error('Erro ao carregar sorteios') }
    finally { setLoading(false) }
  }

  const handleParticipate = async (raffleId: string) => {
    if (!session) { toast.error('Faça login para participar'); router.push('/login'); return }
    setParticipating(raffleId)
    try {
      const r = await axios.post('/api/raffles/participate', { raffleId })
      toast.success(r.data.message || 'Você entrou no sorteio!')
      loadRaffles()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao participar')
    } finally { setParticipating(null) }
  }

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center text-white/55">
        <svg className="h-5 w-5 animate-spin mr-2" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25"/><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4"/></svg>
        Carregando sorteios...
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/4 top-0 h-[500px] w-[500px] rounded-full bg-aurora-magenta/12 blur-[140px]" />
        <div className="absolute right-1/4 top-1/2 h-[450px] w-[450px] rounded-full bg-aurora-violet/12 blur-[140px]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="mb-12 text-center animate-fade-up">
          <p className="eyebrow">Sorteios ao vivo</p>
          <h1 className="mt-2 text-display text-5xl sm:text-6xl font-bold">
            <span className="text-gradient">Concorra a prêmios </span>
            <span className="text-gradient-aurora">incríveis</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-white/55">
            Participe gratuitamente e tenha chance de levar planos premium, gerações ilimitadas e mais.
          </p>
        </div>

        {raffles.length === 0 ? (
          <div className="surface-card-elevated mx-auto max-w-md p-10 text-center animate-fade-up">
            <div className="text-5xl mb-3">🎲</div>
            <p className="text-display text-2xl font-bold text-white">Nenhum sorteio ativo</p>
            <p className="mt-2 text-sm text-white/55">Volte em breve para novos sorteios.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-fade-up delay-100">
            {raffles.map((raffle) => {
              const end = new Date(raffle.endDate)
              const tl = timeLeft(end)
              const isExpired = tl.expired
              const canParticipate = !isExpired && raffle.isActive && !raffle.isFinished

              return (
                <div key={raffle.id} className="surface-card relative overflow-hidden p-7 transition-all hover:-translate-y-1">
                  <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-aurora-magenta/15 blur-3xl" />
                  <div className="relative">
                    <h2 className="text-display text-2xl font-bold text-white">{raffle.title}</h2>
                    {raffle.description && <p className="mt-2 text-sm text-white/55">{raffle.description}</p>}

                    <div className="mt-4 rounded-2xl border border-aurora-gold/30 bg-aurora-gold/8 p-4">
                      <p className="eyebrow text-aurora-gold mb-1">🎁 Prêmio</p>
                      <p className="text-display text-lg font-bold text-white">
                        {raffle.prizeType === 'PLAN' && raffle.prizePlan
                          ? `Plano: ${raffle.prizePlan.name}`
                          : raffle.prizeType === 'GENERATIONS'
                            ? `${raffle.prize} gerações grátis`
                            : raffle.prize}
                      </p>
                    </div>

                    {!isExpired && !raffle.isFinished && (
                      <div className="mt-4 grid grid-cols-4 gap-1.5">
                        {[
                          { v: tl.d, l: 'D' },
                          { v: tl.h, l: 'H' },
                          { v: tl.m, l: 'M' },
                          { v: tl.s, l: 'S' }
                        ].map((u, idx) => (
                          <div key={idx} className="rounded-xl border border-white/8 bg-black/30 p-2 text-center">
                            <p className="num-display text-xl text-white">{u.v.toString().padStart(2, '0')}</p>
                            <p className="text-[10px] uppercase tracking-wider text-white/40">{u.l}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-4 flex items-center justify-between text-[12.5px]">
                      <span className="text-white/55">Participantes</span>
                      <span className="font-semibold text-white">{raffle._count.participants}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[12.5px]">
                      <span className="text-white/55">Finaliza em</span>
                      <span className="font-semibold text-white">{format(end, "dd/MM/yy 'às' HH:mm", { locale: ptBR })}</span>
                    </div>

                    {raffle.winner && (
                      <div className="mt-4 rounded-2xl border border-aurora-mint/30 bg-aurora-mint/8 p-3 text-center">
                        <p className="text-aurora-mint font-bold text-sm">🎉 Ganhador: <span className="text-white">{raffle.winner.username}</span></p>
                      </div>
                    )}

                    <div className="mt-5">
                      {canParticipate && !raffle.winner && (
                        <button
                          onClick={() => handleParticipate(raffle.id)}
                          disabled={participating === raffle.id}
                          className="btn btn-primary w-full"
                        >
                          {participating === raffle.id ? 'Participando...' : '🎲 Participar agora'}
                        </button>
                      )}
                      {isExpired && !raffle.isFinished && (
                        <div className="rounded-xl border border-aurora-gold/30 bg-aurora-gold/8 p-3 text-center text-sm font-semibold text-aurora-gold">
                          ⏰ Aguardando finalização
                        </div>
                      )}
                      {raffle.isFinished && (
                        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center text-sm text-white/55">
                          ✅ Sorteio finalizado
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
