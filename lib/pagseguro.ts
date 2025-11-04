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

    // Tentar usar o endpoint /orders primeiro (estrutura recomendada pela documentação)
    // O PagBank parece usar /orders com charges dentro
    const orderData: any = {
      reference_id: data.reference_id,
      customer: customerData,
      items: [
        {
          reference_id: `${data.reference_id}_item`,
          name: data.description,
          quantity: 1,
          unit_amount: valueInCents
        }
      ],
      charges: [
        {
          reference_id: `${data.reference_id}_charge`,
          description: data.description,
          amount: {
            value: valueInCents,
            currency: 'BRL'
          },
          payment_method: {
            type: 'PIX'
          }
        }
      ]
    }

    console.log('Criando pedido PIX no PagSeguro (via /orders):', JSON.stringify(orderData, null, 2))

    let chargeResponse: any
    let chargeId: string

    try {
      // Tentar criar via /orders primeiro
      const orderResponse = await axios.post(
        `${apiUrl}/orders`,
        orderData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      )

      console.log('✅ Pedido PIX criado no PagSeguro via /orders:', orderResponse.data.id)
      
      // Extrair o charge_id da resposta
      chargeId = orderResponse.data.charges?.[0]?.id || orderResponse.data.id
      chargeResponse = {
        data: orderResponse.data.charges?.[0] || orderResponse.data
      }
    } catch (orderError: any) {
      // Se /orders falhar, tentar /charges diretamente
      console.log('⚠️ /orders falhou, tentando /charges diretamente...')
      console.log('Erro:', orderError.response?.data || orderError.message)
      
      const chargeData: any = {
        reference_id: data.reference_id,
        customer: customerData,
        amount: {
          value: valueInCents,
          currency: 'BRL'
        },
        description: data.description,
        payment_method: {
          type: 'PIX'
        }
      }

      console.log('Criando cobrança PIX no PagSeguro (via /charges):', JSON.stringify(chargeData, null, 2))

      chargeResponse = await axios.post(
        `${apiUrl}/charges`,
        chargeData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      )

      console.log('✅ Cobrança PIX criada no PagSeguro via /charges:', chargeResponse.data.id)
      chargeId = chargeResponse.data.id
    }
    
    // O QR code PIX pode vir na resposta inicial ou precisar ser buscado
    // Primeiro tentar extrair da estrutura de resposta (orders ou charges)
    const responseData = chargeResponse.data
    let qrCodeData = responseData?.charges?.[0]?.payment_method?.pix || 
                     responseData?.payment_method?.pix ||
                     responseData?.pix ||
                     responseData
    
    // Se não tiver QR code na resposta, buscar separadamente
    if (!qrCodeData?.qr_code && !qrCodeData?.qr_code_text && !qrCodeData?.pix_copy_paste && !qrCodeData?.text) {
      console.log('Buscando QR code PIX separadamente...')
      try {
        const qrCodeResponse = await axios.get(
          `${apiUrl}/charges/${chargeId}/pix`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        )
        qrCodeData = qrCodeResponse.data
        console.log('✅ QR code PIX obtido via GET')
      } catch (getError: any) {
        // Se GET falhar, tentar POST
        console.log('⚠️ GET falhou, tentando POST para gerar QR code PIX...')
        try {
          const qrCodeResponse = await axios.post(
            `${apiUrl}/charges/${chargeId}/pix`,
            {},
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            }
          )
          qrCodeData = qrCodeResponse.data
          console.log('✅ QR code PIX gerado via POST')
        } catch (postError: any) {
          console.error('⚠️ Não foi possível obter QR code PIX:', postError.response?.data || postError.message)
          // Continuar mesmo assim, pode estar na resposta inicial
        }
      }
    }

    // Extrair QR code de diferentes possíveis estruturas
    const responseDataFinal = chargeResponse.data
    const qrCode = qrCodeData?.qr_code || 
                   qrCodeData?.qr_code_text || 
                   qrCodeData?.pix_copy_paste ||
                   qrCodeData?.text ||
                   responseDataFinal?.charges?.[0]?.payment_method?.pix?.qr_code ||
                   responseDataFinal?.charges?.[0]?.payment_method?.pix?.qr_code_text ||
                   responseDataFinal?.charges?.[0]?.payment_method?.pix?.pix_copy_paste ||
                   responseDataFinal?.payment_method?.pix?.qr_code ||
                   responseDataFinal?.payment_method?.pix?.qr_code_text ||
                   responseDataFinal?.payment_method?.pix?.pix_copy_paste ||
                   responseDataFinal?.pix?.qr_code ||
                   responseDataFinal?.pix?.qr_code_text ||
                   responseDataFinal?.pix?.pix_copy_paste ||
                   ''

    const qrCodeImage = qrCodeData?.qr_code_image || 
                        qrCodeData?.qr_code_base64 ||
                        responseDataFinal?.charges?.[0]?.payment_method?.pix?.qr_code_image ||
                        responseDataFinal?.charges?.[0]?.payment_method?.pix?.qr_code_base64 ||
                        responseDataFinal?.payment_method?.pix?.qr_code_image ||
                        responseDataFinal?.payment_method?.pix?.qr_code_base64 ||
                        responseDataFinal?.pix?.qr_code_image ||
                        responseDataFinal?.pix?.qr_code_base64 ||
                        null

    const expiresAt = qrCodeData?.expires_at || 
                      qrCodeData?.expiration_date ||
                      responseDataFinal?.charges?.[0]?.payment_method?.pix?.expires_at ||
                      responseDataFinal?.charges?.[0]?.payment_method?.pix?.expiration_date ||
                      responseDataFinal?.payment_method?.pix?.expires_at ||
                      responseDataFinal?.payment_method?.pix?.expiration_date ||
                      responseDataFinal?.pix?.expires_at ||
                      responseDataFinal?.pix?.expiration_date ||
                      new Date(Date.now() + 30 * 60 * 1000).toISOString()

    return {
      id: chargeId || chargeResponse.data.id || chargeResponse.data?.charges?.[0]?.id || '',
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

