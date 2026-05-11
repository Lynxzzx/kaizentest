import axios from 'axios'
import { prisma } from '@/lib/prisma'

const PAGSEGURO_HTTP_TIMEOUT_MS = Number(process.env.PAGSEGURO_HTTP_TIMEOUT_MS || 45000)

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

/** Extrai copia-e-cola + imagem do body de GET/POST /orders. */
function extractPixPayload(orderData_response: any): {
  qrCode: string
  qrCodeImage: string | null
  expiresAt: string
} {
  const qrCodeData =
    orderData_response.qr_codes?.[0] ||
    orderData_response.charges?.[0]?.qr_codes?.[0] ||
    orderData_response.charges?.[0]?.payment_method?.pix ||
    orderData_response

  const qrCode =
    qrCodeData?.text ||
    qrCodeData?.qr_code ||
    qrCodeData?.qr_code_text ||
    qrCodeData?.pix_copy_paste ||
    orderData_response.qr_codes?.[0]?.text ||
    orderData_response.qr_codes?.[0]?.qr_code ||
    orderData_response.qr_codes?.[0]?.qr_code_text ||
    orderData_response.qr_codes?.[0]?.pix_copy_paste ||
    orderData_response.charges?.[0]?.qr_codes?.[0]?.text ||
    orderData_response.charges?.[0]?.qr_codes?.[0]?.qr_code ||
    orderData_response.charges?.[0]?.qr_codes?.[0]?.qr_code_text ||
    orderData_response.charges?.[0]?.qr_codes?.[0]?.pix_copy_paste ||
    ''

  const qrCodeImage =
    qrCodeData?.qr_code_image ||
    qrCodeData?.qr_code_base64 ||
    orderData_response.qr_codes?.[0]?.qr_code_image ||
    orderData_response.qr_codes?.[0]?.qr_code_base64 ||
    orderData_response.charges?.[0]?.qr_codes?.[0]?.qr_code_image ||
    orderData_response.charges?.[0]?.qr_codes?.[0]?.qr_code_base64 ||
    null

  const expiresAt =
    qrCodeData?.expiration_date ||
    qrCodeData?.expires_at ||
    orderData_response.qr_codes?.[0]?.expiration_date ||
    orderData_response.qr_codes?.[0]?.expires_at ||
    orderData_response.charges?.[0]?.qr_codes?.[0]?.expiration_date ||
    orderData_response.charges?.[0]?.qr_codes?.[0]?.expires_at ||
    new Date(Date.now() + 30 * 60 * 1000).toISOString()

  return { qrCode: qrCode || '', qrCodeImage, expiresAt }
}

// Função para obter o email do vendedor (se configurado)
async function getPagSeguroSellerEmail(): Promise<string | null> {
  // Primeiro verificar variável de ambiente
  let email = process.env.PAGSEGURO_SELLER_EMAIL

  // Se não encontrar, buscar no banco de dados
  if (!email || (typeof email === 'string' && email.trim().length === 0)) {
    try {
      const config = await prisma.systemConfig.findUnique({
        where: { key: 'PAGSEGURO_SELLER_EMAIL' }
      })

      if (config && config.value && config.value.trim().length > 0) {
        email = config.value.trim()
        console.log('✅ PAGSEGURO_SELLER_EMAIL encontrado no banco de dados:', email)
      }
    } catch (dbError: any) {
      console.error('⚠️ Erro ao buscar PAGSEGURO_SELLER_EMAIL no banco de dados:', dbError.message)
    }
  }

  return email && email.trim().length > 0 ? email.trim() : null
}

// Função para obter e validar a chave/token do PagSeguro
async function getPagSeguroKey(): Promise<string> {
  // Primeiro tentar PAGSEGURO_APP_KEY (chave de aplicação)
  // Depois tentar PAGSEGURO_TOKEN (token) para compatibilidade
  const PAGSEGURO_APP_KEY = process.env.PAGSEGURO_APP_KEY
  const PAGSEGURO_TOKEN = process.env.PAGSEGURO_TOKEN

  let key = PAGSEGURO_APP_KEY || PAGSEGURO_TOKEN

  // Se não encontrar na variável de ambiente, tentar buscar no banco de dados
  if (!key || (typeof key === 'string' && key.trim().length === 0)) {
    console.log('⚠️ PAGSEGURO_APP_KEY/PAGSEGURO_TOKEN não encontrada em variáveis de ambiente, tentando buscar no banco de dados...')
    try {
      // Tentar primeiro PAGSEGURO_APP_KEY
      let config = await prisma.systemConfig.findUnique({
        where: { key: 'PAGSEGURO_APP_KEY' }
      })

      if (config && config.value && config.value.trim().length > 0) {
        key = config.value.trim()
        console.log('✅ PAGSEGURO_APP_KEY encontrada no banco de dados!')
        console.log('   Tamanho:', key.length, 'caracteres')
        console.log('   Prefixo:', key.substring(0, 20))
      } else {
        // Tentar PAGSEGURO_TOKEN
        config = await prisma.systemConfig.findUnique({
          where: { key: 'PAGSEGURO_TOKEN' }
        })

        if (config && config.value && config.value.trim().length > 0) {
          key = config.value.trim()
          console.log('✅ PAGSEGURO_TOKEN encontrada no banco de dados!')
          console.log('   Tamanho:', key.length, 'caracteres')
          console.log('   Prefixo:', key.substring(0, 20))
        } else {
          console.log('⚠️ PAGSEGURO_APP_KEY/PAGSEGURO_TOKEN não encontrada no banco de dados')
        }
      }
    } catch (dbError: any) {
      console.error('⚠️ Erro ao buscar PAGSEGURO_APP_KEY/PAGSEGURO_TOKEN no banco de dados:', dbError.message)
      // Continuar para mostrar erro da variável de ambiente
    }
  }

  if (!key || (typeof key === 'string' && key.trim().length === 0)) {
    console.error('❌ ERRO: PAGSEGURO_APP_KEY ou PAGSEGURO_TOKEN não está configurada!')
    console.error('   Configure no .env, no Vercel ou no dashboard admin: PAGSEGURO_APP_KEY ou PAGSEGURO_TOKEN')
    throw new Error('PAGSEGURO_APP_KEY ou PAGSEGURO_TOKEN não está configurada no servidor.')
  }

  const trimmedKey = key.trim()

  if (!(getPagSeguroKey as any).logged) {
    const keyType = PAGSEGURO_APP_KEY ? 'APP_KEY' : (key === PAGSEGURO_TOKEN ? 'TOKEN' : 'APP_KEY/TOKEN (DB)')
    console.log(`✅ PAGSEGURO_${keyType} carregada com sucesso!`)
    console.log('   Tamanho:', trimmedKey.length, 'caracteres')
    console.log('   Prefixo:', trimmedKey.substring(0, 20))
      ; (getPagSeguroKey as any).logged = true
  }

  return trimmedKey
}

// Função para obter a URL da API baseada no ambiente
async function getPagSeguroApiUrl(): Promise<string> {
  // Primeiro verificar se há URL customizada (variável de ambiente ou banco de dados)
  let customUrl = process.env.PAGSEGURO_API_URL

  // Se não encontrar na variável de ambiente, tentar buscar no banco de dados
  if (!customUrl || (typeof customUrl === 'string' && customUrl.trim().length === 0)) {
    try {
      const config = await prisma.systemConfig.findUnique({
        where: { key: 'PAGSEGURO_API_URL' }
      })

      if (config && config.value && config.value.trim().length > 0) {
        customUrl = config.value.trim()
        console.log('✅ PAGSEGURO_API_URL encontrada no banco de dados:', customUrl)
      }
    } catch (dbError: any) {
      console.error('⚠️ Erro ao buscar PAGSEGURO_API_URL no banco de dados:', dbError.message)
    }
  }

  // Se houver URL customizada, usar ela
  if (customUrl && customUrl.trim().length > 0) {
    const trimmedUrl = customUrl.trim()
    // Validar se é uma URL válida
    try {
      new URL(trimmedUrl)
      console.log(`📦 Usando PagSeguro URL customizada: ${trimmedUrl}`)
      return trimmedUrl
    } catch (error) {
      console.warn('⚠️ URL customizada inválida, usando padrão baseado em sandbox')
    }
  }

  // Se não houver URL customizada, usar lógica baseada em sandbox
  let isSandbox: boolean | null = null

  // PRIORIDADE: Banco de dados primeiro (configuração do admin tem prioridade)
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { key: 'PAGSEGURO_SANDBOX' }
    })

    if (config && config.value && config.value.trim().length > 0) {
      isSandbox = config.value.trim().toLowerCase() === 'true'
      console.log(`📦 PAGSEGURO_SANDBOX do banco de dados (PRIORIDADE): ${isSandbox}`)
      console.log(`   Valor encontrado: "${config.value}"`)
    } else {
      console.log('⚠️ PAGSEGURO_SANDBOX não encontrado no banco de dados ou está vazio')
    }
  } catch (dbError: any) {
    console.error('⚠️ Erro ao buscar PAGSEGURO_SANDBOX no banco de dados:', dbError.message)
  }

  // Se não encontrou no banco de dados, verificar variável de ambiente
  if (isSandbox === null) {
    const envSandbox = process.env.PAGSEGURO_SANDBOX
    if (envSandbox !== undefined && envSandbox.trim().length > 0) {
      isSandbox = envSandbox.trim().toLowerCase() === 'true'
      console.log(`📦 PAGSEGURO_SANDBOX da variável de ambiente: ${isSandbox}`)
    }
  }

  // Se ainda não foi definido, usar PRODUÇÃO por padrão (mudança para produção)
  if (isSandbox === null) {
    isSandbox = false // Padrão: PRODUÇÃO
    console.log(`📦 PAGSEGURO_SANDBOX padrão: ${isSandbox} (PRODUÇÃO)`)
  }

  const baseUrl = isSandbox
    ? 'https://sandbox.api.pagseguro.com'
    : 'https://api.pagseguro.com'

  console.log(`📦 Usando PagSeguro ${isSandbox ? 'SANDBOX' : 'PRODUÇÃO'}: ${baseUrl}`)
  console.log(`   isSandbox: ${isSandbox}, NODE_ENV: ${process.env.NODE_ENV}`)
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
  let key: string = ''
  let apiUrl: string = ''

  try {
    key = await getPagSeguroKey()
    apiUrl = await getPagSeguroApiUrl()

    // Converter valor de reais para centavos
    const valueInCents = Math.round(data.amount * 100)

    // Obter email do vendedor (se configurado)
    const sellerEmail = await getPagSeguroSellerEmail()

    // Preparar dados do cliente
    // O PagSeguro exige que customer.email seja obrigatório e diferente do email do vendedor
    const customerData: any = {
      name: data.customer.name,
      tax_id: data.customer.tax_id.replace(/\D/g, '') // Remover formatação do CPF/CNPJ
    }

    // Validar e usar email do cliente
    if (!data.customer.email || data.customer.email.trim().length === 0) {
      throw new Error('Email do cliente é obrigatório para pagamentos via PagSeguro')
    }

    const customerEmail = data.customer.email.trim()

    // Verificar se o email do cliente é diferente do email do vendedor
    if (sellerEmail && customerEmail.toLowerCase() === sellerEmail.toLowerCase()) {
      throw new Error('O email do cliente não pode ser igual ao email do vendedor. Por favor, use um email diferente.')
    }

    customerData.email = customerEmail

    // O endpoint /orders é o correto para PIX com qr_codes (conforme documentação oficial)
    // Estrutura: orders com items e qr_codes (sem payment_method)
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
      qr_codes: [
        {
          amount: {
            value: valueInCents,
            currency: 'BRL'
          },
          expiration_date: new Date(Date.now() + 30 * 60 * 1000).toISOString()
        }
      ]
    }

    // Criar pedido via /orders (método correto para PIX)
    // Conforme documentação oficial do PagSeguro:
    // Authorization: Bearer [TOKEN] (apenas o token, sem email)
    // App-Token: [TOKEN]
    // X-Seller-Email: [EMAIL] (opcional, mas recomendado)
    const headers: any = {
      'Authorization': `Bearer ${key}`,
      'App-Token': key,
      'Content-Type': 'application/json'
    }

    // Adicionar email do vendedor se configurado (recomendado pela documentação)
    if (sellerEmail) {
      headers['X-Seller-Email'] = sellerEmail
    }

    // ============================================
    // LOG COMPLETO DO REQUEST - PRODUÇÃO
    // ============================================
    console.log('='.repeat(80))
    console.log('📤 REQUEST COMPLETO - PagSeguro API PRODUÇÃO')
    console.log('='.repeat(80))
    console.log('📡 Método: POST')
    console.log('📡 URL:', `${apiUrl}/orders`)
    console.log('🌐 Ambiente:', apiUrl.includes('sandbox') ? 'SANDBOX' : 'PRODUÇÃO')
    console.log('📋 Headers Completos:')
    console.log(JSON.stringify(headers, null, 2))
    console.log('📦 Body (Request Payload) Completo:')
    console.log(JSON.stringify(orderData, null, 2))
    console.log('='.repeat(80))

    const orderResponse = await axios.post(`${apiUrl}/orders`, orderData, {
      headers,
      timeout: PAGSEGURO_HTTP_TIMEOUT_MS,
      validateStatus: () => true
    })

    if (orderResponse.status >= 400) {
      const httpErr: any = new Error(`PagSeguro POST /orders HTTP ${orderResponse.status}`)
      httpErr.response = { status: orderResponse.status, data: orderResponse.data }
      throw httpErr
    }

    // ============================================
    // LOG COMPLETO DO RESPONSE - PRODUÇÃO
    // ============================================
    console.log('='.repeat(80))
    console.log('📥 RESPONSE COMPLETO - PagSeguro API PRODUÇÃO')
    console.log('='.repeat(80))
    console.log('📊 Status Code:', orderResponse.status)
    console.log('🌐 Ambiente:', apiUrl.includes('sandbox') ? 'SANDBOX' : 'PRODUÇÃO')
    console.log('📋 Headers da Resposta:')
    console.log(JSON.stringify(orderResponse.headers, null, 2))
    console.log('📦 Body (Response Payload) Completo:')
    console.log(JSON.stringify(orderResponse.data, null, 2))
    console.log('='.repeat(80))

    console.log('✅ Pedido PIX criado no PagSeguro:', orderResponse.data.id)

    let orderData_response = orderResponse.data

    const orderId = orderData_response.id
    const chargeId = orderData_response.charges?.[0]?.id
    const paymentId = orderId || chargeId || ''

    let { qrCode, qrCodeImage, expiresAt } = extractPixPayload(orderData_response)

    if (!orderId) {
      throw new Error('Resposta do PagSeguro sem ID do pedido.')
    }

    if (!qrCode || qrCode.trim().length === 0) {
      const maxAttempts = 8
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        console.log(`🔄 PIX sem código na resposta inicial — consultando pedido (${attempt}/${maxAttempts})…`)
        await sleep(1200)
        try {
          const pollHeaders: any = {
            Authorization: `Bearer ${key}`,
            'App-Token': key
          }
          if (sellerEmail) pollHeaders['X-Seller-Email'] = sellerEmail
          const poll = await axios.get(`${apiUrl}/orders/${orderId}`, {
            headers: pollHeaders,
            timeout: PAGSEGURO_HTTP_TIMEOUT_MS
          })
          orderData_response = poll.data
          const extracted = extractPixPayload(orderData_response)
          qrCode = extracted.qrCode
          qrCodeImage = extracted.qrCodeImage
          expiresAt = extracted.expiresAt
          if (qrCode && qrCode.trim().length > 0) break
        } catch (pollErr: any) {
          console.warn('⚠️ GET /orders/:id:', pollErr.response?.data || pollErr.message)
        }
      }
    }

    if (!qrCode || qrCode.trim().length === 0) {
      throw new Error(
        'PagSeguro não devolveu o código PIX. Confira token, sandbox/produção (PAGSEGURO_SANDBOX) e o painel do PagBank.'
      )
    }

    console.log('📋 IDs extraídos da resposta:')
    console.log('   Order ID:', orderId)
    console.log('   Charge ID:', chargeId)
    console.log('   ID que será salvo:', paymentId)

    return {
      id: paymentId,
      qrCode: qrCode || '',
      qrCodeImage: qrCodeImage || null,
      expiresAt: expiresAt
    }
  } catch (error: any) {
    const errorData = error.response?.data || error.message

    // ============================================
    // LOG COMPLETO DO ERRO - PRODUÇÃO
    // ============================================
    console.error('='.repeat(80))
    console.error('❌ ERRO - PagSeguro API PRODUÇÃO')
    console.error('='.repeat(80))
    console.error('📡 URL da Requisição:', `${apiUrl}/orders`)
    console.error('📡 Método: POST')
    console.error('🌐 Ambiente:', apiUrl.includes('sandbox') ? 'SANDBOX' : 'PRODUÇÃO')

    if (error.config) {
      console.error('📋 Headers Enviados (Request):')
      console.error(JSON.stringify(error.config.headers, null, 2))
      console.error('📦 Body Enviado (Request Payload):')
      try {
        const requestData = typeof error.config.data === 'string' ? JSON.parse(error.config.data) : error.config.data
        console.error(JSON.stringify(requestData, null, 2))
      } catch (e) {
        console.error(error.config.data)
      }
    }

    if (error.response) {
      console.error('📊 Status Code da Resposta:', error.response.status)
      console.error('📋 Headers da Resposta:')
      console.error(JSON.stringify(error.response.headers, null, 2))
      console.error('📦 Body da Resposta (Response Payload) Completo:')
      console.error(JSON.stringify(error.response.data, null, 2))
    } else {
      console.error('❌ Erro de Rede ou Timeout')
      console.error('📝 Mensagem:', error.message)
      console.error('📝 Código:', error.code)
    }
    console.error('='.repeat(80))

    // Verificar se é erro de rede/API fora do ar
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND' || error.code === 'ECONNABORTED' ||
      error.message?.includes('timeout') || error.message?.includes('ECONNREFUSED') ||
      error.response?.status === 503 || error.response?.status === 502 || error.response?.status === 504) {
      const networkError = new Error('A API do PagSeguro está temporariamente indisponível. O serviço pode estar fora do ar ou em manutenção. Tente novamente em alguns minutos.')
      networkError.name = 'PagSeguroServiceUnavailableError'
      throw networkError
    }

    // Verificar se é erro de autenticação
    if (error.response?.status === 401 || error.response?.status === 403) {
      const errorMessage = errorData?.error_messages?.[0]?.description || errorData?.message || 'Token inválido'
      const errorCode = errorData?.error_messages?.[0]?.code || 'UNKNOWN'

      console.error('❌ ERRO DE AUTENTICAÇÃO: O token do PagSeguro está inválido ou expirado!')
      console.error('   Código do erro:', errorCode)
      console.error('   Mensagem do PagSeguro:', errorMessage)
      console.error('   URL usada:', apiUrl || 'não disponível')
      console.error('   Token (primeiros 20 caracteres):', key ? key.substring(0, 20) + '...' : 'não disponível')
      console.error('   ⚠️ IMPORTANTE: Verifique se:')
      console.error('      1. O token é válido para o ambiente SANDBOX (não use token de produção)')
      console.error('      2. O token foi gerado no painel do PagSeguro sandbox')
      console.error('      3. A conta tem permissão para usar a API no sandbox')
      console.error('      4. O token não está expirado')

      let detailedMessage = `Token do PagSeguro inválido: ${errorMessage}`
      if (errorCode === 'UNAUTHORIZED') {
        detailedMessage += '\n\nPossíveis causas:'
        detailedMessage += '\n- Token não é válido para o ambiente sandbox'
        detailedMessage += '\n- Token foi gerado para produção, mas está sendo usado no sandbox'
        detailedMessage += '\n- Token está expirado ou foi revogado'
        detailedMessage += '\n- Conta não tem permissão para usar a API no sandbox'
        detailedMessage += '\n\nSolução: Gere um novo token no painel do PagSeguro SANDBOX e configure no admin.'
      }

      const authError = new Error(detailedMessage)
      authError.name = 'PagSeguroAuthenticationError'
      throw authError
    }

    throw error
  }
}

// Buscar status de um pagamento (pode ser Order ID ou Charge ID)
export async function getPagSeguroPayment(paymentId: string) {
  try {
    const key = await getPagSeguroKey()
    const apiUrl = await getPagSeguroApiUrl()

    console.log('🔍 [getPagSeguroPayment] Buscando pagamento:', paymentId)

    // Detectar se é Order ID (formatos: ORD-, ORDE_, ORDER_)
    const isOrderId = paymentId.startsWith('ORD-') ||
      paymentId.startsWith('ORDE_') ||
      paymentId.startsWith('ORDER_') ||
      paymentId.toUpperCase().includes('ORDER')

    // Detectar se é Charge ID (formato: CHG-, CHAR_)
    const isChargeId = paymentId.startsWith('CHG-') ||
      paymentId.startsWith('CHAR_') ||
      paymentId.toUpperCase().includes('CHARGE')

    console.log('🔍 [getPagSeguroPayment] Tipo detectado:', { isOrderId, isChargeId })

    // Tentar buscar como Order primeiro se for identificado como Order
    if (isOrderId && !isChargeId) {
      try {
        console.log('📦 [getPagSeguroPayment] Tentando buscar como Order...')
        const response = await axios.get(
          `${apiUrl}/orders/${paymentId}`,
          {
            headers: {
              'Authorization': `Bearer ${key}`,
              'App-Token': key
            }
          }
        )
        console.log('✅ [getPagSeguroPayment] Order encontrada!')
        return response.data
      } catch (orderError: any) {
        console.warn('⚠️ [getPagSeguroPayment] Falha ao buscar como Order:', orderError.response?.data || orderError.message)
        // Se falhar com 404, tentar como Charge
        if (orderError.response?.status !== 404 && orderError.response?.status !== 400) {
          throw orderError
        }
        console.log('🔄 [getPagSeguroPayment] Tentando como Charge...')
      }
    }

    // Tentar buscar como Charge
    try {
      console.log('📦 [getPagSeguroPayment] Tentando buscar como Charge...')
      const response = await axios.get(
        `${apiUrl}/charges/${paymentId}`,
        {
          headers: {
            'Authorization': `Bearer ${key}`,
            'App-Token': key
          }
        }
      )
      console.log('✅ [getPagSeguroPayment] Charge encontrada!')
      return response.data
    } catch (chargeError: any) {
      console.error('❌ [getPagSeguroPayment] Falha ao buscar como Charge:', chargeError.response?.data || chargeError.message)

      // Se já tentamos Order e Charge e ambos falharam, lançar erro
      if (isOrderId) {
        throw new Error(`Pagamento não encontrado no PagSeguro (ID: ${paymentId}). Tentado como Order e Charge.`)
      }

      throw chargeError
    }
  } catch (error: any) {
    console.error('❌ [getPagSeguroPayment] Erro ao buscar pagamento no PagSeguro:', error.response?.data || error.message)
    throw error
  }
}

// Buscar QR code PIX de um pagamento existente
export async function getPagSeguroPixQrCode(chargeId: string) {
  try {
    const key = await getPagSeguroKey()
    const apiUrl = await getPagSeguroApiUrl()

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

// Interface para pagamento com cartão (usando criptografia do PagBank SDK)
interface CreateCardPaymentData {
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
  amount: number // Valor em reais
  description: string
  encryptedCard: string // Cartão criptografado via PagBank SDK (PagSeguro.encryptCard)
  holderName: string // Nome do titular do cartão
  installments?: number // Número de parcelas (1 = à vista)
}

// Criar pagamento com cartão de crédito no PagSeguro
// Usa cartão criptografado conforme documentação oficial:
// https://dev.pagbank.uol.com.br/reference/criar-pagar-pedido-com-cartao
export async function createPagSeguroCardPayment(data: CreateCardPaymentData) {
  let key: string = ''
  let apiUrl: string = ''

  try {
    key = await getPagSeguroKey()
    apiUrl = await getPagSeguroApiUrl()

    // Converter valor de reais para centavos
    const valueInCents = Math.round(data.amount * 100)

    // Obter email do vendedor (se configurado)
    const sellerEmail = await getPagSeguroSellerEmail()

    // Preparar dados do cliente
    const customerTaxId = data.customer.tax_id.replace(/\D/g, '') // Remover formatação do CPF/CNPJ
    const customerData: any = {
      name: data.customer.name,
      email: data.customer.email.trim(),
      tax_id: customerTaxId
    }

    // Validar email do cliente
    if (!data.customer.email || data.customer.email.trim().length === 0) {
      throw new Error('Email do cliente é obrigatório para pagamentos via cartão')
    }

    // Verificar se o email do cliente é diferente do email do vendedor
    if (sellerEmail && data.customer.email.trim().toLowerCase() === sellerEmail.toLowerCase()) {
      throw new Error('O email do cliente não pode ser igual ao email do vendedor.')
    }

    // Validar dados obrigatórios
    if (!data.encryptedCard || data.encryptedCard.trim().length === 0) {
      throw new Error('Cartão criptografado é obrigatório. Use o SDK do PagBank para criptografar os dados do cartão.')
    }

    if (!data.holderName || data.holderName.trim().length === 0) {
      throw new Error('Nome do titular do cartão é obrigatório.')
    }

    // Estrutura para pagamento via cartão usando /orders
    // Conforme documentação oficial do PagBank:
    // - card.encrypted: string criptografada pelo SDK
    // - card.store: false (não armazenar cartão)
    // - holder: no nível payment_method (fora de card)
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
            type: 'CREDIT_CARD',
            installments: data.installments || 1,
            capture: true, // Captura imediata
            card: {
              encrypted: data.encryptedCard,
              store: false
            },
            holder: {
              name: data.holderName.toUpperCase(),
              tax_id: customerTaxId
            }
          }
        }
      ]
    }

    // Headers para a requisição
    const headers: any = {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    }

    // Adicionar email do vendedor se configurado
    if (sellerEmail) {
      headers['X-Seller-Email'] = sellerEmail
    }

    // ============================================
    // LOG DO REQUEST - CARTÃO (criptografado)
    // ============================================
    console.log('='.repeat(80))
    console.log('📤 REQUEST - PagSeguro CARTÃO (criptografado)')
    console.log('='.repeat(80))
    console.log('📡 Método: POST')
    console.log('📡 URL:', `${apiUrl}/orders`)
    console.log('🌐 Ambiente:', apiUrl.includes('sandbox') ? 'SANDBOX' : 'PRODUÇÃO')
    console.log('📋 Headers:')
    console.log(JSON.stringify({ ...headers, 'Authorization': 'Bearer ***' }, null, 2))
    // Log seguro - mostrar apenas parte do encrypted
    const safeOrderData = {
      ...orderData,
      charges: [
        {
          ...orderData.charges[0],
          payment_method: {
            ...orderData.charges[0].payment_method,
            card: {
              encrypted: `${data.encryptedCard.substring(0, 30)}...`,
              store: false
            }
          }
        }
      ]
    }
    console.log('📦 Body (encrypted reduzido para log):')
    console.log(JSON.stringify(safeOrderData, null, 2))
    console.log('='.repeat(80))

    const response = await axios.post(
      `${apiUrl}/orders`,
      orderData,
      { headers }
    )

    // ============================================
    // LOG DO RESPONSE - CARTÃO
    // ============================================
    console.log('='.repeat(80))
    console.log('📥 RESPONSE - PagSeguro CARTÃO')
    console.log('='.repeat(80))
    console.log('📊 Status Code:', response.status)
    console.log('📦 Response:')
    console.log(JSON.stringify(response.data, null, 2))
    console.log('='.repeat(80))

    const orderResponse = response.data

    // Extrair dados da charge dentro do order
    const charge = orderResponse.charges?.[0] || orderResponse.charge || orderResponse

    // Verificar status do pagamento
    const paymentStatus = charge.status || orderResponse.status
    const chargeId = charge.id || orderResponse.id
    const orderId = orderResponse.id

    // Verificar payment_response para erros detalhados
    const paymentResponse = charge.payment_response
    if (paymentResponse) {
      console.log('💳 Payment Response:', JSON.stringify(paymentResponse, null, 2))
      if (paymentResponse.code && paymentResponse.code !== '20000') {
        console.warn('⚠️ Payment Response Code:', paymentResponse.code, '-', paymentResponse.message)
      }
    }

    console.log('✅ Pedido via cartão criado:', orderId)
    console.log('✅ Charge ID:', chargeId)
    console.log('📊 Status:', paymentStatus)

    // Determinar se foi pago com base no status E no payment_response
    const isPaid = paymentStatus === 'PAID' || paymentStatus === 'AUTHORIZED' ||
      (paymentResponse?.code === '20000')

    return {
      id: chargeId || orderId,
      orderId: orderId,
      status: paymentStatus,
      paid: isPaid,
      message: paymentResponse?.message || getCardPaymentStatusMessage(paymentStatus),
      paymentMethod: charge.payment_method,
      paymentResponse: paymentResponse,
      createdAt: charge.created_at || orderResponse.created_at
    }
  } catch (error: any) {
    const errorData = error.response?.data || error.message

    // ============================================
    // LOG DO ERRO - CARTÃO
    // ============================================
    console.error('='.repeat(80))
    console.error('❌ ERRO - PagSeguro CARTÃO')
    console.error('='.repeat(80))
    console.error('📡 URL:', `${apiUrl}/orders`)
    console.error('🌐 Ambiente:', apiUrl.includes('sandbox') ? 'SANDBOX' : 'PRODUÇÃO')

    if (error.response) {
      console.error('📊 Status Code:', error.response.status)
      console.error('📦 Response:')
      console.error(JSON.stringify(error.response.data, null, 2))
    } else {
      console.error('❌ Erro de Rede:', error.message)
    }
    console.error('='.repeat(80))

    // Verificar se é erro de rede/API fora do ar
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND' || error.code === 'ECONNABORTED' ||
      error.message?.includes('timeout') || error.message?.includes('ECONNREFUSED') ||
      error.response?.status === 503 || error.response?.status === 502 || error.response?.status === 504) {
      const networkError = new Error('A API do PagSeguro está temporariamente indisponível. Tente novamente em alguns minutos.')
      networkError.name = 'PagSeguroServiceUnavailableError'
      throw networkError
    }

    // Verificar se é erro de autenticação
    if (error.response?.status === 401 || error.response?.status === 403) {
      const authError = new Error('Token do PagSeguro inválido ou expirado.')
      authError.name = 'PagSeguroAuthenticationError'
      throw authError
    }

    // Erros específicos do cartão (400, 422)
    if (error.response?.status === 400 || error.response?.status === 422) {
      const errorMessages = errorData?.error_messages || []
      const firstError = errorMessages[0]

      if (firstError) {
        const errorCode = firstError.code || ''
        const errorDescription = firstError.description || 'Erro ao processar pagamento'
        const cardError = new Error(mapCardErrorMessage(errorCode, errorDescription))
        cardError.name = 'PagSeguroCardError'
        throw cardError
      }

      // Verificar payment_response dentro de charges (cartão recusado)
      const charges = errorData?.charges || []
      const chargePaymentResponse = charges[0]?.payment_response
      if (chargePaymentResponse && chargePaymentResponse.code !== '20000') {
        const declineError = new Error(mapCardPaymentResponseMessage(chargePaymentResponse.code, chargePaymentResponse.message))
        declineError.name = 'PagSeguroCardError'
        throw declineError
      }
    }

    throw error
  }
}

// Mapear mensagens de erro do cartão para mensagens amigáveis
function mapCardErrorMessage(code: string, description: string): string {
  const errorMap: Record<string, string> = {
    'INVALID_CARD_NUMBER': 'Número do cartão inválido. Verifique e tente novamente.',
    'EXPIRED_CARD': 'Cartão expirado. Use outro cartão.',
    'INVALID_CVV': 'CVV inválido. Verifique o código de segurança.',
    'INSUFFICIENT_FUNDS': 'Saldo insuficiente. Use outro cartão ou forma de pagamento.',
    'CARD_DECLINED': 'Cartão recusado. Entre em contato com o banco emissor.',
    'INVALID_EXPIRATION_DATE': 'Data de validade inválida.',
    'CARD_BLOCKED': 'Cartão bloqueado. Entre em contato com o banco emissor.',
    'CARD_NOT_SUPPORTED': 'Bandeira do cartão não suportada.',
    'FRAUD_DETECTED': 'Transação não autorizada por medidas de segurança.',
    'INVALID_HOLDER_NAME': 'Nome do titular inválido.',
    'INVALID_PARAMETER': description || 'Parâmetro inválido na requisição.',
    '40001': 'Dados do cartão inválidos. Verifique os dados e tente novamente.',
    '40002': 'Dados do cartão inválidos. Verifique os dados e tente novamente.'
  }

  return errorMap[code] || description || 'Erro ao processar o cartão. Tente novamente.'
}

// Mapear códigos de resposta de pagamento do PagBank
function mapCardPaymentResponseMessage(code: string, message: string): string {
  const responseMap: Record<string, string> = {
    '20000': 'Pagamento aprovado com sucesso!',
    '20001': 'Cartão recusado pelo emissor. Entre em contato com o banco.',
    '20002': 'Cartão recusado pelo emissor.',
    '20003': 'Cartão expirado.',
    '20004': 'Cartão restrito.',
    '20005': 'Cartão bloqueado.',
    '20006': 'Tempo limite excedido. Tente novamente.',
    '20007': 'Cartão com erro. Verifique os dados.',
    '20008': 'Número do cartão inválido.',
    '20009': 'CVV inválido.',
    '20010': 'Transação não permitida para este cartão.',
    '20011': 'Saldo insuficiente.',
    '20012': 'Valor da transação não permitido.',
    '20013': 'Parcelamento não permitido.',
    '20014': 'Número de parcelas inválido.',
    '20015': 'Transação não autorizada.',
    '20017': 'Transação suspeita de fraude.',
    '20018': 'Transação de teste. Use cartão de teste.',
    '20019': 'Tente novamente mais tarde.',
    '99999': 'Erro interno no PagBank. Tente novamente.'
  }

  return responseMap[code] || message || 'Erro ao processar o cartão. Tente novamente.'
}

// Obter mensagem de status do pagamento
function getCardPaymentStatusMessage(status: string): string {
  const statusMap: Record<string, string> = {
    'PAID': 'Pagamento aprovado com sucesso!',
    'AUTHORIZED': 'Pagamento autorizado com sucesso!',
    'DECLINED': 'Pagamento recusado. Tente outro cartão.',
    'CANCELED': 'Pagamento cancelado.',
    'IN_ANALYSIS': 'Pagamento em análise. Aguarde confirmação.',
    'WAITING': 'Aguardando processamento...'
  }

  return statusMap[status] || 'Processando pagamento...'
}
