import type { Settings } from './types'

export function formatMoney(value: number, settings: Settings, opts?: { compact?: boolean }) {
  try {
    return new Intl.NumberFormat(settings.locale || undefined, {
      style: 'currency',
      currency: settings.currency || 'INR',
      maximumFractionDigits: opts?.compact ? 1 : 0,
      notation: opts?.compact ? 'compact' : 'standard',
    }).format(value)
  } catch {
    return `${settings.currency} ${Math.round(value).toLocaleString()}`
  }
}

export function formatNumber(value: number, locale: string) {
  try {
    return new Intl.NumberFormat(locale || undefined, { maximumFractionDigits: 2 }).format(value)
  } catch {
    return String(value)
  }
}

export function formatDate(iso: string, locale: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  try {
    return new Intl.DateTimeFormat(locale || undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d)
  } catch {
    return iso
  }
}

export function formatMonth(month: string, locale: string) {
  const [y, m] = month.split('-').map(Number)
  if (!y || !m) return month
  try {
    return new Intl.DateTimeFormat(locale || undefined, { month: 'short', year: '2-digit' }).format(
      new Date(Date.UTC(y, m - 1, 1)),
    )
  } catch {
    return month
  }
}

export function formatPercent(value: number | undefined, digits = 1) {
  if (value === undefined || !Number.isFinite(value)) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(digits)}%`
}

/** "3 years, 2 months" style span used on venture headers. */
export function holdingPeriod(from?: string) {
  if (!from) return '—'
  const start = new Date(from)
  if (Number.isNaN(start.getTime())) return '—'
  const months = Math.max(
    0,
    (new Date().getFullYear() - start.getFullYear()) * 12 +
      (new Date().getMonth() - start.getMonth()),
  )
  const years = Math.floor(months / 12)
  const rest = months % 12
  if (years === 0) return `${rest} mo`
  if (rest === 0) return `${years} yr`
  return `${years} yr ${rest} mo`
}

/** Bare currency symbol for the brand mark, e.g. "₹" or "$". */
export function currencySymbol(settings: Settings) {
  try {
    return (
      new Intl.NumberFormat(settings.locale || undefined, {
        style: 'currency',
        currency: settings.currency || 'INR',
        maximumFractionDigits: 0,
      })
        .formatToParts(0)
        .find((part) => part.type === 'currency')?.value ?? '$'
    )
  } catch {
    return '$'
  }
}
