import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Layout from '@/components/Layout'
import axios from 'axios'
import toast from 'react-hot-toast'

interface Stats {
  affiliateCode: string | null
  totalReferrals: number
  affiliateBalance: number
  totalAffiliateEarnings: number
  commissionRate: number
  recentCommissions: Array<{
    id: string
    amount: number
    paymentAmount: number
    buyerUsername: string
    planName: string
    createdAt: string
  }>
}

export default function CoOwnerPanel() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    if (status === 'authenticated') {
      const rawRole = String(session?.user?.role || '').toUpperCase()
      const isCoOwner = rawRole === 'CO_OWNER' || rawRole === 'CO-OWNER' || rawRole === 'CO OWNER'
      if (!isCoOwner) {
        router.push('/dashboard')
        return
      }
      loadStats()
    }
  }, [session, status])

  const loadStats = async () => {
    try {
      const res = await axios.get('/api/affiliate/stats')
      setStats(res.data)
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Erro ao carregar estatísticas')
    }
  }

  const getLink = (code: string | null) => {
    if (!code || typeof window === 'undefined') return ''
    return `${window.location.origin}/register?ref=${code}`
  }

  const copy = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copiado!')
  }

  return (
    <Layout>
      <div className="min-h-screen pt-12 pb-16 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-extrabold text-white mb-6">Painel do Co-Owner</h1>

          <div className="glass-panel p-6 rounded-2xl border border-white/10 mb-8">
            <h2 className="text-xl font-bold text-white mb-4">Seu link</h2>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white font-mono text-sm truncate">
                {getLink(stats?.affiliateCode || null)}
              </div>
              {stats?.affiliateCode && (
                <button
                  onClick={() => copy(getLink(stats.affiliateCode))}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold"
                >
                  Copiar
                </button>
              )}
            </div>
          </div>

          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
                <div className="text-4xl mb-2">💵</div>
                <p className="text-3xl font-bold text-green-400">R$ {stats.affiliateBalance.toFixed(2)}</p>
                <p className="text-gray-400">Saldo disponível</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
                <div className="text-4xl mb-2">📈</div>
                <p className="text-3xl font-bold text-white">R$ {stats.totalAffiliateEarnings.toFixed(2)}</p>
                <p className="text-gray-400">Total ganho</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
                <div className="text-4xl mb-2">🏷️</div>
                <p className="text-3xl font-bold text-white">{stats.commissionRate}%</p>
                <p className="text-gray-400">Comissão por venda</p>
              </div>
            </div>
          )}

          {stats && stats.recentCommissions && stats.recentCommissions.length > 0 && (
            <div className="glass-panel p-6 rounded-2xl border border-white/10">
              <h2 className="text-xl font-bold text-white mb-4">Vendas pelo seu link</h2>
              <div className="space-y-3">
                {stats.recentCommissions.map((c) => (
                  <div key={c.id} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg p-4">
                    <div className="text-white">
                      <p className="font-semibold">{c.buyerUsername} comprou {c.planName}</p>
                      <p className="text-xs text-gray-400">Valor do plano: R$ {c.paymentAmount.toFixed(2)}</p>
                    </div>
                    <div className="text-green-400 font-bold">+ R$ {c.amount.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
