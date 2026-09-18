import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { groupSum, monthlySeries, portfolioStats, statsFor } from '../lib/calc'
import { formatDate, formatMoney, formatMonth, formatPercent } from '../lib/format'
import { download, investmentsCsv, payoutsCsv, toCsv } from '../lib/csv'
import { Empty } from '../components/ui'

export default function Reports() {
  const { data } = useStore()
  const [year, setYear] = useState('all')
  const money = (n: number) => formatMoney(n, data.settings)

  const years = useMemo(() => {
    const set = new Set<string>()
    for (const i of data.investments) if (i.date) set.add(i.date.slice(0, 4))
    for (const p of data.payouts) if (p.date) set.add(p.date.slice(0, 4))
    return [...set].sort().reverse()
  }, [data])

  const investments = useMemo(
    () => data.investments.filter((i) => year === 'all' || i.date.startsWith(year)),
    [data.investments, year],
  )
  const payouts = useMemo(
    () => data.payouts.filter((p) => year === 'all' || p.date.startsWith(year)),
    [data.payouts, year],
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

  const ledger = useMemo(() => {
    const name = (id: string) => data.ventures.find((v) => v.id === id)?.name ?? 'Unknown'
    return [
      ...investments.map((i) => ({
        id: i.id,
        date: i.date,
        venture: name(i.ventureId),
        detail: i.item,
        kind: 'Investment',
        out: i.amount,
        in: 0,
      })),
      ...payouts.map((p) => ({
        id: p.id,
        date: p.date,
        venture: name(p.ventureId),
        detail: p.notes || `${p.kind} payout`,
        kind: 'Return',
        out: 0,
        in: p.amount,
      })),
    ].sort((a, b) => b.date.localeCompare(a.date))
  }, [investments, payouts, data.ventures])

  const totals = useMemo(() => portfolioStats(data), [data])
  const invested = investments.reduce((a, i) => a + i.amount, 0)
  const returned = payouts.reduce((a, p) => a + p.amount, 0)

  if (data.ventures.length === 0) {
    return (
      <div className="page">
        <Empty title="No data to report on" message="Add an investment type first." />
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
        v.currentValue ?? '',
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

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Reports</h1>
          <div className="sub">Cash flow, category mix and a full ledger you can export.</div>
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
        <button onClick={() => download('investments.csv', investmentsCsv(data))}>
          Export investments
        </button>
        <button onClick={() => download('returns.csv', payoutsCsv(data))}>Export returns</button>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 18 }}>
        <div className="card">
          <div className="card-head">
            <h3>Month by month</h3>
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
                      Nothing in this period.
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
              </tbody>
            </table>
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
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Ledger</h3>
          <div className="spacer" />
          <span className="muted">{ledger.length} entries</span>
        </div>
        <div className="table-wrap">
          <table className="stack-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Investment type</th>
                <th className="wrap-cell">Detail</th>
                <th>Kind</th>
                <th className="num">Out</th>
                <th className="num">In</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((r) => (
                <tr key={r.id}>
                  <td data-label="Date">{formatDate(r.date, data.settings.locale)}</td>
                  <td data-label="Investment type" className="table-lead">
                    {r.venture}
                  </td>
                  <td data-label="Detail" className="wrap-cell">
                    {r.detail}
                  </td>
                  <td data-label="Kind">
                    <span className="badge">{r.kind}</span>
                  </td>
                  <td data-label="Out" className={`num ${r.out ? '' : 'muted is-empty'}`}>
                    {r.out ? money(r.out) : '—'}
                  </td>
                  <td data-label="In" className={`num ${r.in ? 'pos' : 'muted is-empty'}`}>
                    {r.in ? money(r.in) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} className="table-lead">
                  Period total
                </td>
                <td data-label="Out" className="num">
                  {money(invested)}
                </td>
                <td data-label="In" className="num">
                  {money(returned)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="summary-bar">
        <div className="stat">
          <div className="k">{year === 'all' ? 'Total investment' : `Invested in ${year}`}</div>
          <div className="v">{money(invested)}</div>
        </div>
        <div className="stat">
          <div className="k">{year === 'all' ? 'Total returns' : `Returns in ${year}`}</div>
          <div className="v pos">{money(returned)}</div>
        </div>
        <div className="spacer" />
        <div className="stat">
          <div className="k">Lifetime ROI</div>
          <div className={`v ${totals.roi >= 0 ? 'pos' : 'neg'}`}>{formatPercent(totals.roi)}</div>
        </div>
      </div>
    </div>
  )
}
