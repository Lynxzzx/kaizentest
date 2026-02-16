import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import axios from 'axios'
import toast from 'react-hot-toast'
import { useTheme } from '@/contexts/ThemeContext'
import { getThemeClasses } from '@/lib/theme-utils'

interface Event {
    id: string
    title: string
    description: string | null
    type: 'QUIZ' | 'CHALLENGE' | 'GIVEAWAY'
    status: 'ACTIVE' | 'ENDED' | 'CANCELLED'
    prize: string
    prizeType: 'PLAN' | 'GENERATIONS' | 'CUSTOM'
    questions: string | null
    maxParticipants: number | null
    endDate: string
    isActive: boolean
    winnerId: string | null
    winnerScore: number | null
    createdBy: { id: string; username: string }
    _count: { participants: number }
    createdAt: string
}

interface QuizQuestion {
    question: string
    options: string[]
    correctIndex: number
}

const EVENT_TYPES = {
    QUIZ: { label: 'Quiz', icon: '❓', color: 'indigo' },
    CHALLENGE: { label: 'Desafio', icon: '🏆', color: 'amber' },
    GIVEAWAY: { label: 'Sorteio', icon: '🎁', color: 'emerald' }
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

export default function AdminEvents() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const { theme } = useTheme()
    const themeClasses = getThemeClasses(theme)

    const [events, setEvents] = useState<Event[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    // Form state
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        type: 'QUIZ' as 'QUIZ' | 'CHALLENGE' | 'GIVEAWAY',
        prize: '',
        prizeType: 'CUSTOM' as 'PLAN' | 'GENERATIONS' | 'CUSTOM',
        endDate: ''
    })
    const [questions, setQuestions] = useState<QuizQuestion[]>([
        { question: '', options: ['', '', '', ''], correctIndex: 0 }
    ])

    useEffect(() => {
        if (status === 'unauthenticated') router.push('/login')
        else if (session && session.user.role !== 'OWNER' && session.user.role !== 'ADMIN') router.push('/dashboard')
        else if (session) loadEvents()
    }, [session, status, router])

    // Live countdown
    useEffect(() => {
        const interval = setInterval(() => setEvents(prev => [...prev]), 1000)
        return () => clearInterval(interval)
    }, [])

    const loadEvents = async () => {
        try {
            const res = await axios.get('/api/admin/events')
            setEvents(res.data)
        } catch { toast.error('Erro ao carregar eventos') }
        finally { setLoading(false) }
    }

    const setTimePreset = (minutes: number) => {
        const d = new Date(Date.now() + minutes * 60000)
        const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
        setFormData({ ...formData, endDate: local })
    }

    const addQuestion = () => {
        setQuestions([...questions, { question: '', options: ['', '', '', ''], correctIndex: 0 }])
    }

    const removeQuestion = (idx: number) => {
        if (questions.length <= 1) return
        setQuestions(questions.filter((_, i) => i !== idx))
    }

    const updateQuestion = (idx: number, field: string, value: any) => {
        const updated = [...questions]
        if (field === 'question') updated[idx].question = value
        else if (field === 'correctIndex') updated[idx].correctIndex = value
        setQuestions(updated)
    }

    const updateOption = (qIdx: number, oIdx: number, value: string) => {
        const updated = [...questions]
        updated[qIdx].options[oIdx] = value
        setQuestions(updated)
    }

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.title || !formData.prize || !formData.endDate) {
            toast.error('Preencha todos os campos obrigatórios')
            return
        }

        if (formData.type === 'QUIZ') {
            const valid = questions.every(q => q.question.trim() && q.options.every(o => o.trim()))
            if (!valid) { toast.error('Preencha todas as perguntas e opções'); return }
        }

        setSaving(true)
        try {
            await axios.post('/api/admin/events', {
                ...formData,
                questions: formData.type === 'QUIZ' ? questions : undefined
            })
            toast.success('Evento criado com sucesso!')
            setShowCreateModal(false)
            setFormData({ title: '', description: '', type: 'QUIZ', prize: '', prizeType: 'CUSTOM', endDate: '' })
            setQuestions([{ question: '', options: ['', '', '', ''], correctIndex: 0 }])
            loadEvents()
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Erro ao criar evento')
        } finally { setSaving(false) }
    }

    const handleEndEvent = async (event: Event) => {
        if (!confirm(`Encerrar o evento "${event.title}"? O vencedor será selecionado automaticamente.`)) return
        try {
            await axios.put('/api/admin/events', { id: event.id, status: 'ENDED' })
            toast.success('Evento encerrado!')
            loadEvents()
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Erro ao encerrar evento')
        }
    }

    const handleDelete = async (event: Event) => {
        if (deletingId === event.id) {
            try {
                await axios.delete(`/api/admin/events?id=${event.id}`)
                toast.success('Evento excluído!')
                setDeletingId(null)
                loadEvents()
            } catch (err: any) {
                toast.error(err.response?.data?.error || 'Erro ao excluir')
                setDeletingId(null)
            }
        } else {
            setDeletingId(event.id)
            setTimeout(() => setDeletingId(null), 4000)
        }
    }

    const getCountdown = (endDate: string) => {
        const diff = new Date(endDate).getTime() - Date.now()
        if (diff <= 0) return 'Encerrado'
        const d = Math.floor(diff / 86400000)
        const h = Math.floor((diff % 86400000) / 3600000)
        const m = Math.floor((diff % 3600000) / 60000)
        const s = Math.floor((diff % 60000) / 1000)
        if (d > 0) return `${d}d ${h}h ${m}m`
        if (h > 0) return `${h}h ${m}m ${s}s`
        return `${m}m ${s}s`
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

    if (!session || (session.user.role !== 'OWNER' && session.user.role !== 'ADMIN')) return null

    const activeEvents = events.filter(e => e.status === 'ACTIVE')
    const endedEvents = events.filter(e => e.status !== 'ACTIVE')

    return (
        <div className={`admin-shell min-h-screen ${themeClasses.bg} py-10 px-4 sm:px-6 lg:px-10`}>
            <div className="max-w-6xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <p className="text-xs uppercase tracking-[0.6em] text-white/40">Gerenciador</p>
                        <h1 className={`text-3xl font-bold ${themeClasses.text.primary}`}>🎯 Eventos</h1>
                        <p className={`${themeClasses.text.secondary} text-sm`}>Crie quizzes, desafios e sorteios interativos</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 px-4 py-2 rounded-2xl">
                            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
                            <span className="text-indigo-300 font-medium text-sm">{activeEvents.length} ativos</span>
                        </div>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 text-white rounded-2xl font-bold hover:opacity-90 transition-all shadow-lg text-sm"
                        >
                            ✨ Criar Evento
                        </button>
                    </div>
                </div>

                {/* Active Events */}
                {activeEvents.length > 0 && (
                    <div className="space-y-4">
                        <h2 className={`text-lg font-semibold ${themeClasses.text.primary}`}>🟢 Eventos Ativos</h2>
                        {activeEvents.map(event => {
                            const typeInfo = EVENT_TYPES[event.type]
                            const countdown = getCountdown(event.endDate)
                            const isExpired = new Date(event.endDate) < new Date()

                            return (
                                <div key={event.id} className={`${themeClasses.card} rounded-2xl p-5 border border-white/10`}>
                                    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className="text-2xl">{typeInfo.icon}</span>
                                                <h3 className={`text-xl font-bold ${themeClasses.text.primary}`}>{event.title}</h3>
                                                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-${typeInfo.color}-500/20 text-${typeInfo.color}-300`}>
                                                    {typeInfo.label}
                                                </span>
                                            </div>
                                            {event.description && (
                                                <p className={`${themeClasses.text.muted} text-sm mb-3`}>{event.description}</p>
                                            )}
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                                                <span className={`${themeClasses.text.secondary} flex items-center gap-1`}>
                                                    🎁 {event.prize}
                                                </span>
                                                <span className={`${themeClasses.text.muted} flex items-center gap-1`}>
                                                    👥 {event._count.participants} participantes
                                                </span>
                                                <span className={`font-mono font-bold ${isExpired ? 'text-red-400' : 'text-cyan-300'} flex items-center gap-1`}>
                                                    ⏱️ {countdown}
                                                </span>
                                                <span className={`${themeClasses.text.muted}`}>
                                                    👤 {event.createdBy.username}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                onClick={() => handleEndEvent(event)}
                                                className="px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-sm font-semibold transition-all"
                                            >
                                                🏁 Encerrar
                                            </button>
                                            <button
                                                onClick={() => handleDelete(event)}
                                                className={`p-2.5 rounded-xl transition-all text-sm ${deletingId === event.id
                                                        ? 'bg-red-500/30 text-red-200 animate-pulse ring-2 ring-red-500/50'
                                                        : 'bg-red-500/10 hover:bg-red-500/20 text-red-300'
                                                    }`}
                                            >
                                                {deletingId === event.id ? '⚠️' : '🗑️'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Ended Events */}
                {endedEvents.length > 0 && (
                    <div className="space-y-4">
                        <h2 className={`text-lg font-semibold ${themeClasses.text.primary}`}>📋 Eventos Encerrados</h2>
                        {endedEvents.map(event => {
                            const typeInfo = EVENT_TYPES[event.type]
                            return (
                                <div key={event.id} className={`${themeClasses.card} rounded-2xl p-5 opacity-60 border border-white/5`}>
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 mb-1">
                                                <span className="text-xl">{typeInfo.icon}</span>
                                                <h3 className={`text-lg font-bold ${themeClasses.text.primary}`}>{event.title}</h3>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${event.status === 'ENDED' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
                                                    }`}>
                                                    {event.status === 'ENDED' ? 'Encerrado' : 'Cancelado'}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                                                <span className={themeClasses.text.muted}>🎁 {event.prize}</span>
                                                <span className={themeClasses.text.muted}>👥 {event._count.participants} participantes</span>
                                                {event.winnerId && (
                                                    <span className="text-emerald-300 font-semibold">
                                                        🏆 Vencedor ID: {event.winnerId.slice(-6)}{event.winnerScore !== null ? ` (${event.winnerScore} pts)` : ''}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleDelete(event)}
                                            className={`p-2.5 rounded-xl transition-all text-sm shrink-0 ${deletingId === event.id
                                                    ? 'bg-red-500/30 text-red-200 animate-pulse'
                                                    : 'bg-red-500/10 hover:bg-red-500/20 text-red-300'
                                                }`}
                                        >
                                            {deletingId === event.id ? '⚠️' : '🗑️'}
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                {events.length === 0 && (
                    <div className={`${themeClasses.card} rounded-3xl p-12 text-center`}>
                        <p className="text-4xl mb-3">🎯</p>
                        <p className={themeClasses.text.secondary}>Nenhum evento criado ainda.</p>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="mt-4 px-6 py-3 bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 text-white rounded-2xl font-bold hover:opacity-90 transition-all shadow-lg"
                        >
                            Criar Primeiro Evento
                        </button>
                    </div>
                )}
            </div>

            {/* Create Event Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowCreateModal(false)}>
                    <div
                        className={`${themeClasses.card} rounded-3xl p-6 sm:p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto`}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-6">
                            <h3 className={`text-xl font-bold ${themeClasses.text.primary}`}>✨ Criar Evento</h3>
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
                                    placeholder="Quiz de Programação"
                                    required
                                />
                            </div>

                            {/* Type */}
                            <div>
                                <label className="text-sm font-semibold mb-2 block">Tipo de Evento</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {(Object.entries(EVENT_TYPES) as [string, any][]).map(([key, val]) => (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, type: key as any })}
                                            className={`p-3 rounded-xl border text-center transition-all ${formData.type === key
                                                    ? 'border-indigo-500 bg-indigo-500/20 text-white'
                                                    : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
                                                }`}
                                        >
                                            <span className="text-2xl block mb-1">{val.icon}</span>
                                            <span className="text-xs font-semibold">{val.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="text-sm font-semibold mb-2 block">Descrição</label>
                                <textarea
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    rows={2}
                                    className={`${themeClasses.input} w-full px-4 py-3 rounded-xl`}
                                    placeholder="Descreva o evento..."
                                />
                            </div>

                            {/* Prize */}
                            <div>
                                <label className="text-sm font-semibold mb-2 block">Prêmio *</label>
                                <input
                                    type="text"
                                    value={formData.prize}
                                    onChange={e => setFormData({ ...formData, prize: e.target.value })}
                                    className={`${themeClasses.input} w-full px-4 py-3 rounded-xl`}
                                    placeholder="Plano Premium por 30 dias"
                                    required
                                />
                            </div>

                            {/* Duration */}
                            <div>
                                <label className="text-sm font-semibold mb-2 block">Duração</label>
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
                                <input
                                    type="datetime-local"
                                    value={formData.endDate}
                                    onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                                    className={`${themeClasses.input} w-full px-4 py-3 rounded-xl`}
                                    required
                                />
                            </div>

                            {/* Quiz Questions */}
                            {formData.type === 'QUIZ' && (
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <label className="text-sm font-semibold">Perguntas do Quiz</label>
                                        <button
                                            type="button"
                                            onClick={addQuestion}
                                            className="text-xs px-3 py-1.5 rounded-xl bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 transition-all font-semibold"
                                        >
                                            + Adicionar Pergunta
                                        </button>
                                    </div>
                                    <div className="space-y-4">
                                        {questions.map((q, qIdx) => (
                                            <div key={qIdx} className="bg-white/5 rounded-xl p-4 border border-white/10">
                                                <div className="flex items-center justify-between mb-3">
                                                    <span className="text-xs text-white/40 font-semibold">Pergunta {qIdx + 1}</span>
                                                    {questions.length > 1 && (
                                                        <button type="button" onClick={() => removeQuestion(qIdx)} className="text-red-400 hover:text-red-300 text-xs">Remover</button>
                                                    )}
                                                </div>
                                                <input
                                                    type="text"
                                                    value={q.question}
                                                    onChange={e => updateQuestion(qIdx, 'question', e.target.value)}
                                                    className={`${themeClasses.input} w-full px-4 py-2.5 rounded-lg mb-3 text-sm`}
                                                    placeholder="Qual é a capital do Brasil?"
                                                />
                                                <div className="grid grid-cols-2 gap-2">
                                                    {q.options.map((opt, oIdx) => (
                                                        <div key={oIdx} className="flex items-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => updateQuestion(qIdx, 'correctIndex', oIdx)}
                                                                className={`w-6 h-6 rounded-full border-2 shrink-0 transition-all ${q.correctIndex === oIdx
                                                                        ? 'border-green-400 bg-green-400/30'
                                                                        : 'border-white/20 hover:border-white/40'
                                                                    }`}
                                                            >
                                                                {q.correctIndex === oIdx && <span className="text-green-300 text-xs">✓</span>}
                                                            </button>
                                                            <input
                                                                type="text"
                                                                value={opt}
                                                                onChange={e => updateOption(qIdx, oIdx, e.target.value)}
                                                                className={`${themeClasses.input} w-full px-3 py-2 rounded-lg text-xs`}
                                                                placeholder={`Opção ${oIdx + 1}`}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 px-4 py-3 rounded-2xl border border-white/10 text-white/60 hover:bg-white/5 transition-all font-semibold">
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 text-white py-3 rounded-2xl font-bold hover:opacity-90 transition-all shadow-lg disabled:opacity-50"
                                >
                                    {saving ? 'Criando...' : '🎯 Criar Evento'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
