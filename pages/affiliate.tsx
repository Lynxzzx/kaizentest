import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useTranslation } from '@/lib/i18n-helper'
import { useTheme } from '@/contexts/ThemeContext'
import { getThemeClasses } from '@/lib/theme-utils'
import axios from 'axios'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'

interface AffiliateStats {
  affiliateCode: string | null
  totalReferrals: number
  totalRewards: number
  bonusGenerations: number
  recentReferrals: Array<{
    id: string
    username: string
    createdAt: string
  }>
  recentRewards: Array<{
    id: string
    rewardedGenerations: number
    createdAt: string
    user: {
      username: string
    }
  }>
}

export default function Affiliate() {
  const { t } = useTranslation()
  const { data: session, status } = useSession()
  const { theme } = useTheme()
  const router = useRouter()
  const [stats, setStats] = useState<AffiliateStats | null>(null)
  const [redeemCode, setRedeemCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const themeClasses = getThemeClasses(theme)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    if (session) {
      loadStats()
    }
  }, [session])

  const loadStats = async () => {
    try {
      const response = await axios.get('/api/affiliate/stats')
      setStats(response.data)
    } catch (error) {
      toast.error('Erro ao carregar estatísticas')
    }
  }

  const generateCode = async () => {
    setGenerating(true)
    try {
      const response = await axios.post('/api/affiliate/generate-code')
      toast.success('Código gerado com sucesso!')
      loadStats()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao gerar código')
    } finally {
      setGenerating(false)
    }
  }

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!redeemCode.trim()) {
      toast.error('Digite um código')
      return
    }

    setLoading(true)
    try {
      const response = await axios.post('/api/affiliate/redeem', {
        code: redeemCode.trim()
      })
      toast.success(response.data.message || 'Código resgatado com sucesso!')
      setRedeemCode('')
      loadStats()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao resgatar código')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Código copiado para a área de transferência!')
  }

  const copyLinkToClipboard = (code: string) => {
    const link = `${typeof window !== 'undefined' ? window.location.origin : ''}/register?ref=${code}`
    navigator.clipboard.writeText(link)
    toast.success('Link de afiliado copiado para a área de transferência!')
  }

  const getAffiliateLink = (code: string) => {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/register?ref=${code}`
  }

  if (status === 'loading') {
    return (
      <div className={`min-h-screen ${themeClasses.loading} flex items-center justify-center`}>
        <div className="text-center">
          <div className={`inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 ${theme === 'dark' ? 'border-purple-500' : 'border-primary-600'}`}></div>
          <p className={`mt-4 ${themeClasses.text.secondary}`}>Carregando...</p>
        </div>
      </div>
    )
  }

  if (!session) return null

  return (
    <div className={`min-h-screen ${themeClasses.bg} py-12 px-4 sm:px-6 lg:px-8`}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className={`text-4xl font-bold mb-2 ${themeClasses.text.primary}`}>Programa de Afiliados</h1>
          <p className={themeClasses.text.secondary}>Ganhe 2 gerações grátis por cada amigo que você indicar!</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Seu Código */}
          <div className={themeClasses.card}>
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-2xl font-bold ${themeClasses.text.primary}`}>Seu Código de Afiliado</h2>
              <span className="text-4xl">🎁</span>
            </div>
            {stats?.affiliateCode ? (
              <div className="space-y-4">
                {/* Código de Afiliado */}
                <div className={`${theme === 'dark' ? 'bg-white/5 border border-white/20' : 'bg-gradient-to-br from-primary-50 to-primary-100 border border-primary-200'} rounded-xl p-6`}>
                  <p className={`text-sm mb-2 font-semibold ${theme === 'dark' ? 'text-purple-300' : 'text-primary-700'}`}>Seu código único:</p>
                  <div className="flex items-center justify-between mb-4">
                    <code className={`text-2xl font-bold font-mono ${theme === 'dark' ? 'text-purple-200' : 'text-primary-900'}`}>
                      {stats.affiliateCode}
                    </code>
                    <button
                      onClick={() => copyToClipboard(stats.affiliateCode!)}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-semibold"
                    >
                      Copiar
                    </button>
                  </div>
                </div>

                {/* Link de Afiliado */}
                <div className={`${theme === 'dark' ? 'bg-white/5 border border-white/20' : 'bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200'} rounded-xl p-6`}>
                  <p className={`text-sm mb-2 font-semibold ${theme === 'dark' ? 'text-purple-300' : 'text-purple-700'}`}>Seu link de afiliado:</p>
                  <div className="flex items-center gap-2 mb-4">
                    <input
                      type="text"
                      value={getAffiliateLink(stats.affiliateCode)}
                      readOnly
                      className={`${themeClasses.input} flex-1 px-3 py-2 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500`}
                    />
                    <button
                      onClick={() => copyLinkToClipboard(stats.affiliateCode!)}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold whitespace-nowrap"
                    >
                      Copiar Link
                    </button>
                  </div>
                  <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-purple-300' : 'text-purple-600'}`}>
                    Compartilhe este link e ganhe 2 gerações grátis quando alguém se cadastrar!
                  </p>
                </div>

                <div className={`${theme === 'dark' ? 'bg-blue-500/20 border border-blue-400/30' : 'bg-blue-50 border border-blue-200'} rounded-lg p-4`}>
                  <p className={`text-sm ${theme === 'dark' ? 'text-blue-200' : 'text-blue-800'}`}>
                    <strong>Como funciona:</strong> Compartilhe seu código ou link com seus amigos. Quando eles se cadastrarem através do seu link, você ganha 2 gerações grátis e eles também ganham 2 gerações grátis automaticamente!
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className={`${themeClasses.text.secondary} mb-4`}>Você ainda não possui um código de afiliado</p>
                <button
                  onClick={generateCode}
                  disabled={generating}
                  className="bg-gradient-to-r from-primary-600 to-primary-700 text-white px-6 py-3 rounded-lg font-bold hover:from-primary-700 hover:to-primary-800 transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
                >
                  {generating ? 'Gerando...' : 'Gerar Meu Código'}
                </button>
              </div>
            )}
          </div>

          {/* Resgatar Código */}
          <div className={themeClasses.card}>
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-2xl font-bold ${themeClasses.text.primary}`}>Resgatar Código</h2>
              <span className="text-4xl">🎫</span>
            </div>
            <form onSubmit={handleRedeem} className="space-y-4">
              <div>
                <label className={`block text-sm font-semibold mb-2 ${themeClasses.text.primary}`}>
                  Código de Afiliado
                </label>
                <input
                  type="text"
                  value={redeemCode}
                  onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                  className={`${themeClasses.input} w-full px-4 py-3 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none font-mono text-center text-xl tracking-widest`}
                  placeholder="DIGITE O CÓDIGO"
                  maxLength={12}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading || !redeemCode.trim()}
                className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white py-3 rounded-lg font-bold hover:from-green-700 hover:to-green-800 transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
              >
                {loading ? 'Resgatando...' : 'Resgatar Código'}
              </button>
              <p className={`text-sm text-center ${themeClasses.text.secondary}`}>
                Ao resgatar um código de afiliado, você ganha 2 gerações grátis!
              </p>
            </form>
          </div>
        </div>

        {/* Estatísticas */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className={`${themeClasses.card} rounded-2xl shadow-xl p-6 text-center`}>
              <div className="text-4xl mb-3">👥</div>
              <p className={`text-3xl font-bold mb-1 ${themeClasses.text.primary}`}>{stats.totalReferrals}</p>
              <p className={themeClasses.text.secondary}>Indicações</p>
            </div>
            <div className={`${themeClasses.card} rounded-2xl shadow-xl p-6 text-center`}>
              <div className="text-4xl mb-3">🎁</div>
              <p className={`text-3xl font-bold mb-1 ${themeClasses.text.primary}`}>{stats.totalRewards}</p>
              <p className={themeClasses.text.secondary}>Recompensas</p>
            </div>
            <div className={`${themeClasses.card} rounded-2xl shadow-xl p-6 text-center`}>
              <div className="text-4xl mb-3">⚡</div>
              <p className={`text-3xl font-bold mb-1 ${themeClasses.text.primary}`}>{stats.bonusGenerations}</p>
              <p className={themeClasses.text.secondary}>Gerações Grátis</p>
            </div>
          </div>
        )}

        {/* Indicações Recentes */}
        {stats && stats.recentReferrals.length > 0 && (
          <div className={`${themeClasses.card} rounded-2xl shadow-xl p-8 mb-8`}>
            <h2 className={`text-2xl font-bold mb-6 ${themeClasses.text.primary}`}>Indicações Recentes</h2>
            <div className="space-y-3">
              {stats.recentReferrals.map((referral) => (
                <div
                  key={referral.id}
                  className={`flex items-center justify-between p-4 ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-50 hover:bg-gray-100'} rounded-lg transition-colors`}
                >
                  <div>
                    <p className={`font-semibold ${themeClasses.text.primary}`}>{referral.username}</p>
                    <p className={`text-sm ${themeClasses.text.muted}`}>
                      {format(new Date(referral.createdAt), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="text-green-600 font-bold">+2 gerações</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recompensas Recentes */}
        {stats && stats.recentRewards.length > 0 && (
          <div className={`${themeClasses.card} rounded-2xl shadow-xl p-8`}>
            <h2 className={`text-2xl font-bold mb-6 ${themeClasses.text.primary}`}>Recompensas Recentes</h2>
            <div className="space-y-3">
              {stats.recentRewards.map((reward) => (
                <div
                  key={reward.id}
                  className={`flex items-center justify-between p-4 ${theme === 'dark' ? 'bg-green-500/20 border border-green-400/30' : 'bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200'} rounded-lg`}
                >
                  <div>
                    <p className={`font-semibold ${themeClasses.text.primary}`}>Indicação: {reward.user.username}</p>
                    <p className={`text-sm ${themeClasses.text.muted}`}>
                      {format(new Date(reward.createdAt), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="text-green-600 font-bold">+{reward.rewardedGenerations} gerações</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

