import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'

// Endpoint para verificar a chave do Asaas
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  // Verificar autenticação - mas retornar informações úteis mesmo sem autenticação
  if (!session) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Você precisa estar logado para acessar este endpoint',
      loginUrl: '/login'
    })
  }

  if (session.user.role !== 'OWNER') {
    return res.status(403).json({ 
      error: 'Forbidden',
      message: 'Apenas OWNER pode acessar este endpoint',
      yourRole: session.user.role,
      requiredRole: 'OWNER'
    })
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const asaasApiKey = process.env.ASAAS_API_KEY
  const asaasApiUrl = process.env.ASAAS_API_URL

  // Informações detalhadas
  const info = {
    hasAsaasApiKey: !!asaasApiKey,
    asaasApiKeyLength: asaasApiKey?.length || 0,
    asaasApiKeyPrefix: asaasApiKey ? asaasApiKey.substring(0, 20) : 'NÃO CONFIGURADA',
    asaasApiKeySuffix: asaasApiKey ? asaasApiKey.substring(asaasApiKey.length - 10) : 'NÃO CONFIGURADA',
    asaasApiKeyStartsWithProd: asaasApiKey?.startsWith('$aact_prod_') || false,
    asaasApiKeyStartsWithSandbox: asaasApiKey?.startsWith('$aact_hmlg_') || false,
    asaasApiUrl: asaasApiUrl || 'NÃO CONFIGURADA',
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    allEnvVars: {
      // Mostrar apenas se algumas variáveis estão configuradas
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
      hasAsaasApiKey: !!process.env.ASAAS_API_KEY,
      hasAsaasApiUrl: !!process.env.ASAAS_API_URL,
    },
    instructions: {
      vercel: '1. Vá em Settings > Environment Variables no Vercel',
      check: '2. Verifique se ASAAS_API_KEY está configurada',
      environments: '3. Certifique-se de que está marcada para Production, Preview e Development',
      redeploy: '4. Após adicionar/alterar, faça um REDEPLOY',
      note: 'IMPORTANTE: O .env local NÃO é usado no Vercel. Você DEVE configurar no painel do Vercel.'
    }
  }

  return res.json(info)
}

