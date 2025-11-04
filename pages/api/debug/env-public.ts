import { NextApiRequest, NextApiResponse } from 'next'

// Endpoint PÚBLICO para verificar variáveis de ambiente (sem autenticação)
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const asaasApiKey = process.env.ASAAS_API_KEY
  const asaasApiUrl = process.env.ASAAS_API_URL
  
  // Listar todas as variáveis que contêm "ASAAS" ou "API"
  const allEnvKeys = Object.keys(process.env)
  const asaasRelatedVars = allEnvKeys.filter(k => k.toUpperCase().includes('ASAAS'))
  const apiRelatedVars = allEnvKeys.filter(k => k.toUpperCase().includes('API') && !k.toUpperCase().includes('ASAAS')).slice(0, 10)
  
  // Verificar se a variável existe mas está vazia
  const asaasKeyExists = 'ASAAS_API_KEY' in process.env
  const asaasKeyHasValue = !!asaasApiKey && asaasApiKey.trim().length > 0

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
      hasAsaasApiUrl: !!process.env.ASAAS_API_URL
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

