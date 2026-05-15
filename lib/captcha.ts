/**
 * 🔐 CAPTCHA Visual - Sistema de geração de CAPTCHA com letras/números
 *
 * Persistência no MongoDB (Prisma): em serverless, memória não é compartilhada entre
 * GET /api/auth/captcha e POST /api/accounts/generate.
 */

import crypto from 'crypto'
import { prisma } from '@/lib/prisma'

const CAPTCHA_CONFIG = {
  LENGTH: 6,
  EXPIRE_MINUTES: 5,
  CHARACTERS: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
  WIDTH: 200,
  HEIGHT: 60,
}

function generateCode(): string {
  let code = ''
  for (let i = 0; i < CAPTCHA_CONFIG.LENGTH; i++) {
    const randomIndex = crypto.randomInt(CAPTCHA_CONFIG.CHARACTERS.length)
    code += CAPTCHA_CONFIG.CHARACTERS[randomIndex]
  }
  return code
}

function generateCaptchaId(): string {
  return crypto.randomBytes(16).toString('hex')
}

function randomDarkColor(): string {
  const r = crypto.randomInt(0, 100)
  const g = crypto.randomInt(0, 100)
  const b = crypto.randomInt(0, 100)
  return `rgb(${r},${g},${b})`
}

function randomLightColor(): string {
  const r = crypto.randomInt(200, 255)
  const g = crypto.randomInt(200, 255)
  const b = crypto.randomInt(200, 255)
  return `rgb(${r},${g},${b})`
}

function generateSvgImage(code: string): string {
  const { WIDTH, HEIGHT } = CAPTCHA_CONFIG
  const charWidth = WIDTH / (code.length + 1)

  const bgColor = randomLightColor()

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">`

  svg += `<rect width="100%" height="100%" fill="${bgColor}"/>`

  for (let i = 0; i < 6; i++) {
    const x1 = crypto.randomInt(0, WIDTH)
    const y1 = crypto.randomInt(0, HEIGHT)
    const x2 = crypto.randomInt(0, WIDTH)
    const y2 = crypto.randomInt(0, HEIGHT)
    const color = randomDarkColor()
    svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1" opacity="0.3"/>`
  }

  for (let i = 0; i < 20; i++) {
    const cx = crypto.randomInt(0, WIDTH)
    const cy = crypto.randomInt(0, HEIGHT)
    const r = crypto.randomInt(1, 4)
    const color = randomDarkColor()
    svg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity="0.2"/>`
  }

  for (let i = 0; i < code.length; i++) {
    const char = code[i]
    const x = charWidth * (i + 0.5) + crypto.randomInt(-5, 5)
    const y = HEIGHT / 2 + crypto.randomInt(-8, 8)
    const rotation = crypto.randomInt(-25, 25)
    const fontSize = crypto.randomInt(24, 32)
    const color = randomDarkColor()

    const fonts = ['Arial', 'Verdana', 'Georgia', 'Times New Roman', 'Courier New']
    const font = fonts[crypto.randomInt(0, fonts.length)]

    svg += `<text x="${x}" y="${y}" font-family="${font}" font-size="${fontSize}" font-weight="bold" fill="${color}" transform="rotate(${rotation}, ${x}, ${y})" text-anchor="middle" dominant-baseline="middle">${char}</text>`
  }

  for (let i = 0; i < 3; i++) {
    const x1 = crypto.randomInt(0, WIDTH)
    const y1 = crypto.randomInt(0, HEIGHT)
    const x2 = crypto.randomInt(0, WIDTH)
    const y2 = crypto.randomInt(0, HEIGHT)
    const color = randomDarkColor()
    svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="2" opacity="0.5"/>`
  }

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

async function pruneExpiredCaptchas(): Promise<void> {
  try {
    await prisma.captchaChallenge.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    })
  } catch {
    /* ignore */
  }
}

export async function createCaptcha(): Promise<{
  id: string
  svg: string
  dataUrl: string
}> {
  await pruneExpiredCaptchas()

  const id = generateCaptchaId()
  const code = generateCode()
  const svg = generateSvgImage(code)
  const expiresAt = new Date(
    Date.now() + CAPTCHA_CONFIG.EXPIRE_MINUTES * 60 * 1000
  )

  await prisma.captchaChallenge.create({
    data: { id, code, attempts: 0, expiresAt },
  })

  const base64 = Buffer.from(svg).toString('base64')
  const dataUrl = `data:image/svg+xml;base64,${base64}`

  return { id, svg, dataUrl }
}

export async function validateCaptcha(
  id: string,
  userInput: string
): Promise<{ valid: boolean; error?: string }> {
  if (!id || !userInput) {
    return { valid: false, error: 'CAPTCHA não fornecido' }
  }

  const entry = await prisma.captchaChallenge.findUnique({ where: { id } })

  if (!entry) {
    return {
      valid: false,
      error: 'CAPTCHA expirado ou inválido. Atualize a página.',
    }
  }

  const now = new Date()
  if (now > entry.expiresAt) {
    await prisma.captchaChallenge.delete({ where: { id } }).catch(() => {})
    return { valid: false, error: 'CAPTCHA expirado. Atualize a página.' }
  }

  const newAttempts = entry.attempts + 1
  await prisma.captchaChallenge.update({
    where: { id },
    data: { attempts: newAttempts },
  })

  if (newAttempts > 3) {
    await prisma.captchaChallenge.delete({ where: { id } }).catch(() => {})
    return { valid: false, error: 'Muitas tentativas. Atualize o CAPTCHA.' }
  }

  const isValid =
    entry.code.toUpperCase() === userInput.trim().toUpperCase()

  if (isValid) {
    await prisma.captchaChallenge.delete({ where: { id } }).catch(() => {})
    return { valid: true }
  }

  return { valid: false, error: 'CAPTCHA incorreto. Tente novamente.' }
}

export async function invalidateCaptcha(id: string): Promise<void> {
  await prisma.captchaChallenge.delete({ where: { id } }).catch(() => {})
}

export async function captchaExists(id: string): Promise<boolean> {
  const entry = await prisma.captchaChallenge.findUnique({ where: { id } })
  if (!entry) return false

  if (new Date() > entry.expiresAt) {
    await prisma.captchaChallenge.delete({ where: { id } }).catch(() => {})
    return false
  }

  return true
}
