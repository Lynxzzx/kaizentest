import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

/**
 * API de gerenciamento de anúncio (apenas OWNER)
 * GET: Obter configuração atual
 * POST: Atualizar configuração
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getServerSession(req, res, authOptions)
    if (!session?.user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (!user || user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Forbidden - Owner only' })
    }

    if (req.method === 'GET') {
      const configs = await prisma.systemConfig.findMany({
        where: {
          key: {
            in: [
              'ANNOUNCEMENT_ACTIVE',
              'ANNOUNCEMENT_TITLE',
              'ANNOUNCEMENT_MESSAGE',
              'ANNOUNCEMENT_EMOJI',
              'ANNOUNCEMENT_BUTTONS',
            ]
          }
        }
      })

      const configMap: Record<string, string> = {}
      for (const c of configs) {
        configMap[c.key] = c.value
      }

      let buttons = {
        primary: { label: 'Acessar Canal', url: '' },
        secondary: { label: 'Continuar para o site' }
      }

      try {
        if (configMap['ANNOUNCEMENT_BUTTONS']) {
          buttons = JSON.parse(configMap['ANNOUNCEMENT_BUTTONS'])
        }
      } catch {
        // mantém os botões padrão
      }

      return res.json({
        isActive: configMap['ANNOUNCEMENT_ACTIVE'] === 'true',
        title: configMap['ANNOUNCEMENT_TITLE'] || 'Aviso Importante',
        message: configMap['ANNOUNCEMENT_MESSAGE'] || '',
        emoji: configMap['ANNOUNCEMENT_EMOJI'] || '📢',
        buttons,
      })
    }

    if (req.method === 'POST') {
      const { isActive, title, message, emoji, buttons } = req.body

      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ error: 'isActive deve ser um booleano' })
      }

      if (!title?.trim()) {
        return res.status(400).json({ error: 'Título é obrigatório' })
      }

      if (!message?.trim()) {
        return res.status(400).json({ error: 'Mensagem é obrigatória' })
      }

      const upsert = async (key: string, value: string, description: string) => {
        await prisma.systemConfig.upsert({
          where: { key },
          update: { value, updatedById: user.id },
          create: { key, value, description, updatedById: user.id },
        })
      }

      await upsert('ANNOUNCEMENT_ACTIVE', isActive ? 'true' : 'false', 'Se o modal de anúncio está ativo')
      await upsert('ANNOUNCEMENT_TITLE', title.trim(), 'Título do anúncio')
      await upsert('ANNOUNCEMENT_MESSAGE', message.trim(), 'Mensagem do anúncio')
      await upsert('ANNOUNCEMENT_EMOJI', (emoji || '📢').trim(), 'Emoji do anúncio')
      await upsert('ANNOUNCEMENT_BUTTONS', JSON.stringify(buttons || {
        primary: { label: 'Acessar Canal', url: '' },
        secondary: { label: 'Continuar para o site' }
      }), 'Botões do anúncio (JSON)')

      return res.json({ success: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error: any) {
    console.error('Error managing announcement:', error)
    return res.status(500).json({ error: 'Internal server error', details: error.message })
  }
}
