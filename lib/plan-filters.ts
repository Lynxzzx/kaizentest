/**
 * Planos que não devem aparecer na loja (/plans, etc.).
 * Match exato pelo nome (trim + lowercase).
 *
 * Extra: env SITE_PLANS_HIDDEN_NAMES=foo,bar,baz
 */

const DEFAULT_HIDDEN_SITE_PLAN_NAMES = new Set([
  'daily',
  'monthly',
  'lifetime',
  'kaizen daily',
  'kaizen monthly',
  'kaizen lifetime',
])

function hiddenNamesFromEnv(): Set<string> {
  const raw = process.env.SITE_PLANS_HIDDEN_NAMES
  const set = new Set<string>()
  if (!raw) return set
  for (const part of raw.split(',')) {
    const n = part.trim().toLowerCase()
    if (n) set.add(n)
  }
  return set
}

export function isSitePlanHiddenFromStore(name: string): boolean {
  const n = String(name || '').trim().toLowerCase()
  if (!n) return false
  if (DEFAULT_HIDDEN_SITE_PLAN_NAMES.has(n)) return true
  for (const extra of hiddenNamesFromEnv()) {
    if (n === extra) return true
  }
  return false
}

/** Para listagem pública de planos SITE (ex.: /api/plans?type=SITE). */
export function filterSitePlansForPublicStore<T extends { name: string; type: string }>(plans: T[]): T[] {
  return plans.filter(
    (p) =>
      p.type !== 'API' &&
      !String(p.name || '')
        .toLowerCase()
        .includes('api') &&
      !isSitePlanHiddenFromStore(p.name)
  )
}
