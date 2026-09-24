import type { AppData, Investment, Loan, Payout, Person, Repayment, Venture } from './types'
import { emptyData, uid } from './store'

const iso = (y: number, m: number, d: number) =>
  new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10)

/** A small, realistic portfolio so the app can be explored before real data exists. */
export function demoData(): AppData {
  const base = emptyData()
  const year = new Date().getFullYear()

  const ventures: Venture[] = [
    {
      id: uid(),
      name: 'Brew & Bloom Cafe',
      category: 'Food & Beverage',
      description: 'Neighbourhood cafe, 40% partnership stake.',
      startDate: iso(year - 2, 3, 12),
      status: 'active',
      targetAmount: 1200000,
      currentValue: 1450000,
      color: '#1baf7a',
      createdAt: new Date().toISOString(),
    },
    {
      id: uid(),
      name: 'Kestrel Logistics',
      category: 'Transport',
      description: 'Two-truck freight operation on long-haul contracts.',
      startDate: iso(year - 1, 7, 1),
      status: 'active',
      targetAmount: 2500000,
      currentValue: 2300000,
      color: '#2a78d6',
      createdAt: new Date().toISOString(),
    },
    {
      id: uid(),
      name: 'Plot 14, Green Acres',
      category: 'Real Estate',
      description: 'Land parcel held for appreciation.',
      startDate: iso(year - 3, 1, 20),
      status: 'active',
      currentValue: 3100000,
      color: '#eda100',
      createdAt: new Date().toISOString(),
    },
  ]

  const [cafe, logistics, land] = ventures

  const investments: Investment[] = [
    [cafe, iso(year - 2, 3, 12), 600000, 'Initial partnership capital', 'Capital', 'Bank transfer'],
    [cafe, iso(year - 2, 4, 2), 285000, 'Espresso machine + grinder', 'Equipment', 'Card'],
    [cafe, iso(year - 2, 4, 18), 120000, 'Interior fit-out', 'Renovation', 'UPI'],
    [cafe, iso(year - 1, 1, 9), 95000, 'Second outlet counter', 'Equipment', 'Bank transfer'],
    [cafe, iso(year - 1, 9, 5), 60000, 'Festival marketing push', 'Marketing', 'UPI'],
    [logistics, iso(year - 1, 7, 1), 1500000, 'Truck #1 down payment', 'Capital', 'Bank transfer'],
    [logistics, iso(year - 1, 11, 14), 700000, 'Truck #2 down payment', 'Capital', 'Bank transfer'],
    [logistics, iso(year, 2, 3), 180000, 'Fleet insurance & permits', 'Licenses & Fees', 'Cheque'],
    [land, iso(year - 3, 1, 20), 1800000, 'Plot purchase', 'Capital', 'Cheque'],
    [land, iso(year - 3, 2, 11), 140000, 'Registration & stamp duty', 'Licenses & Fees', 'Bank transfer'],
    [land, iso(year - 2, 6, 8), 90000, 'Boundary wall', 'Renovation', 'Cash'],
  ].map(([v, date, amount, item, category, mode]) => ({
    id: uid(),
    ventureId: (v as Venture).id,
    date: date as string,
    amount: amount as number,
    item: item as string,
    category: category as string,
    paymentMode: mode as string,
    notes: '',
  }))

  const payouts: Payout[] = [
    [cafe, iso(year - 1, 4, 30), 85000, 'profit', 'FY quarter share'],
    [cafe, iso(year - 1, 10, 31), 110000, 'profit', 'Festive quarter'],
    [cafe, iso(year, 4, 30), 140000, 'profit', 'Best quarter yet'],
    [logistics, iso(year, 1, 15), 220000, 'profit', 'Contract settlement'],
    [logistics, iso(year, 5, 15), 260000, 'profit', 'Contract settlement'],
    [land, iso(year - 1, 3, 1), 45000, 'rent', 'Seasonal ground lease'],
  ].map(([v, date, amount, kind, notes]) => ({
    id: uid(),
    ventureId: (v as Venture).id,
    date: date as string,
    amount: amount as number,
    kind: kind as Payout['kind'],
    notes: notes as string,
  }))

  const people: Person[] = [
    {
      id: uid(),
      name: 'Ravi',
      contact: 'College friend',
      notes: 'Always pays back, just slowly.',
      color: '#4a3aa7',
      createdAt: new Date().toISOString(),
    },
    {
      id: uid(),
      name: 'Anita',
      contact: 'Cousin',
      notes: '',
      color: '#e87ba4',
      createdAt: new Date().toISOString(),
    },
    {
      id: uid(),
      name: 'Deepak',
      contact: 'Neighbour',
      notes: 'Settled up in full.',
      color: '#eb6834',
      createdAt: new Date().toISOString(),
    },
  ]

  const [ravi, anita, deepak] = people

  const loans: Loan[] = [
    ['out', ravi, iso(year - 1, 6, 12), 50000, 'Medical', iso(year - 1, 12, 12), ''],
    ['out', ravi, iso(year, 2, 2), 20000, 'Personal', iso(year, 8, 2), 'For the house move'],
    ['out', anita, iso(year, 5, 20), 75000, 'Education', iso(year + 1, 5, 20), 'Semester fees'],
    ['out', deepak, iso(year - 2, 9, 4), 15000, 'Emergency', iso(year - 2, 12, 4), ''],
    // Borrowed the other way, to show a person you owe as well as one who owes you.
    ['in', anita, iso(year, 3, 10), 120000, 'Business', iso(year + 1, 3, 10), 'Bridge for the fleet deposit'],
    ['in', deepak, iso(year - 1, 8, 1), 30000, 'Personal', iso(year, 2, 1), ''],
  ].map(([direction, p, date, amount, purpose, dueDate, notes]) => ({
    id: uid(),
    direction: direction as Loan['direction'],
    personId: (p as Person).id,
    date: date as string,
    amount: amount as number,
    purpose: purpose as string,
    dueDate: dueDate as string,
    notes: notes as string,
  }))

  const repayments: Repayment[] = [
    ['out', ravi, iso(year - 1, 9, 1), 20000, 'Part payment'],
    ['out', ravi, iso(year, 1, 15), 15000, ''],
    ['out', deepak, iso(year - 2, 11, 30), 15000, 'Settled in full'],
    ['in', anita, iso(year, 7, 5), 40000, 'First instalment'],
    ['in', deepak, iso(year, 1, 20), 30000, 'Cleared it'],
  ].map(([direction, p, date, amount, notes]) => ({
    id: uid(),
    direction: direction as Repayment['direction'],
    personId: (p as Person).id,
    date: date as string,
    amount: amount as number,
    notes: notes as string,
  }))

  return { ...base, ventures, investments, payouts, people, loans, repayments }
}
