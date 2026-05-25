export const PAYMENT_CONFIG_ROLES = ['OWNER', 'ADMIN', 'CO_OWNER'] as const

export function canManagePaymentConfig(role: string | undefined | null): boolean {
  if (!role) return false
  return PAYMENT_CONFIG_ROLES.includes(role as (typeof PAYMENT_CONFIG_ROLES)[number])
}
