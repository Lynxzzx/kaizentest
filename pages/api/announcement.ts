import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'

/**
 * API pública para obter configurações do anúncio do site
 * GET: Retorna o anúncio ativo (sem autenticação necessária)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
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

    const isActive = configMap['ANNOUNCEMENT_ACTIVE'] === 'true'

    if (!isActive) {
      return res.json({ isActive: false })
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
      isActive,
      title: configMap['ANNOUNCEMENT_TITLE'] || 'Aviso Importante',
      message: configMap['ANNOUNCEMENT_MESSAGE'] || '',
      emoji: configMap['ANNOUNCEMENT_EMOJI'] || '📢',
      buttons,
    })
  } catch (error: any) {
    console.error('Error fetching announcement:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
