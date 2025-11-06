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

