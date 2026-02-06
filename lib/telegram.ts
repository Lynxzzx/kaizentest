import axios from 'axios'
import { prisma } from '@/lib/prisma'

async function getTelegramBotToken(): Promise<string | null> {
  const envToken = process.env.TELEGRAM_BOT_TOKEN
  if (envToken && envToken.trim().length > 0) {
    return envToken.trim()
  }
  try {
    const cfg = await prisma.systemConfig.findUnique({
      where: { key: 'TELEGRAM_BOT_TOKEN' }
    })
    const value = cfg?.value?.trim()
    return value && value.length > 0 ? value : null
  } catch {
    return null
  }
}

async function getTelegramChatId(): Promise<string | null> {
  const envChat = process.env.TELEGRAM_CHAT_ID
  if (envChat && envChat.trim().length > 0) {
    return envChat.trim()
  }
  try {
    const cfg = await prisma.systemConfig.findUnique({
      where: { key: 'TELEGRAM_CHAT_ID' }
    })
    const value = cfg?.value?.trim()
    return value && value.length > 0 ? value : null
  } catch {
    return null
  }
}

export async function sendTelegramMessage(text: string, overrides?: { token?: string; chatId?: string }) {
  const token = overrides?.token || await getTelegramBotToken()
  const chatId = overrides?.chatId || await getTelegramChatId()
  if (!token || !chatId) {
    return { ok: false, error: 'Telegram not configured' }
  }
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`
    const payload = {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: false
    }
    const res = await axios.post(url, payload)
    return { ok: true, result: res.data }
  } catch (error: any) {
    // Não logar token ou chatId
    console.error('Error sending Telegram message:', error.response?.data || error.message)
    return { ok: false, error: error.response?.data || error.message }
  }
}

export async function sendStockRestockNotificationTelegram(
  serviceName: string,
  quantity: number,
  siteUrl: string = 'https://kaizengen.shop'
) {
  const text =
    [
      '🎉 <b>ESTOQUE REABASTECIDO!</b>',
      '',
      `🛍️ Serviço: <b>${escapeHtml(serviceName)}</b>`,
      `📊 Quantidade: <b>${quantity}</b> conta(s) adicionada(s)`,
      '',
      `🔗 <a href="${escapeHtml(siteUrl)}">Clique aqui para acessar o site</a>`,
      '',
      'Kaizen Gens — Sistema de Geração de Contas'
    ].join('\n')
  return sendTelegramMessage(text)
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
