import { NextApiRequest, NextApiResponse } from 'next'

// Endpoint PÚBLICO para verificar variáveis de ambiente (sem autenticação)
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Tentar múltiplas formas de acessar a variável
  const asaasApiKey1 = process.env.ASAAS_API_KEY
  const asaasApiKey2 = process.env['ASAAS_API_KEY']
  const asaasApiKey3 = (process.env as any).ASAAS_API_KEY
  const asaasApiKey = asaasApiKey1 || asaasApiKey2 || asaasApiKey3
  
  const asaasApiUrl = process.env.ASAAS_API_URL
  
  // Listar todas as variáveis que contêm "ASAAS" ou "API"
  const allEnvKeys = Object.keys(process.env)
  const asaasRelatedVars = allEnvKeys.filter(k => k.toUpperCase().includes('ASAAS'))
  const apiRelatedVars = allEnvKeys.filter(k => k.toUpperCase().includes('API') && !k.toUpperCase().includes('ASAAS')).slice(0, 10)
  
  // Verificar se a variável existe mas está vazia
  const asaasKeyExists = 'ASAAS_API_KEY' in process.env
  const asaasKeyHasValue = !!asaasApiKey && asaasApiKey.trim().length > 0
  
  // Debug detalhado: tentar acessar o valor de diferentes formas
  const debugAccess = {
    directAccess: process.env.ASAAS_API_KEY,
    bracketAccess: process.env['ASAAS_API_KEY'],
    anyAccess: (process.env as any).ASAAS_API_KEY,
    typeDirect: typeof process.env.ASAAS_API_KEY,
    typeBracket: typeof process.env['ASAAS_API_KEY'],
    valueDirect: process.env.ASAAS_API_KEY === undefined ? 'undefined' : process.env.ASAAS_API_KEY === '' ? 'empty string' : 'has value',
    valueBracket: process.env['ASAAS_API_KEY'] === undefined ? 'undefined' : process.env['ASAAS_API_KEY'] === '' ? 'empty string' : 'has value',
    // Tentar acessar via Object.getOwnPropertyDescriptor
    descriptor: Object.getOwnPropertyDescriptor(process.env, 'ASAAS_API_KEY'),
    // Verificar se está na lista de chaves
    inKeys: allEnvKeys.includes('ASAAS_API_KEY'),
    // Verificar se há variações do nome (com espaços, etc)
    keyVariations: allEnvKeys.filter(k => k.toUpperCase().replace(/[^A-Z0-9_]/g, '') === 'ASAAS_API_KEY')
  }

  return res.json({
    asaas: {
      hasApiKey: asaasKeyHasValue,
      keyExists: asaasKeyExists,
      keyHasValue: asaasKeyHasValue,
      apiKeyLength: asaasApiKey?.length || 0,
      apiKeyPrefix: asaasApiKey ? asaasApiKey.substring(0, 20) : 'NÃO CONFIGURADA',
      apiKeySuffix: asaasApiKey ? asaasApiKey.substring(asaasApiKey.length - 10) : 'NÃO CONFIGURADA',
      isProdKey: asaasApiKey?.startsWith('$aact_prod_') || false,
      isSandboxKey: asaasApiKey?.startsWith('$aact_hmlg_') || false,
      apiUrl: asaasApiUrl || 'NÃO CONFIGURADA',
      problem: !asaasKeyExists 
        ? 'A variável ASAAS_API_KEY não existe no Vercel'
        : !asaasKeyHasValue
        ? '⚠️ A variável ASAAS_API_KEY existe mas está VAZIA! Edite no Vercel e adicione o valor da chave.'
        : null
    },
    environment: {
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV,
      vercel: process.env.VERCEL,
      totalEnvVars: allEnvKeys.length
    },
    debug: {
      asaasRelatedVars: asaasRelatedVars,
      apiRelatedVars: apiRelatedVars,
      hasAsaasApiKey: !!process.env.ASAAS_API_KEY,
      hasAsaasApiUrl: !!process.env.ASAAS_API_URL,
      accessMethods: debugAccess,
      // Tentar acessar o valor bruto
      rawValue: process.env.ASAAS_API_KEY,
      rawValueType: typeof process.env.ASAAS_API_KEY,
      rawValueLength: process.env.ASAAS_API_KEY?.length || 0,
      // Verificar se há problema com caracteres especiais
      firstChar: process.env.ASAAS_API_KEY?.[0] || 'N/A',
      firstCharCode: process.env.ASAAS_API_KEY?.[0]?.charCodeAt(0) || 'N/A',
      // Verificar todas as variáveis ASAAS
      allAsaasVars: Object.fromEntries(
        asaasRelatedVars.map(key => [key, {
          exists: key in process.env,
          hasValue: !!(process.env as any)[key],
          valueType: typeof (process.env as any)[key],
          valueLength: ((process.env as any)[key]?.length || 0),
          valuePreview: (process.env as any)[key] ? String((process.env as any)[key]).substring(0, 20) : 'N/A'
        }])
      )
    },
    instructions: !asaasKeyExists ? {
      step1: 'Acesse: https://vercel.com/dashboard',
      step2: 'Selecione seu projeto',
      step3: 'Vá em Settings (⚙️) > Environment Variables',
      step4: 'Clique em "Add New"',
      step5: 'Nome: ASAAS_API_KEY (exatamente assim)',
      step6: 'Valor: Cole sua chave completa do Asaas (começa com $aact_prod_...)',
      step7: 'Marque TODOS: Production, Preview, Development',
      step8: 'Clique em "Save"',
      step9: 'VÁ EM DEPLOYMENTS > ⋯ > "Redeploy"',
      step10: 'AGUARDE o redeploy completar'
    } : !asaasKeyHasValue ? {
      step1: '⚠️ PROBLEMA ENCONTRADO: A variável ASAAS_API_KEY existe mas está VAZIA!',
      step2: 'Acesse: https://vercel.com/dashboard',
      step3: 'Selecione seu projeto',
      step4: 'Vá em Settings (⚙️) > Environment Variables',
      step5: 'Clique em ASAAS_API_KEY para EDITAR',
      step6: 'No campo "Value", cole sua chave completa do Asaas',
      step7: 'A chave deve começar com $aact_prod_... ou $aact_hmlg_...',
      step8: 'A chave deve ter mais de 100 caracteres',
      step9: 'Verifique se está marcada para Production ✅',
      step10: 'Clique em "Save"',
      step11: 'VÁ EM DEPLOYMENTS > ⋯ > "Redeploy"',
      step12: 'AGUARDE o redeploy completar'
    } : {
      step1: '✅ ASAAS_API_KEY está configurada corretamente!',
      step2: 'Se ainda houver problemas, verifique se a chave está correta no painel do Asaas'
    },
    commonProblems: [
      !asaasKeyExists ? 'Variável não existe no Vercel' : null,
      !asaasKeyHasValue ? 'Variável existe mas está VAZIA (mais comum neste caso)' : null,
      'Variável não marcada para Production',
      'Não fez REDEPLOY após adicionar/editar',
      'Nome da variável com espaços ou errado',
      'Chave incompleta (deve ter mais de 100 caracteres)'
    ].filter(Boolean)
  })
}

