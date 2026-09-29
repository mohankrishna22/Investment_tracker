import type { AppData } from './types'
import { countsOf } from './schema'

/**
 * A short history of this device's data from just before sync replaced it with
 * something smaller. Sync should never lose anything — but if a bug or an
 * out-of-date device ever makes it try, the last good copy is still here.
 */
export interface SafetyCopy {
  savedAt: string
  reason: string
  counts: Record<string, number>
  data: AppData
}

const KEY = 'investment-tracker/safety-copies'
const KEEP = 10

export function listSafetyCopies(): SafetyCopy[] {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? (JSON.parse(raw) as SafetyCopy[]) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveSafetyCopy(data: AppData, reason: string) {
  const counts = countsOf(data)
  const copy: SafetyCopy = { savedAt: new Date().toISOString(), reason, counts, data }
  try {
    const next = [copy, ...listSafetyCopies()].slice(0, KEEP)
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Storage full: fall back to keeping only the newest copy rather than none.
    try {
      localStorage.setItem(KEY, JSON.stringify([copy]))
    } catch {
      /* nothing more can be done without storage */
    }
  }
  window.dispatchEvent(new Event('safety-copies-changed'))
}
