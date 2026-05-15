import { prisma } from './prisma'

export const PREMIUM_TRIAL_CONFIG_KEY = 'PREMIUM_TRIAL_CONFIG'

export interface PremiumTrialConfig {
  enabled: boolean
  planId: string
  durationDays: number
  title: string
  description: string
  buttonText: string
}

export const DEFAULT_PREMIUM_TRIAL_CONFIG: PremiumTrialConfig = {
  enabled: false,
  planId: '',
  durationDays: 1,
  title: 'Teste premium liberado',
  description: 'Resgate seu acesso premium temporario ao gerador e experimente os servicos pagos.',
  buttonText: 'Resgatar trial premium'
}

export function normalizePremiumTrialConfig(value: unknown): PremiumTrialConfig {
  if (!value || typeof value !== 'object') {
    return DEFAULT_PREMIUM_TRIAL_CONFIG
  }

  const raw = value as Partial<PremiumTrialConfig>
  const durationDays = Number(raw.durationDays)

  return {
    enabled: raw.enabled === true,
    planId: typeof raw.planId === 'string' ? raw.planId : '',
    durationDays: Number.isFinite(durationDays) && durationDays > 0
      ? Math.min(Math.floor(durationDays), 365)
      : DEFAULT_PREMIUM_TRIAL_CONFIG.durationDays,
    title: typeof raw.title === 'string' && raw.title.trim()
      ? raw.title.trim().slice(0, 80)
      : DEFAULT_PREMIUM_TRIAL_CONFIG.title,
    description: typeof raw.description === 'string' && raw.description.trim()
      ? raw.description.trim().slice(0, 300)
      : DEFAULT_PREMIUM_TRIAL_CONFIG.description,
    buttonText: typeof raw.buttonText === 'string' && raw.buttonText.trim()
      ? raw.buttonText.trim().slice(0, 40)
      : DEFAULT_PREMIUM_TRIAL_CONFIG.buttonText
  }
}

export function parsePremiumTrialConfig(value: string | null | undefined): PremiumTrialConfig {
  if (!value) return DEFAULT_PREMIUM_TRIAL_CONFIG

  try {
    return normalizePremiumTrialConfig(JSON.parse(value))
  } catch {
    return DEFAULT_PREMIUM_TRIAL_CONFIG
  }
}

export async function getPremiumTrialConfig(): Promise<PremiumTrialConfig> {
  const config = await prisma.systemConfig.findUnique({
    where: { key: PREMIUM_TRIAL_CONFIG_KEY }
  })

  return parsePremiumTrialConfig(config?.value)
}

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}
