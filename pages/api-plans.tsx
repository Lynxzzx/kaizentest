import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useTranslation } from '@/lib/i18n-helper'
import { useTheme } from '@/contexts/ThemeContext'
import Layout from '@/components/Layout'
import axios from 'axios'
import toast from 'react-hot-toast'

interface ApiPlan {
  id: string
  name: string
  description: string
  price: number
  duration: number
  maxGenerations: number
  features: string[]
  badge?: string
  color: string
}

const API_PLANS: ApiPlan[] = [
  {
    id: 'api-starter',
    name: 'API KAIZEN STARTER',
    description: 'Entrada, mas já filtra curioso.',
    price: 79.90,
    duration: 30,
    maxGenerations: 1500,
    color: 'green',
    features: [
      '🔑 1 API Key',
      '🔄 1.500 gerações / mês',
      '📦 Serviços básicos',
      '⏱️ Rate limit seguro',
      '🚫 Sem revenda explícita',
      '📊 Log básico'
    ]
  },
  {
    id: 'api-creator',
    name: 'API KAIZEN CREATOR',
    description: 'Plano mais equilibrado.',
    price: 149.90,
    duration: 30,
    maxGenerations: 5000,
    color: 'blue',
    badge: 'Mais Popular',
    features: [
      '🔑 API Key dedicada',
      '🔄 5.000 gerações / mês',
      '📦 Serviços ampliados',
      '⚡ Rate limit melhor',
      '✅ Uso comercial permitido',
      '📊 Histórico completo'
    ]
  },
  {
    id: 'api-pro',
    name: 'API KAIZEN PRO',
    description: 'Aqui é cliente de verdade.',
    price: 299.90,
    duration: 30,
    maxGenerations: 15000,
    color: 'purple',
    features: [
      '🔑 API Key exclusiva',
      '🔄 15.000 gerações / mês',
      '📦 Todos os serviços',
      '🚀 Prioridade de estoque',
      '⚡ Rate limit alto',
      '🛡️ Anti-abuso avançado',
      '💬 Suporte prioritário'
    ]
  },
  {
    id: 'api-enterprise',
    name: 'API KAIZEN ENTERPRISE',
    description: 'Estoque dedicado e limites customizados.',
    price: 0, // Sob consulta
    duration: 0,
    maxGenerations: 0,
    color: 'red',
    features: [
      '💼 Estoque dedicado',
      '📊 Limites customizados',
      '🔒 IP whitelist',
      '📋 SLA',
      '🎨 Possível whitelabel'
    ]
  }
]

export default function ApiPlans() {
  const { t } = useTranslation()
  const { data: session } = useSession()
  const router = useRouter()
  const { theme } = useTheme()
  const [loading, setLoading] = useState(false)

  const handleSelectPlan = async (plan: ApiPlan) => {
    if (!session) {
      router.push('/login?redirect=/api-plans')
      return
    }

    if (plan.id === 'api-enterprise') {
      window.open('https://t.me/lynxdevz', '_blank')
      return
    }

    setLoading(true)
    try {
      // Redirecionar para página de pagamento (similar ao fluxo de planos normais)
      router.push(`/plans?apiPlan=${plan.id}`)
    } catch (error) {
      toast.error('Erro ao processar plano')
    } finally {
      setLoading(false)
    }
  }

  const getColorClasses = (color: string) => {
    const colors: Record<string, string> = {
      green: 'from-green-500 to-emerald-600',
      blue: 'from-blue-500 to-cyan-600',
      purple: 'from-purple-500 to-pink-600',
      red: 'from-red-500 to-rose-600'
    }
    return colors[color] || colors.blue
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              🌐 API Kaizen
            </h1>
            <p className="text-xl text-slate-300 mb-8">
              Integre nosso estoque ao seu site ou bot
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {API_PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`relative bg-white/10 backdrop-blur-lg rounded-2xl p-6 border-2 ${
                  plan.badge ? 'border-purple-500/50 ring-4 ring-purple-500/20' : 'border-white/20'
                } hover:scale-105 transition-transform`}
              >
                {plan.badge && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-1 rounded-full text-sm font-bold">
                    {plan.badge}
                  </div>
                )}
                <div className={`w-16 h-16 rounded-full bg-gradient-to-r ${getColorClasses(plan.color)} flex items-center justify-center text-white text-2xl font-bold mb-4`}>
                  {plan.name.charAt(0)}
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                <p className="text-slate-300 text-sm mb-4">{plan.description}</p>
                <div className="mb-4">
                  {plan.price > 0 ? (
                    <div>
                      <span className="text-3xl font-bold text-white">R$ {plan.price.toFixed(2)}</span>
                      <span className="text-slate-400"> / mês</span>
                    </div>
                  ) : (
                    <div>
                      <span className="text-2xl font-bold text-white">💼 Sob consulta</span>
                    </div>
                  )}
                </div>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="text-sm text-slate-300 flex items-start">
                      <span className="mr-2">{feature}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleSelectPlan(plan)}
                  disabled={loading}
                  className={`w-full py-3 rounded-lg font-semibold text-white bg-gradient-to-r ${getColorClasses(plan.color)} hover:opacity-90 transition-opacity disabled:opacity-50`}
                >
                  {plan.id === 'api-enterprise' ? 'Falar no Telegram' : 'Assinar'}
                </button>
              </div>
            ))}
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-4">📚 Documentação da API</h2>
            <p className="text-slate-300 mb-4">
              Após assinar um plano, você receberá sua API Key e poderá acessar a documentação completa.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="bg-white/5 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-2">POST /api/v1/generate</h3>
                <p className="text-sm text-slate-300">Gerar uma conta para um serviço</p>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-2">GET /api/v1/services</h3>
                <p className="text-sm text-slate-300">Listar serviços disponíveis</p>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-2">GET /api/v1/status</h3>
                <p className="text-sm text-slate-300">Verificar status e uso da API</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}