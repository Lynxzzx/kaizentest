import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import axios from 'axios'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'

interface RankingEntry {
  position: number
  userId: string
  username: string
  count: number
  badge: string | null
}

interface WeeklyData {
  weekStart: string
  nextReset: string
  totalParticipants: number
  rankings: RankingEntry[]
}

interface Snapshot {
  id: string
  weekStart: string
  weekEnd: string
  rankings: string
}

const BADGE_COLORS: Record<string, string> = {
  gold: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  silver: 'text-slate-300 bg-slate-300/10 border-slate-300/30',
  bronze: 'text-orange-400 bg-orange-400/10 border-orange-400/30'
}
const BADGE_EMOJI: Record<string, string> = { gold: '🥇', silver: '🥈', bronze: '🥉' }

export default function AdminRanking() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [weeklyData, setWeeklyData] = useState<WeeklyData | null>(null)
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)
  const [selectedSnapshot, setSelectedSnapshot] = useState<Snapshot | null>(null)

  useEffect(() => {
    if (status === 'loading') return
    if (!session || !['OWNER', 'CO_OWNER', 'ADMIN'].includes(session.user.role)) {
      router.push('/dashboard')
    }
  }, [session, status, router])

  useEffect(() => {
    if (session) {
      loadData()
    }
  }, [session])

  const loadData = async () => {
    setLoading(true)
    try {
      const [rankRes, snapshotRes] = await Promise.all([
        axios.get('/api/ranking/weekly'),
        axios.get('/api/admin/ranking/snapshots')
      ])
      setWeeklyData(rankRes.data)
      setSnapshots(snapshotRes.data.snapshots || [])
    } catch (e) {
      // snapshots might not exist yet
      try {
        const rankRes = await axios.get('/api/ranking/weekly')
        setWeeklyData(rankRes.data)
      } catch {}
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async () => {
    if (!confirm('⚠️ Isso vai resetar TODOS os contadores semanais e distribuir prêmios agora. Continuar?')) return
    setResetting(true)
    try {
      const cronSecret = prompt('Digite o CRON_SECRET para confirmar:')
      if (!cronSecret) { setResetting(false); return }
      const res = await axios.post('/api/cron/reset-weekly-ranking', {}, {
        headers: { Authorization: `Bearer ${cronSecret}` }
      })
      toast.success(`✅ Reset concluído! ${res.data.usersReset} usuários resetados.`)
      await loadData()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Erro ao resetar ranking')
    } finally {
      setResetting(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-500" />
    </div>
  )

  return (
    <div className="min-h-screen bg-[#000000] text-gray-100">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/10 bg-black/20 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-gray-400 hover:text-white text-sm">← Admin</Link>
            <span className="text-gray-600">/</span>
            <span className="text-white font-bold">🏆 Ranking Semanal</span>
          </div>
          <button
            onClick={handleReset}
            disabled={resetting}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 text-white font-bold text-sm hover:shadow-lg hover:shadow-red-500/50 disabled:opacity-50 transition-all"
          >
            {resetting ? '⏳ Resetando...' : '🔄 Forçar Reset Agora'}
          </button>
        </div>
      </nav>

      <main className="pt-24 pb-16 px-6 max-w-7xl mx-auto">

        {/* Stats header */}
        {weeklyData && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="glass-card p-5 rounded-2xl border border-white/10">
              <p className="text-gray-400 text-sm">Participantes esta semana</p>
              <p className="text-3xl font-bold text-white mt-1">{weeklyData.totalParticipants}</p>
            </div>
            <div className="glass-card p-5 rounded-2xl border border-white/10">
              <p className="text-gray-400 text-sm">Início da semana</p>
              <p className="text-lg font-bold text-white mt-1">
                {format(new Date(weeklyData.weekStart), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
            <div className="glass-card p-5 rounded-2xl border border-yellow-500/20 bg-yellow-500/5">
              <p className="text-gray-400 text-sm">Próximo reset</p>
              <p className="text-lg font-bold text-yellow-300 mt-1">
                {format(new Date(weeklyData.nextReset), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Ranking atual */}
          <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
            <div className="p-6 border-b border-white/10 bg-gradient-to-r from-yellow-500/10 to-transparent">
              <h2 className="text-xl font-bold text-white">🏆 Ranking Atual</h2>
              <p className="text-gray-400 text-sm mt-1">{weeklyData?.rankings.length || 0} usuários no top</p>
            </div>
            <div className="p-4 space-y-2 max-h-[500px] overflow-y-auto">
              {(weeklyData?.rankings || []).length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                  <p className="text-3xl mb-2">📭</p>
                  <p>Nenhuma geração esta semana ainda</p>
                </div>
              ) : (
                weeklyData?.rankings.map(entry => (
                  <div key={entry.userId} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className="w-8 text-center font-bold text-sm text-gray-400">#{entry.position}</div>
                    {entry.badge && (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${BADGE_COLORS[entry.badge]}`}>
                        {BADGE_EMOJI[entry.badge]} {entry.badge}
                      </span>
                    )}
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm font-bold">
                      {entry.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-white">{entry.username}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-white">{entry.count}</span>
                      <p className="text-[10px] text-gray-500">ger.</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Histórico de semanas */}
          <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
            <div className="p-6 border-b border-white/10 bg-gradient-to-r from-purple-500/10 to-transparent">
              <h2 className="text-xl font-bold text-white">📅 Histórico de Semanas</h2>
              <p className="text-gray-400 text-sm mt-1">{snapshots.length} semanas registradas</p>
            </div>
            <div className="p-4 space-y-2 max-h-[500px] overflow-y-auto">
              {snapshots.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                  <p className="text-3xl mb-2">📂</p>
                  <p>Nenhuma semana finalizada ainda</p>
                </div>
              ) : (
                snapshots.map(snap => {
                  const rankings = JSON.parse(snap.rankings) as RankingEntry[]
                  const top1 = rankings[0]
                  return (
                    <div
                      key={snap.id}
                      className="p-3 rounded-xl bg-white/5 border border-white/5 cursor-pointer hover:bg-white/10 transition-all"
                      onClick={() => setSelectedSnapshot(selectedSnapshot?.id === snap.id ? null : snap)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {format(new Date(snap.weekStart), "dd/MM", { locale: ptBR })} → {format(new Date(snap.weekEnd), "dd/MM/yyyy", { locale: ptBR })}
                          </p>
                          {top1 && <p className="text-xs text-gray-400">🥇 {top1.username} • {top1.count} ger.</p>}
                        </div>
                        <span className="text-gray-500 text-xs">{selectedSnapshot?.id === snap.id ? '▲' : '▼'}</span>
                      </div>

                      {selectedSnapshot?.id === snap.id && (
                        <div className="mt-3 space-y-1 border-t border-white/10 pt-3">
                          {rankings.slice(0, 10).map(r => (
                            <div key={r.userId} className="flex items-center gap-2 text-xs">
                              <span className="text-gray-500 w-6">#{r.position}</span>
                              {r.badge && <span>{BADGE_EMOJI[r.badge]}</span>}
                              <span className="text-white flex-1">{r.username}</span>
                              <span className="text-gray-400">{r.count} ger.</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
