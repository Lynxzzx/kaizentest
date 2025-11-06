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
      <div className={`min-h-screen ${themeClasses.loading} flex items-center justify-center`}>
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

  return (
    <div className={`min-h-screen ${themeClasses.bg} py-12 px-4 sm:px-6 lg:px-8`}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className={`text-4xl font-bold mb-2 ${themeClasses.text.primary}`}>Gerenciar Sorteios</h1>
            <p className={themeClasses.text.secondary}>Crie e gerencie sorteios para seus usuários</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-lg font-bold hover:from-primary-700 hover:to-primary-800 transition-all shadow-lg hover:shadow-xl"
          >
            + Criar Sorteio
          </button>
        </div>

        {/* Lista de Sorteios */}
        <div className="grid grid-cols-1 gap-6">
          {raffles.map((raffle) => (
            <div key={raffle.id} className={`${themeClasses.card} rounded-xl shadow-xl p-6`}>
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h2 className={`text-2xl font-bold mb-2 ${themeClasses.text.primary}`}>{raffle.title}</h2>
                  {raffle.description && (
                    <p className={`${themeClasses.text.secondary} mb-4`}>{raffle.description}</p>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className={`text-sm ${themeClasses.text.muted} mb-1`}>Prêmio:</p>
                      <p className={`font-semibold ${themeClasses.text.primary}`}>
                        {raffle.prizeType === 'PLAN' && raffle.prizePlan
                          ? `Plano: ${raffle.prizePlan.name}`
                          : raffle.prizeType === 'GENERATIONS'
                          ? `${raffle.prize} Gerações Grátis`
                          : raffle.prize}
                      </p>
                    </div>
                    <div>
                      <p className={`text-sm ${themeClasses.text.muted} mb-1`}>Data de Finalização:</p>
                      <p className={`font-semibold ${themeClasses.text.primary}`}>
                        {format(new Date(raffle.endDate), "dd 'de' MMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <div>
                      <p className={`text-sm ${themeClasses.text.muted} mb-1`}>Participantes:</p>
                      <p className={`font-semibold ${themeClasses.text.primary}`}>{raffle._count.participants}</p>
                    </div>
                    <div>
                      <p className={`text-sm ${themeClasses.text.muted} mb-1`}>Status:</p>
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                        raffle.isFinished
                          ? 'bg-green-500/20 text-green-300'
                          : raffle.isActive
                          ? 'bg-blue-500/20 text-blue-300'
                          : 'bg-gray-500/20 text-gray-300'
                      }`}>
                        {raffle.isFinished ? 'Finalizado' : raffle.isActive ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                  </div>
                  {raffle.winner && (
                    <div className={`${theme === 'dark' ? 'bg-green-500/20 border border-green-400/30' : 'bg-green-50 border border-green-200'} rounded-lg p-4 mb-4`}>
                      <p className={`font-semibold ${theme === 'dark' ? 'text-green-300' : 'text-green-800'}`}>
                        🎉 Ganhador: {raffle.winner.username} ({raffle.winner.email || 'Sem email'})
                      </p>
                    </div>
                  )}
                </div>
              </div>
              {!raffle.isFinished && raffle._count.participants > 0 && (
                <button
                  onClick={() => handleDraw(raffle.id)}
                  disabled={drawing === raffle.id}
                  className="px-6 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg font-bold hover:from-green-700 hover:to-green-800 transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
                >
                  {drawing === raffle.id ? 'Realizando sorteio...' : '🎲 Realizar Sorteio'}
                </button>
              )}
            </div>
          ))}
        </div>

        {raffles.length === 0 && (
          <div className={`${themeClasses.card} rounded-xl shadow-xl p-12 text-center`}>
            <p className={`text-xl ${themeClasses.text.secondary}`}>Nenhum sorteio criado ainda</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-lg font-bold hover:from-primary-700 hover:to-primary-800 transition-all shadow-lg hover:shadow-xl"
            >
              Criar Primeiro Sorteio
            </button>
          </div>
        )}

        {/* Modal de Criar Sorteio */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className={`${themeClasses.card} rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto`}>
              <div className="flex justify-between items-center mb-6">
                <h2 className={`text-2xl font-bold ${themeClasses.text.primary}`}>Criar Novo Sorteio</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className={`text-2xl ${themeClasses.text.secondary} hover:${themeClasses.text.primary}`}
                >
                  ×
                </button>
              </div>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className={`block text-sm font-semibold mb-2 ${themeClasses.text.primary}`}>
                    Título *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className={`${themeClasses.input} w-full px-4 py-3 rounded-lg focus:ring-2 focus:ring-primary-500`}
                    required
                  />
                </div>
                <div>
                  <label className={`block text-sm font-semibold mb-2 ${themeClasses.text.primary}`}>
                    Descrição
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className={`${themeClasses.input} w-full px-4 py-3 rounded-lg focus:ring-2 focus:ring-primary-500`}
                    rows={3}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-semibold mb-2 ${themeClasses.text.primary}`}>
                    Tipo de Prêmio *
                  </label>
                  <select
                    value={formData.prizeType}
                    onChange={(e) => setFormData({ ...formData, prizeType: e.target.value as any, prizePlanId: '' })}
                    className={`${themeClasses.input} w-full px-4 py-3 rounded-lg focus:ring-2 focus:ring-primary-500`}
                    required
                  >
                    <option value="PLAN">Plano</option>
                    <option value="GENERATIONS">Gerações Grátis</option>
                    <option value="CUSTOM">Prêmio Customizado</option>
                  </select>
                </div>
                {formData.prizeType === 'PLAN' && (
                  <div>
                    <label className={`block text-sm font-semibold mb-2 ${themeClasses.text.primary}`}>
                      Plano *
                    </label>
                    <select
                      value={formData.prizePlanId}
                      onChange={(e) => setFormData({ ...formData, prizePlanId: e.target.value })}
                      className={`${themeClasses.input} w-full px-4 py-3 rounded-lg focus:ring-2 focus:ring-primary-500`}
                      required
                    >
                      <option value="">Selecione um plano</option>
                      {plans.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.name} - R$ {plan.price.toFixed(2)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {(formData.prizeType === 'GENERATIONS' || formData.prizeType === 'CUSTOM') && (
                  <div>
                    <label className={`block text-sm font-semibold mb-2 ${themeClasses.text.primary}`}>
                      {formData.prizeType === 'GENERATIONS' ? 'Quantidade de Gerações *' : 'Descrição do Prêmio *'}
                    </label>
                    <input
                      type={formData.prizeType === 'GENERATIONS' ? 'number' : 'text'}
                      value={formData.prize}
                      onChange={(e) => setFormData({ ...formData, prize: e.target.value })}
                      className={`${themeClasses.input} w-full px-4 py-3 rounded-lg focus:ring-2 focus:ring-primary-500`}
                      required
                      min={formData.prizeType === 'GENERATIONS' ? 1 : undefined}
                    />
                  </div>
                )}
                <div>
                  <label className={`block text-sm font-semibold mb-2 ${themeClasses.text.primary}`}>
                    Data de Finalização *
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className={`${themeClasses.input} w-full px-4 py-3 rounded-lg focus:ring-2 focus:ring-primary-500`}
                    required
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className={`flex-1 px-6 py-3 ${themeClasses.input} rounded-lg font-semibold hover:opacity-80 transition-opacity`}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-lg font-bold hover:from-primary-700 hover:to-primary-800 transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
                  >
                    {creating ? 'Criando...' : 'Criar Sorteio'}
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

