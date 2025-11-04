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
  }
  amount: number // Valor em reais
  description: string
}) {
  try {
    const token = getPagSeguroToken()
    const apiUrl = getPagSeguroApiUrl()

    // Converter valor de reais para centavos
    const valueInCents = Math.round(data.amount * 100)

    // Preparar dados do cliente (não enviar email se estiver vazio)
    const customerData: any = {
      name: data.customer.name,
      tax_id: data.customer.tax_id.replace(/\D/g, '') // Remover formatação do CPF/CNPJ
    }
    
    // Adicionar email apenas se não estiver vazio
    if (data.customer.email && data.customer.email.trim().length > 0) {
      customerData.email = data.customer.email
    }

    // Preparar dados do pagamento
    // O PagSeguro pode requerer uma estrutura diferente para PIX
    const paymentData: any = {
      reference_id: data.reference_id,
      customer: customerData,
      amount: {
        value: valueInCents,
        currency: 'BRL'
      },
      description: data.description,
      // Tentar criar charge sem payment_method primeiro, depois gerar PIX
      // Ou usar estrutura de payment_methods (array)
      payment_methods: [{
        type: 'PIX'
      }]
    }

    console.log('Criando pagamento PIX no PagSeguro:', JSON.stringify(paymentData, null, 2))

    // Criar cobrança PIX
    let response
    try {
      response = await axios.post(
        `${apiUrl}/charges`,
        paymentData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      )
    } catch (firstError: any) {
      // Se falhar com payment_methods, tentar sem payment_method e gerar PIX depois
      if (firstError.response?.status === 400) {
        console.log('⚠️ Tentando criar charge sem payment_method...')
        const chargeDataWithoutMethod = {
          reference_id: data.reference_id,
          customer: customerData,
          amount: {
            value: valueInCents,
            currency: 'BRL'
          },
          description: data.description
        }
        
        response = await axios.post(
          `${apiUrl}/charges`,
          chargeDataWithoutMethod,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        )
        
        // Após criar a charge, gerar o QR code PIX
        const chargeId = response.data.id
        const pixResponse = await axios.post(
          `${apiUrl}/charges/${chargeId}/pix`,
          {},
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        )
        
        return {
          id: response.data.id,
          qrCode: pixResponse.data.qr_code || pixResponse.data.qr_code_text || pixResponse.data.text,
          qrCodeImage: pixResponse.data.qr_code_image || pixResponse.data.qr_code_base64,
          expiresAt: pixResponse.data.expires_at || new Date(Date.now() + 30 * 60 * 1000).toISOString()
        }
      } else {
        throw firstError
      }
    }

    console.log('✅ Pagamento PIX criado no PagSeguro:', response.data.id)
    
    // Buscar QR code PIX
    const chargeId = response.data.id
    let qrCodeResponse
    try {
      qrCodeResponse = await axios.get(
        `${apiUrl}/charges/${chargeId}/pix`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      )
    } catch (qrError: any) {
      // Se GET falhar, tentar POST
      console.log('⚠️ GET falhou, tentando POST para gerar QR code PIX...')
      qrCodeResponse = await axios.post(
        `${apiUrl}/charges/${chargeId}/pix`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      )
    }

    return {
      id: response.data.id,
      qrCode: qrCodeResponse.data.qr_code || qrCodeResponse.data.qr_code_text || qrCodeResponse.data.text || qrCodeResponse.data.pix_copy_paste,
      qrCodeImage: qrCodeResponse.data.qr_code_image || qrCodeResponse.data.qr_code_base64,
      expiresAt: qrCodeResponse.data.expires_at || qrCodeResponse.data.expiration_date || new Date(Date.now() + 30 * 60 * 1000).toISOString()
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

