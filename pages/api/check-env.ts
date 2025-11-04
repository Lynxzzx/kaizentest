import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const dbUrl = process.env.DATABASE_URL || 'NOT_SET'
  const hasDbUrl = dbUrl !== 'NOT_SET'
  const isAtlas = dbUrl.includes('mongodb+srv://')
  const isLocalhost = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')
  
  // Verificar chave do Asaas
  const asaasApiKey = process.env.ASAAS_API_KEY || 'NOT_SET'
  const hasAsaasKey = asaasApiKey !== 'NOT_SET'
  const isProdKey = hasAsaasKey && asaasApiKey.startsWith('$aact_prod_')
  const isSandboxKey = hasAsaasKey && asaasApiKey.startsWith('$aact_hmlg_')
  const asaasApiUrl = process.env.ASAAS_API_URL || 'NOT_SET'
  
  // Debug adicional
  const nodeEnv = process.env.NODE_ENV
  const vercelEnv = process.env.VERCEL_ENV
  const allEnvVars = Object.keys(process.env)
  const asaasRelatedVars = allEnvVars.filter(k => k.toUpperCase().includes('ASAAS'))
  
  return res.json({
    hasDatabaseUrl: hasDbUrl,
    isAtlas: isAtlas,
    isLocalhost: isLocalhost,
    databaseUrlPreview: hasDbUrl 
      ? `${dbUrl.substring(0, 20)}...${dbUrl.substring(dbUrl.length - 10)}` 
      : 'NOT_SET',
    databaseMessage: isLocalhost 
      ? '⚠️ URL aponta para localhost. Você precisa configurar MongoDB Atlas ou ter MongoDB local rodando.'
      : isAtlas
      ? '✅ URL do MongoDB Atlas configurada'
      : '⚠️ DATABASE_URL não está configurada corretamente',
    asaas: {
      hasApiKey: hasAsaasKey,
      keyPrefix: hasAsaasKey ? asaasApiKey.substring(0, 20) : 'NOT_SET',
      keyLength: hasAsaasKey ? asaasApiKey.length : 0,
      isProdKey,
      isSandboxKey,
      apiUrl: asaasApiUrl,
      message: !hasAsaasKey
        ? '❌ ASAAS_API_KEY não está configurada! Configure no Vercel: Settings > Environment Variables'
        : isProdKey
        ? '✅ Chave de PRODUÇÃO detectada'
        : isSandboxKey
        ? '✅ Chave de SANDBOX detectada'
        : '⚠️ Formato da chave não reconhecido (deve começar com $aact_prod_ ou $aact_hmlg_)'
    },
    debug: {
      nodeEnv,
      vercelEnv,
      totalEnvVars: allEnvVars.length,
      asaasRelatedVars: asaasRelatedVars,
      hasAsaasApiKey: !!process.env.ASAAS_API_KEY,
      hasAsaasApiUrl: !!process.env.ASAAS_API_URL
    },
    instructions: {
      vercel: 'Para configurar no Vercel: Vá em Settings > Environment Variables e adicione ASAAS_API_KEY com sua chave do Asaas',
      local: 'Para desenvolvimento local: Adicione ASAAS_API_KEY no arquivo .env na raiz do projeto',
      redeploy: hasAsaasKey ? '⚠️ IMPORTANTE: Após alterar variáveis no Vercel, faça um redeploy para aplicar as mudanças!' : '⚠️ CRÍTICO: Configure ASAAS_API_KEY no Vercel e faça um REDEPLOY!'
    }
  })
}
