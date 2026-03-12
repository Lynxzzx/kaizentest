import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import axios from 'axios'
import Link from 'next/link'

interface RankingEntry {
  position: number
  userId: string
  username: string
  count: number
  planName: string | null
  badge: 'gold' | 'silver' | 'bronze' | null
  lastWeekBadge: string | null
}

interface WeeklyRankingData {
  weekStart: string
  nextReset: string
  totalParticipants: number
  rankings: RankingEntry[]
  myPosition: number | null
}

function useCountdown(targetDate: string) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })

  useEffect(() => {
    const calc = () => {
      const diff = new Date(targetDate).getTime() - Date.now()
      if (diff <= 0) return setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 })
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000)
      })
    }
    calc()
    const interval = setInterval(calc, 1000)
    return () => clearInterval(interval)
  }, [targetDate])

  return timeLeft
}

const MEDAL_CONFIG = {
  gold: {
    emoji: '🥇',
    label: '1º',
    gradient: 'from-yellow-400 via-amber-400 to-yellow-500',
    glow: 'shadow-yellow-500/50',
    border: 'border-yellow-500/40',
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-300',
    ring: 'ring-yellow-500/30',
    bonusLabel: '+10 gerações + cooldown ÷2'
  },
  silver: {
    emoji: '🥈',
    label: '2º',
    gradient: 'from-slate-300 via-gray-200 to-slate-400',
    glow: 'shadow-slate-400/50',
    border: 'border-slate-400/40',
    bg: 'bg-slate-400/10',
    text: 'text-slate-300',
    ring: 'ring-slate-400/30',
    bonusLabel: '+5 gerações + cooldown ÷2'
  },
  bronze: {
    emoji: '🥉',
    label: '3º',
    gradient: 'from-orange-400 via-amber-600 to-orange-700',
    glow: 'shadow-orange-600/50',
    border: 'border-orange-600/40',
    bg: 'bg-orange-600/10',
    text: 'text-orange-300',
    ring: 'ring-orange-600/30',
    bonusLabel: '+3 gerações + cooldown ÷2'
  }
}

export default function WeeklyRanking() {
  const { data: session } = useSession()
  const [data, setData] = useState<WeeklyRankingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await axios.get('/api/ranking/weekly')
      setData(res.data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const countdown = useCountdown(data?.nextReset || new Date(Date.now() + 7 * 86400000).toISOString())

  if (loading) {
    return (
      <div className="glass-card rounded-2xl sm:rounded-3xl p-6 border border-white/10 animate-pulse">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-white/10" />
          <div className="flex-1">
            <div className="h-4 bg-white/10 rounded mb-2 w-48" />
            <div className="h-3 bg-white/10 rounded w-32" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[0, 1, 2].map(i => <div key={i} className="h-32 bg-white/5 rounded-2xl" />)}
        </div>
      </div>
    )
  }

  const top3 = (data?.rankings || []).slice(0, 3)
  const rest = expanded ? (data?.rankings || []).slice(3, 20) : (data?.rankings || []).slice(3, 7)
  const myPos = data?.myPosition
  const isTop3 = myPos !== null && myPos !== undefined && myPos <= 3

  // Pódio: 2º, 1º, 3º (visual)
  const podiumOrder = [top3[1], top3[0], top3[2]]
  const podiumHeights = ['h-24', 'h-32', 'h-20']
  const podiumBadge = ['silver', 'gold', 'bronze'] as const

  return (
    <div className="glass-card rounded-2xl sm:rounded-3xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="relative p-5 sm:p-8 pb-4 bg-gradient-to-br from-yellow-500/10 via-transparent to-purple-500/10 border-b border-white/10">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-amber-500 rounded-2xl blur-md opacity-60" />
              <div className="relative w-12 sm:w-14 h-12 sm:h-14 rounded-2xl bg-gradient-to-r from-yellow-400 to-amber-500 flex items-center justify-center text-2xl">
                🏆
              </div>
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                Ranking Semanal
                {isTop3 && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 animate-pulse">
                    VOCÊ ESTÁ NO TOP 3 🔥
                  </span>
                )}
              </h2>
              <p className="text-gray-400 text-sm">{data?.totalParticipants || 0} participantes • Reseta todo domingo</p>
            </div>
          </div>

          {/* Countdown */}
          {data?.nextReset && (
            <div className="flex items-center gap-1.5 bg-black/30 rounded-2xl px-4 py-2.5 border border-white/10">
              <span className="text-gray-400 text-xs font-medium mr-1">Próximo reset:</span>
              {[
                { v: countdown.days, l: 'd' },
                { v: countdown.hours, l: 'h' },
                { v: countdown.minutes, l: 'm' },
                { v: countdown.seconds, l: 's' }
              ].map(({ v, l }, i) => (
                <div key={l} className="flex items-center gap-1">
                  <span className="text-white font-bold text-sm tabular-nums w-5 text-right">{String(v).padStart(2, '0')}</span>
                  <span className="text-gray-500 text-xs">{l}</span>
                  {i < 3 && <span className="text-gray-600 text-xs">:</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="p-5 sm:p-8">

        {/* Pódio Top 3 */}
        {top3.length > 0 && (
          <div className="mb-8">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-5 text-center">🏅 Pódio da Semana</p>
            <div className="flex items-end justify-center gap-2 sm:gap-4 mb-4">
              {podiumOrder.map((user, idx) => {
                if (!user) return <div key={idx} className="flex-1 max-w-[110px] sm:max-w-[140px]" />
                const cfg = MEDAL_CONFIG[podiumBadge[idx]]
                const isMe = user.userId === session?.user?.id
                return (
                  <div key={user.userId} className="flex-1 max-w-[110px] sm:max-w-[140px] flex flex-col items-center gap-2">
                    {/* Avatar */}
                    <div className={`relative ${isMe ? 'scale-110' : ''}`}>
                      {idx === 1 && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-lg">👑</div>
                      )}
                      <div className={`w-12 sm:w-14 h-12 sm:h-14 rounded-full bg-gradient-to-br ${cfg.gradient} flex items-center justify-center text-xl font-bold text-white ring-2 ${cfg.ring} shadow-lg ${isMe ? 'ring-4 ring-indigo-500/50' : ''}`}>
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      {isMe && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-indigo-500 rounded-full border-2 border-black flex items-center justify-center text-[8px]">✓</div>
                      )}
                    </div>

                    {/* Username */}
                    <div className="text-center">
                      <p className={`font-bold text-xs sm:text-sm truncate max-w-[100px] ${isMe ? 'text-indigo-300' : 'text-white'}`}>
                        {isMe ? 'Você' : user.username}
                      </p>
                      <p className={`text-xs font-semibold ${cfg.text}`}>
                        {user.count} ger.
                      </p>
                    </div>

                    {/* Pedestal */}
                    <div className={`w-full ${podiumHeights[idx]} rounded-t-2xl bg-gradient-to-b ${cfg.gradient} opacity-70 flex flex-col items-center justify-start pt-2`}>
                      <span className="text-2xl">{cfg.emoji}</span>
                      <span className="text-white font-black text-lg">{cfg.label}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Prêmios legenda */}
            <div className="grid grid-cols-3 gap-2">
              {(['gold', 'silver', 'bronze'] as const).map(badge => {
                const cfg = MEDAL_CONFIG[badge]
                return (
                  <div key={badge} className={`rounded-xl p-2 ${cfg.bg} border ${cfg.border} text-center`}>
                    <p className={`text-[10px] font-semibold ${cfg.text}`}>{cfg.bonusLabel}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Lista 4-10+ */}
        {rest.length > 0 && (
          <div className="space-y-2 mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Classificação</p>
            {rest.map(entry => {
              const isMe = entry.userId === session?.user?.id
              return (
                <div
                  key={entry.userId}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${isMe
                    ? 'bg-indigo-500/10 border-indigo-500/30'
                    : 'bg-white/5 border-white/5 hover:bg-white/10'
                    }`}
                >
                  <div className="w-7 text-center text-sm font-bold text-gray-400">
                    #{entry.position}
                  </div>
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center text-sm font-bold ${isMe ? 'from-indigo-600 to-purple-600' : ''}`}>
                    {entry.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm truncate ${isMe ? 'text-indigo-300' : 'text-white'}`}>
                      {isMe ? `${entry.username} (você)` : entry.username}
                    </p>
                    {entry.planName && <p className="text-xs text-gray-500">{entry.planName}</p>}
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-white">{entry.count}</span>
                    <p className="text-[10px] text-gray-500">gerações</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Ver mais / menos */}
        {(data?.rankings || []).length > 7 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full py-2.5 rounded-xl border border-white/10 text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-all"
          >
            {expanded ? '▲ Ver menos' : `▼ Ver mais (${(data?.rankings || []).length - 7} usuários)`}
          </button>
        )}

        {/* Minha posição fora do top */}
        {myPos && myPos > 20 && (
          <div className="mt-4 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between">
            <span className="text-sm text-indigo-300">Sua posição esta semana</span>
            <span className="font-bold text-white">#{myPos}</span>
          </div>
        )}

        {/* Estado vazio */}
        {(data?.rankings || []).length === 0 && (
          <div className="text-center py-10">
            <div className="text-5xl mb-4">🏁</div>
            <p className="text-gray-400 font-semibold">Ranking vazio!</p>
            <p className="text-gray-500 text-sm mt-1">Seja o primeiro a gerar esta semana e garanta o topo 🔥</p>
          </div>
        )}
      </div>
    </div>
  )
}
