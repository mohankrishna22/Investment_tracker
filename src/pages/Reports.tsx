import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { groupSum, monthlySeries, portfolioStats, statsFor } from '../lib/calc'
import { lendingTotals, statsForPerson } from '../lib/lending'
import { formatDate, formatMoney, formatMonth, formatPercent } from '../lib/format'
import { download, investmentsCsv, loansCsv, payoutsCsv, toCsv } from '../lib/csv'
import { Empty, Kpi } from '../components/ui'

type LedgerFilter = 'all' | 'investments' | 'loans'

interface LedgerRow {
  id: string
  date: string
  who: string
  detail: string
  kind: string
  group: 'investments' | 'loans'
  out: number
  in: number
}

/** Whether a "yyyy-mm-dd" falls in the selected year ("all" matches everything). */
const within = (date: string, year: string) => year === 'all' || date.startsWith(year)

export default function Reports() {
  const { data } = useStore()
  const [year, setYear] = useState('all')
  const [ledgerFilter, setLedgerFilter] = useState<LedgerFilter>('all')
  const money = (n: number) => formatMoney(n, data.settings)

  const years = useMemo(() => {
    const set = new Set<string>()
    for (const list of [data.investments, data.payouts, data.loans, data.repayments])
      for (const row of list) if (row.date) set.add(row.date.slice(0, 4))
    return [...set].sort().reverse()
  }, [data])

  const investments = useMemo(
    () => data.investments.filter((i) => within(i.date, year)),
    [data.investments, year],
  )
  const payouts = useMemo(() => data.payouts.filter((p) => within(p.date, year)), [data.payouts, year])
  const loans = useMemo(() => data.loans.filter((l) => within(l.date, year)), [data.loans, year])
  const repayments = useMemo(
    () => data.repayments.filter((r) => within(r.date, year)),
    [data.repayments, year],
  )

  // Gap months matter in a chart, but in a table they are just noise.
  const months = useMemo(
    () => monthlySeries(investments, payouts).filter((m) => m.invested || m.returned),
    [investments, payouts],
  )
  const byCategory = useMemo(
    () => groupSum(investments, (i) => i.category, (i) => i.amount),
    [investments],
  )
  const byVentureCategory = useMemo(() => {
    const cat = (id: string) => data.ventures.find((v) => v.id === id)?.category ?? 'Unknown'
    return groupSum(investments, (i) => cat(i.ventureId), (i) => i.amount)
  }, [investments, data.ventures])

  /** Loan movements per month, both directions, for the selected period. */
  const loanMonths = useMemo(() => {
    const buckets = new Map<string, { lent: number; borrowed: number; backToYou: number; youRepaid: number }>()
    const at = (date: string) => {
      const key = date.slice(0, 7)
      if (!buckets.has(key)) buckets.set(key, { lent: 0, borrowed: 0, backToYou: 0, youRepaid: 0 })
      return buckets.get(key)!
    }
    for (const l of loans) at(l.date)[l.direction === 'out' ? 'lent' : 'borrowed'] += l.amount
    for (const r of repayments) at(r.date)[r.direction === 'out' ? 'backToYou' : 'youRepaid'] += r.amount
    return [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([month, v]) => ({ month, ...v }))
  }, [loans, repayments])

  /** Current balances with each person — balances are "now", not per period. */
  const balances = useMemo(
    () =>
      data.people
        .map((person) => ({ person, stats: statsForPerson(person, data.loans, data.repayments) }))
        .filter(({ stats }) => stats.out.outstanding > 0 || stats.in.outstanding > 0)
        .sort((a, b) => Math.abs(b.stats.net) - Math.abs(a.stats.net)),
    [data.people, data.loans, data.repayments],
  )

  /** Every movement of money in the period, whichever side of the app it came from. */
  const ledger = useMemo<LedgerRow[]>(() => {
    const venture = (id: string) => data.ventures.find((v) => v.id === id)?.name ?? 'Unknown'
    const person = (id: string) => data.people.find((p) => p.id === id)?.name ?? 'Unknown'
    return [
      ...investments.map((i) => ({
        id: i.id, date: i.date, who: venture(i.ventureId), detail: i.item,
        kind: 'Investment', group: 'investments' as const, out: i.amount, in: 0,
      })),
      ...payouts.map((p) => ({
        id: p.id, date: p.date, who: venture(p.ventureId), detail: p.notes || `${p.kind} payout`,
        kind: 'Return', group: 'investments' as const, out: 0, in: p.amount,
      })),
      ...loans.map((l) => ({
        id: l.id, date: l.date, who: person(l.personId), detail: l.purpose,
        kind: l.direction === 'out' ? 'Lent' : 'Borrowed', group: 'loans' as const,
        out: l.direction === 'out' ? l.amount : 0, in: l.direction === 'in' ? l.amount : 0,
      })),
      ...repayments.map((r) => ({
        id: r.id, date: r.date, who: person(r.personId), detail: r.notes || 'Repayment',
        kind: r.direction === 'out' ? 'Repaid to you' : 'You repaid', group: 'loans' as const,
        out: r.direction === 'in' ? r.amount : 0, in: r.direction === 'out' ? r.amount : 0,
      })),
    ].sort((a, b) => b.date.localeCompare(a.date))
  }, [investments, payouts, loans, repayments, data.ventures, data.people])

  const shownLedger = ledger.filter((r) => ledgerFilter === 'all' || r.group === ledgerFilter)
  const ledgerOut = shownLedger.reduce((a, r) => a + r.out, 0)
  const ledgerIn = shownLedger.reduce((a, r) => a + r.in, 0)

  const totals = useMemo(() => portfolioStats(data), [data])
  const loanTotals = useMemo(() => lendingTotals(data), [data])
  const invested = investments.reduce((a, i) => a + i.amount, 0)
  const returned = payouts.reduce((a, p) => a + p.amount, 0)

  if (data.ventures.length === 0 && data.people.length === 0) {
    return (
      <div className="page">
        <Empty
          title="No data to report on"
          message="Add an investment type or a loan first, and the reports fill in from there."
        />
      </div>
    )
  }

  const exportPortfolio = () => {
    const rows = data.ventures.map((v) => {
      const s = statsFor(v, data.investments, data.payouts)
      return [
        v.name,
        v.category,
        v.status,
        v.startDate,
        s.invested,
        s.returned,
        s.currentValue ?? '',
        s.net,
        s.roi.toFixed(2),
        s.xirr === undefined ? '' : s.xirr.toFixed(2),
      ]
    })
    download(
      'portfolio-summary.csv',
      toCsv(
        ['Name', 'Category', 'Status', 'Started', 'Invested', 'Returned', 'Current value', 'Net', 'ROI %', 'XIRR %'],
        rows,
      ),
    )
  }

  const periodLabel = year === 'all' ? 'all time' : year

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Reports</h1>
          <div className="sub">Cash flow across investments and loans, with a full ledger to export.</div>
        </div>
        <div className="spacer" />
        <select value={year} onChange={(e) => setYear(e.target.value)} style={{ width: 'auto' }}>
          <option value="all">All years</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <button onClick={exportPortfolio}>Export summary</button>
        <button onClick={() => download('investments.csv', investmentsCsv(data))}>Export investments</button>
        <button onClick={() => download('returns.csv', payoutsCsv(data))}>Export returns</button>
        <button onClick={() => download('loans.csv', loansCsv(data))}>Export loans</button>
      </div>

      <div className="grid grid-kpi" style={{ marginBottom: 18 }}>
        <Kpi label={`Invested · ${periodLabel}`} value={money(invested)} hint={`${investments.length} entries`} />
        <Kpi
          label={`Returns · ${periodLabel}`}
          value={money(returned)}
          tone="pos"
          hint={`Lifetime ROI ${formatPercent(totals.roi)}`}
        />
        <Kpi
          label="Owed to you now"
          value={money(loanTotals.owedToMe)}
          hint={`${loanTotals.owingMeCount} ${loanTotals.owingMeCount === 1 ? 'person' : 'people'}`}
        />
        <Kpi
          label="You owe now"
          value={money(loanTotals.iOwe)}
          hint={`${loanTotals.owedByMeCount} ${loanTotals.owedByMeCount === 1 ? 'person' : 'people'}`}
        />
      </div>

      <div className="grid grid-2" style={{ marginBottom: 18 }}>
        <div className="card">
          <div className="card-head">
            <h3>Investments month by month</h3>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th className="num">Invested</th>
                  <th className="num">Returned</th>
                  <th className="num hide-sm">Net</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m.month}>
                    <td>{formatMonth(m.month, data.settings.locale)}</td>
                    <td className="num">{m.invested ? money(m.invested) : '—'}</td>
                    <td className={`num ${m.returned ? 'pos' : 'muted'}`}>
                      {m.returned ? money(m.returned) : '—'}
                    </td>
                    <td className={`num hide-sm ${m.returned - m.invested >= 0 ? 'pos' : 'neg'}`}>
                      {money(m.returned - m.invested)}
                    </td>
                  </tr>
                ))}
                {months.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted">
                      No investment activity in this period.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td className="num">{money(invested)}</td>
                  <td className="num">{money(returned)}</td>
                  <td className={`num hide-sm ${returned - invested >= 0 ? 'pos' : 'neg'}`}>
                    {money(returned - invested)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Spend mix</h3>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Expense category</th>
                  <th className="num">Amount</th>
                  <th className="num">Share</th>
                </tr>
              </thead>
              <tbody>
                {byCategory.map((r) => (
                  <tr key={r.label}>
                    <td>{r.label}</td>
                    <td className="num">{money(r.total)}</td>
                    <td className="num muted">
                      {invested ? ((r.total / invested) * 100).toFixed(1) : '0.0'}%
                    </td>
                  </tr>
                ))}
                {byCategory.length === 0 && (
                  <tr>
                    <td colSpan={3} className="muted">
                      Nothing invested in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {byVentureCategory.length > 0 && (
              <table style={{ borderTop: '1px solid var(--border)' }}>
                <thead>
                  <tr>
                    <th>By sector</th>
                    <th className="num">Amount</th>
                    <th className="num">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {byVentureCategory.map((r) => (
                    <tr key={r.label}>
                      <td>{r.label}</td>
                      <td className="num">{money(r.total)}</td>
                      <td className="num muted">
                        {invested ? ((r.total / invested) * 100).toFixed(1) : '0.0'}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {data.people.length > 0 && (
        <div className="grid grid-2" style={{ marginBottom: 18 }}>
          <div className="card">
            <div className="card-head">
              <h3>Loan balances now</h3>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Person</th>
                    <th className="num">Owes you</th>
                    <th className="num">You owe</th>
                    <th className="num hide-sm">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {balances.map(({ person, stats }) => (
                    <tr key={person.id}>
                      <td>{person.name}</td>
                      <td className={`num ${stats.out.outstanding ? '' : 'muted'}`}>
                        {stats.out.outstanding ? money(stats.out.outstanding) : '—'}
                      </td>
                      <td className={`num ${stats.in.outstanding ? '' : 'muted'}`}>
                        {stats.in.outstanding ? money(stats.in.outstanding) : '—'}
                      </td>
                      <td className={`num hide-sm ${stats.net > 0 ? 'pos' : stats.net < 0 ? 'neg' : 'muted'}`}>
                        {money(Math.abs(stats.net))}
                      </td>
                    </tr>
                  ))}
                  {balances.length === 0 && (
                    <tr>
                      <td colSpan={4} className="muted">
                        Everyone is settled up.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Total</td>
                    <td className="num">{money(loanTotals.owedToMe)}</td>
                    <td className="num">{money(loanTotals.iOwe)}</td>
                    <td className={`num hide-sm ${loanTotals.net >= 0 ? 'pos' : 'neg'}`}>
                      {money(Math.abs(loanTotals.net))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h3>Loan activity month by month</h3>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th className="num">Lent</th>
                    <th className="num">Borrowed</th>
                    <th className="num">Paid back</th>
                  </tr>
                </thead>
                <tbody>
                  {loanMonths.map((m) => (
                    <tr key={m.month}>
                      <td>{formatMonth(m.month, data.settings.locale)}</td>
                      <td className={`num ${m.lent ? '' : 'muted'}`}>{m.lent ? money(m.lent) : '—'}</td>
                      <td className={`num ${m.borrowed ? '' : 'muted'}`}>{m.borrowed ? money(m.borrowed) : '—'}</td>
                      <td className="num">
                        {m.backToYou > 0 && <div className="pos">+{money(m.backToYou)} to you</div>}
                        {m.youRepaid > 0 && <div>{money(m.youRepaid)} by you</div>}
                        {!m.backToYou && !m.youRepaid && <span className="muted">—</span>}
                      </td>
                    </tr>
                  ))}
                  {loanMonths.length === 0 && (
                    <tr>
                      <td colSpan={4} className="muted">
                        No loan activity in this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h3>Ledger</h3>
          <div className="spacer" />
          <div className="segmented" style={{ width: 'auto', minWidth: 260 }}>
            {(['all', 'investments', 'loans'] as const).map((f) => (
              <button
                key={f}
                type="button"
                className={ledgerFilter === f ? 'active' : ''}
                onClick={() => setLedgerFilter(f)}
              >
                {f === 'all' ? 'Everything' : f === 'investments' ? 'Investments' : 'Loans'}
              </button>
            ))}
          </div>
        </div>
        <div className="table-wrap">
          <table className="stack-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Who / what</th>
                <th className="wrap-cell">Detail</th>
                <th>Kind</th>
                <th className="num">Out</th>
                <th className="num">In</th>
              </tr>
            </thead>
            <tbody>
              {shownLedger.map((r) => (
                <tr key={r.id}>
                  <td data-label="Date">{formatDate(r.date, data.settings.locale)}</td>
                  <td data-label="Who / what" className="table-lead">
                    {r.who}
                  </td>
                  <td data-label="Detail" className="wrap-cell">
                    {r.detail}
                  </td>
                  <td data-label="Kind">
                    <span className="badge badge-plain">{r.kind}</span>
                  </td>
                  <td data-label="Out" className={`num ${r.out ? '' : 'muted is-empty'}`}>
                    {r.out ? money(r.out) : '—'}
                  </td>
                  <td data-label="In" className={`num ${r.in ? 'pos' : 'muted is-empty'}`}>
                    {r.in ? money(r.in) : '—'}
                  </td>
                </tr>
              ))}
              {shownLedger.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted">
                    Nothing in this period.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} className="table-lead">
                  Period total · {shownLedger.length} entries
                </td>
                <td data-label="Out" className="num">
                  {money(ledgerOut)}
                </td>
                <td data-label="In" className="num">
                  {money(ledgerIn)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="summary-bar">
        <div className="stat">
          <div className="k">Money out · {periodLabel}</div>
          <div className="v">{money(ledgerOut)}</div>
        </div>
        <div className="stat">
          <div className="k">Money in · {periodLabel}</div>
          <div className="v pos">{money(ledgerIn)}</div>
        </div>
        <div className="stat">
          <div className="k">Net cash flow</div>
          <div className={`v ${ledgerIn - ledgerOut >= 0 ? 'pos' : 'neg'}`}>
            {money(ledgerIn - ledgerOut)}
          </div>
        </div>
        <div className="spacer" />
        <div className="stat">
          <div className="k">Lifetime investment ROI</div>
          <div className={`v ${totals.roi >= 0 ? 'pos' : 'neg'}`}>{formatPercent(totals.roi)}</div>
        </div>
      </div>
    </div>
  )
}
