// Função utilitária para enviar webhooks do Discord

export async function sendDiscordWebhook(webhookUrl: string, message: {
  content?: string
  embeds?: Array<{
    author?: {
      name: string
      icon_url?: string
    }
    title?: string
    url?: string
    description?: string
    color?: number
    fields?: Array<{
      name: string
      value: string
      inline?: boolean
    }>
    thumbnail?: {
      url: string
    }
    image?: {
      url: string
    }
    footer?: {
      text: string
      icon_url?: string
    }
    timestamp?: string
  }>
}) {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    })

    if (!response.ok) {
      console.error('Discord webhook error:', await response.text())
    }

    return response.ok
  } catch (error) {
    console.error('Error sending Discord webhook:', error)
    return false
  }
}

export async function sendStockRestockNotification(
  webhookUrl: string,
  serviceName: string,
  quantity: number,
  siteUrl: string = 'https://kaizengen.shop'
) {
  const message = {
    content: '@everyone',
    embeds: [
      {
        author: {
          name: '🚀 KAIZEN GENS — Alerta de Estoque',
          icon_url: 'https://kaizengen.shop/favicon.ico',
        },
        title: '🔥 ESTOQUE REABASTECIDO!',
        url: siteUrl,
        description:
          `> O serviço **${serviceName}** acabou de ser reabastecido!\n> Garanta o seu antes que acabe! ⚡`,
        color: 0xFFD700, // Dourado premium
        fields: [
          {
            name: '🛍️ Serviço',
            value: `\`\`${serviceName}\`\``,
            inline: true,
          },
          {
            name: '📦 Contas Adicionadas',
            value: `**${quantity}** conta(s)`,
            inline: true,
          },
          {
            name: '\u200B',
            value: '\u200B',
            inline: false,
          },
          {
            name: '⚡ Ação Rápida',
            value: `[👉 **Acessar o site agora**](${siteUrl})`,
            inline: false,
          },
          {
            name: '⏳ Disponibilidade',
            value: '🟢 Disponível agora — estoque limitado!',
            inline: false,
          },
        ],
        thumbnail: {
          url: 'https://em-content.zobj.net/source/twitter/376/package_1f4e6.png',
        },
        image: {
          url: 'https://kaizengen.shop/estoque.jpg',
        },
        footer: {
          text: '🏷️ Kaizen Gens — Gerador de Contas Premium  •  kaizengen.shop',
          icon_url: 'https://kaizengen.shop/favicon.ico',
        },
        timestamp: new Date().toISOString(),
      },
    ],
  }

  return sendDiscordWebhook(webhookUrl, message)
}