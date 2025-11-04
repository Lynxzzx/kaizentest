import axios from 'axios'

// Função para obter e validar a chave/token do PagSeguro
function getPagSeguroKey(): string {
  // Primeiro tentar PAGSEGURO_APP_KEY (chave de aplicação)
  // Depois tentar PAGSEGURO_TOKEN (token) para compatibilidade
  const PAGSEGURO_APP_KEY = process.env.PAGSEGURO_APP_KEY
  const PAGSEGURO_TOKEN = process.env.PAGSEGURO_TOKEN

  const key = PAGSEGURO_APP_KEY || PAGSEGURO_TOKEN

  if (!key || (typeof key === 'string' && key.trim().length === 0)) {
    console.error('❌ ERRO: PAGSEGURO_APP_KEY ou PAGSEGURO_TOKEN não está configurada!')
    console.error('   Configure no .env ou no Vercel: PAGSEGURO_APP_KEY=sua_chave')
    throw new Error('PAGSEGURO_APP_KEY ou PAGSEGURO_TOKEN não está configurada no servidor.')
  }

  const trimmedKey = key.trim()

  if (!(getPagSeguroKey as any).logged) {
    const keyType = PAGSEGURO_APP_KEY ? 'APP_KEY' : 'TOKEN'
    console.log(`✅ PAGSEGURO_${keyType} carregada com sucesso!`)
    console.log('   Tamanho:', trimmedKey.length, 'caracteres')
    console.log('   Prefixo:', trimmedKey.substring(0, 20))
    ;(getPagSeguroKey as any).logged = true
  }

  return trimmedKey
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
    const key = getPagSeguroKey()
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

    // O endpoint /charges não aceita PIX diretamente
    // Estratégia: criar cobrança primeiro, depois gerar QR code PIX separadamente
    const chargeData: any = {
      reference_id: data.reference_id,
      customer: customerData,
      amount: {
        value: valueInCents,
        currency: 'BRL'
      },
      description: data.description
      // Não incluir payment_method nem qr_codes aqui
    }

    console.log('Criando cobrança no PagSeguro (sem método de pagamento):', JSON.stringify(chargeData, null, 2))

    // Criar cobrança primeiro (sem método de pagamento)
    let chargeResponse
    try {
      chargeResponse = await axios.post(
        `${apiUrl}/charges`,
        chargeData,
        {
          headers: {
            'Authorization': `Bearer ${key}`,
            'App-Token': key,
            'Content-Type': 'application/json'
          }
        }
      )
      console.log('✅ Cobrança criada no PagSeguro:', chargeResponse.data.id)
    } catch (chargeError: any) {
      // Se falhar por falta de payment_method, tentar criar diretamente via endpoint de QR code
      console.log('⚠️ Criar cobrança falhou, tentando criar QR code PIX diretamente...')
      console.log('Erro:', chargeError.response?.data || chargeError.message)
      
      // Tentar criar QR code PIX diretamente sem cobrança prévia
      const pixData = {
        reference_id: data.reference_id,
        customer: customerData,
        amount: {
          value: valueInCents,
          currency: 'BRL'
        },
        description: data.description,
        expiration_date: new Date(Date.now() + 30 * 60 * 1000).toISOString()
      }
      
      const pixResponse = await axios.post(
        `${apiUrl}/pix/qr-codes`,
        pixData,
        {
          headers: {
            'Authorization': `Bearer ${key}`,
            'App-Token': key,
            'Content-Type': 'application/json'
          }
        }
      )
      
      return {
        id: pixResponse.data.id || pixResponse.data.reference_id || '',
        qrCode: pixResponse.data.text || pixResponse.data.qr_code || pixResponse.data.pix_copy_paste || '',
        qrCodeImage: pixResponse.data.qr_code_image || pixResponse.data.qr_code_base64 || null,
        expiresAt: pixResponse.data.expiration_date || pixResponse.data.expires_at || new Date(Date.now() + 30 * 60 * 1000).toISOString()
      }
    }
    
    const chargeId = chargeResponse.data.id
    
    // Gerar QR code PIX para a cobrança criada
    console.log('Gerando QR code PIX para cobrança:', chargeId)
    
    let qrCodeData: any = null
    
    // Tentar vários endpoints possíveis para gerar QR code PIX
    const pixEndpoints = [
      `${apiUrl}/charges/${chargeId}/pix/qr-codes`,
      `${apiUrl}/charges/${chargeId}/pix`,
      `${apiUrl}/pix/qr-codes`,
      `${apiUrl}/charges/${chargeId}/qr-codes`
    ]
    
    for (const endpoint of pixEndpoints) {
      try {
        console.log(`Tentando endpoint: ${endpoint}`)
        const qrCodeResponse = await axios.post(
          endpoint,
          {
            amount: {
              value: valueInCents,
              currency: 'BRL'
            },
            expiration_date: new Date(Date.now() + 30 * 60 * 1000).toISOString()
          },
          {
            headers: {
              'Authorization': `Bearer ${key}`,
              'App-Token': key,
              'Content-Type': 'application/json'
            }
          }
        )
        qrCodeData = qrCodeResponse.data
        console.log(`✅ QR code PIX gerado via ${endpoint}`)
        break
      } catch (endpointError: any) {
        console.log(`⚠️ ${endpoint} falhou:`, endpointError.response?.data?.error_messages?.[0]?.description || endpointError.message)
        // Tentar próximo endpoint
        continue
      }
    }
    
    // Se POST falhou em todos, tentar GET
    if (!qrCodeData) {
      for (const endpoint of [`${apiUrl}/charges/${chargeId}/pix`, `${apiUrl}/charges/${chargeId}/pix/qr-codes`]) {
        try {
          console.log(`Tentando GET: ${endpoint}`)
          const qrCodeResponse = await axios.get(
            endpoint,
            {
              headers: {
                'Authorization': `Bearer ${key}`,
                'App-Token': key
              }
            }
          )
          qrCodeData = qrCodeResponse.data
          console.log(`✅ QR code PIX obtido via GET ${endpoint}`)
          break
        } catch (getError: any) {
          console.log(`⚠️ GET ${endpoint} falhou`)
          continue
        }
      }
    }
    
    if (!qrCodeData) {
      throw new Error('Não foi possível gerar QR code PIX. Verifique se a cobrança foi criada e se o endpoint de PIX está disponível.')
    }

    // Extrair QR code de diferentes possíveis estruturas (qr_codes)
    const responseDataFinal = chargeResponse.data
    const qrCode = qrCodeData?.text ||
                   qrCodeData?.qr_code || 
                   qrCodeData?.qr_code_text || 
                   qrCodeData?.pix_copy_paste ||
                   responseDataFinal?.qr_codes?.[0]?.text ||
                   responseDataFinal?.qr_codes?.[0]?.qr_code ||
                   responseDataFinal?.qr_codes?.[0]?.qr_code_text ||
                   responseDataFinal?.qr_codes?.[0]?.pix_copy_paste ||
                   responseDataFinal?.qr_code?.text ||
                   responseDataFinal?.qr_code ||
                   responseDataFinal?.qr_code_text ||
                   responseDataFinal?.pix_copy_paste ||
                   ''

    const qrCodeImage = qrCodeData?.qr_code_image || 
                        qrCodeData?.qr_code_base64 ||
                        responseDataFinal?.qr_codes?.[0]?.qr_code_image ||
                        responseDataFinal?.qr_codes?.[0]?.qr_code_base64 ||
                        responseDataFinal?.qr_code_image ||
                        responseDataFinal?.qr_code_base64 ||
                        null

    const expiresAt = qrCodeData?.expiration_date ||
                      qrCodeData?.expires_at || 
                      responseDataFinal?.qr_codes?.[0]?.expiration_date ||
                      responseDataFinal?.qr_codes?.[0]?.expires_at ||
                      responseDataFinal?.expiration_date ||
                      responseDataFinal?.expires_at ||
                      new Date(Date.now() + 30 * 60 * 1000).toISOString()

    return {
      id: chargeId || chargeResponse.data.id || '',
      qrCode: qrCode || '',
      qrCodeImage: qrCodeImage || null,
      expiresAt: expiresAt
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
    const key = getPagSeguroKey()
    const apiUrl = getPagSeguroApiUrl()

    const response = await axios.get(
      `${apiUrl}/charges/${chargeId}`,
      {
        headers: {
          'Authorization': `Bearer ${key}`,
          'App-Token': key
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
    const key = getPagSeguroKey()
    const apiUrl = getPagSeguroApiUrl()

    const response = await axios.get(
      `${apiUrl}/charges/${chargeId}/pix`,
      {
        headers: {
          'Authorization': `Bearer ${key}`,
          'App-Token': key
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

