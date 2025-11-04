import { NextApiRequest, NextApiResponse } from 'next'
import { readFileSync } from 'fs'
import { join } from 'path'

// Endpoint para verificar o arquivo .env diretamente
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Tentar ler o arquivo .env
    const envPath = join(process.cwd(), '.env')
    let envFileContent = ''
    let envFileExists = false
    
    try {
      envFileContent = readFileSync(envPath, 'utf-8')
      envFileExists = true
    } catch (error: any) {
      envFileExists = false
      console.error('Erro ao ler .env:', error.message)
    }

    // Analisar o conteúdo do arquivo
    const envLines = envFileExists ? envFileContent.split('\n') : []
    const asaasKeyLine = envLines.find(line => line.trim().startsWith('ASAAS_API_KEY') && !line.trim().startsWith('#'))
    
    // Verificar o que está no process.env
    const processEnvValue = process.env.ASAAS_API_KEY
    const processEnvType = typeof processEnvValue
    const processEnvLength = processEnvValue?.length || 0

    // Verificar se há problema com o caractere $
    const hasDollarIssue = asaasKeyLine && !asaasKeyLine.includes('$') && processEnvValue?.startsWith('$')

    return res.json({
      envFile: {
        exists: envFileExists,
        path: envPath,
        totalLines: envLines.length,
        asaasKeyLine: asaasKeyLine || 'NÃO ENCONTRADA',
        asaasKeyLineLength: asaasKeyLine?.length || 0,
        asaasKeyLinePreview: asaasKeyLine ? asaasKeyLine.substring(0, 50) : 'N/A',
        // Verificar se a linha começa com ASAAS_API_KEY
        hasAsaasKeyLine: !!asaasKeyLine,
        // Verificar se há problema com formato
        hasQuotes: asaasKeyLine?.includes('"') || false,
        startsWithDollar: asaasKeyLine?.includes('$aact_prod_') || false,
        // Mostrar todas as linhas que contêm ASAAS
        allAsaasLines: envLines.filter(line => line.toUpperCase().includes('ASAAS'))
      },
      processEnv: {
        value: processEnvValue || 'NÃO DEFINIDA',
        type: processEnvType,
        length: processEnvLength,
        isEmpty: processEnvValue === '' || (typeof processEnvValue === 'string' && processEnvValue.trim().length === 0),
        isUndefined: processEnvValue === undefined,
        isNull: processEnvValue === null,
        startsWithDollar: processEnvValue?.startsWith('$') || false,
        preview: processEnvValue ? processEnvValue.substring(0, 30) : 'N/A'
      },
      comparison: {
        fileHasValue: !!asaasKeyLine && asaasKeyLine.includes('=') && asaasKeyLine.split('=')[1]?.trim().length > 0,
        processEnvHasValue: !!processEnvValue && processEnvValue.trim().length > 0,
        match: !!asaasKeyLine && !!processEnvValue && asaasKeyLine.includes(processEnvValue),
        fileValueLength: asaasKeyLine ? (asaasKeyLine.split('=')[1]?.trim().length || 0) : 0,
        processEnvValueLength: processEnvValue?.length || 0
      },
      diagnosis: {
        problem: !envFileExists
          ? 'Arquivo .env não existe na raiz do projeto'
          : !asaasKeyLine
          ? 'Linha ASAAS_API_KEY não encontrada no arquivo .env'
          : !asaasKeyLine.includes('=')
          ? 'Linha ASAAS_API_KEY não tem o formato correto (deve ser: ASAAS_API_KEY=valor)'
          : !asaasKeyLine.split('=')[1]?.trim()
          ? 'Linha ASAAS_API_KEY existe mas o valor está vazio'
          : !processEnvValue || processEnvValue.trim().length === 0
          ? 'Arquivo .env tem a chave mas process.env.ASAAS_API_KEY está vazia - pode ser problema com caractere $ ou formato'
          : '✅ Arquivo .env e process.env parecem estar corretos',
        recommendations: [
          !envFileExists ? '1. Crie um arquivo .env na raiz do projeto' : null,
          !asaasKeyLine ? '1. Adicione a linha ASAAS_API_KEY=... no arquivo .env' : null,
          !asaasKeyLine || !asaasKeyLine.includes('=') ? '1. Formato correto: ASAAS_API_KEY=$aact_prod_...' : null,
          !asaasKeyLine || !asaasKeyLine.split('=')[1]?.trim() ? '1. Adicione o valor da chave após o =' : null,
          (!processEnvValue || processEnvValue.trim().length === 0) && asaasKeyLine ? [
            '1. O problema pode ser o caractere $ no início da chave',
            '2. Tente colocar a chave entre aspas: ASAAS_API_KEY="$aact_prod_..."',
            '3. Ou tente escapar o $: ASAAS_API_KEY=\\$aact_prod_...',
            '4. Reinicie o servidor após alterar o .env: npm run dev'
          ] : null,
          processEnvValue && processEnvValue.trim().length > 0 ? '✅ Tudo parece estar correto!' : null
        ].filter(Boolean).flat()
      },
      instructions: {
        ifNoFile: [
          '1. Crie um arquivo .env na raiz do projeto',
          '2. Adicione: ASAAS_API_KEY=$aact_prod_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OjMzMTJjOTkwLTZiMDgtNDUyZC05Y2M0LWU2ZGM0ZTcwYzQ1NDo6JGFhY2hfYjBmZDVkOWMtNDJlZC00ZmEwLWE4ZTYtNTFlMWE4NWJlMWNh',
          '3. Reinicie o servidor: npm run dev'
        ],
        ifFileButNoValue: [
          '1. Verifique se a linha ASAAS_API_KEY=... está no arquivo .env',
          '2. Tente colocar a chave entre aspas:',
          '   ASAAS_API_KEY="$aact_prod_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OjMzMTJjOTkwLTZiMDgtNDUyZC05Y2M0LWU2ZGM0ZTcwYzQ1NDo6JGFhY2hfYjBmZDVkOWMtNDJlZC00ZmEwLWE4ZTYtNTFlMWE4NWJlMWNh"',
          '3. Reinicie o servidor: npm run dev'
        ]
      }
    })
  } catch (error: any) {
    return res.status(500).json({
      error: 'Erro ao verificar arquivo .env',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
}

