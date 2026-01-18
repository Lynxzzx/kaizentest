// Função utilitária para enviar webhooks do Discord

export async function sendDiscordWebhook(webhookUrl: string, message: {
  content?: string
  embeds?: Array<{
    title?: string
    description?: string
    color?: number
    fields?: Array<{
      name: string
      value: string
      inline?: boolean
    }>
    footer?: {
      text: string
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
    content: '@everyone 🎉 **ESTOQUE REABASTECIDO!**',
    embeds: [
      {
        title: '📦 Novo Estoque Disponível',
        description: `O serviço **${serviceName}** foi reabastecido com sucesso!`,
        color: 0x00ff00, // Verde
        fields: [
          {
            name: '🛍️ Serviço',
            value: serviceName,
            inline: true,
          },
          {
            name: '📊 Quantidade',
            value: `${quantity} conta(s) adicionada(s)`,
            inline: true,
          },
          {
            name: '🔗 Acesse Agora',
            value: `[Clique aqui para acessar o site](${siteUrl})`,
            inline: false,
          },
        ],
        footer: {
          text: 'Kaizen Gens - Sistema de Geração de Contas',
        },
        timestamp: new Date().toISOString(),
      },
    ],
  }

  return sendDiscordWebhook(webhookUrl, message)
}