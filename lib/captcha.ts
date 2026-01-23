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

// Validação stateless usando HMAC assinado (evita problemas de instância/cluster)
function getSecret(): string {
  return process.env.CAPTCHA_SECRET || process.env.NEXTAUTH_SECRET || 'dev-captcha-secret'
}
function signCode(code: string, createdAt: number): string {
  const hmac = crypto.createHmac('sha256', getSecret())
  hmac.update(`${code}:${createdAt}`)
  return hmac.digest('hex')
}
function encodeId(createdAt: number, signature: string): string {
  const payload = JSON.stringify({ t: createdAt, s: signature })
  return Buffer.from(payload).toString('base64url')
}
function decodeId(id: string): { createdAt: number; signature: string } | null {
  try {
    const raw = Buffer.from(id, 'base64url').toString('utf8')
    const obj = JSON.parse(raw)
    if (typeof obj?.t !== 'number' || typeof obj?.s !== 'string') return null
    return { createdAt: obj.t, signature: obj.s }
  } catch {
    return null
  }
}

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
  const code = generateCode()
  const svg = generateSvgImage(code)
  const createdAt = Date.now()
  const signature = signCode(code, createdAt)
  const id = encodeId(createdAt, signature)
  
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
  const parsed = decodeId(id)
  if (!parsed) {
    return { valid: false, error: 'CAPTCHA inválido. Atualize a página.' }
  }
  const now = Date.now()
  const expireTime = CAPTCHA_CONFIG.EXPIRE_MINUTES * 60 * 1000
  if (now - parsed.createdAt > expireTime) {
    return { valid: false, error: 'CAPTCHA expirado. Atualize a página.' }
  }
  const input = userInput.trim().toUpperCase()
  const expectedSig = signCode(input, parsed.createdAt)
  if (expectedSig === parsed.signature) {
    return { valid: true }
  }
  return { valid: false, error: 'CAPTCHA incorreto. Tente novamente.' }
}

/**
 * Invalidar CAPTCHA (após uso ou erro)
 */
export function invalidateCaptcha(id: string): void {
  // Stateless: nada a invalidar
}

/**
 * Verificar se um CAPTCHA existe e é válido
 */
export function captchaExists(id: string): boolean {
  const parsed = decodeId(id)
  if (!parsed) return false
  const now = Date.now()
  const expireTime = CAPTCHA_CONFIG.EXPIRE_MINUTES * 60 * 1000
  return now - parsed.createdAt <= expireTime
}

