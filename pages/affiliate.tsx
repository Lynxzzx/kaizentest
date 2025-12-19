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
  affiliateBalance: number
  totalAffiliateEarnings: number
  commissionRate: number
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
  recentCommissions: Array<{
    id: string
    amount: number
    paymentAmount: number
    buyerUsername: string
    planName: string
    paidAt: string
    createdAt: string
  }>
  recentWithdrawals: Array<{
    id: string
    amount: number
    status: string
    createdAt: string
    processedAt: string | null
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
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [pixKey, setPixKey] = useState('')
  const [pixKeyType, setPixKeyType] = useState<'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'RANDOM'>('CPF')
  const [withdrawing, setWithdrawing] = useState(false)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
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

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount)
    if (isNaN(amount) || amount < 10) {
      toast.error('Valor mínimo de resgate é R$ 10,00')
      return
    }
    if (!pixKey.trim()) {
      toast.error('Digite sua chave PIX')
      return
    }
    if (amount > (stats?.affiliateBalance || 0)) {
      toast.error('Saldo insuficiente')
      return
    }

    setWithdrawing(true)
    try {
      const response = await axios.post('/api/affiliate/withdraw', {
        amount,
        pixKey: pixKey.trim(),
        pixKeyType
      })
      toast.success(response.data.message || 'Solicitação enviada!')
      setShowWithdrawModal(false)
      setWithdrawAmount('')
      setPixKey('')
      loadStats()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao solicitar resgate')
    } finally {
      setWithdrawing(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: '⏳ Pendente' },
      PROCESSING: { bg: 'bg-blue-100', text: 'text-blue-800', label: '🔄 Processando' },
      COMPLETED: { bg: 'bg-green-100', text: 'text-green-800', label: '✅ Pago' },
      REJECTED: { bg: 'bg-red-100', text: 'text-red-800', label: '❌ Rejeitado' }
    }
    const badge = badges[status] || badges.PENDING
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    )
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

        {/* Saldo e Comissões */}
        {stats && (
          <div className={`${themeClasses.card} rounded-2xl shadow-xl p-6 mb-8`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-2xl font-bold ${themeClasses.text.primary}`}>💰 Suas Comissões</h2>
              <span className={`text-sm px-3 py-1 rounded-full ${theme === 'dark' ? 'bg-green-500/20 text-green-300' : 'bg-green-100 text-green-700'}`}>
                {stats.commissionRate}% por venda
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className={`${theme === 'dark' ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/10 border border-green-500/30' : 'bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200'} rounded-xl p-6 text-center`}>
                <div className="text-4xl mb-2">💵</div>
                <p className={`text-3xl font-bold mb-1 text-green-600`}>R$ {stats.affiliateBalance.toFixed(2)}</p>
                <p className={themeClasses.text.secondary}>Saldo Disponível</p>
              </div>
              <div className={`${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'} rounded-xl p-6 text-center`}>
                <div className="text-4xl mb-2">📈</div>
                <p className={`text-3xl font-bold mb-1 ${themeClasses.text.primary}`}>R$ {stats.totalAffiliateEarnings.toFixed(2)}</p>
                <p className={themeClasses.text.secondary}>Total Ganho</p>
              </div>
              <div className={`${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'} rounded-xl p-6 text-center`}>
                <div className="text-4xl mb-2">👥</div>
                <p className={`text-3xl font-bold mb-1 ${themeClasses.text.primary}`}>{stats.totalReferrals}</p>
                <p className={themeClasses.text.secondary}>Indicados</p>
              </div>
            </div>

            <button
              onClick={() => setShowWithdrawModal(true)}
              disabled={stats.affiliateBalance < 10}
              className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
                stats.affiliateBalance >= 10
                  ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 shadow-lg hover:shadow-xl'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {stats.affiliateBalance >= 10 ? '💸 Solicitar Resgate' : '💸 Mínimo R$ 10,00 para resgatar'}
            </button>

            <p className={`text-sm text-center mt-3 ${themeClasses.text.muted}`}>
              Quando alguém que você indicou compra um plano, você ganha {stats.commissionRate}% do valor!
            </p>
          </div>
        )}

        {/* Estatísticas de Gerações */}
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

        {/* Comissões Recentes */}
        {stats && stats.recentCommissions && stats.recentCommissions.length > 0 && (
          <div className={`${themeClasses.card} rounded-2xl shadow-xl p-8 mb-8`}>
            <h2 className={`text-2xl font-bold mb-6 ${themeClasses.text.primary}`}>💰 Comissões Recentes</h2>
            <div className="space-y-3">
              {stats.recentCommissions.map((commission) => (
                <div
                  key={commission.id}
                  className={`flex items-center justify-between p-4 ${theme === 'dark' ? 'bg-green-500/20 border border-green-400/30' : 'bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200'} rounded-lg`}
                >
                  <div>
                    <p className={`font-semibold ${themeClasses.text.primary}`}>
                      {commission.buyerUsername} comprou {commission.planName}
                    </p>
                    <p className={`text-sm ${themeClasses.text.muted}`}>
                      Valor do plano: R$ {commission.paymentAmount.toFixed(2)}
                    </p>
                    <p className={`text-xs ${themeClasses.text.muted}`}>
                      {format(new Date(commission.createdAt), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="text-green-600 font-bold text-lg">+R$ {commission.amount.toFixed(2)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resgates Recentes */}
        {stats && stats.recentWithdrawals && stats.recentWithdrawals.length > 0 && (
          <div className={`${themeClasses.card} rounded-2xl shadow-xl p-8 mb-8`}>
            <h2 className={`text-2xl font-bold mb-6 ${themeClasses.text.primary}`}>💸 Seus Resgates</h2>
            <div className="space-y-3">
              {stats.recentWithdrawals.map((withdrawal) => (
                <div
                  key={withdrawal.id}
                  className={`flex items-center justify-between p-4 ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'} rounded-lg`}
                >
                  <div>
                    <p className={`font-semibold ${themeClasses.text.primary}`}>
                      Resgate de R$ {withdrawal.amount.toFixed(2)}
                    </p>
                    <p className={`text-xs ${themeClasses.text.muted}`}>
                      {format(new Date(withdrawal.createdAt), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  {getStatusBadge(withdrawal.status)}
                </div>
              ))}
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

      {/* Modal de Resgate */}
      {showWithdrawModal && stats && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${themeClasses.card} rounded-2xl p-6 max-w-md w-full shadow-2xl`}>
            <h2 className={`text-2xl font-bold mb-4 ${themeClasses.text.primary}`}>💸 Solicitar Resgate</h2>
            
            <div className={`${theme === 'dark' ? 'bg-green-500/20 border border-green-400/30' : 'bg-green-50 border border-green-200'} rounded-lg p-4 mb-4`}>
              <p className={`text-sm ${theme === 'dark' ? 'text-green-300' : 'text-green-700'}`}>
                Saldo disponível: <strong>R$ {stats.affiliateBalance.toFixed(2)}</strong>
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-semibold mb-2 ${themeClasses.text.primary}`}>
                  Valor do resgate
                </label>
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="Mínimo R$ 10,00"
                  min="10"
                  max={stats.affiliateBalance}
                  step="0.01"
                  className={`${themeClasses.input} w-full px-4 py-3 rounded-lg`}
                />
              </div>

              <div>
                <label className={`block text-sm font-semibold mb-2 ${themeClasses.text.primary}`}>
                  Tipo de Chave PIX
                </label>
                <select
                  value={pixKeyType}
                  onChange={(e) => setPixKeyType(e.target.value as any)}
                  className={`${themeClasses.input} w-full px-4 py-3 rounded-lg`}
                >
                  <option value="CPF">CPF</option>
                  <option value="CNPJ">CNPJ</option>
                  <option value="EMAIL">E-mail</option>
                  <option value="PHONE">Telefone</option>
                  <option value="RANDOM">Chave Aleatória</option>
                </select>
              </div>

              <div>
                <label className={`block text-sm font-semibold mb-2 ${themeClasses.text.primary}`}>
                  Chave PIX
                </label>
                <input
                  type="text"
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  placeholder="Digite sua chave PIX"
                  className={`${themeClasses.input} w-full px-4 py-3 rounded-lg`}
                />
              </div>

              <div className={`${theme === 'dark' ? 'bg-yellow-500/20 border border-yellow-400/30' : 'bg-yellow-50 border border-yellow-200'} rounded-lg p-4`}>
                <p className={`text-sm ${theme === 'dark' ? 'text-yellow-200' : 'text-yellow-800'}`}>
                  <strong>⚠️ Importante:</strong> Após solicitar, aguarde o processamento. O pagamento será feito manualmente pelo administrador via PIX.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleWithdraw}
                  disabled={withdrawing}
                  className="flex-1 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-bold hover:from-green-600 hover:to-emerald-700 disabled:opacity-50"
                >
                  {withdrawing ? 'Enviando...' : 'Confirmar Resgate'}
                </button>
                <button
                  onClick={() => {
                    setShowWithdrawModal(false)
                    setWithdrawAmount('')
                    setPixKey('')
                  }}
                  className={`px-6 py-3 rounded-lg font-semibold ${theme === 'dark' ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

