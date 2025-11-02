import { randomBytes } from 'crypto'

/**
 * Gera um fingerprint único do dispositivo baseado em características do navegador
 * Isso previne criação de múltiplas contas do mesmo dispositivo
 */
export function generateDeviceFingerprint(): string {
  if (typeof window === 'undefined') {
    // No servidor, retornar hash aleatório
    return randomBytes(16).toString('hex')
  }

  // Coletar informações do navegador e dispositivo
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  ctx?.fillText('Device fingerprint', 2, 2)
  const canvasFingerprint = canvas.toDataURL()

  const screenInfo = `${screen.width}x${screen.height}x${screen.colorDepth}`
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const language = navigator.language || navigator.languages?.[0] || 'en'
  const platform = navigator.platform || 'unknown'
  const hardwareConcurrency = navigator.hardwareConcurrency || 0
  const deviceMemory = (navigator as any).deviceMemory || 0
  
  // User Agent
  const userAgent = navigator.userAgent || ''
  
  // Plugin information (limitado)
  const plugins = Array.from(navigator.plugins || [])
    .slice(0, 3)
    .map(p => p.name)
    .join(',')
  
  // Combinar todas as informações
  const fingerprintData = [
    canvasFingerprint,
    screenInfo,
    timezone,
    language,
    platform,
    hardwareConcurrency.toString(),
    deviceMemory.toString(),
    userAgent,
    plugins
  ].join('|')

  // Criar hash simples (poderia usar crypto.subtle, mas mantém compatibilidade)
  let hash = 0
  for (let i = 0; i < fingerprintData.length; i++) {
    const char = fingerprintData.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }

  // Adicionar timestamp para mais unicidade (sem expor data exata)
  const timestamp = Math.floor(Date.now() / (1000 * 60 * 60 * 24)) // Dias desde epoch
  
  // Combinar hash com timestamp
  const finalHash = `${Math.abs(hash).toString(36)}${timestamp.toString(36)}`
  
  return finalHash
}

/**
 * Armazena o device fingerprint no localStorage
 * Isso permite reutilizar o mesmo fingerprint para o mesmo dispositivo
 */
export function getStoredDeviceFingerprint(): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const stored = localStorage.getItem('device_fingerprint')
    if (stored) {
      return stored
    }
    
    // Se não existe, gerar e armazenar
    const fingerprint = generateDeviceFingerprint()
    localStorage.setItem('device_fingerprint', fingerprint)
    return fingerprint
  } catch (error) {
    console.error('Error accessing localStorage:', error)
    return null
  }
}

