import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useTheme } from '@/contexts/ThemeContext'
import { getThemeClasses } from '@/lib/theme-utils'
import axios from 'axios'
import toast from 'react-hot-toast'
import { format, isPast, isFuture } from 'date-fns'
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
  } | null
  _count: {
    participants: number
  }
  createdAt: string
}

export default function Raffles() {
  const { data: session } = useSession()
  const { theme } = useTheme()
  const router = useRouter()
  const [raffles, setRaffles] = useState<Raffle[]>([])
  const [loading, setLoading] = useState(true)
  const [participating, setParticipating] = useState<string | null>(null)
  const themeClasses = getThemeClasses(theme)

  useEffect(() => {
    loadRaffles()
    const interval = setInterval(loadRaffles, 30000) // Atualizar a cada 30 segundos
    return () => clearInterval(interval)
  }, [])

  const loadRaffles = async () => {
    try {
      const response = await axios.get('/api/raffles?active=true')
      setRaffles(response.data)
    } catch (error) {
      toast.error('Erro ao carregar sorteios')
    } finally {
      setLoading(false)
    }
  }

  const handleParticipate = async (raffleId: string) => {
    if (!session) {
      toast.error('Faça login para participar')
      router.push('/login')
      return
    }

    setParticipating(raffleId)
    try {
      const response = await axios.post('/api/raffles/participate', { raffleId })
      toast.success(response.data.message || 'Você entrou no sorteio!')
      loadRaffles()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao participar do sorteio')
    } finally {
      setParticipating(null)
    }
  }

  const checkUserParticipated = async (raffleId: string): Promise<boolean> => {
    if (!session) return false
    try {
      // Verificar se o usuário já participou (será verificado pela API)
      return false // Será verificado no backend
    } catch {
      return false
    }
  }

  if (loading) {
    return (
      <div className={`min-h-screen ${themeClasses.loading} flex items-center justify-center`}>
        <div className="text-center">
          <div className={`inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 ${theme === 'dark' ? 'border-purple-500' : 'border-primary-600'}`}></div>
          <p className={`mt-4 ${themeClasses.text.secondary}`}>Carregando sorteios...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${themeClasses.bg} py-12 px-4 sm:px-6 lg:px-8`}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className={`text-4xl font-bold mb-2 ${themeClasses.text.primary}`}>🎲 Sorteios</h1>
          <p className={themeClasses.text.secondary}>Participe dos sorteios e ganhe prêmios incríveis!</p>
        </div>

        {raffles.length === 0 ? (
          <div className={`${themeClasses.card} rounded-xl shadow-xl p-12 text-center`}>
            <p className={`text-xl ${themeClasses.text.secondary}`}>Nenhum sorteio ativo no momento</p>
            <p className={`mt-2 ${themeClasses.text.muted}`}>Volte em breve para participar de novos sorteios!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {raffles.map((raffle) => {
              const endDate = new Date(raffle.endDate)
              const isExpired = isPast(endDate)
              const canParticipate = !isExpired && raffle.isActive && !raffle.isFinished

              return (
                <div key={raffle.id} className={`${themeClasses.card} rounded-xl shadow-xl p-6 hover:shadow-2xl transition-shadow`}>
                  <div className="mb-4">
                    <h2 className={`text-2xl font-bold mb-2 ${themeClasses.text.primary}`}>{raffle.title}</h2>
                    {raffle.description && (
                      <p className={`${themeClasses.text.secondary} text-sm mb-4`}>{raffle.description}</p>
                    )}
                  </div>

                  <div className={`${theme === 'dark' ? 'bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-400/30' : 'bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200'} rounded-lg p-4 mb-4`}>
                    <p className={`text-sm font-semibold mb-2 ${theme === 'dark' ? 'text-purple-300' : 'text-purple-700'}`}>
                      🎁 Prêmio:
                    </p>
                    <p className={`font-bold text-lg ${themeClasses.text.primary}`}>
                      {raffle.prizeType === 'PLAN' && raffle.prizePlan
                        ? `Plano: ${raffle.prizePlan.name}`
                        : raffle.prizeType === 'GENERATIONS'
                        ? `${raffle.prize} Gerações Grátis`
                        : raffle.prize}
                    </p>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between">
                      <span className={`text-sm ${themeClasses.text.muted}`}>Participantes:</span>
                      <span className={`font-semibold ${themeClasses.text.primary}`}>
                        {raffle._count.participants}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className={`text-sm ${themeClasses.text.muted}`}>Finaliza em:</span>
                      <span className={`font-semibold ${themeClasses.text.primary}`}>
                        {format(endDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                  </div>

                  {raffle.winner && (
                    <div className={`${theme === 'dark' ? 'bg-green-500/20 border border-green-400/30' : 'bg-green-50 border border-green-200'} rounded-lg p-3 mb-4`}>
                      <p className={`text-sm font-semibold ${theme === 'dark' ? 'text-green-300' : 'text-green-800'}`}>
                        🎉 Ganhador: {raffle.winner.username}
                      </p>
                    </div>
                  )}

                  {canParticipate && !raffle.winner && (
                    <button
                      onClick={() => handleParticipate(raffle.id)}
                      disabled={participating === raffle.id}
                      className="w-full px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-lg font-bold hover:from-primary-700 hover:to-primary-800 transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
                    >
                      {participating === raffle.id ? 'Participando...' : '🎲 Participar do Sorteio'}
                    </button>
                  )}

                  {isExpired && !raffle.isFinished && (
                    <div className={`${theme === 'dark' ? 'bg-yellow-500/20 border border-yellow-400/30' : 'bg-yellow-50 border border-yellow-200'} rounded-lg p-3`}>
                      <p className={`text-sm font-semibold ${theme === 'dark' ? 'text-yellow-300' : 'text-yellow-800'}`}>
                        ⏰ Sorteio aguardando finalização
                      </p>
                    </div>
                  )}

                  {raffle.isFinished && (
                    <div className={`${theme === 'dark' ? 'bg-gray-500/20 border border-gray-400/30' : 'bg-gray-50 border border-gray-200'} rounded-lg p-3`}>
                      <p className={`text-sm font-semibold ${theme === 'dark' ? 'text-gray-300' : 'text-gray-800'}`}>
                        ✅ Sorteio finalizado
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

