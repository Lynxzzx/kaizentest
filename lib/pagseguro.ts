import axios from 'axios'

// Função para obter e validar o token do PagSeguro
function getPagSeguroToken(): string {
  const PAGSEGURO_TOKEN = process.env.PAGSEGURO_TOKEN

  if (!PAGSEGURO_TOKEN || (typeof PAGSEGURO_TOKEN === 'string' && PAGSEGURO_TOKEN.trim().length === 0)) {
    console.error('❌ ERRO: PAGSEGURO_TOKEN não está configurada!')
    console.error('   Configure no .env ou no Vercel: PAGSEGURO_TOKEN=seu_token')
    throw new Error('PAGSEGURO_TOKEN não está configurada no servidor.')
  }

  const token = PAGSEGURO_TOKEN.trim()

  if (!(getPagSeguroToken as any).logged) {
    console.log('✅ PAGSEGURO_TOKEN carregada com sucesso!')
    console.log('   Tamanho:', token.length, 'caracteres')
    console.log('   Prefixo:', token.substring(0, 20))
    ;(getPagSeguroToken as any).logged = true
  }

  return token
}

// Função para obter a URL da API baseada no ambiente
function getPagSeguroApiUrl(): string {
  const isSandbox = process.env.PAGSEGURO_SANDBOX === 'true' || process.env.NODE_ENV === 'development'
  const baseUrl = isSandbox 
    ? 'https://sandbox.api.pagseguro.com' 
    : 'https://api.pagseguro.com'
  
  console.log(`📦 Usando PagSeguro ${isSandbox ? 'SANDBOX' : 'PRODUÇÃO'}: ${baseUrl}`)
  return baseUrl
}

// Interface para dados do cliente
interface CreateCustomerData {
  name: string
  email?: string
  phone?: string
  tax_id?: string
}

// Interface para criar pagamento PIX
interface CreatePixPaymentData {
  reference_id: string
  customer: {
    name: string
    email: string
    tax_id: string
    phones?: Array<{
      country: string
      area: string
      number: string
      type: string
    }>
  }
  amount: {
    value: number // Valor em centavos
    currency: string
  }
  description?: string
}

// Criar cliente no PagSeguro (se necessário)
export async function createPagSeguroCustomer(data: CreateCustomerData) {
  try {
    // O PagSeguro não requer criação prévia de cliente para PIX
    // Mas mantemos a função para compatibilidade
    console.log('📝 Criando cliente no PagSeguro:', data.name)
    return {
      id: `customer_${Date.now()}`,
      name: data.name,
      email: data.email,
      tax_id: data.tax_id
    }
  } catch (error: any) {
    console.error('Erro ao criar cliente no PagSeguro:', error.message)
    throw error
  }
}

// Criar pagamento PIX no PagSeguro
export async function createPagSeguroPixPayment(data: {
  reference_id: string
  customer: {
    name: string
    email: string
    tax_id: string
    phone?: string
  }
  amount: number // Valor em reais
  description: string
}) {
  try {
    const token = getPagSeguroToken()
    const apiUrl = getPagSeguroApiUrl()

    // Converter valor de reais para centavos
    const valueInCents = Math.round(data.amount * 100)

    // Preparar dados do pagamento
    const paymentData: CreatePixPaymentData = {
      reference_id: data.reference_id,
      customer: {
        name: data.customer.name,
        email: data.customer.email,
        tax_id: data.customer.tax_id.replace(/\D/g, ''), // Remover formatação do CPF/CNPJ
        ...(data.customer.phone && {
          phones: [{
            country: '55',
            area: data.customer.phone.substring(0, 2),
            number: data.customer.phone.substring(2).replace(/\D/g, ''),
            type: 'MOBILE'
          }]
        })
      },
      amount: {
        value: valueInCents,
        currency: 'BRL'
      },
      description: data.description
    }

    console.log('Criando pagamento PIX no PagSeguro:', JSON.stringify(paymentData, null, 2))

    // Criar cobrança PIX
    const response = await axios.post(
      `${apiUrl}/charges`,
      {
        ...paymentData,
        payment_method: {
          type: 'PIX'
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    )

    console.log('✅ Pagamento PIX criado no PagSeguro:', response.data.id)
    
    // Buscar QR code PIX
    const chargeId = response.data.id
    const qrCodeResponse = await axios.get(
      `${apiUrl}/charges/${chargeId}/pix`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    )

    return {
      id: response.data.id,
      qrCode: qrCodeResponse.data.qr_code,
      qrCodeImage: qrCodeResponse.data.qr_code_image,
      expiresAt: qrCodeResponse.data.expires_at || new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutos padrão
    }
  } catch (error: any) {
    const errorData = error.response?.data || error.message
    console.error('PagSeguro API Error (Create PIX Payment):', JSON.stringify(errorData, null, 2))

    // Verificar se é erro de rede/API fora do ar
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND' ||
        error.message?.includes('timeout') || error.message?.includes('ECONNREFUSED') ||
        error.response?.status === 503 || error.response?.status === 502 || error.response?.status === 504) {
      const networkError = new Error('A API do PagSeguro está temporariamente indisponível. O serviço pode estar fora do ar ou em manutenção. Tente novamente em alguns minutos.')
      networkError.name = 'PagSeguroServiceUnavailableError'
      throw networkError
    }

    // Verificar se é erro de autenticação
    if (error.response?.status === 401 || error.response?.status === 403) {
      const errorMessage = errorData?.error_messages?.[0]?.description || errorData?.message || 'Token inválido'
      console.error('❌ ERRO DE AUTENTICAÇÃO: O token do PagSeguro está inválido ou expirado!')
      console.error('   Mensagem do PagSeguro:', errorMessage)
      
      const authError = new Error(`Token do PagSeguro inválido: ${errorMessage}. Verifique se o token está correto.`)
      authError.name = 'PagSeguroAuthenticationError'
      throw authError
    }

    throw error
  }
}

// Buscar status de um pagamento
export async function getPagSeguroPayment(chargeId: string) {
  try {
    const token = getPagSeguroToken()
    const apiUrl = getPagSeguroApiUrl()

    const response = await axios.get(
      `${apiUrl}/charges/${chargeId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    )

    return response.data
  } catch (error: any) {
    console.error('Erro ao buscar pagamento no PagSeguro:', error.response?.data || error.message)
    throw error
  }
}

// Buscar QR code PIX de um pagamento existente
export async function getPagSeguroPixQrCode(chargeId: string) {
  try {
    const token = getPagSeguroToken()
    const apiUrl = getPagSeguroApiUrl()

    const response = await axios.get(
      `${apiUrl}/charges/${chargeId}/pix`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    )

    return {
      qrCode: response.data.qr_code,
      qrCodeImage: response.data.qr_code_image,
      expiresAt: response.data.expires_at
    }
  } catch (error: any) {
    console.error('Erro ao buscar QR code PIX no PagSeguro:', error.response?.data || error.message)
    throw error
  }
}

