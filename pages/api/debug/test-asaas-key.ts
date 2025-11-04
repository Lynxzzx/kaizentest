import { NextApiRequest, NextApiResponse } from 'next'

// Endpoint de teste para verificar ASAAS_API_KEY de forma mais agressiva
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Tentar TODAS as formas possíveis de acessar a variável
  const methods = {
    direct: process.env.ASAAS_API_KEY,
    bracket: process.env['ASAAS_API_KEY'],
    any: (process.env as any).ASAAS_API_KEY,
    // Tentar com diferentes variações do nome
    lowerCase: (process.env as any).asaas_api_key,
    mixedCase1: (process.env as any).Asaas_Api_Key,
    // Tentar acessar via Object.getOwnPropertyDescriptor
    descriptor: Object.getOwnPropertyDescriptor(process.env, 'ASAAS_API_KEY'),
    // Tentar acessar via Object.entries
    fromEntries: Object.fromEntries(Object.entries(process.env).filter(([k]) => k.toUpperCase() === 'ASAAS_API_KEY'))['ASAAS_API_KEY'],
    // Tentar acessar via Object.keys e depois buscar
    fromKeys: (() => {
      const key = Object.keys(process.env).find(k => k.toUpperCase() === 'ASAAS_API_KEY')
      return key ? (process.env as any)[key] : undefined
    })()
  }

  // Verificar todas as formas
  const allValues = Object.values(methods).filter(v => v !== undefined && v !== null && typeof v === 'string' && v.length > 0)
  const validValue = allValues[0] || null

  // Análise detalhada
  const analysis = {
    exists: 'ASAAS_API_KEY' in process.env,
    inKeys: Object.keys(process.env).includes('ASAAS_API_KEY'),
    hasValue: !!validValue && validValue.trim().length > 0,
    valueLength: validValue?.length || 0,
    valueType: typeof validValue,
    isEmpty: validValue === '' || (typeof validValue === 'string' && validValue.trim().length === 0),
    isUndefined: validValue === undefined,
    isNull: validValue === null,
    // Verificar se começa com $
    startsWithDollar: validValue?.startsWith('$') || false,
    // Verificar prefixo esperado
    hasProdPrefix: validValue?.startsWith('$aact_prod_') || false,
    hasSandboxPrefix: validValue?.startsWith('$aact_hmlg_') || false,
    // Verificar caracteres especiais
    firstChar: validValue?.[0] || 'N/A',
    firstCharCode: validValue?.[0]?.charCodeAt(0) || 'N/A',
    // Verificar se há espaços ou quebras de linha
    hasSpaces: validValue?.includes(' ') || false,
    hasNewlines: validValue?.includes('\n') || false,
    hasTabs: validValue?.includes('\t') || false,
    // Verificar se há caracteres invisíveis
    hasInvisibleChars: validValue ? /[\x00-\x1F\x7F-\x9F]/.test(validValue) : false,
    // Preview do valor
    preview: validValue ? validValue.substring(0, 50) : 'N/A',
    // Verificar todas as formas de acesso
    accessMethods: methods,
    // Verificar todas as variáveis que contêm "ASAAS"
    allAsaasVars: Object.keys(process.env).filter(k => k.toUpperCase().includes('ASAAS')).map(key => ({
      key,
      exists: key in process.env,
      hasValue: !!(process.env as any)[key],
      valueType: typeof (process.env as any)[key],
      valueLength: ((process.env as any)[key]?.length || 0),
      valuePreview: (process.env as any)[key] ? String((process.env as any)[key]).substring(0, 30) : 'N/A'
    }))
  }

  // Diagnóstico
  const diagnosis = {
    problem: !analysis.exists 
      ? 'A variável ASAAS_API_KEY não existe no process.env'
      : !analysis.hasValue
      ? 'A variável ASAAS_API_KEY existe mas está VAZIA'
      : !analysis.hasProdPrefix && !analysis.hasSandboxPrefix
      ? 'A variável existe mas não começa com $aact_prod_ ou $aact_hmlg_'
      : analysis.hasSpaces || analysis.hasNewlines || analysis.hasTabs
      ? 'A variável existe mas contém espaços, quebras de linha ou tabs'
      : analysis.valueLength < 50
      ? 'A variável existe mas parece estar incompleta (menos de 50 caracteres)'
      : '✅ A variável parece estar configurada corretamente!',
    recommendations: [
      !analysis.exists ? '1. Adicione ASAAS_API_KEY no Vercel: Settings > Environment Variables' : null,
      !analysis.hasValue ? '1. DELETE a variável ASAAS_API_KEY no Vercel' : null,
      !analysis.hasValue ? '2. Crie NOVAMENTE com o valor correto' : null,
      !analysis.hasValue || analysis.hasSpaces || analysis.hasNewlines ? '3. Certifique-se de copiar a chave COMPLETA sem espaços ou quebras de linha' : null,
      !analysis.hasValue ? '4. Marque TODOS os ambientes: Production, Preview, Development' : null,
      !analysis.hasValue ? '5. VÁ EM DEPLOYMENTS > ⋯ > Redeploy' : null,
      !analysis.hasValue ? '6. AGUARDE o redeploy completar (1-2 minutos)' : null,
      analysis.hasProdPrefix || analysis.hasSandboxPrefix ? '✅ A chave parece estar no formato correto!' : null
    ].filter(Boolean)
  }

  return res.json({
    status: analysis.hasValue && (analysis.hasProdPrefix || analysis.hasSandboxPrefix) ? 'OK' : 'ERROR',
    analysis,
    diagnosis,
    environment: {
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV,
      vercel: process.env.VERCEL,
      totalEnvVars: Object.keys(process.env).length
    },
    instructions: {
      ifEmpty: [
        '⚠️ PROBLEMA: A variável ASAAS_API_KEY está VAZIA!',
        '',
        'SOLUÇÃO:',
        '1. Acesse: https://vercel.com/dashboard',
        '2. Selecione seu projeto',
        '3. Vá em Settings (⚙️) > Environment Variables',
        '4. DELETE a variável ASAAS_API_KEY (ícone de lixeira 🗑️)',
        '5. Clique em "Add New"',
        '6. Nome: ASAAS_API_KEY (exatamente assim, maiúsculas)',
        '7. Valor: Cole esta chave completa:',
        '   $aact_prod_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OjMzMTJjOTkwLTZiMDgtNDUyZC05Y2M0LWU2ZGM0ZTcwYzQ1NDo6JGFhY2hfYjBmZDVkOWMtNDJlZC00ZmEwLWE4ZTYtNTFlMWE4NWJlMWNh',
        '8. IMPORTANTE: Marque TODOS: Production ✅, Preview ✅, Development ✅',
        '9. Verifique se o valor aparece no campo antes de salvar',
        '10. Clique em "Save"',
        '11. VÁ EM DEPLOYMENTS > ⋯ > Redeploy',
        '12. AGUARDE o redeploy completar (1-2 minutos)',
        '',
        '⚠️ DICA: Se persistir, use o Vercel CLI:',
        '   npm i -g vercel',
        '   vercel login',
        '   vercel env add ASAAS_API_KEY production',
        '   (Cole a chave quando solicitado)'
      ],
      ifNotExists: [
        '1. Acesse: https://vercel.com/dashboard',
        '2. Selecione seu projeto',
        '3. Vá em Settings > Environment Variables',
        '4. Clique em "Add New"',
        '5. Nome: ASAAS_API_KEY',
        '6. Valor: Cole sua chave do Asaas',
        '7. Marque TODOS: Production, Preview, Development',
        '8. Clique em "Save"',
        '9. VÁ EM DEPLOYMENTS > ⋯ > Redeploy',
        '10. AGUARDE o redeploy completar'
      ]
    }
  })
}

