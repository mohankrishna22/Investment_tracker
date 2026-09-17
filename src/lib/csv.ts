import type { AppData } from './types'

const escape = (value: unknown) => {
  const s = value === undefined || value === null ? '' : String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(headers: string[], rows: (string | number)[][]) {
  return [headers, ...rows].map((row) => row.map(escape).join(',')).join('\n')
}

export function download(filename: string, content: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function investmentsCsv(data: AppData, ventureId?: string) {
  const name = (id: string) => data.ventures.find((v) => v.id === id)?.name ?? 'Unknown'
  const rows = data.investments
    .filter((i) => !ventureId || i.ventureId === ventureId)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((i) => [name(i.ventureId), i.date, i.item, i.category, i.paymentMode, i.amount, i.notes])
  return toCsv(
    ['Venture', 'Date', 'Item', 'Category', 'Payment mode', 'Amount', 'Notes'],
    rows,
  )
}

export function payoutsCsv(data: AppData, ventureId?: string) {
  const name = (id: string) => data.ventures.find((v) => v.id === id)?.name ?? 'Unknown'
  const rows = data.payouts
    .filter((p) => !ventureId || p.ventureId === ventureId)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((p) => [name(p.ventureId), p.date, p.kind, p.amount, p.notes])
  return toCsv(['Venture', 'Date', 'Type', 'Amount', 'Notes'], rows)
}
