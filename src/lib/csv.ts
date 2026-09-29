import type { AppData } from './types'

const escape = (value: unknown) => {
  const s = value === undefined || value === null ? '' : String(value)
  // Carriage returns need quoting too, or Excel splits the row.
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * A byte-order mark tells Excel the file is UTF-8. Without it, Excel on a Mac
 * reads it as a legacy encoding and garbles "₹" and any non-English name.
 */
const BOM = '\uFEFF'

export function toCsv(headers: string[], rows: (string | number)[][]) {
  return BOM + [headers, ...rows].map((row) => row.map(escape).join(',')).join('\r\n')
}

export function download(filename: string, content: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Safari, iPhone Safari especially, starts the download asynchronously; freeing
  // the URL in the same tick cancels it, so give it time first.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
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

/** Every loan and repayment, both directions, one row each — for the Reports export. */
export function loansCsv(data: AppData) {
  const name = (id: string) => data.people.find((p) => p.id === id)?.name ?? 'Unknown'
  const loanRows = data.loans.map((l) => [
    name(l.personId),
    l.direction === 'out' ? 'Lent out' : 'Borrowed',
    'Loan',
    l.date,
    l.amount,
    l.purpose + (l.notes ? ` — ${l.notes}` : ''),
    l.dueDate ?? '',
    l.writtenOff ? 'Written off' : '',
  ])
  const repaymentRows = data.repayments.map((r) => [
    name(r.personId),
    r.direction === 'out' ? 'Lent out' : 'Borrowed',
    r.direction === 'out' ? 'They paid me' : 'I paid them',
    r.date,
    r.amount,
    r.notes,
    '',
    '',
  ])
  const rows = [...loanRows, ...repaymentRows].sort((a, b) =>
    String(a[3]).localeCompare(String(b[3])),
  )
  return toCsv(
    ['Person', 'Direction', 'Type', 'Date', 'Amount', 'Purpose / notes', 'Due', 'Status'],
    rows as (string | number)[][],
  )
}
