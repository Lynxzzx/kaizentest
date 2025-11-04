import axios from 'axios'

const ASAAS_API_KEY_ENV = process.env.ASAAS_API_KEY

if (!ASAAS_API_KEY_ENV) {
  console.error('❌ ERRO CRÍTICO: ASAAS_API_KEY não está configurada!')
  console.error('   Configure a variável de ambiente ASAAS_API_KEY no seu arquivo .env ou nas variáveis de ambiente do servidor.')
  console.error('   Exemplo: ASAAS_API_KEY=$aact_prod_...')
  throw new Error('ASAAS_API_KEY não está configurada. Verifique as variáveis de ambiente.')
}

// Remover espaços extras e garantir que a chave está completa
const ASAAS_API_KEY: string = ASAAS_API_KEY_ENV.trim()

// Log detalhado para debug
console.log('🔑 ASAAS_API_KEY carregada:', {
  hasKey: !!ASAAS_API_KEY,
  length: ASAAS_API_KEY.length,
  prefix: ASAAS_API_KEY.substring(0, 15),
  suffix: ASAAS_API_KEY.substring(ASAAS_API_KEY.length - 10),
  startsWithProd: ASAAS_API_KEY.startsWith('$aact_prod_'),
  startsWithSandbox: ASAAS_API_KEY.startsWith('$aact_hmlg_')
})

// Detectar ambiente baseado na chave de API
// A chave de produção deve usar URL de produção, chave de sandbox deve usar URL de sandbox
const isProdKey = ASAAS_API_KEY.startsWith('$aact_prod_')
const isSandboxKey = ASAAS_API_KEY.startsWith('$aact_hmlg_')

let ASAAS_API_URL: string
const envUrl = process.env.ASAAS_API_URL

// Se há URL no .env, verificar compatibilidade
if (envUrl) {
  const isProdUrl = envUrl.includes('api.asaas.com') && !envUrl.includes('sandbox')
  const isSandboxUrl = envUrl.includes('sandbox')
  
  // Verificar incompatibilidade
  if ((isProdKey && isSandboxUrl) || (isSandboxKey && isProdUrl)) {
    // Há incompatibilidade - corrigir automaticamente
    if (isProdKey) {
      ASAAS_API_URL = 'https://api.asaas.com/v3'
      console.warn('⚠️ AVISO: URL do .env é SANDBOX mas a chave é PRODUÇÃO!')
      console.warn('   Corrigindo automaticamente para:', ASAAS_API_URL)
    } else if (isSandboxKey) {
      ASAAS_API_URL = 'https://api-sandbox.asaas.com/v3'
      console.warn('⚠️ AVISO: URL do .env é PRODUÇÃO mas a chave é SANDBOX!')
      console.warn('   Corrigindo automaticamente para:', ASAAS_API_URL)
    } else {
      ASAAS_API_URL = envUrl
    }
  } else {
    // Compatível, usar do .env
    ASAAS_API_URL = envUrl
    console.log('📦 Usando ASAAS_API_URL do .env:', ASAAS_API_URL)
  }
} else {
  // Não há URL no .env, detectar pela chave
  if (isProdKey) {
    ASAAS_API_URL = 'https://api.asaas.com/v3'
    console.log('📦 Detectado: Chave de PRODUÇÃO - usando URL de produção')
  } else if (isSandboxKey) {
    ASAAS_API_URL = 'https://api-sandbox.asaas.com/v3'
    console.log('🧪 Detectado: Chave de SANDBOX - usando URL de sandbox')
  } else {
    // Não conseguiu detectar, usar sandbox por padrão
    ASAAS_API_URL = 'https://api-sandbox.asaas.com/v3'
    console.warn('⚠️ Não foi possível detectar o ambiente pela chave, usando SANDBOX por padrão')
  }
}

interface CreateCustomerData {
  name: string
  email?: string
  phone?: string
  cpfCnpj?: string
}

interface CreatePaymentData {
  customer: string
  billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD'
  value: number
  dueDate: string
  description: string
}

export async function createAsaasCustomer(data: CreateCustomerData) {
  try {
    console.log('Creating Asaas customer with data:', JSON.stringify(data, null, 2))
    console.log('Using API URL:', ASAAS_API_URL)
    console.log('API Key prefix:', ASAAS_API_KEY.substring(0, 15))
    console.log('API Key length:', ASAAS_API_KEY.length)
    console.log('API Key ends with:', ASAAS_API_KEY.substring(ASAAS_API_KEY.length - 10))
    
    // Verificar se a chave não está vazia ou truncada
    if (!ASAAS_API_KEY || ASAAS_API_KEY.length < 50) {
      console.error('❌ ERRO: Chave de API parece estar incompleta ou muito curta!')
      console.error('   Tamanho da chave:', ASAAS_API_KEY.length)
      console.error('   Chave deve ter pelo menos 50 caracteres')
      throw new Error('Chave de API do Asaas parece estar incompleta. Verifique se está configurada corretamente no Vercel.')
    }
    
    const response = await axios.post(
      `${ASAAS_API_URL}/customers`,
      data,
      {
        headers: {
          'access_token': ASAAS_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    )
    
    console.log('Asaas customer created:', response.data?.id)
    return response.data
  } catch (error: any) {
    const errorData = error.response?.data || error.message
    console.error('Asaas API Error (Create Customer):', JSON.stringify(errorData, null, 2))
    console.error('API URL used:', ASAAS_API_URL)
    console.error('API Key prefix:', ASAAS_API_KEY.substring(0, 15))
    console.error('API Key length:', ASAAS_API_KEY.length)
    
    // Verificar se é erro de autenticação
    if (error.response?.status === 401) {
      const errorMessage = errorData?.errors?.[0]?.description || errorData?.message || 'Chave de API inválida'
      console.error('❌ ERRO DE AUTENTICAÇÃO ao criar cliente: A chave de API do Asaas está inválida ou expirada!')
      console.error('   Mensagem do Asaas:', errorMessage)
      console.error('   Verifique:')
      console.error('   1. Se a chave está completa no Vercel (não apenas o prefixo)')
      console.error('   2. Se a chave está correta no painel do Asaas')
      console.error('   3. Se a chave não expirou ou foi revogada')
      console.error('   4. Se você está usando a chave correta (produção vs sandbox)')
      
      const authError = new Error(`Chave de API do Asaas inválida: ${errorMessage}. Verifique se a chave está completa e correta no Vercel.`)
      authError.name = 'AsaasAuthenticationError'
      throw authError
    }
    
    // Se o cliente já existe, tentar buscar pelo email
    if (error.response?.status === 400 && data.email) {
      try {
        const existingCustomer = await getAsaasCustomerByEmail(data.email)
        if (existingCustomer) {
          console.log('Found existing customer:', existingCustomer.id)
          return existingCustomer
        }
      } catch (searchError) {
        console.error('Error searching for existing customer:', searchError)
      }
    }
    
    throw error
  }
}

export async function getAsaasCustomerByEmail(email: string) {
  try {
    const response = await axios.get(
      `${ASAAS_API_URL}/customers?email=${encodeURIComponent(email)}`,
      {
        headers: {
          'access_token': ASAAS_API_KEY
        }
      }
    )
    
    if (response.data?.data && response.data.data.length > 0) {
      return response.data.data[0]
    }
    return null
  } catch (error: any) {
    console.error('Error searching customer by email:', error.response?.data || error.message)
    return null
  }
}

export async function getAsaasCustomer(customerId: string) {
  try {
    const response = await axios.get(
      `${ASAAS_API_URL}/customers/${customerId}`,
      {
        headers: {
          'access_token': ASAAS_API_KEY
        }
      }
    )
    return response.data
  } catch (error: any) {
    console.error('Asaas API Error (Get Customer):', error.response?.data || error.message)
    throw error
  }
}

export async function updateAsaasCustomer(customerId: string, data: Partial<CreateCustomerData>) {
  try {
    console.log('Updating Asaas customer:', customerId, 'with data:', JSON.stringify(data, null, 2))
    
    const response = await axios.put(
      `${ASAAS_API_URL}/customers/${customerId}`,
      data,
      {
        headers: {
          'access_token': ASAAS_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    )
    
    console.log('Asaas customer updated:', response.data?.id)
    return response.data
  } catch (error: any) {
    const errorData = error.response?.data || error.message
    console.error('Asaas API Error (Update Customer):', JSON.stringify(errorData, null, 2))
    
    // Verificar se é erro de autenticação
    if (error.response?.status === 401) {
      const errorMessage = errorData?.errors?.[0]?.description || errorData?.message || 'Chave de API inválida'
      console.error('❌ ERRO DE AUTENTICAÇÃO ao atualizar cliente: A chave de API do Asaas está inválida ou expirada!')
      console.error('   Mensagem do Asaas:', errorMessage)
    }
    
    throw error
  }
}

export async function createAsaasPayment(data: CreatePaymentData) {
  try {
    console.log('Creating Asaas payment with data:', JSON.stringify(data, null, 2))
    console.log('Using API URL:', ASAAS_API_URL)
    console.log('API Key prefix:', ASAAS_API_KEY.substring(0, 15))
    console.log('API Key length:', ASAAS_API_KEY.length)
    
    // Verificar se a chave não está vazia ou truncada
    if (!ASAAS_API_KEY || ASAAS_API_KEY.length < 50) {
      console.error('❌ ERRO: Chave de API parece estar incompleta ou muito curta!')
      console.error('   Tamanho da chave:', ASAAS_API_KEY.length)
      console.error('   Chave deve ter pelo menos 50 caracteres')
      throw new Error('Chave de API do Asaas parece estar incompleta. Verifique se está configurada corretamente no Vercel.')
    }
    
    const response = await axios.post(
      `${ASAAS_API_URL}/payments`,
      data,
      {
        headers: {
          'access_token': ASAAS_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    )
    
    console.log('Asaas payment created:', response.data?.id)
    console.log('Payment response:', JSON.stringify(response.data, null, 2))
    return response.data
  } catch (error: any) {
    const errorData = error.response?.data || error.message
    console.error('Asaas API Error (Create Payment):', JSON.stringify(errorData, null, 2))
    console.error('API URL used:', ASAAS_API_URL)
    console.error('API Key prefix:', ASAAS_API_KEY.substring(0, 15))
    console.error('API Key length:', ASAAS_API_KEY.length)
    
    // Verificar se é erro de autenticação
    if (error.response?.status === 401) {
      const errorMessage = errorData?.errors?.[0]?.description || errorData?.message || 'Chave de API inválida'
      console.error('❌ ERRO DE AUTENTICAÇÃO: A chave de API do Asaas está inválida ou expirada!')
      console.error('   Mensagem do Asaas:', errorMessage)
      console.error('   Verifique:')
      console.error('   1. Se a chave está completa no Vercel (não apenas o prefixo)')
      console.error('   2. Se a chave está correta no painel do Asaas')
      console.error('   3. Se a chave não expirou ou foi revogada')
      console.error('   4. Se você está usando a chave correta (produção vs sandbox)')
      
      // Lançar erro mais descritivo
      const authError = new Error(`Chave de API do Asaas inválida: ${errorMessage}. Verifique se a chave está completa e correta no Vercel.`)
      authError.name = 'AsaasAuthenticationError'
      throw authError
    }
    
    throw error
  }
}

export async function getAsaasPayment(paymentId: string) {
  try {
    const response = await axios.get(
      `${ASAAS_API_URL}/payments/${paymentId}`,
      {
        headers: {
          'access_token': ASAAS_API_KEY
        }
      }
    )
    return response.data
  } catch (error: any) {
    console.error('Asaas API Error (Get Payment):', error.response?.data || error.message)
    throw error
  }
}

export async function getAsaasPixQrCode(paymentId: string) {
  try {
    console.log('Getting PIX QR Code for payment:', paymentId)
    console.log('Using API URL:', ASAAS_API_URL)
    
    const response = await axios.get(
      `${ASAAS_API_URL}/payments/${paymentId}/pixQrCode`,
      {
        headers: {
          'access_token': ASAAS_API_KEY
        }
      }
    )
    
    console.log('PIX QR Code retrieved:', {
      hasQrCode: !!response.data?.payload,
      hasCopyPaste: !!response.data?.payload,
      hasEncodedImage: !!response.data?.encodedImage,
      encodedImageLength: response.data?.encodedImage?.length || 0,
      encodedImagePreview: response.data?.encodedImage?.substring(0, 50) || 'null'
    })
    
    // Garantir que encodedImage tenha o prefixo correto se necessário
    if (response.data?.encodedImage && !response.data.encodedImage.startsWith('data:')) {
      // Se não tem prefixo, assumir que é PNG base64
      response.data.encodedImage = `data:image/png;base64,${response.data.encodedImage}`
    }
    
    return response.data
  } catch (error: any) {
    const errorData = error.response?.data || error.message
    console.error('Asaas API Error (Get PIX QR Code):', JSON.stringify(errorData, null, 2))
    console.error('API URL used:', ASAAS_API_URL)
    throw error
  }
}
