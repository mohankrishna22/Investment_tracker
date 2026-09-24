import type { AppData, Loan, Person, Repayment } from './types'

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
 * Repayments are not tagged with a loan — asking someone to say which of four
 * loans their transfer covers is friction nobody wants. Instead the pot is
 * applied to the oldest unsettled loan first, which is how people actually
 * think about "paying me back".
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

export interface PersonStats {
  lent: number
  repaid: number
  outstanding: number
  writtenOff: number
  overdueAmount: number
  /** Worst overdue loan, for the "chase this one" nudge. */
  maxDaysOverdue: number
  loanCount: number
  openLoanCount: number
  repaymentCount: number
  firstDate?: string
  lastDate?: string
  /** Next due date among unsettled loans. */
  nextDue?: string
  /** Any repayment money beyond what was lent, i.e. an overpayment. */
  credit: number
}

export function statsForPerson(
  person: Person,
  loans: Loan[],
  repayments: Repayment[],
): PersonStats {
  const mine = loans.filter((l) => l.personId === person.id)
  const theirs = repayments.filter((r) => r.personId === person.id)
  const states = allocate(mine, theirs)

  const live = states.filter((s) => s.status !== 'written-off')
  const lent = sum(live.map((s) => s.loan.amount))
  const repaidTotal = sum(theirs.map((r) => r.amount))
  const outstanding = sum(live.map((s) => s.outstanding))
  const overdue = states.filter((s) => s.overdue)
  const dates = [...mine.map((l) => l.date), ...theirs.map((r) => r.date)].filter(Boolean).sort()
  const upcoming = live
    .filter((s) => s.outstanding > 0 && s.loan.dueDate)
    .map((s) => s.loan.dueDate!)
    .sort()

  return {
    lent,
    repaid: repaidTotal,
    outstanding,
    writtenOff: sum(states.filter((s) => s.status === 'written-off').map((s) => s.loan.amount)),
    overdueAmount: sum(overdue.map((s) => s.outstanding)),
    maxDaysOverdue: overdue.reduce((a, s) => Math.max(a, s.daysOverdue), 0),
    loanCount: mine.length,
    openLoanCount: live.filter((s) => s.outstanding > 0).length,
    repaymentCount: theirs.length,
    firstDate: dates[0],
    lastDate: dates[dates.length - 1],
    nextDue: upcoming[0],
    credit: Math.max(0, repaidTotal - lent),
  }
}

export interface LendingTotals {
  lent: number
  repaid: number
  outstanding: number
  writtenOff: number
  overdueAmount: number
  peopleCount: number
  owingCount: number
  overdueCount: number
  recoveredShare: number
}

export function lendingTotals(data: AppData): LendingTotals {
  const perPerson = data.people.map((p) => statsForPerson(p, data.loans, data.repayments))
  const lent = sum(perPerson.map((s) => s.lent))
  const repaid = sum(perPerson.map((s) => s.repaid))

  return {
    lent,
    repaid,
    outstanding: sum(perPerson.map((s) => s.outstanding)),
    writtenOff: sum(perPerson.map((s) => s.writtenOff)),
    overdueAmount: sum(perPerson.map((s) => s.overdueAmount)),
    peopleCount: data.people.length,
    owingCount: perPerson.filter((s) => s.outstanding > 0).length,
    overdueCount: perPerson.filter((s) => s.overdueAmount > 0).length,
    recoveredShare: lent > 0 ? Math.min(1, repaid / lent) : 0,
  }
}

export interface DueSoon {
  person: Person
  state: LoanState
}

/** Unsettled loans due within `days`, plus everything already overdue. */
export function dueSoon(data: AppData, days = 30): DueSoon[] {
  const today = todayIso()
  const horizon = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)

  return data.people
    .flatMap((person) =>
      allocate(
        data.loans.filter((l) => l.personId === person.id),
        data.repayments.filter((r) => r.personId === person.id),
      )
        .filter(
          (state) =>
            state.outstanding > 0 &&
            state.loan.dueDate &&
            (state.loan.dueDate < today || state.loan.dueDate <= horizon),
        )
        .map((state) => ({ person, state })),
    )
    .sort((a, b) => (a.state.loan.dueDate ?? '').localeCompare(b.state.loan.dueDate ?? ''))
}
