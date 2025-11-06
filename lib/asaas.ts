import axios from 'axios'
import { prisma } from '@/lib/prisma'

// Função para obter e validar a chave de API (tenta variável de ambiente primeiro, depois banco de dados)
async function getAsaasApiKey(): Promise<string> {
  // Log detalhado de debug ANTES de acessar process.env
  if (!(getAsaasApiKey as any).debugLogged) {
    console.log('🔍 DEBUG: Verificando variáveis de ambiente...')
    console.log('   NODE_ENV:', process.env.NODE_ENV)
    console.log('   VERCEL_ENV:', process.env.VERCEL_ENV)
    console.log('   VERCEL:', process.env.VERCEL)
    console.log('   Todas as variáveis que começam com ASAAS:', Object.keys(process.env).filter(k => k.includes('ASAAS')))
    ;(getAsaasApiKey as any).debugLogged = true
  }

  const ASAAS_API_KEY_ENV = process.env.ASAAS_API_KEY

  // Detectar se a variável existe mas está vazia (string vazia)
  const isStringEmpty = typeof ASAAS_API_KEY_ENV === 'string' && ASAAS_API_KEY_ENV.trim().length === 0
  const isUndefinedOrNull = ASAAS_API_KEY_ENV === undefined || ASAAS_API_KEY_ENV === null

  // Se não encontrar na variável de ambiente, tentar buscar no banco de dados
  if (isUndefinedOrNull || isStringEmpty) {
    console.log('⚠️ ASAAS_API_KEY não encontrada em variáveis de ambiente, tentando buscar no banco de dados...')
    try {
      const config = await prisma.systemConfig.findUnique({
        where: { key: 'ASAAS_API_KEY' }
      })
      
      if (config && config.value && config.value.trim().length > 0) {
        const dbKey = config.value.trim()
        console.log('✅ ASAAS_API_KEY encontrada no banco de dados!')
        console.log('   Tamanho:', dbKey.length, 'caracteres')
        console.log('   Prefixo:', dbKey.substring(0, 20))
        
        // Validar tamanho mínimo
        if (dbKey.length < 50) {
          throw new Error('Chave de API do banco de dados parece estar incompleta.')
        }
        
        return dbKey
      } else {
        console.log('⚠️ ASAAS_API_KEY não encontrada no banco de dados')
      }
    } catch (dbError: any) {
      console.error('⚠️ Erro ao buscar ASAAS_API_KEY no banco de dados:', dbError.message)
      // Continuar para mostrar erro da variável de ambiente
    }
    if (isStringEmpty) {
      console.error('❌ ERRO CRÍTICO: ASAAS_API_KEY existe mas está VAZIA (string vazia)!')
      console.error('   Isso significa que a variável foi criada no Vercel mas o valor não foi salvo corretamente.')
      console.error('   Tipo:', typeof ASAAS_API_KEY_ENV)
      console.error('   Valor:', JSON.stringify(ASAAS_API_KEY_ENV))
      console.error('   Tamanho:', ASAAS_API_KEY_ENV?.length || 0)
    } else {
      console.error('❌ ERRO CRÍTICO: ASAAS_API_KEY não está configurada!')
      console.error('   process.env.ASAAS_API_KEY:', typeof ASAAS_API_KEY_ENV, ASAAS_API_KEY_ENV)
    }
    console.error('   Todas as variáveis de ambiente disponíveis:', Object.keys(process.env).length, 'variáveis')
    console.error('   Variáveis que contêm "ASAAS":', Object.keys(process.env).filter(k => k.toUpperCase().includes('ASAAS')))
    console.error('   Variáveis que contêm "API":', Object.keys(process.env).filter(k => k.toUpperCase().includes('API')).slice(0, 10))
    console.error('')
    if (isStringEmpty) {
      console.error('   ⚠️ SOLUÇÃO PARA VARIÁVEL VAZIA:')
      console.error('   1. Acesse: https://vercel.com/dashboard')
      console.error('   2. Selecione seu projeto')
      console.error('   3. Vá em Settings (⚙️) > Environment Variables')
      console.error('   4. DELETE a variável ASAAS_API_KEY (clique no ícone de lixeira 🗑️)')
      console.error('   5. Clique em "Add New" para criar NOVAMENTE')
      console.error('   6. Nome: ASAAS_API_KEY (EXATAMENTE assim, maiúsculas, SEM espaços)')
      console.error('   7. Valor: Cole sua chave COMPLETA do Asaas')
      console.error('      - Copie a chave do painel do Asaas')
      console.error('      - Deve começar com $aact_prod_... ou $aact_hmlg_...')
      console.error('      - Deve ter mais de 100 caracteres')
      console.error('      - NÃO adicione espaços ou quebras de linha')
      console.error('      - Cole usando Ctrl+V (não Shift+Insert)')
      console.error('   8. IMPORTANTE: Marque TODOS os ambientes:')
      console.error('      ✅ Production (obrigatório!)')
      console.error('      ✅ Preview')  
      console.error('      ✅ Development')
      console.error('   9. Verifique se o valor aparece no campo antes de salvar')
      console.error('   10. Clique em "Save"')
      console.error('   11. VÁ EM DEPLOYMENTS > Clique nos 3 pontos (⋯) do último deployment > "Redeploy"')
      console.error('   12. AGUARDE o redeploy completar (pode levar 1-2 minutos)')
      console.error('')
      console.error('   ⚠️ DICA: Se persistir, tente usar o Vercel CLI:')
      console.error('      vercel env add ASAAS_API_KEY production')
      console.error('      (Cole a chave quando solicitado)')
    } else {
      console.error('   ⚠️ INSTRUÇÕES DETALHADAS PARA CONFIGURAR NO VERCEL:')
      console.error('   1. Acesse: https://vercel.com/dashboard')
      console.error('   2. Selecione seu projeto')
      console.error('   3. Vá em Settings (⚙️) > Environment Variables')
      console.error('   4. Clique em "Add New"')
      console.error('   5. Nome: ASAAS_API_KEY (EXATAMENTE assim, maiúsculas)')
      console.error('   6. Valor: Cole sua chave completa do Asaas (começa com $aact_prod_...)')
      console.error('   7. IMPORTANTE: Marque TODOS os ambientes:')
      console.error('      ✅ Production')
      console.error('      ✅ Preview')  
      console.error('      ✅ Development')
      console.error('   8. Clique em "Save"')
      console.error('   9. VÁ EM DEPLOYMENTS > Clique nos 3 pontos (⋯) do último deployment > "Redeploy"')
      console.error('   10. AGUARDE o redeploy completar (pode levar 1-2 minutos)')
    }
    console.error('')
    console.error('   ⚠️ PROBLEMAS COMUNS:')
    console.error('   - Variável configurada mas não marcada para Production')
    console.error('   - Não fez REDEPLOY após adicionar (só push não funciona)')
    console.error('   - Nome da variável com espaços ou errado (deve ser exatamente: ASAAS_API_KEY)')
    console.error('   - Chave incompleta (deve ter mais de 100 caracteres)')
    console.error('   - Variável salva vazia (delete e crie novamente)')
    throw new Error(isStringEmpty 
      ? 'ASAAS_API_KEY existe mas está VAZIA! Delete e crie novamente no Vercel com o valor correto.'
      : 'ASAAS_API_KEY não está configurada no servidor. Verifique no Vercel: Settings > Environment Variables (certifique-se de marcar Production e fazer REDEPLOY).')
  }

  // Remover espaços extras e garantir que a chave está completa
  const ASAAS_API_KEY = ASAAS_API_KEY_ENV.trim()

  // Validar tamanho mínimo
  if (ASAAS_API_KEY.length < 50) {
    console.error('❌ ERRO: Chave de API parece estar incompleta!')
    console.error('   Tamanho da chave:', ASAAS_API_KEY.length)
    console.error('   Chave deve ter pelo menos 50 caracteres')
    console.error('   Prefixo da chave:', ASAAS_API_KEY.substring(0, 20))
    throw new Error('Chave de API do Asaas parece estar incompleta. Verifique se copiou a chave completa do painel do Asaas.')
  }

  // Log detalhado para debug (apenas na primeira chamada)
  if (!(getAsaasApiKey as any).logged) {
    console.log('✅ ASAAS_API_KEY carregada com sucesso!')
    console.log('   Tamanho:', ASAAS_API_KEY.length, 'caracteres')
    console.log('   Prefixo:', ASAAS_API_KEY.substring(0, 20))
    console.log('   Sufixo:', ASAAS_API_KEY.substring(ASAAS_API_KEY.length - 10))
    console.log('   É produção?', ASAAS_API_KEY.startsWith('$aact_prod_'))
    console.log('   É sandbox?', ASAAS_API_KEY.startsWith('$aact_hmlg_'))
    ;(getAsaasApiKey as any).logged = true
  }

  return ASAAS_API_KEY
}

// Função para obter a URL da API baseada na chave
async function getAsaasApiUrl(): Promise<string> {
  try {
    const ASAAS_API_KEY = await getAsaasApiKey()
    
    // Detectar ambiente baseado na chave de API
    const isProdKey = ASAAS_API_KEY.startsWith('$aact_prod_')
    const isSandboxKey = ASAAS_API_KEY.startsWith('$aact_hmlg_')
    
    const envUrl = process.env.ASAAS_API_URL

    // Se há URL no .env, verificar compatibilidade
    if (envUrl) {
      const isProdUrl = envUrl.includes('api.asaas.com') && !envUrl.includes('sandbox')
      const isSandboxUrl = envUrl.includes('sandbox')
      
      // Verificar incompatibilidade
      if ((isProdKey && isSandboxUrl) || (isSandboxKey && isProdUrl)) {
        // Há incompatibilidade - corrigir automaticamente
        if (isProdKey) {
          console.warn('⚠️ AVISO: URL do .env é SANDBOX mas a chave é PRODUÇÃO!')
          console.warn('   Corrigindo automaticamente para: https://api.asaas.com/v3')
          return 'https://api.asaas.com/v3'
        } else if (isSandboxKey) {
          console.warn('⚠️ AVISO: URL do .env é PRODUÇÃO mas a chave é SANDBOX!')
          console.warn('   Corrigindo automaticamente para: https://api-sandbox.asaas.com/v3')
          return 'https://api-sandbox.asaas.com/v3'
        } else {
          return envUrl
        }
      } else {
        // Compatível, usar do .env
        console.log('📦 Usando ASAAS_API_URL do .env:', envUrl)
        return envUrl
      }
    } else {
      // Não há URL no .env, detectar pela chave
      if (isProdKey) {
        console.log('📦 Detectado: Chave de PRODUÇÃO - usando URL de produção')
        return 'https://api.asaas.com/v3'
      } else if (isSandboxKey) {
        console.log('🧪 Detectado: Chave de SANDBOX - usando URL de sandbox')
        return 'https://api-sandbox.asaas.com/v3'
      } else {
        // Não conseguiu detectar, usar sandbox por padrão
        console.warn('⚠️ Não foi possível detectar o ambiente pela chave, usando SANDBOX por padrão')
        return 'https://api-sandbox.asaas.com/v3'
      }
    }
  } catch (error) {
    // Se não conseguir obter a chave, usar produção por padrão
    console.warn('⚠️ Não foi possível detectar o ambiente, usando PRODUÇÃO por padrão')
    return 'https://api.asaas.com/v3'
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
    const ASAAS_API_KEY = await getAsaasApiKey()
    const ASAAS_API_URL = await getAsaasApiUrl()
    
    console.log('Creating Asaas customer with data:', JSON.stringify(data, null, 2))
    console.log('Using API URL:', ASAAS_API_URL)
    console.log('API Key prefix:', ASAAS_API_KEY.substring(0, 15))
    console.log('API Key length:', ASAAS_API_KEY.length)
    console.log('API Key ends with:', ASAAS_API_KEY.substring(ASAAS_API_KEY.length - 10))
    
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
    
    try {
      const ASAAS_API_KEY = await getAsaasApiKey()
      const ASAAS_API_URL = await getAsaasApiUrl()
      console.error('API URL used:', ASAAS_API_URL)
      console.error('API Key prefix:', ASAAS_API_KEY.substring(0, 15))
      console.error('API Key length:', ASAAS_API_KEY.length)
    } catch (keyError) {
      console.error('Não foi possível obter informações da chave:', keyError)
    }
    
    // Verificar se é erro de rede/API fora do ar
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND' || 
        error.message?.includes('timeout') || error.message?.includes('ECONNREFUSED') ||
        error.response?.status === 503 || error.response?.status === 502 || error.response?.status === 504) {
      const networkError = new Error('A API do Asaas está temporariamente indisponível. O serviço pode estar fora do ar ou em manutenção. Tente novamente em alguns minutos.')
      networkError.name = 'AsaasServiceUnavailableError'
      console.error('❌ ERRO DE REDE/SERVIÇO: A API do Asaas não está respondendo!')
      console.error('   Código:', error.code)
      console.error('   Status:', error.response?.status)
      console.error('   Mensagem:', error.message)
      console.error('   Isso pode acontecer quando:')
      console.error('   1. O serviço do Asaas está fora do ar')
      console.error('   2. O sandbox está instável (use produção se possível)')
      console.error('   3. Problemas de rede temporários')
      throw networkError
    }
    
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
    const ASAAS_API_KEY = await getAsaasApiKey()
    const ASAAS_API_URL = await getAsaasApiUrl()
    
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
    const ASAAS_API_KEY = await getAsaasApiKey()
    const ASAAS_API_URL = await getAsaasApiUrl()
    
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
    const ASAAS_API_KEY = await getAsaasApiKey()
    const ASAAS_API_URL = await getAsaasApiUrl()
    
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
    const ASAAS_API_KEY = await getAsaasApiKey()
    const ASAAS_API_URL = await getAsaasApiUrl()
    
    console.log('Creating Asaas payment with data:', JSON.stringify(data, null, 2))
    console.log('Using API URL:', ASAAS_API_URL)
    console.log('API Key prefix:', ASAAS_API_KEY.substring(0, 15))
    console.log('API Key length:', ASAAS_API_KEY.length)
    
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
    
    try {
      const ASAAS_API_KEY = await getAsaasApiKey()
      const ASAAS_API_URL = await getAsaasApiUrl()
      console.error('API URL used:', ASAAS_API_URL)
      console.error('API Key prefix:', ASAAS_API_KEY.substring(0, 15))
      console.error('API Key length:', ASAAS_API_KEY.length)
    } catch (keyError) {
      console.error('Não foi possível obter informações da chave:', keyError)
    }
    
    // Verificar se é erro de rede/API fora do ar
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND' || 
        error.message?.includes('timeout') || error.message?.includes('ECONNREFUSED') ||
        error.response?.status === 503 || error.response?.status === 502 || error.response?.status === 504) {
      const networkError = new Error('A API do Asaas está temporariamente indisponível. O serviço pode estar fora do ar ou em manutenção. Tente novamente em alguns minutos.')
      networkError.name = 'AsaasServiceUnavailableError'
      console.error('❌ ERRO DE REDE/SERVIÇO: A API do Asaas não está respondendo!')
      console.error('   Código:', error.code)
      console.error('   Status:', error.response?.status)
      console.error('   Mensagem:', error.message)
      console.error('   Isso pode acontecer quando:')
      console.error('   1. O serviço do Asaas está fora do ar')
      console.error('   2. O sandbox está instável (use produção se possível)')
      console.error('   3. Problemas de rede temporários')
      throw networkError
    }
    
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
    const ASAAS_API_KEY = await getAsaasApiKey()
    const ASAAS_API_URL = await getAsaasApiUrl()
    
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
    const ASAAS_API_KEY = await getAsaasApiKey()
    const ASAAS_API_URL = await getAsaasApiUrl()
    
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
    
    try {
      const ASAAS_API_URL = await getAsaasApiUrl()
      console.error('API URL used:', ASAAS_API_URL)
    } catch (keyError) {
      console.error('Não foi possível obter informações da URL:', keyError)
    }
    
    throw error
  }
}
