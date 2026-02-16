import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useTheme } from '@/contexts/ThemeContext'
import { getThemeClasses } from '@/lib/theme-utils'
import axios from 'axios'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'

interface Plan {
  id: string
  name: string
  description: string | null
  price: number
  duration: number
}

interface Raffle {
  id: string
  title: string
  description: string | null
  prize: string
  prizeType: 'PLAN' | 'GENERATIONS' | 'CUSTOM'
  prizePlanId: string | null
  prizePlan: Plan | null
  endDate: string
  isActive: boolean
  isFinished: boolean
  winnerId: string | null
  winner: {
    id: string
    username: string
    email: string | null
  } | null
  createdBy: {
    id: string
    username: string
  }
  _count: {
    participants: number
  }
  createdAt: string
}

const TIME_PRESETS = [
  { label: '5 min', minutes: 5 },
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '1 hora', minutes: 60 },
  { label: '2 horas', minutes: 120 },
  { label: '6 horas', minutes: 360 },
  { label: '12 horas', minutes: 720 },
  { label: '24 horas', minutes: 1440 },
  { label: '3 dias', minutes: 4320 },
  { label: '7 dias', minutes: 10080 }
]

export default function AdminRaffles() {
  const { data: session, status } = useSession()
  const { theme } = useTheme()
  const router = useRouter()
  const [raffles, setRaffles] = useState<Raffle[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [drawing, setDrawing] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    prize: '',
    prizeType: 'PLAN' as 'PLAN' | 'GENERATIONS' | 'CUSTOM',
    prizePlanId: '',
    endDate: ''
  })
  const themeClasses = getThemeClasses(theme)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (session?.user?.role !== 'OWNER' && session?.user?.role !== 'ADMIN') {
      router.push('/dashboard')
    }
  }, [session, status, router])

  useEffect(() => {
    if (session?.user?.role === 'OWNER' || session?.user?.role === 'ADMIN') {
      loadRaffles()
      loadPlans()
    }
  }, [session])

  // Live countdown ticker
  useEffect(() => {
    const interval = setInterval(() => setRaffles(prev => [...prev]), 1000)
    return () => clearInterval(interval)
  }, [])

  const loadRaffles = async () => {
    try {
      const response = await axios.get('/api/admin/raffles')
      setRaffles(response.data)
    } catch (error) {
      toast.error('Erro ao carregar sorteios')
    } finally {
      setLoading(false)
    }
  }

  const loadPlans = async () => {
    try {
      const response = await axios.get('/api/plans')
      setPlans(response.data)
    } catch (error) {
      console.error('Error loading plans:', error)
    }
  }

  const setTimePreset = (minutes: number) => {
    const d = new Date(Date.now() + minutes * 60000)
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    setFormData({ ...formData, endDate: local })
  }

  const getCountdown = (endDate: string) => {
    const diff = new Date(endDate).getTime() - Date.now()
    if (diff <= 0) return { text: 'Encerrado', expired: true }
    const d = Math.floor(diff / 86400000)
    const h = Math.floor((diff % 86400000) / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    const s = Math.floor((diff % 60000) / 1000)
    if (d > 0) return { text: `${d}d ${h}h ${m}m`, expired: false }
    if (h > 0) return { text: `${h}h ${m}m ${s}s`, expired: false }
    return { text: `${m}m ${s}s`, expired: false }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    try {
      await axios.post('/api/admin/raffles/create', formData)
      toast.success('Sorteio criado com sucesso!')
      setShowCreateModal(false)
      setFormData({
        title: '',
        description: '',
        prize: '',
        prizeType: 'PLAN',
        prizePlanId: '',
        endDate: ''
      })
      loadRaffles()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao criar sorteio')
    } finally {
      setCreating(false)
    }
  }

  const handleDraw = async (raffleId: string) => {
    if (!confirm('Tem certeza que deseja realizar o sorteio? Esta ação não pode ser desfeita.')) {
      return
    }
    setDrawing(raffleId)
    try {
      const response = await axios.post('/api/admin/raffles/draw', { raffleId })
      toast.success(`Sorteio realizado! Ganhador: ${response.data.winner.username}`)
      loadRaffles()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao realizar sorteio')
    } finally {
      setDrawing(null)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className={`admin-shell min-h-screen ${themeClasses.loading} flex items-center justify-center`}>
        <div className="text-center">
          <div className={`inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 ${theme === 'dark' ? 'border-purple-500' : 'border-primary-600'}`}></div>
          <p className={`mt-4 ${themeClasses.text.secondary}`}>Carregando...</p>
        </div>
      </div>
    )
  }

  if (session?.user?.role !== 'OWNER' && session?.user?.role !== 'ADMIN') {
    return null
  }

  const activeRaffles = raffles.filter(r => !r.isFinished && r.isActive)
  const finishedRaffles = raffles.filter(r => r.isFinished || !r.isActive)

  return (
    <div className={`admin-shell min-h-screen ${themeClasses.bg} py-10 px-4 sm:px-6 lg:px-10`}>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.6em] text-white/40">Gerenciador</p>
            <h1 className={`text-3xl font-bold ${themeClasses.text.primary}`}>🎲 Sorteios</h1>
            <p className={`${themeClasses.text.secondary} text-sm`}>Crie sorteios rápidos em minutos ou agende para depois</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-2xl">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-emerald-300 font-medium text-sm">{activeRaffles.length} ativos</span>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 text-white rounded-2xl font-bold hover:opacity-90 transition-all shadow-lg text-sm"
            >
              ✨ Criar Sorteio
            </button>
          </div>
        </div>

        {/* Active Raffles */}
        {activeRaffles.length > 0 && (
          <div className="space-y-4">
            <h2 className={`text-lg font-semibold ${themeClasses.text.primary}`}>🟢 Sorteios Ativos</h2>
            {activeRaffles.map(raffle => {
              const countdown = getCountdown(raffle.endDate)
              return (
                <div key={raffle.id} className={`${themeClasses.card} rounded-2xl p-5 border border-white/10`}>
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className={`text-xl font-bold ${themeClasses.text.primary}`}>{raffle.title}</h3>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-blue-500/20 text-blue-300">
                          Ativo
                        </span>
                      </div>
                      {raffle.description && (
                        <p className={`${themeClasses.text.muted} text-sm mb-3`}>{raffle.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                        <span className={`${themeClasses.text.secondary} flex items-center gap-1`}>
                          🎁 {raffle.prizeType === 'PLAN' && raffle.prizePlan
                            ? `Plano: ${raffle.prizePlan.name}`
                            : raffle.prizeType === 'GENERATIONS'
                              ? `${raffle.prize} Gerações`
                              : raffle.prize}
                        </span>
                        <span className={`${themeClasses.text.muted} flex items-center gap-1`}>
                          👥 {raffle._count.participants} participantes
                        </span>
                        <span className={`font-mono font-bold ${countdown.expired ? 'text-red-400' : 'text-cyan-300'} flex items-center gap-1`}>
                          ⏱️ {countdown.text}
                        </span>
                        <span className={themeClasses.text.muted}>
                          📅 {format(new Date(raffle.endDate), "dd/MM 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {raffle._count.participants > 0 && (
                        <button
                          onClick={() => handleDraw(raffle.id)}
                          disabled={drawing === raffle.id}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-green-500/80 to-emerald-500/80 hover:from-green-500 hover:to-emerald-500 text-white text-sm font-semibold transition-all shadow-lg disabled:opacity-50"
                        >
                          {drawing === raffle.id ? '⏳ Sorteando...' : '🎲 Sortear Agora'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Finished Raffles */}
        {finishedRaffles.length > 0 && (
          <div className="space-y-4">
            <h2 className={`text-lg font-semibold ${themeClasses.text.primary}`}>📋 Sorteios Finalizados</h2>
            {finishedRaffles.map(raffle => (
              <div key={raffle.id} className={`${themeClasses.card} rounded-2xl p-5 opacity-60 border border-white/5`}>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className={`text-lg font-bold ${themeClasses.text.primary}`}>{raffle.title}</h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-green-500/20 text-green-300">
                        Finalizado
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                      <span className={themeClasses.text.muted}>
                        🎁 {raffle.prizeType === 'PLAN' && raffle.prizePlan
                          ? `Plano: ${raffle.prizePlan.name}`
                          : raffle.prizeType === 'GENERATIONS'
                            ? `${raffle.prize} Gerações`
                            : raffle.prize}
                      </span>
                      <span className={themeClasses.text.muted}>👥 {raffle._count.participants} participantes</span>
                    </div>
                    {raffle.winner && (
                      <div className="mt-2 px-3 py-2 rounded-xl bg-green-500/10 border border-green-500/20 inline-flex items-center gap-2">
                        <span className="text-emerald-300 font-semibold text-sm">
                          🏆 Ganhador: {raffle.winner.username} {raffle.winner.email ? `(${raffle.winner.email})` : ''}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {raffles.length === 0 && (
          <div className={`${themeClasses.card} rounded-3xl p-12 text-center`}>
            <p className="text-4xl mb-3">🎲</p>
            <p className={themeClasses.text.secondary}>Nenhum sorteio criado ainda.</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 px-6 py-3 bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 text-white rounded-2xl font-bold hover:opacity-90 transition-all shadow-lg"
            >
              Criar Primeiro Sorteio
            </button>
          </div>
        )}

        {/* Create Raffle Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowCreateModal(false)}>
            <div
              className={`${themeClasses.card} rounded-3xl p-6 sm:p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto`}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className={`text-xl font-bold ${themeClasses.text.primary}`}>✨ Criar Sorteio</h3>
                <button onClick={() => setShowCreateModal(false)} className="p-2 rounded-xl hover:bg-white/10 text-white/60 hover:text-white transition-all">✕</button>
              </div>
              <form onSubmit={handleCreate} className="space-y-5">
                {/* Title */}
                <div>
                  <label className="text-sm font-semibold mb-2 block">Título *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    className={`${themeClasses.input} w-full px-4 py-3 rounded-xl`}
                    placeholder="Sorteio Relâmpago"
                    required
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="text-sm font-semibold mb-2 block">Descrição</label>
                  <textarea
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className={`${themeClasses.input} w-full px-4 py-3 rounded-xl`}
                    rows={2}
                    placeholder="Descrição do sorteio..."
                  />
                </div>

                {/* Prize Type */}
                <div>
                  <label className="text-sm font-semibold mb-2 block">Tipo de Prêmio *</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { key: 'PLAN', icon: '📋', label: 'Plano' },
                      { key: 'GENERATIONS', icon: '⚡', label: 'Gerações' },
                      { key: 'CUSTOM', icon: '🎁', label: 'Customizado' }
                    ].map(opt => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setFormData({ ...formData, prizeType: opt.key as any, prizePlanId: '' })}
                        className={`p-3 rounded-xl border text-center transition-all ${formData.prizeType === opt.key
                            ? 'border-indigo-500 bg-indigo-500/20 text-white'
                            : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
                          }`}
                      >
                        <span className="text-xl block mb-1">{opt.icon}</span>
                        <span className="text-xs font-semibold">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Plan selection or prize input */}
                {formData.prizeType === 'PLAN' && (
                  <div>
                    <label className="text-sm font-semibold mb-2 block">Plano *</label>
                    <select
                      value={formData.prizePlanId}
                      onChange={e => setFormData({ ...formData, prizePlanId: e.target.value })}
                      className={`${themeClasses.input} w-full px-4 py-3 rounded-xl`}
                      required
                    >
                      <option value="">Selecione um plano</option>
                      {plans.map(plan => (
                        <option key={plan.id} value={plan.id}>{plan.name} - R$ {plan.price.toFixed(2)}</option>
                      ))}
                    </select>
                  </div>
                )}
                {(formData.prizeType === 'GENERATIONS' || formData.prizeType === 'CUSTOM') && (
                  <div>
                    <label className="text-sm font-semibold mb-2 block">
                      {formData.prizeType === 'GENERATIONS' ? 'Quantidade de Gerações *' : 'Descrição do Prêmio *'}
                    </label>
                    <input
                      type={formData.prizeType === 'GENERATIONS' ? 'number' : 'text'}
                      value={formData.prize}
                      onChange={e => setFormData({ ...formData, prize: e.target.value })}
                      className={`${themeClasses.input} w-full px-4 py-3 rounded-xl`}
                      required
                      min={formData.prizeType === 'GENERATIONS' ? 1 : undefined}
                      placeholder={formData.prizeType === 'GENERATIONS' ? '50' : 'Descri o do prêmio'}
                    />
                  </div>
                )}

                {/* Duration - Quick Presets */}
                <div>
                  <label className="text-sm font-semibold mb-2 block">⏱️ Duração - Tempo Rápido</label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {TIME_PRESETS.map(preset => (
                      <button
                        key={preset.minutes}
                        type="button"
                        onClick={() => setTimePreset(preset.minutes)}
                        className="px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 text-white/70 hover:bg-indigo-500/20 hover:border-indigo-500/30 hover:text-white text-xs font-semibold transition-all"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <label className="text-xs text-white/40 block mb-1">Ou defina uma data manualmente:</label>
                  <input
                    type="datetime-local"
                    value={formData.endDate}
                    onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                    className={`${themeClasses.input} w-full px-4 py-3 rounded-xl`}
                    required
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 px-4 py-3 rounded-2xl border border-white/10 text-white/60 hover:bg-white/5 transition-all font-semibold">
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="flex-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 text-white py-3 rounded-2xl font-bold hover:opacity-90 transition-all shadow-lg disabled:opacity-50"
                  >
                    {creating ? 'Criando...' : '🎲 Criar Sorteio'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
