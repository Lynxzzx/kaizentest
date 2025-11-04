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

  return res.json({
    asaas: {
      hasApiKey: !!asaasApiKey,
      apiKeyLength: asaasApiKey?.length || 0,
      apiKeyPrefix: asaasApiKey ? asaasApiKey.substring(0, 20) : 'NÃO CONFIGURADA',
      apiKeySuffix: asaasApiKey ? asaasApiKey.substring(asaasApiKey.length - 10) : 'NÃO CONFIGURADA',
      isProdKey: asaasApiKey?.startsWith('$aact_prod_') || false,
      isSandboxKey: asaasApiKey?.startsWith('$aact_hmlg_') || false,
      apiUrl: asaasApiUrl || 'NÃO CONFIGURADA'
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
    instructions: {
      step1: 'Acesse: https://vercel.com/dashboard',
      step2: 'Selecione seu projeto',
      step3: 'Vá em Settings (⚙️) > Environment Variables',
      step4: 'Procure por ASAAS_API_KEY ou clique em "Add New"',
      step5: 'Se existir: Verifique se está marcada para Production ✅',
      step6: 'Se não existir: Adicione ASAAS_API_KEY (nome EXATO)',
      step7: 'Cole sua chave completa do Asaas',
      step8: 'Marque TODOS os ambientes: Production, Preview, Development',
      step9: 'Clique em "Save"',
      step10: 'VÁ EM DEPLOYMENTS > Clique nos 3 pontos (⋯) > "Redeploy"',
      step11: 'AGUARDE o redeploy completar (1-2 minutos)',
      commonProblems: [
        'Variável não marcada para Production (mais comum)',
        'Não fez REDEPLOY após adicionar (só push não funciona)',
        'Nome da variável com espaços ou errado (deve ser exatamente: ASAAS_API_KEY)',
        'Chave incompleta (deve ter mais de 100 caracteres)'
      ]
    }
  })
}

