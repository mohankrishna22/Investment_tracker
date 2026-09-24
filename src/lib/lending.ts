import type { AppData, Loan, LoanDirection, Person, Repayment } from './types'

export interface LoanState {
  loan: Loan
  /** How much of this loan has been covered by repayments. */
  repaid: number
  outstanding: number
  status: 'settled' | 'partial' | 'open' | 'written-off'
  overdue: boolean
  daysOverdue: number
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

const todayIso = () => new Date().toISOString().slice(0, 10)

function daysBetween(fromIso: string, toIso: string) {
  const from = Date.parse(fromIso)
  const to = Date.parse(toIso)
  if (Number.isNaN(from) || Number.isNaN(to)) return 0
  return Math.floor((to - from) / 86400000)
}

/**
 * Repayments are not tagged with a loan — asking which of four loans a transfer
 * covers is friction nobody wants. Instead the pot is applied to the oldest
 * unsettled loan first, which is how people actually think about paying back.
 */
export function allocate(loans: Loan[], repayments: Repayment[]): LoanState[] {
  const ordered = [...loans].sort((a, b) => a.date.localeCompare(b.date))
  let pot = sum(repayments.map((r) => r.amount))
  const today = todayIso()

  return ordered.map((loan) => {
    if (loan.writtenOff) {
      return {
        loan,
        repaid: 0,
        outstanding: 0,
        status: 'written-off' as const,
        overdue: false,
        daysOverdue: 0,
      }
    }
    const repaid = Math.min(pot, loan.amount)
    pot -= repaid
    const outstanding = loan.amount - repaid
    const overdue = outstanding > 0 && !!loan.dueDate && loan.dueDate < today
    return {
      loan,
      repaid,
      outstanding,
      status: outstanding === 0 ? 'settled' : repaid > 0 ? 'partial' : 'open',
      overdue,
      daysOverdue: overdue && loan.dueDate ? daysBetween(loan.dueDate, today) : 0,
    }
  })
}

/** One direction's ledger: either what they owe you, or what you owe them. */
export interface SideStats {
  principal: number
  repaid: number
  outstanding: number
  writtenOff: number
  overdueAmount: number
  maxDaysOverdue: number
  loanCount: number
  openLoanCount: number
  repaymentCount: number
  nextDue?: string
  /** Repaid beyond what was borrowed — usually a missing loan. */
  credit: number
  states: LoanState[]
}

const emptySide = (): SideStats => ({
  principal: 0,
  repaid: 0,
  outstanding: 0,
  writtenOff: 0,
  overdueAmount: 0,
  maxDaysOverdue: 0,
  loanCount: 0,
  openLoanCount: 0,
  repaymentCount: 0,
  credit: 0,
  states: [],
})

export function sideStats(
  loans: Loan[],
  repayments: Repayment[],
  direction: LoanDirection,
): SideStats {
  const mine = loans.filter((l) => l.direction === direction)
  const theirs = repayments.filter((r) => r.direction === direction)
  if (mine.length === 0 && theirs.length === 0) return emptySide()

  const states = allocate(mine, theirs)
  const live = states.filter((s) => s.status !== 'written-off')
  const principal = sum(live.map((s) => s.loan.amount))
  const repaid = sum(theirs.map((r) => r.amount))
  const overdue = states.filter((s) => s.overdue)
  const upcoming = live
    .filter((s) => s.outstanding > 0 && s.loan.dueDate)
    .map((s) => s.loan.dueDate!)
    .sort()

  return {
    principal,
    repaid,
    outstanding: sum(live.map((s) => s.outstanding)),
    writtenOff: sum(states.filter((s) => s.status === 'written-off').map((s) => s.loan.amount)),
    overdueAmount: sum(overdue.map((s) => s.outstanding)),
    maxDaysOverdue: overdue.reduce((a, s) => Math.max(a, s.daysOverdue), 0),
    loanCount: mine.length,
    openLoanCount: live.filter((s) => s.outstanding > 0).length,
    repaymentCount: theirs.length,
    nextDue: upcoming[0],
    credit: Math.max(0, repaid - principal),
    states,
  }
}

export interface PersonStats {
  /** What you lent them and what is still owed to you. */
  out: SideStats
  /** What you borrowed from them and what you still owe. */
  in: SideStats
  /** Positive means they owe you more than you owe them. */
  net: number
  firstDate?: string
  lastDate?: string
  hasBoth: boolean
  maxDaysOverdue: number
}

export function statsForPerson(
  person: Person,
  loans: Loan[],
  repayments: Repayment[],
): PersonStats {
  const mine = loans.filter((l) => l.personId === person.id)
  const theirs = repayments.filter((r) => r.personId === person.id)
  const out = sideStats(mine, theirs, 'out')
  const inbound = sideStats(mine, theirs, 'in')
  const dates = [...mine.map((l) => l.date), ...theirs.map((r) => r.date)].filter(Boolean).sort()

  return {
    out,
    in: inbound,
    net: out.outstanding - inbound.outstanding,
    firstDate: dates[0],
    lastDate: dates[dates.length - 1],
    hasBoth: out.loanCount > 0 && inbound.loanCount > 0,
    maxDaysOverdue: Math.max(out.maxDaysOverdue, inbound.maxDaysOverdue),
  }
}

export interface LendingTotals {
  owedToMe: number
  iOwe: number
  net: number
  lentTotal: number
  borrowedTotal: number
  receivedBack: number
  paidBack: number
  overdueToMe: number
  overdueIOwe: number
  peopleCount: number
  owingMeCount: number
  owedByMeCount: number
  writtenOff: number
}

export function lendingTotals(data: AppData): LendingTotals {
  const perPerson = data.people.map((p) => statsForPerson(p, data.loans, data.repayments))
  const owedToMe = sum(perPerson.map((s) => s.out.outstanding))
  const iOwe = sum(perPerson.map((s) => s.in.outstanding))

  return {
    owedToMe,
    iOwe,
    net: owedToMe - iOwe,
    lentTotal: sum(perPerson.map((s) => s.out.principal)),
    borrowedTotal: sum(perPerson.map((s) => s.in.principal)),
    receivedBack: sum(perPerson.map((s) => s.out.repaid)),
    paidBack: sum(perPerson.map((s) => s.in.repaid)),
    overdueToMe: sum(perPerson.map((s) => s.out.overdueAmount)),
    overdueIOwe: sum(perPerson.map((s) => s.in.overdueAmount)),
    peopleCount: data.people.length,
    owingMeCount: perPerson.filter((s) => s.out.outstanding > 0).length,
    owedByMeCount: perPerson.filter((s) => s.in.outstanding > 0).length,
    writtenOff: sum(perPerson.map((s) => s.out.writtenOff + s.in.writtenOff)),
  }
}

export interface DueSoon {
  person: Person
  state: LoanState
  direction: LoanDirection
}

/** Unsettled loans due within `days`, plus everything already overdue, both ways. */
export function dueSoon(data: AppData, days = 30): DueSoon[] {
  const today = todayIso()
  const horizon = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)

  return data.people
    .flatMap((person) => {
      const stats = statsForPerson(person, data.loans, data.repayments)
      return (['out', 'in'] as const).flatMap((direction) =>
        (direction === 'out' ? stats.out : stats.in).states
          .filter(
            (state) =>
              state.outstanding > 0 &&
              state.loan.dueDate &&
              (state.loan.dueDate < today || state.loan.dueDate <= horizon),
          )
          .map((state) => ({ person, state, direction })),
      )
    })
    .sort((a, b) => (a.state.loan.dueDate ?? '').localeCompare(b.state.loan.dueDate ?? ''))
}
