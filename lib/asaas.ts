import axios from 'axios'

const ASAAS_API_KEY_ENV = process.env.ASAAS_API_KEY

if (!ASAAS_API_KEY_ENV) {
  console.error('❌ ERRO CRÍTICO: ASAAS_API_KEY não está configurada!')
  console.error('   Configure a variável de ambiente ASAAS_API_KEY no seu arquivo .env ou nas variáveis de ambiente do servidor.')
  console.error('   Exemplo: ASAAS_API_KEY=$aact_prod_...')
  throw new Error('ASAAS_API_KEY não está configurada. Verifique as variáveis de ambiente.')
}

// Após a verificação, garantir que não é undefined
const ASAAS_API_KEY: string = ASAAS_API_KEY_ENV

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
    
    // Verificar se é erro de autenticação
    if (error.response?.status === 401) {
      const errorMessage = errorData?.errors?.[0]?.description || errorData?.message || 'Chave de API inválida'
      console.error('❌ ERRO DE AUTENTICAÇÃO: A chave de API do Asaas está inválida ou expirada!')
      console.error('   Verifique se a chave está correta no painel do Asaas e se está configurada corretamente nas variáveis de ambiente.')
      console.error('   Mensagem do Asaas:', errorMessage)
      
      // Lançar erro mais descritivo
      const authError = new Error(`Chave de API do Asaas inválida: ${errorMessage}. Verifique a configuração da variável ASAAS_API_KEY.`)
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
