import axios from 'axios'
import { prisma } from '@/lib/prisma'

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
    ;(getPagSeguroKey as any).logged = true
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
  
  // Se ainda não foi definido, usar padrão baseado em NODE_ENV (apenas em desenvolvimento)
  if (isSandbox === null) {
    isSandbox = process.env.NODE_ENV === 'development'
    console.log(`📦 PAGSEGURO_SANDBOX padrão (NODE_ENV=${process.env.NODE_ENV}): ${isSandbox}`)
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
    // LOG COMPLETO DO REQUEST PARA HOMOLOGAÇÃO
    // ============================================
    console.log('='.repeat(80))
    console.log('📤 REQUEST COMPLETO - PagSeguro API (Para Homologação)')
    console.log('='.repeat(80))
    console.log('📡 Método: POST')
    console.log('📡 URL:', `${apiUrl}/orders`)
    console.log('📋 Headers Completos:')
    console.log(JSON.stringify(headers, null, 2))
    console.log('📦 Body (Request Payload) Completo:')
    console.log(JSON.stringify(orderData, null, 2))
    console.log('='.repeat(80))
    
    const orderResponse = await axios.post(
      `${apiUrl}/orders`,
      orderData,
      { headers }
    )

    // ============================================
    // LOG COMPLETO DO RESPONSE PARA HOMOLOGAÇÃO
    // ============================================
    console.log('='.repeat(80))
    console.log('📥 RESPONSE COMPLETO - PagSeguro API (Para Homologação)')
    console.log('='.repeat(80))
    console.log('📊 Status Code:', orderResponse.status)
    console.log('📋 Headers da Resposta:')
    console.log(JSON.stringify(orderResponse.headers, null, 2))
    console.log('📦 Body (Response Payload) Completo:')
    console.log(JSON.stringify(orderResponse.data, null, 2))
    console.log('='.repeat(80))
    
    console.log('✅ Pedido PIX criado no PagSeguro:', orderResponse.data.id)
    
    // Extrair dados do QR code da resposta
    const orderData_response = orderResponse.data
    const chargeId = orderData_response.charges?.[0]?.id || orderData_response.id
    
    // O QR code PIX deve vir na resposta do /orders dentro de qr_codes
    const qrCodeData = orderData_response.qr_codes?.[0] || 
                       orderData_response.charges?.[0]?.qr_codes?.[0] ||
                       orderData_response.charges?.[0]?.payment_method?.pix ||
                       orderData_response
    const qrCode = qrCodeData?.text ||
                   qrCodeData?.qr_code || 
                   qrCodeData?.qr_code_text || 
                   qrCodeData?.pix_copy_paste ||
                   orderData_response.qr_codes?.[0]?.text ||
                   orderData_response.qr_codes?.[0]?.qr_code ||
                   orderData_response.qr_codes?.[0]?.qr_code_text ||
                   orderData_response.qr_codes?.[0]?.pix_copy_paste ||
                   orderData_response.charges?.[0]?.qr_codes?.[0]?.text ||
                   orderData_response.charges?.[0]?.qr_codes?.[0]?.qr_code ||
                   orderData_response.charges?.[0]?.qr_codes?.[0]?.pix_copy_paste ||
                   ''

    const qrCodeImage = qrCodeData?.qr_code_image || 
                        qrCodeData?.qr_code_base64 ||
                        orderData_response.qr_codes?.[0]?.qr_code_image ||
                        orderData_response.qr_codes?.[0]?.qr_code_base64 ||
                        orderData_response.charges?.[0]?.qr_codes?.[0]?.qr_code_image ||
                        orderData_response.charges?.[0]?.qr_codes?.[0]?.qr_code_base64 ||
                        null

    const expiresAt = qrCodeData?.expiration_date ||
                      qrCodeData?.expires_at || 
                      orderData_response.qr_codes?.[0]?.expiration_date ||
                      orderData_response.qr_codes?.[0]?.expires_at ||
                      orderData_response.charges?.[0]?.qr_codes?.[0]?.expiration_date ||
                      orderData_response.charges?.[0]?.qr_codes?.[0]?.expires_at ||
                      new Date(Date.now() + 30 * 60 * 1000).toISOString()

    return {
      id: chargeId || orderResponse.data.id || '',
      qrCode: qrCode || '',
      qrCodeImage: qrCodeImage || null,
      expiresAt: expiresAt
    }
  } catch (error: any) {
    const errorData = error.response?.data || error.message
    
    // ============================================
    // LOG COMPLETO DO ERRO PARA HOMOLOGAÇÃO
    // ============================================
    console.error('='.repeat(80))
    console.error('❌ ERRO - PagSeguro API (Para Homologação)')
    console.error('='.repeat(80))
    console.error('📡 URL da Requisição:', `${apiUrl}/orders`)
    console.error('📡 Método: POST')
    
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

// Buscar status de um pagamento
export async function getPagSeguroPayment(chargeId: string) {
  try {
    const key = await getPagSeguroKey()
    const apiUrl = await getPagSeguroApiUrl()

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

