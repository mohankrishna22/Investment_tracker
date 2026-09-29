import type { AppData, Investment, Loan, LoanDirection, Payout, Person, Repayment, Venture } from './types'
import { RETURN_KINDS } from './types'

/**
 * Reads CSVs this app exported — including the formats from earlier versions —
 * and works out which records to add. Pure: nothing is written here, so the
 * caller can show what will happen and the logic can be tested on its own.
 *
 * Records are added, never replaced, and anything already present is skipped,
 * so importing the same file twice is harmless.
 */

export interface ImportFile {
  name: string
  text: string
}

export interface ImportAdditions {
  ventures: Omit<Venture, 'color'>[]
  investments: Investment[]
  payouts: Payout[]
  people: Omit<Person, 'color'>[]
  loans: Loan[]
  repayments: Repayment[]
}

export interface ImportSummary {
  investments: number
  payouts: number
  loans: number
  repayments: number
  newVentures: number
  newPeople: number
  duplicates: number
  invalid: number
  unrecognised: string[]
}

/** RFC 4180-style parsing: quoted fields, doubled quotes, CRLF, and a leading BOM. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') {
        quoted = false
      } else {
        field += c
      }
    } else if (c === '"') {
      quoted = true
    } else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += c
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''))
}

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s.trim())
const amountOf = (s: string) => {
  const n = Number(String(s).replace(/[,\s₹]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}
const norm = (s: string) => s.trim().toLowerCase()

/** "Purpose — notes" as the exports write it, split back apart. */
function splitPurpose(s: string) {
  const at = s.indexOf(' — ')
  return at === -1 ? { purpose: s.trim(), notes: '' } : { purpose: s.slice(0, at).trim(), notes: s.slice(at + 3).trim() }
}

/** The person a per-person export belongs to, from its filename: "Ravi-loans.csv". */
function personFromFilename(name: string) {
  const base = name.replace(/\.csv$/i, '')
  const match = /^(.*?)-(loans|lending)$/i.exec(base)
  return match ? match[1].trim() : null
}

export function planImport(files: ImportFile[], data: AppData, makeId: () => string) {
  const add: ImportAdditions = { ventures: [], investments: [], payouts: [], people: [], loans: [], repayments: [] }
  const summary: ImportSummary = {
    investments: 0, payouts: 0, loans: 0, repayments: 0,
    newVentures: 0, newPeople: 0, duplicates: 0, invalid: 0, unrecognised: [],
  }

  const ventureIds = new Map(data.ventures.map((v) => [norm(v.name), v.id]))
  const personIds = new Map(data.people.map((p) => [norm(p.name), p.id]))
  const now = new Date().toISOString()

  const ventureFor = (name: string, date: string) => {
    const key = norm(name)
    const found = ventureIds.get(key)
    if (found) return found
    const id = makeId()
    add.ventures.push({
      id, name: name.trim(), category: 'Imported', description: '',
      startDate: date, status: 'active', createdAt: now,
    })
    ventureIds.set(key, id)
    summary.newVentures++
    return id
  }
  const personFor = (name: string) => {
    const key = norm(name)
    const found = personIds.get(key)
    if (found) return found
    const id = makeId()
    add.people.push({ id, name: name.trim(), contact: '', notes: '', createdAt: now })
    personIds.set(key, id)
    summary.newPeople++
    return id
  }

  // Fingerprints of what already exists, so re-imports are skipped.
  const seen = new Set<string>([
    ...data.investments.map((i) => `i|${i.ventureId}|${i.date}|${i.amount}|${norm(i.item)}`),
    ...data.payouts.map((p) => `p|${p.ventureId}|${p.date}|${p.amount}|${p.kind}`),
    ...data.loans.map((l) => `l|${l.personId}|${l.direction}|${l.date}|${l.amount}|${norm(l.purpose)}`),
    ...data.repayments.map((r) => `r|${r.personId}|${r.direction}|${r.date}|${r.amount}`),
  ])
  const fresh = (key: string) => {
    if (seen.has(key)) {
      summary.duplicates++
      return false
    }
    seen.add(key)
    return true
  }

  for (const file of files) {
    const [header, ...rows] = parseCsv(file.text)
    if (!header) {
      summary.unrecognised.push(file.name)
      continue
    }
    const h = header.map(norm)
    const col = (row: string[], name: string) => {
      const at = h.indexOf(name)
      return at === -1 ? '' : (row[at] ?? '').trim()
    }

    // investments.csv — Venture, Date, Item, Category, Payment mode, Amount, Notes
    if (h.includes('venture') && h.includes('item')) {
      for (const row of rows) {
        const date = col(row, 'date')
        const amount = amountOf(col(row, 'amount'))
        const venture = col(row, 'venture')
        if (!isDate(date) || amount === null || !venture) {
          summary.invalid++
          continue
        }
        const ventureId = ventureFor(venture, date)
        const item = col(row, 'item') || 'Imported'
        if (!fresh(`i|${ventureId}|${date}|${amount}|${norm(item)}`)) continue
        add.investments.push({
          id: makeId(), ventureId, date, amount, item,
          category: col(row, 'category') || 'Other',
          paymentMode: col(row, 'payment mode') || 'Other',
          notes: col(row, 'notes'),
        })
        summary.investments++
      }
      continue
    }

    // returns.csv — Venture, Date, Type, Amount, Notes
    if (h.includes('venture') && h.includes('type')) {
      for (const row of rows) {
        const date = col(row, 'date')
        const amount = amountOf(col(row, 'amount'))
        const venture = col(row, 'venture')
        if (!isDate(date) || amount === null || !venture) {
          summary.invalid++
          continue
        }
        const ventureId = ventureFor(venture, date)
        const kindRaw = norm(col(row, 'type'))
        const kind = (RETURN_KINDS as string[]).includes(kindRaw) ? (kindRaw as Payout['kind']) : 'other'
        if (!fresh(`p|${ventureId}|${date}|${amount}|${kind}`)) continue
        add.payouts.push({ id: makeId(), ventureId, date, amount, kind, notes: col(row, 'notes') })
        summary.payouts++
      }
      continue
    }

    // loans.csv (Reports), and per-person exports — which name the person only in
    // the filename — from both the current and the pre-borrowing versions.
    if (h.includes('type') && h.includes('amount') && (h.includes('person') || personFromFilename(file.name))) {
      const fallbackPerson = personFromFilename(file.name)
      for (const row of rows) {
        const date = col(row, 'date')
        const amount = amountOf(col(row, 'amount'))
        const who = col(row, 'person') || fallbackPerson || ''
        if (!isDate(date) || amount === null || !who) {
          summary.invalid++
          continue
        }
        const personId = personFor(who)
        const type = norm(col(row, 'type'))
        const directionCell = norm(col(row, 'direction'))
        const direction: LoanDirection = directionCell === 'borrowed' ? 'in' : 'out'

        if (type === 'loan') {
          const { purpose, notes } = splitPurpose(col(row, 'purpose / notes'))
          if (!fresh(`l|${personId}|${direction}|${date}|${amount}|${norm(purpose || 'Personal')}`)) continue
          const due = col(row, 'due')
          add.loans.push({
            id: makeId(), personId, direction, date, amount,
            purpose: purpose || 'Personal', notes,
            dueDate: isDate(due) ? due : undefined,
            writtenOff: norm(col(row, 'status')) === 'written off' || undefined,
          })
          summary.loans++
        } else if (type === 'they paid me' || type === 'i paid them' || type === 'repayment') {
          const repaymentDirection: LoanDirection = type === 'i paid them' ? 'in' : type === 'they paid me' ? 'out' : direction
          if (!fresh(`r|${personId}|${repaymentDirection}|${date}|${amount}`)) continue
          add.repayments.push({
            id: makeId(), personId, direction: repaymentDirection, date, amount,
            notes: col(row, 'purpose / notes') || col(row, 'notes'),
          })
          summary.repayments++
        } else {
          summary.invalid++
        }
      }
      continue
    }

    summary.unrecognised.push(file.name)
  }

  return { add, summary }
}
