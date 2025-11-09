import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

/**
 * API para atualizar configurações do sistema (como ASAAS_API_KEY)
 * Apenas admins podem atualizar
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Verificar autenticação
    const session = await getServerSession(req, res, authOptions)
    if (!session || !session.user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Verificar se é admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!user || (user.role !== 'ADMIN' && user.role !== 'OWNER')) {
      return res.status(403).json({ error: 'Forbidden - Admin only' })
    }

    const { key, value, description } = req.body

    if (!key || !value) {
      return res.status(400).json({ error: 'Key and value are required' })
    }

    // Validar chave específica (ASAAS_API_KEY)
    if (key === 'ASAAS_API_KEY') {
      const trimmedValue = value.trim()
      if (trimmedValue.length < 50) {
        return res.status(400).json({ error: 'ASAAS_API_KEY deve ter pelo menos 50 caracteres' })
      }
      if (!trimmedValue.startsWith('$aact_prod_') && !trimmedValue.startsWith('$aact_hmlg_')) {
        return res.status(400).json({ error: 'ASAAS_API_KEY deve começar com $aact_prod_ ou $aact_hmlg_' })
      }
    }

    // Validar chaves do PagSeguro
    if (key === 'PAGSEGURO_APP_KEY' || key === 'PAGSEGURO_TOKEN') {
      const trimmedValue = value.trim()
      if (trimmedValue.length < 20) {
        return res.status(400).json({ error: `${key} deve ter pelo menos 20 caracteres` })
      }
    }

    // Validar PAGSEGURO_API_URL (deve ser uma URL válida)
    if (key === 'PAGSEGURO_API_URL') {
      const trimmedValue = value.trim()
      try {
        const url = new URL(trimmedValue)
        // Validar se é HTTP ou HTTPS
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          return res.status(400).json({ error: 'PAGSEGURO_API_URL deve usar protocolo http:// ou https://' })
        }
        // Validar se é um domínio do PagSeguro (opcional, mas recomendado)
        if (!url.hostname.includes('pagseguro.com') && !url.hostname.includes('pagseguro.uol.com.br')) {
          console.warn('⚠️ URL do PagSeguro não parece ser um domínio oficial:', url.hostname)
        }
      } catch (error) {
        return res.status(400).json({ error: 'PAGSEGURO_API_URL deve ser uma URL válida (ex: https://api.pagseguro.com)' })
      }
    }

    // Validar PAGSEGURO_SANDBOX (deve ser "true" ou "false")
    if (key === 'PAGSEGURO_SANDBOX') {
      const trimmedValue = value.trim().toLowerCase()
      if (trimmedValue !== 'true' && trimmedValue !== 'false') {
        return res.status(400).json({ error: 'PAGSEGURO_SANDBOX deve ser "true" ou "false"' })
      }
    }

    // Criar ou atualizar configuração
    const config = await prisma.systemConfig.upsert({
      where: { key },
      update: {
        value: value.trim(),
        description: description || null,
        updatedById: user.id
      },
      create: {
        key,
        value: value.trim(),
        description: description || null,
        updatedById: user.id
      }
    })

    return res.json({ 
      success: true, 
      config: {
        id: config.id,
        key: config.key,
        description: config.description,
        updatedAt: config.updatedAt
        // Não retornar o valor por segurança
      }
    })
  } catch (error: any) {
    console.error('Error updating config:', error)
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    })
  }
}

