import type { AppData } from './types'

/**
 * Bumped whenever the shape of AppData grows. 1 = investments only; 2 = loans in
 * both directions. Sync uses it to spot a device running an older build.
 */
export const DATA_VERSION = 2

/** The collections a build of each version knows how to carry. */
export const COLLECTIONS = [
  'ventures',
  'investments',
  'payouts',
  'people',
  'loans',
  'repayments',
] as const

/**
 * A store nobody has touched must never look freshly edited: stamping it with
 * "now" would let an empty device win a sync against a device holding real data.
 */
export const NEVER = new Date(0).toISOString()

/** Every record id in a snapshot, across all collections. */
export function allIds(d: AppData): string[] {
  return COLLECTIONS.flatMap((key) => ((d[key] ?? []) as { id: string }[]).map((item) => item.id))
}

/** True when a snapshot holds no records of any kind. */
export function isEmpty(d: AppData) {
  return COLLECTIONS.every((key) => !Array.isArray(d[key]) || d[key].length === 0)
}

/** Record count per collection, for summaries and diagnostics. */
export function countsOf(d: AppData): Record<(typeof COLLECTIONS)[number], number> {
  return Object.fromEntries(
    COLLECTIONS.map((key) => [key, Array.isArray(d[key]) ? d[key].length : 0]),
  ) as Record<(typeof COLLECTIONS)[number], number>
}
