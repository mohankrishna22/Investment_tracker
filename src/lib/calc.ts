import type { AppData, Investment, Payout, Venture } from './types'

export interface VentureStats {
  invested: number
  returned: number
  /** Latest valuation of the stake, if recorded. */
  currentValue?: number
  /** Cash back plus current value, minus what went in. */
  net: number
  roi: number // percent
  /** Annualised money-weighted return, or undefined when it cannot be solved. */
  xirr?: number
  firstDate?: string
  lastDate?: string
  investmentCount: number
  payoutCount: number
  /** Share of capital already recovered as cash, 0..1+. */
  recovered: number
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

export function statsFor(
  venture: Venture,
  investments: Investment[],
  payouts: Payout[],
): VentureStats {
  const mine = investments.filter((i) => i.ventureId === venture.id)
  const theirs = payouts.filter((p) => p.ventureId === venture.id)
  const invested = sum(mine.map((i) => i.amount))
  const returned = sum(theirs.map((p) => p.amount))
  const currentValue =
    typeof venture.currentValue === 'number' && venture.currentValue > 0
      ? venture.currentValue
      : undefined
  const net = returned + (currentValue ?? 0) - invested
  const dates = [...mine.map((i) => i.date), ...theirs.map((p) => p.date)].filter(Boolean).sort()

  return {
    invested,
    returned,
    currentValue,
    net,
    roi: invested > 0 ? (net / invested) * 100 : 0,
    xirr: xirrFor(venture, mine, theirs),
    firstDate: dates[0],
    lastDate: dates[dates.length - 1],
    investmentCount: mine.length,
    payoutCount: theirs.length,
    recovered: invested > 0 ? returned / invested : 0,
  }
}

export interface Flow {
  date: Date
  amount: number
}

/** Cash flows from the investor's point of view: money out negative, money in positive. */
export function flowsFor(venture: Venture, investments: Investment[], payouts: Payout[]): Flow[] {
  const flows: Flow[] = [
    ...investments.map((i) => ({ date: new Date(i.date), amount: -i.amount })),
    ...payouts.map((p) => ({ date: new Date(p.date), amount: p.amount })),
  ].filter((f) => !Number.isNaN(f.date.getTime()) && f.amount !== 0)

  if (venture.currentValue && venture.currentValue > 0 && venture.status !== 'closed') {
    flows.push({ date: new Date(), amount: venture.currentValue })
  }
  return flows.sort((a, b) => a.date.getTime() - b.date.getTime())
}

const DAYS = 365

/** Newton's method on the XIRR equation, with a bisection fallback. */
export function xirr(flows: Flow[]): number | undefined {
  if (flows.length < 2) return undefined
  const hasNeg = flows.some((f) => f.amount < 0)
  const hasPos = flows.some((f) => f.amount > 0)
  if (!hasNeg || !hasPos) return undefined

  const t0 = flows[0].date.getTime()
  const years = flows.map((f) => (f.date.getTime() - t0) / (DAYS * 24 * 3600 * 1000))
  const npv = (rate: number) =>
    flows.reduce((acc, f, idx) => acc + f.amount / Math.pow(1 + rate, years[idx]), 0)

  let rate = 0.1
  for (let i = 0; i < 80; i++) {
    const value = npv(rate)
    if (!Number.isFinite(value)) break
    if (Math.abs(value) < 1e-7) return rate * 100
    const step = 1e-5
    const slope = (npv(rate + step) - value) / step
    if (!Number.isFinite(slope) || Math.abs(slope) < 1e-12) break
    const next = rate - value / slope
    if (!Number.isFinite(next) || next <= -0.9999) break
    if (Math.abs(next - rate) < 1e-9) return next * 100
    rate = next
  }

  // Newton bailed out — scan for a sign change, then bisect it.
  let lo = -0.9999
  let hi = 10
  let loVal = npv(lo)
  let hiVal = npv(hi)
  if (!Number.isFinite(loVal) || !Number.isFinite(hiVal) || loVal * hiVal > 0) return undefined
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    const midVal = npv(mid)
    if (Math.abs(midVal) < 1e-7) return mid * 100
    if (loVal * midVal < 0) {
      hi = mid
      hiVal = midVal
    } else {
      lo = mid
      loVal = midVal
    }
  }
  return ((lo + hi) / 2) * 100
}

function xirrFor(venture: Venture, investments: Investment[], payouts: Payout[]) {
  const flows = flowsFor(venture, investments, payouts)
  const span = flows.length
    ? (flows[flows.length - 1].date.getTime() - flows[0].date.getTime()) / 86400000
    : 0
  // Under a month of history the annualised figure is noise, not signal.
  if (span < 30) return undefined
  return xirr(flows)
}

export interface PortfolioStats extends VentureStats {
  ventureCount: number
  activeCount: number
}

export function portfolioStats(data: AppData): PortfolioStats {
  const invested = sum(data.investments.map((i) => i.amount))
  const returned = sum(data.payouts.map((p) => p.amount))
  const currentValue = sum(
    data.ventures
      .filter((v) => v.status !== 'closed')
      .map((v) => (typeof v.currentValue === 'number' ? v.currentValue : 0)),
  )
  const net = returned + currentValue - invested
  const dates = [...data.investments.map((i) => i.date), ...data.payouts.map((p) => p.date)]
    .filter(Boolean)
    .sort()

  const allFlows = data.ventures.flatMap((v) =>
    flowsFor(
      v,
      data.investments.filter((i) => i.ventureId === v.id),
      data.payouts.filter((p) => p.ventureId === v.id),
    ),
  )
  const span = allFlows.length
    ? (Math.max(...allFlows.map((f) => f.date.getTime())) -
        Math.min(...allFlows.map((f) => f.date.getTime()))) /
      86400000
    : 0

  return {
    invested,
    returned,
    currentValue: currentValue || undefined,
    net,
    roi: invested > 0 ? (net / invested) * 100 : 0,
    xirr: span >= 30 ? xirr(allFlows.sort((a, b) => a.date.getTime() - b.date.getTime())) : undefined,
    firstDate: dates[0],
    lastDate: dates[dates.length - 1],
    investmentCount: data.investments.length,
    payoutCount: data.payouts.length,
    recovered: invested > 0 ? returned / invested : 0,
    ventureCount: data.ventures.length,
    activeCount: data.ventures.filter((v) => v.status === 'active').length,
  }
}

export interface MonthPoint {
  month: string // yyyy-mm
  invested: number
  returned: number
}

/** Month-by-month totals with no gaps, so charts read as a real timeline. */
export function monthlySeries(investments: Investment[], payouts: Payout[]): MonthPoint[] {
  const buckets = new Map<string, MonthPoint>()
  const touch = (month: string) => {
    if (!buckets.has(month)) buckets.set(month, { month, invested: 0, returned: 0 })
    return buckets.get(month)!
  }
  for (const i of investments) if (i.date) touch(i.date.slice(0, 7)).invested += i.amount
  for (const p of payouts) if (p.date) touch(p.date.slice(0, 7)).returned += p.amount
  if (buckets.size === 0) return []

  const keys = [...buckets.keys()].sort()
  const out: MonthPoint[] = []
  const [startY, startM] = keys[0].split('-').map(Number)
  const [endY, endM] = keys[keys.length - 1].split('-').map(Number)
  const cursor = new Date(Date.UTC(startY, startM - 1, 1))
  const end = new Date(Date.UTC(endY, endM - 1, 1))
  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 7)
    out.push(buckets.get(key) ?? { month: key, invested: 0, returned: 0 })
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }
  return out
}

export function groupSum<T>(rows: T[], key: (row: T) => string, value: (row: T) => number) {
  const map = new Map<string, number>()
  for (const row of rows) map.set(key(row), (map.get(key(row)) ?? 0) + value(row))
  return [...map.entries()]
    .map(([label, total]) => ({ label, total }))
    .sort((a, b) => b.total - a.total)
}
