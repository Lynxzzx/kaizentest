import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useSession } from 'next-auth/react'
import { useTranslation } from '@/lib/i18n-helper'
import { useTheme } from '@/contexts/ThemeContext'
import { getThemeClasses } from '@/lib/theme-utils'
import axios from 'axios'
import toast from 'react-hot-toast'

interface PaymentStatus {
  id: string
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED' | 'DECLINED'
  method: string
  amount: number
  finalAmount: number
  createdAt: string
  paidAt?: string | null
  plan: {
    name: string
  }
  user: {
    username: string
  }
}

export default function PaymentStatusPage() {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const router = useRouter()
  const { data: session } = useSession()
  const { id } = router.query
  const [payment, setPayment] = useState<PaymentStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkingStatus, setCheckingStatus] = useState(false)
  const themeClasses = getThemeClasses(theme)

  useEffect(() => {
    if (!id || typeof id !== 'string') return
    loadPaymentStatus()
    
    // Verificar status automaticamente a cada 3 segundos se ainda estiver pendente
    const interval = setInterval(() => {
      if (payment && (payment.status === 'PENDING' || payment.status === 'DECLINED')) {
        checkPaymentStatus()
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [id, payment?.status])

  const loadPaymentStatus = async () => {
    if (!id || typeof id !== 'string') return
    
    try {
      setLoading(true)
      const response = await axios.get(`/api/payments/status/${id}`)
      setPayment(response.data)
    } catch (error: any) {
      console.error('Erro ao carregar status do pagamento:', error)
      toast.error(error.response?.data?.error || 'Erro ao carregar status do pagamento')
    } finally {
      setLoading(false)
    }
  }

  const checkPaymentStatus = async () => {
    if (!id || typeof id !== 'string') return
    
    try {
      setCheckingStatus(true)
      const response = await axios.get(`/api/payments/status/${id}`)
      const newStatus = response.data.status
      
      if (newStatus !== payment?.status) {
        setPayment(response.data)
        
        if (newStatus === 'PAID') {
          toast.success('Pagamento confirmado!')
          // Recarregar a página após 2 segundos para atualizar o plano
          setTimeout(() => {
            window.location.reload()
          }, 2000)
        } else if (newStatus === 'DECLINED' || newStatus === 'CANCELLED') {
          toast.error('Pagamento recusado ou cancelado')
        }
      }
    } catch (error: any) {
      console.error('Erro ao verificar status do pagamento:', error)
    } finally {
      setCheckingStatus(false)
    }
  }

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'PAID':
        return {
          icon: '✅',
          title: 'Pagamento Aprovado!',
          message: 'Seu pagamento foi confirmado com sucesso. Seu plano foi ativado.',
          color: 'green',
          bgColor: theme === 'dark' ? 'bg-green-500/20 border-green-400/30' : 'bg-green-50 border-green-200'
        }
      case 'PENDING':
        return {
          icon: '⏳',
          title: 'Aguardando Confirmação',
          message: 'Seu pagamento está sendo processado. Aguarde alguns instantes...',
          color: 'yellow',
          bgColor: theme === 'dark' ? 'bg-yellow-500/20 border-yellow-400/30' : 'bg-yellow-50 border-yellow-200'
        }
      case 'DECLINED':
        return {
          icon: '❌',
          title: 'Pagamento Recusado',
          message: 'Seu pagamento foi recusado. Verifique os dados do cartão e tente novamente.',
          color: 'red',
          bgColor: theme === 'dark' ? 'bg-red-500/20 border-red-400/30' : 'bg-red-50 border-red-200'
        }
      case 'CANCELLED':
        return {
          icon: '🚫',
          title: 'Pagamento Cancelado',
          message: 'Seu pagamento foi cancelado.',
          color: 'gray',
          bgColor: theme === 'dark' ? 'bg-gray-500/20 border-gray-400/30' : 'bg-gray-50 border-gray-200'
        }
      case 'EXPIRED':
        return {
          icon: '⏰',
          title: 'Pagamento Expirado',
          message: 'O prazo para pagamento expirou. Por favor, realize um novo pagamento.',
          color: 'orange',
          bgColor: theme === 'dark' ? 'bg-orange-500/20 border-orange-400/30' : 'bg-orange-50 border-orange-200'
        }
      default:
        return {
          icon: '❓',
          title: 'Status Desconhecido',
          message: 'Não foi possível determinar o status do pagamento.',
          color: 'gray',
          bgColor: theme === 'dark' ? 'bg-gray-500/20 border-gray-400/30' : 'bg-gray-50 border-gray-200'
        }
    }
  }

  if (loading) {
    return (
      <div className={`min-h-screen ${themeClasses.bg} flex items-center justify-center`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className={themeClasses.text.secondary}>Carregando status do pagamento...</p>
        </div>
      </div>
    )
  }

  if (!payment) {
    return (
      <div className={`min-h-screen ${themeClasses.bg} flex items-center justify-center p-4`}>
        <div className={`${themeClasses.card} rounded-xl p-8 max-w-md w-full text-center`}>
          <p className={`text-xl mb-4 ${themeClasses.text.primary}`}>Pagamento não encontrado</p>
          <p className={`mb-6 ${themeClasses.text.secondary}`}>
            O pagamento solicitado não foi encontrado ou você não tem permissão para visualizá-lo.
          </p>
          <button
            onClick={() => router.push('/plans')}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors"
          >
            Voltar para Planos
          </button>
        </div>
      </div>
    )
  }

  const statusInfo = getStatusInfo(payment.status)

  return (
    <div className={`min-h-screen ${themeClasses.bg} py-6 sm:py-8 md:py-12 px-4 sm:px-6 lg:px-8`}>
      <div className="max-w-2xl mx-auto">
        <div className={`${themeClasses.card} rounded-xl sm:rounded-2xl p-6 sm:p-8 shadow-xl`}>
          {/* Status Card */}
          <div className={`${statusInfo.bgColor} border-2 rounded-xl p-6 sm:p-8 mb-6 text-center`}>
            <div className="text-6xl sm:text-7xl mb-4">{statusInfo.icon}</div>
            <h1 className={`text-2xl sm:text-3xl font-bold mb-3 ${themeClasses.text.primary}`}>
              {statusInfo.title}
            </h1>
            <p className={`text-base sm:text-lg ${themeClasses.text.secondary} mb-4`}>
              {statusInfo.message}
            </p>
            
            {payment.status === 'PENDING' && checkingStatus && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600"></div>
                <span className={themeClasses.text.secondary}>Verificando status...</span>
              </div>
            )}
          </div>

          {/* Payment Details */}
          <div className={`${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'} rounded-lg p-6 mb-6`}>
            <h2 className={`text-xl font-semibold mb-4 ${themeClasses.text.primary}`}>
              Detalhes do Pagamento
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className={themeClasses.text.secondary}>ID do Pagamento:</span>
                <span className={`font-mono text-sm ${themeClasses.text.primary}`}>{payment.id.substring(0, 8)}...</span>
              </div>
              <div className="flex justify-between">
                <span className={themeClasses.text.secondary}>Plano:</span>
                <span className={themeClasses.text.primary}>{payment.plan.name}</span>
              </div>
              <div className="flex justify-between">
                <span className={themeClasses.text.secondary}>Método:</span>
                <span className={themeClasses.text.primary}>
                  {payment.method === 'CARD' ? '💳 Cartão de Crédito' : 
                   payment.method === 'PIX' ? '📱 PIX' : 
                   payment.method === 'BITCOIN' ? '₿ Bitcoin' : payment.method}
                </span>
              </div>
              <div className="flex justify-between">
                <span className={themeClasses.text.secondary}>Valor:</span>
                <span className={`font-semibold ${themeClasses.text.primary}`}>
                  R$ {payment.finalAmount.toFixed(2)}
                </span>
              </div>
              {payment.paidAt && (
                <div className="flex justify-between">
                  <span className={themeClasses.text.secondary}>Pago em:</span>
                  <span className={themeClasses.text.primary}>
                    {new Date(payment.paidAt).toLocaleString('pt-BR')}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className={themeClasses.text.secondary}>Criado em:</span>
                <span className={themeClasses.text.primary}>
                  {new Date(payment.createdAt).toLocaleString('pt-BR')}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            {payment.status === 'PAID' && (
              <button
                onClick={() => router.push('/dashboard')}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-700 text-white rounded-lg font-semibold hover:from-green-700 hover:to-emerald-800 transition-all"
              >
                Ir para Dashboard
              </button>
            )}
            
            {(payment.status === 'DECLINED' || payment.status === 'CANCELLED' || payment.status === 'EXPIRED') && (
              <button
                onClick={() => router.push('/plans')}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-lg font-semibold hover:from-primary-700 hover:to-primary-800 transition-all"
              >
                Tentar Novamente
              </button>
            )}

            {payment.status === 'PENDING' && (
              <button
                onClick={checkPaymentStatus}
                disabled={checkingStatus}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50"
              >
                {checkingStatus ? 'Verificando...' : 'Verificar Status'}
              </button>
            )}

            <button
              onClick={() => router.push('/plans')}
              className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                theme === 'dark' 
                  ? 'bg-white/10 text-white hover:bg-white/20' 
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }`}
            >
              Voltar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
