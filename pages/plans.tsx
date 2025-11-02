import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useTranslation } from '@/lib/i18n-helper'
import axios from 'axios'
import toast from 'react-hot-toast'
import QRCode from 'qrcode.react'

interface Plan {
  id: string
  name: string
  description: string
  price: number
  duration: number
  maxGenerations: number
}

interface PaymentData {
  id: string
  pixQrCodeImage?: string  // Imagem base64 completa do QR code
  pixQrCode?: string       // Código copia e cola (para gerar QR code se não tiver imagem)
  pixCopyPaste?: string   // Código copia e cola
  telegramLink?: string
  expiresAt?: Date
}

export default function Plans() {
  const { t } = useTranslation()
  const { data: session } = useSession()
  const router = useRouter()
  const [plans, setPlans] = useState<Plan[]>([])
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'CRYPTO' | null>(null)
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null)
  const [loading, setLoading] = useState(false)
  const [qrCodeImageError, setQrCodeImageError] = useState(false)

  useEffect(() => {
    loadPlans()
  }, [])

  const loadPlans = async () => {
    try {
      const response = await axios.get('/api/plans')
      setPlans(response.data)
    } catch (error) {
      toast.error('Erro ao carregar planos')
    }
  }

  const handlePayment = async (plan: Plan, method: 'PIX' | 'CRYPTO') => {
    if (!session) {
      toast.error('Faça login para continuar')
      router.push('/login')
      return
    }

    if (method === 'CRYPTO') {
      // Para criptomoedas, redirecionar direto para o Telegram
      setLoading(true)
      try {
        // Criar registro de pagamento no banco
        await axios.post('/api/payments/create', {
          planId: plan.id,
          method: 'BITCOIN' // Usar BITCOIN internamente para manter compatibilidade
        })
        
        // Redirecionar para o Telegram
        const telegramUrl = 'https://t.me/lynxdevz'
        window.open(telegramUrl, '_blank')
        toast.success('Redirecionando para o Telegram...')
      } catch (error: any) {
        toast.error(error.response?.data?.error || 'Erro ao criar pagamento')
        // Mesmo com erro, redirecionar para o Telegram
        const telegramUrl = 'https://t.me/lynxdevz'
        window.open(telegramUrl, '_blank')
      } finally {
        setLoading(false)
      }
      return
    }

    setLoading(true)
    setSelectedPlan(plan)
    setPaymentMethod(method)

    try {
          const response = await axios.post('/api/payments/create', {
            planId: plan.id,
            method
          })
          setPaymentData(response.data)
          setQrCodeImageError(false) // Resetar erro quando criar novo pagamento
          
          // Log para debug
          console.log('Payment data received:', {
            hasPixQrCodeImage: !!response.data.pixQrCodeImage,
            pixQrCodeImageLength: response.data.pixQrCodeImage?.length || 0,
            pixQrCodeImagePreview: response.data.pixQrCodeImage?.substring(0, 100) || 'null',
            hasPixCopyPaste: !!response.data.pixCopyPaste,
            pixCopyPasteLength: response.data.pixCopyPaste?.length || 0
          })
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao criar pagamento')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 py-6 sm:py-8 md:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-3 sm:mb-4 px-2">{t('plans')}</h1>
          <p className="text-base sm:text-lg md:text-xl text-gray-600 max-w-2xl mx-auto px-4">
            Escolha o plano ideal para você e tenha acesso a todos os nossos serviços
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8 mb-6 sm:mb-8">
          {plans.map((plan, index) => (
            <div
              key={plan.id}
              className={`bg-white rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 md:p-8 border-2 transition-all transform hover:-translate-y-2 hover:shadow-2xl ${
                index === 1 ? 'border-primary-500 sm:scale-105' : 'border-gray-200 hover:border-primary-300'
              }`}
            >
              {index === 1 && (
                <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white text-center py-1.5 sm:py-2 rounded-lg mb-3 sm:mb-4 -mt-2 mx-4 sm:mx-8">
                  <span className="font-bold text-xs sm:text-sm">MAIS POPULAR</span>
                </div>
              )}
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
              <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6 min-h-[60px]">{plan.description}</p>
              <div className="mb-4 sm:mb-6">
                <div className="flex items-baseline mb-2">
                  <span className="text-3xl sm:text-4xl font-extrabold text-gray-900">R$</span>
                  <span className="text-4xl sm:text-5xl font-extrabold text-gray-900 ml-1">{plan.price.toFixed(2)}</span>
                </div>
                <p className="text-gray-500 text-xs sm:text-sm">ou {plan.duration} dias</p>
              </div>
              <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
                <div className="flex items-center text-gray-700">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{plan.duration} dias de acesso</span>
                </div>
                <div className="flex items-center text-gray-700">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{plan.maxGenerations === 0 ? 'Ilimitadas' : `${plan.maxGenerations} gerações`}</span>
                </div>
                <div className="flex items-center text-gray-700">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Acesso a todos os serviços</span>
                </div>
              </div>
              <div className="space-y-2 sm:space-y-3">
                <button
                  onClick={() => handlePayment(plan, 'PIX')}
                  disabled={loading}
                  className={`w-full py-2.5 sm:py-3 rounded-lg text-sm sm:text-base font-bold transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 touch-manipulation ${
                    index === 1
                      ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white hover:from-primary-700 hover:to-primary-800'
                      : 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800'
                  }`}
                >
                  Pagar via PIX
                </button>
                <button
                  onClick={() => handlePayment(plan, 'CRYPTO')}
                  disabled={loading}
                  className="w-full py-2.5 sm:py-3 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-lg text-sm sm:text-base font-bold hover:from-orange-700 hover:to-orange-800 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 touch-manipulation"
                >
                  Pagar via Criptomoedas
                </button>
              </div>
            </div>
          ))}
        </div>

        {plans.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">Nenhum plano disponível no momento.</p>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {paymentData && selectedPlan && paymentMethod && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 max-w-md w-full mx-4 shadow-2xl my-4">
            <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-gray-900">
              Pagamento via {paymentMethod}
            </h2>
            
            {paymentMethod === 'PIX' && (
              <div className="space-y-4">
                {(paymentData.pixQrCodeImage || paymentData.pixQrCode || paymentData.pixCopyPaste) ? (
                  <>
                    <div className="flex justify-center bg-gray-50 p-3 sm:p-4 rounded-lg">
                      {paymentData.pixQrCodeImage && !qrCodeImageError ? (
                        // Exibir imagem base64 diretamente (QR code oficial do Asaas)
                        <img 
                          src={paymentData.pixQrCodeImage} 
                          alt="QR Code PIX" 
                          className="w-48 h-48 sm:w-64 sm:h-64 object-contain mx-auto"
                          onError={(e) => {
                            console.error('Erro ao carregar imagem QR code')
                            console.error('Image src length:', paymentData.pixQrCodeImage?.length)
                            console.error('Image src preview:', paymentData.pixQrCodeImage?.substring(0, 100))
                            setQrCodeImageError(true)
                          }}
                          onLoad={() => {
                            console.log('QR code image loaded successfully')
                          }}
                        />
                      ) : paymentData.pixCopyPaste || paymentData.pixQrCode ? (
                        // Gerar QR code a partir do código copia e cola como fallback
                        <div className="flex justify-center">
                          <QRCode 
                            value={paymentData.pixCopyPaste || paymentData.pixQrCode || ''} 
                            size={256} 
                            className="w-48 h-48 sm:w-64 sm:h-64"
                          />
                        </div>
                      ) : (
                        <div className="w-64 h-64 flex items-center justify-center text-gray-500">
                          <p>Carregando QR code...</p>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Código PIX (Copiar e Colar)
                      </label>
                      <textarea
                        value={paymentData.pixCopyPaste || paymentData.pixQrCode || ''}
                        readOnly
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg font-mono text-xs bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        rows={4}
                        onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                      />
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm text-blue-800">
                        <strong>Instruções:</strong> Escaneie o QR Code ou copie o código PIX. Após o pagamento, seu plano será ativado automaticamente.
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-800">
                      <strong>Aguarde:</strong> Estamos processando os dados do pagamento PIX. Por favor, recarregue a página em alguns instantes ou verifique o código do pagamento na sua conta.
                    </p>
                    {paymentData.pixCopyPaste && (
                      <div className="mt-4">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Código PIX (Copiar e Colar)
                        </label>
                        <textarea
                          value={paymentData.pixCopyPaste}
                          readOnly
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg font-mono text-xs bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
                          rows={4}
                          onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}


            <button
              onClick={() => {
                setPaymentData(null)
                setSelectedPlan(null)
                setPaymentMethod(null)
              }}
              className="mt-4 sm:mt-6 w-full bg-gray-100 text-gray-800 px-4 py-2.5 sm:py-3 rounded-lg text-sm sm:text-base font-semibold hover:bg-gray-200 transition-colors touch-manipulation"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

