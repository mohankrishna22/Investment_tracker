/**
 * Calendar dates in this app are the user's local calendar, not UTC.
 *
 * `new Date().toISOString()` is UTC, so between midnight and 05:30 in India it
 * returns yesterday's date — a loan entered at 1am would be recorded a day early,
 * and "overdue" would flip at 05:30 instead of midnight.
 */
export function localIsoDate(date: Date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Parses "yyyy-mm-dd" as a local date (the Date constructor would read it as UTC). */
export function parseIsoDate(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) {
    const fallback = new Date(iso)
    return Number.isNaN(fallback.getTime()) ? null : fallback
  }
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) ? null : date
}

/** Whole calendar days from one "yyyy-mm-dd" to another. */
export function daysBetween(fromIso: string, toIso: string) {
  const from = parseIsoDate(fromIso)
  const to = parseIsoDate(toIso)
  if (!from || !to) return 0
  // Round rather than floor so a daylight-saving shift cannot lose a day.
  return Math.round((to.getTime() - from.getTime()) / 86400000)
}

/** A local date `days` from today, as "yyyy-mm-dd". */
export function localIsoDateIn(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return localIsoDate(date)
}
