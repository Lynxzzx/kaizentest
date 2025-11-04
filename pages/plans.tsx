import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useTranslation } from '@/lib/i18n-helper'
import { useTheme } from '@/contexts/ThemeContext'
import { getThemeClasses } from '@/lib/theme-utils'
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
  bitcoinAddress?: string
  bitcoinAmount?: number
  network?: string
  qrCode?: string
  originalAmount?: number
  currency?: string
  fallback?: boolean
  expiresAt?: Date
}

export default function Plans() {
  const { t } = useTranslation()
  const { data: session } = useSession()
  const { theme } = useTheme()
  const router = useRouter()
  const [plans, setPlans] = useState<Plan[]>([])
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'CRYPTO' | null>(null)
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null)
  const [loading, setLoading] = useState(false)
  const [qrCodeImageError, setQrCodeImageError] = useState(false)
  const [showPixMaintenanceAlert, setShowPixMaintenanceAlert] = useState(false)
  const [showTelegramOption, setShowTelegramOption] = useState(false)
  const themeClasses = getThemeClasses(theme)

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
      // Para criptomoedas, criar pagamento via Binance
      setLoading(true)
      setSelectedPlan(plan)
      setPaymentMethod(method)
      
      try {
        console.log('🚀 Criando pagamento via criptomoedas...')
        const response = await axios.post('/api/payments/create', {
          planId: plan.id,
          method: 'BITCOIN' // Usar BITCOIN internamente para manter compatibilidade
        })
        
        console.log('✅ Resposta recebida:', response.data)
        console.log('✅ Status HTTP:', response.status)
        console.log('✅ Tem bitcoinAddress?', !!response.data.bitcoinAddress)
        console.log('✅ Tem fallback?', !!response.data.fallback)
        
        // SEMPRE verificar primeiro se tem bitcoinAddress (sucesso Binance)
        if (response.data.bitcoinAddress) {
          console.log('✅ Dados Binance recebidos com sucesso!')
          console.log('📋 Dados completos:', JSON.stringify(response.data, null, 2))
          setPaymentData(response.data)
          setQrCodeImageError(false)
          toast.success('Pagamento via criptomoedas criado com sucesso!')
          // Garantir que o modal apareça
          setPaymentMethod('CRYPTO')
          setSelectedPlan(plan)
        } else {
          // Sem bitcoinAddress - mostrar erro mas NÃO redirecionar
          console.error('❌ Resposta não contém bitcoinAddress')
          console.error('❌ Resposta completa:', response.data)
          console.error('❌ Keys na resposta:', Object.keys(response.data))
          toast.error('Erro: Dados de pagamento incompletos. Tente novamente.')
          setLoading(false)
        }
      } catch (error: any) {
        console.error('❌ Erro HTTP ao criar pagamento:', error)
        console.error('❌ Status HTTP:', error.response?.status)
        console.error('❌ Error response data:', error.response?.data)
        console.error('❌ Error message:', error.message)
        
        // NUNCA redirecionar para Telegram automaticamente
        // Sempre mostrar erro ao usuário
        const errorMessage = error.response?.data?.error || error.response?.data?.details || error.message || 'Erro ao criar pagamento. Tente novamente.'
        toast.error(errorMessage)
        setLoading(false)
        
        // Se ainda assim tiver bitcoinAddress no erro (caso raro), usar
        if (error.response?.data?.bitcoinAddress) {
          console.log('⚠️ Erro HTTP mas tem bitcoinAddress, usando dados')
          setPaymentData(error.response.data)
          setPaymentMethod('CRYPTO')
          setSelectedPlan(plan)
        }
      }
      return
    }

    // Para PIX: mostrar alerta de manutenção primeiro
    if (method === 'PIX') {
      setSelectedPlan(plan)
      setShowPixMaintenanceAlert(true)
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
    <div className={`min-h-screen ${themeClasses.bg} py-6 sm:py-8 md:py-12 px-4 sm:px-6 lg:px-8`}>
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8 sm:mb-12">
          <h1 className={`text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4 px-2 ${themeClasses.text.primary}`}>{t('plans')}</h1>
          <p className={`text-base sm:text-lg md:text-xl max-w-2xl mx-auto px-4 ${themeClasses.text.secondary}`}>
            Escolha o plano ideal para você e tenha acesso a todos os nossos serviços
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8 mb-6 sm:mb-8">
          {plans.map((plan, index) => (
            <div
              key={plan.id}
              className={`${themeClasses.card} border-2 transition-all transform hover:-translate-y-2 hover:shadow-2xl ${
                index === 1 ? 'border-purple-500 sm:scale-105' : theme === 'dark' ? 'border-white/20 hover:border-purple-500' : 'border-gray-200 hover:border-primary-300'
              }`}
            >
              {index === 1 && (
                <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white text-center py-1.5 sm:py-2 rounded-lg mb-3 sm:mb-4 -mt-2 mx-4 sm:mx-8">
                  <span className="font-bold text-xs sm:text-sm">MAIS POPULAR</span>
                </div>
              )}
              <h3 className={`text-xl sm:text-2xl font-bold mb-2 ${themeClasses.text.primary}`}>{plan.name}</h3>
              <p className={`text-sm sm:text-base mb-4 sm:mb-6 min-h-[60px] ${themeClasses.text.secondary}`}>{plan.description}</p>
              <div className="mb-4 sm:mb-6">
                <div className="flex items-baseline mb-2">
                  <span className={`text-3xl sm:text-4xl font-extrabold ${themeClasses.text.primary}`}>R$</span>
                  <span className={`text-4xl sm:text-5xl font-extrabold ml-1 ${themeClasses.text.primary}`}>{plan.price.toFixed(2)}</span>
                </div>
                <p className={`${themeClasses.text.muted} text-xs sm:text-sm`}>ou {plan.duration} dias</p>
              </div>
              <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
                <div className={`flex items-center ${themeClasses.text.secondary}`}>
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{plan.duration} dias de acesso</span>
                </div>
                <div className={`flex items-center ${themeClasses.text.secondary}`}>
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{plan.maxGenerations === 0 ? 'Ilimitadas' : `${plan.maxGenerations} gerações`}</span>
                </div>
                <div className={`flex items-center ${themeClasses.text.secondary}`}>
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
            <p className={`${themeClasses.text.secondary} text-lg`}>Nenhum plano disponível no momento.</p>
          </div>
        )}
      </div>

      {/* PIX Maintenance Alert Modal */}
      {showPixMaintenanceAlert && selectedPlan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className={`${themeClasses.card} rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 max-w-md w-full mx-4 shadow-2xl my-4`}>
            <div className="text-center mb-6">
              <div className={`mx-auto flex items-center justify-center h-16 w-16 rounded-full mb-4 ${
                theme === 'dark' ? 'bg-yellow-500/20' : 'bg-yellow-100'
              }`}>
                <svg className={`h-8 w-8 ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className={`text-xl sm:text-2xl font-bold mb-4 ${themeClasses.text.primary}`}>
                Sistema em Atualização
              </h2>
              <p className={`text-sm sm:text-base mb-6 ${themeClasses.text.secondary}`}>
                O sistema de pagamento PIX está temporariamente em manutenção para melhorias. 
                Estamos trabalhando para oferecer uma experiência ainda melhor!
              </p>
            </div>

            <div className={`${theme === 'dark' ? 'bg-blue-500/20 border border-blue-400/30' : 'bg-blue-50 border border-blue-200'} rounded-lg p-4 mb-6`}>
              <p className={`text-sm font-semibold mb-2 ${theme === 'dark' ? 'text-blue-200' : 'text-blue-900'}`}>
                💡 Alternativa Disponível
              </p>
              <p className={`text-sm ${theme === 'dark' ? 'text-blue-300' : 'text-blue-700'}`}>
                Você pode comprar via Telegram usando PIX. É rápido, seguro e seu plano será ativado automaticamente!
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => {
                  setShowPixMaintenanceAlert(false)
                  setSelectedPlan(null)
                  
                  // Redirecionar diretamente para o Telegram
                  const telegramLink = `https://t.me/lynxdevz`
                  toast.success('Redirecionando para o Telegram...')
                  
                  // Redirecionar automaticamente para o Telegram após 500ms
                  setTimeout(() => {
                    window.open(telegramLink, '_blank')
                  }, 500)
                }}
                className={`w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg text-base font-bold hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5`}
              >
                Comprar via Telegram
              </button>
              <button
                onClick={() => {
                  setShowPixMaintenanceAlert(false)
                  setSelectedPlan(null)
                }}
                className={`w-full py-3 rounded-lg text-base font-semibold transition-colors ${
                  theme === 'dark' 
                    ? 'bg-white/10 text-white hover:bg-white/20' 
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {(paymentData || (paymentMethod === 'CRYPTO' && loading)) && selectedPlan && paymentMethod && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className={`${themeClasses.card} rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 max-w-md w-full mx-4 shadow-2xl my-4`}>
            <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 ${themeClasses.text.primary}`}>
              Pagamento via {paymentMethod}
            </h2>
            
            {paymentMethod === 'PIX' && paymentData && (
              <div className="space-y-4">
                {(paymentData.pixQrCodeImage || paymentData.pixQrCode || paymentData.pixCopyPaste) ? (
                  <>
                    <div className={`flex justify-center ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'} p-3 sm:p-4 rounded-lg`}>
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
                        <div className={`w-64 h-64 flex items-center justify-center ${themeClasses.text.muted}`}>
                          <p>Carregando QR code...</p>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className={`block text-sm font-semibold mb-2 ${themeClasses.text.primary}`}>
                        Código PIX (Copiar e Colar)
                      </label>
                      <textarea
                        value={paymentData.pixCopyPaste || paymentData.pixQrCode || ''}
                        readOnly
                        className={`${themeClasses.input} w-full px-4 py-3 rounded-lg font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary-500`}
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
                  <div className={`${theme === 'dark' ? 'bg-yellow-500/20 border border-yellow-400/30' : 'bg-yellow-50 border border-yellow-200'} rounded-lg p-4`}>
                    <p className={`text-sm ${theme === 'dark' ? 'text-yellow-200' : 'text-yellow-800'}`}>
                      <strong>Aguarde:</strong> Estamos processando os dados do pagamento PIX. Por favor, recarregue a página em alguns instantes ou verifique o código do pagamento na sua conta.
                    </p>
                    {paymentData.pixCopyPaste && (
                      <div className="mt-4">
                        <label className={`block text-sm font-semibold mb-2 ${themeClasses.text.primary}`}>
                          Código PIX (Copiar e Colar)
                        </label>
                        <textarea
                          value={paymentData.pixCopyPaste}
                          readOnly
                          className={`${themeClasses.input} w-full px-4 py-3 rounded-lg font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary-500`}
                          rows={4}
                          onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {paymentMethod === 'CRYPTO' && paymentData && (
              <div className="space-y-4">
                {paymentData.fallback ? (
                  <div className={`${theme === 'dark' ? 'bg-yellow-500/20 border border-yellow-400/30' : 'bg-yellow-50 border border-yellow-200'} rounded-lg p-4`}>
                    <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-yellow-200' : 'text-yellow-800'}`}>
                      <strong>Atenção:</strong> Sistema de pagamento automático temporariamente indisponível.
                    </p>
                    <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-yellow-200' : 'text-yellow-800'}`}>
                      Entre em contato via Telegram para completar o pagamento:
                    </p>
                    <a
                      href={paymentData.telegramLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block w-full text-center bg-blue-500 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-600 transition-colors"
                    >
                      Abrir Telegram
                    </a>
                  </div>
                ) : (
                  <>
                    <div className={`${theme === 'dark' ? 'bg-blue-500/20 border border-blue-400/30' : 'bg-blue-50 border border-blue-200'} rounded-lg p-4`}>
                      <p className={`text-sm font-semibold mb-2 ${theme === 'dark' ? 'text-blue-200' : 'text-blue-900'}`}>Valor a pagar:</p>
                      <p className={`text-2xl font-bold mb-1 ${theme === 'dark' ? 'text-blue-100' : 'text-blue-900'}`}>
                        {paymentData.bitcoinAmount?.toFixed(8)} {paymentData.currency || 'BTC'}
                      </p>
                      <p className={`text-sm ${theme === 'dark' ? 'text-blue-300' : 'text-blue-700'}`}>
                        (R$ {paymentData.originalAmount?.toFixed(2)})
                      </p>
                    </div>
                    
                    <div>
                      <label className={`block text-sm font-semibold mb-2 ${themeClasses.text.primary}`}>
                        Endereço Bitcoin
                      </label>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <input
                          type="text"
                          value={paymentData.bitcoinAddress || ''}
                          readOnly
                          className={`${themeClasses.input} flex-1 px-4 py-3 rounded-lg font-mono text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-500`}
                          onClick={(e) => (e.target as HTMLInputElement).select()}
                        />
                        <button
                          onClick={() => {
                            if (paymentData.bitcoinAddress) {
                              navigator.clipboard.writeText(paymentData.bitcoinAddress)
                              toast.success('Endereço copiado!')
                            }
                          }}
                          className="px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium whitespace-nowrap"
                        >
                          Copiar
                        </button>
                      </div>
                    </div>

                    {paymentData.qrCode && (
                      <div className={`flex justify-center ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'} p-4 rounded-lg`}>
                        <QRCode 
                          value={paymentData.qrCode} 
                          size={256} 
                          className="w-48 h-48 sm:w-64 sm:h-64"
                        />
                      </div>
                    )}

                    <div className={`${theme === 'dark' ? 'bg-green-500/20 border border-green-400/30' : 'bg-green-50 border border-green-200'} rounded-lg p-4`}>
                      <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-green-200' : 'text-green-800'}`}>
                        <strong>Rede:</strong> {paymentData.network || 'Bitcoin'}
                      </p>
                      <p className={`text-xs ${theme === 'dark' ? 'text-green-300' : 'text-green-700'}`}>
                        Envie exatamente <strong>{paymentData.bitcoinAmount?.toFixed(8)} {paymentData.currency || 'BTC'}</strong> para o endereço acima.
                        O pagamento será processado automaticamente após confirmação na rede.
                      </p>
                    </div>

                    <div className={`${theme === 'dark' ? 'bg-yellow-500/20 border border-yellow-400/30' : 'bg-yellow-50 border border-yellow-200'} rounded-lg p-4`}>
                      <p className={`text-sm ${theme === 'dark' ? 'text-yellow-200' : 'text-yellow-800'}`}>
                        <strong>⚠️ Importante:</strong> Verifique o endereço antes de enviar. Transações de criptomoedas são irreversíveis.
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}

            <button
              onClick={() => {
                setPaymentData(null)
                setSelectedPlan(null)
                setPaymentMethod(null)
              }}
              className={`mt-4 sm:mt-6 w-full px-4 py-2.5 sm:py-3 rounded-lg text-sm sm:text-base font-semibold transition-colors touch-manipulation ${
                theme === 'dark' 
                  ? 'bg-white/10 text-white hover:bg-white/20' 
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }`}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

