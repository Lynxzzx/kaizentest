/**
 * 🔐 CAPTCHA Visual - Sistema de geração de CAPTCHA com letras/números
 * 
 * Este módulo gera CAPTCHAs visuais que o usuário precisa digitar corretamente.
 */

import crypto from 'crypto'

// Configurações do CAPTCHA
const CAPTCHA_CONFIG = {
  LENGTH: 6,                          // Número de caracteres
  EXPIRE_MINUTES: 5,                  // Tempo de expiração
  CHARACTERS: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', // Sem I, O, 0, 1 (confusos)
  WIDTH: 200,
  HEIGHT: 60,
}

// Armazenamento em memória dos CAPTCHAs (em produção, usar Redis)
interface CaptchaEntry {
  code: string
  createdAt: number
  attempts: number
}

const captchaStore: Map<string, CaptchaEntry> = new Map()

// Limpar CAPTCHAs expirados periodicamente
setInterval(() => {
  const now = Date.now()
  const expireTime = CAPTCHA_CONFIG.EXPIRE_MINUTES * 60 * 1000
  
  for (const [key, value] of captchaStore.entries()) {
    if (now - value.createdAt > expireTime) {
      captchaStore.delete(key)
    }
  }
}, 60 * 1000) // A cada minuto

/**
 * Gerar código aleatório do CAPTCHA
 */
function generateCode(): string {
  let code = ''
  for (let i = 0; i < CAPTCHA_CONFIG.LENGTH; i++) {
    const randomIndex = crypto.randomInt(CAPTCHA_CONFIG.CHARACTERS.length)
    code += CAPTCHA_CONFIG.CHARACTERS[randomIndex]
  }
  return code
}

/**
 * Gerar ID único para o CAPTCHA
 */
function generateCaptchaId(): string {
  return crypto.randomBytes(16).toString('hex')
}

/**
 * Gerar cor aleatória escura
 */
function randomDarkColor(): string {
  const r = crypto.randomInt(0, 100)
  const g = crypto.randomInt(0, 100)
  const b = crypto.randomInt(0, 100)
  return `rgb(${r},${g},${b})`
}

/**
 * Gerar cor aleatória clara (para fundo)
 */
function randomLightColor(): string {
  const r = crypto.randomInt(200, 255)
  const g = crypto.randomInt(200, 255)
  const b = crypto.randomInt(200, 255)
  return `rgb(${r},${g},${b})`
}

/**
 * Gerar imagem SVG do CAPTCHA
 */
function generateSvgImage(code: string): string {
  const { WIDTH, HEIGHT } = CAPTCHA_CONFIG
  const charWidth = WIDTH / (code.length + 1)
  
  // Cores de fundo
  const bgColor = randomLightColor()
  
  // Começar SVG
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">`
  
  // Fundo
  svg += `<rect width="100%" height="100%" fill="${bgColor}"/>`
  
  // Adicionar ruído de fundo (linhas)
  for (let i = 0; i < 6; i++) {
    const x1 = crypto.randomInt(0, WIDTH)
    const y1 = crypto.randomInt(0, HEIGHT)
    const x2 = crypto.randomInt(0, WIDTH)
    const y2 = crypto.randomInt(0, HEIGHT)
    const color = randomDarkColor()
    svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1" opacity="0.3"/>`
  }
  
  // Adicionar círculos de ruído
  for (let i = 0; i < 20; i++) {
    const cx = crypto.randomInt(0, WIDTH)
    const cy = crypto.randomInt(0, HEIGHT)
    const r = crypto.randomInt(1, 4)
    const color = randomDarkColor()
    svg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity="0.2"/>`
  }
  
  // Adicionar cada caractere com rotação e posição aleatória
  for (let i = 0; i < code.length; i++) {
    const char = code[i]
    const x = charWidth * (i + 0.5) + crypto.randomInt(-5, 5)
    const y = HEIGHT / 2 + crypto.randomInt(-8, 8)
    const rotation = crypto.randomInt(-25, 25)
    const fontSize = crypto.randomInt(24, 32)
    const color = randomDarkColor()
    
    // Fontes variadas
    const fonts = ['Arial', 'Verdana', 'Georgia', 'Times New Roman', 'Courier New']
    const font = fonts[crypto.randomInt(0, fonts.length)]
    
    svg += `<text x="${x}" y="${y}" font-family="${font}" font-size="${fontSize}" font-weight="bold" fill="${color}" transform="rotate(${rotation}, ${x}, ${y})" text-anchor="middle" dominant-baseline="middle">${char}</text>`
  }
  
  // Adicionar linhas de interferência sobre o texto
  for (let i = 0; i < 3; i++) {
    const x1 = crypto.randomInt(0, WIDTH)
    const y1 = crypto.randomInt(0, HEIGHT)
    const x2 = crypto.randomInt(0, WIDTH)
    const y2 = crypto.randomInt(0, HEIGHT)
    const color = randomDarkColor()
    svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="2" opacity="0.5"/>`
  }
  
  // Curva bezier para mais distorção
  const startX = 0
  const startY = crypto.randomInt(20, HEIGHT - 20)
  const cp1X = WIDTH / 3
  const cp1Y = crypto.randomInt(0, HEIGHT)
  const cp2X = (WIDTH * 2) / 3
  const cp2Y = crypto.randomInt(0, HEIGHT)
  const endX = WIDTH
  const endY = crypto.randomInt(20, HEIGHT - 20)
  svg += `<path d="M${startX},${startY} C${cp1X},${cp1Y} ${cp2X},${cp2Y} ${endX},${endY}" stroke="${randomDarkColor()}" stroke-width="2" fill="none" opacity="0.4"/>`
  
  svg += '</svg>'
  
  return svg
}

/**
 * Criar novo CAPTCHA
 */
export function createCaptcha(): { id: string; svg: string; dataUrl: string } {
  const id = generateCaptchaId()
  const code = generateCode()
  const svg = generateSvgImage(code)
  
  // Armazenar
  captchaStore.set(id, {
    code,
    createdAt: Date.now(),
    attempts: 0
  })
  
  // Converter SVG para data URL
  const base64 = Buffer.from(svg).toString('base64')
  const dataUrl = `data:image/svg+xml;base64,${base64}`
  
  return { id, svg, dataUrl }
}

/**
 * Validar CAPTCHA
 */
export function validateCaptcha(id: string, userInput: string): { valid: boolean; error?: string } {
  if (!id || !userInput) {
    return { valid: false, error: 'CAPTCHA não fornecido' }
  }
  
  const entry = captchaStore.get(id)
  
  if (!entry) {
    return { valid: false, error: 'CAPTCHA expirado ou inválido. Atualize a página.' }
  }
  
  // Verificar expiração
  const now = Date.now()
  const expireTime = CAPTCHA_CONFIG.EXPIRE_MINUTES * 60 * 1000
  
  if (now - entry.createdAt > expireTime) {
    captchaStore.delete(id)
    return { valid: false, error: 'CAPTCHA expirado. Atualize a página.' }
  }
  
  // Incrementar tentativas
  entry.attempts++
  
  // Máximo de 3 tentativas por CAPTCHA
  if (entry.attempts > 3) {
    captchaStore.delete(id)
    return { valid: false, error: 'Muitas tentativas. Atualize o CAPTCHA.' }
  }
  
  // Comparar (case-insensitive)
  const isValid = entry.code.toUpperCase() === userInput.trim().toUpperCase()
  
  if (isValid) {
    // Remover CAPTCHA usado
    captchaStore.delete(id)
    return { valid: true }
  }
  
  captchaStore.set(id, entry)
  return { valid: false, error: 'CAPTCHA incorreto. Tente novamente.' }
}

/**
 * Invalidar CAPTCHA (após uso ou erro)
 */
export function invalidateCaptcha(id: string): void {
  captchaStore.delete(id)
}

/**
 * Verificar se um CAPTCHA existe e é válido
 */
export function captchaExists(id: string): boolean {
  const entry = captchaStore.get(id)
  if (!entry) return false
  
  const now = Date.now()
  const expireTime = CAPTCHA_CONFIG.EXPIRE_MINUTES * 60 * 1000
  
  if (now - entry.createdAt > expireTime) {
    captchaStore.delete(id)
    return false
  }
  
  return true
}

