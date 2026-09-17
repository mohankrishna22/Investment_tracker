import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../lib/store'
import { groupSum, monthlySeries, statsFor } from '../lib/calc'
import { formatDate, formatMoney, formatMonth, formatPercent, holdingPeriod } from '../lib/format'
import { seriesColor, type Investment, type Payout } from '../lib/types'
import { download, investmentsCsv, payoutsCsv } from '../lib/csv'
import { ConfirmButton, Empty, Kpi, StatusBadge } from '../components/ui'
import { InvestmentForm, PayoutForm, VentureForm } from '../components/forms'
import { Donut, GroupedBars } from '../components/charts'

type Tab = 'investments' | 'returns' | 'breakdown'

export default function VentureDetail({ dark }: { dark: boolean }) {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { data, deleteInvestment, deletePayout, deleteVenture } = useStore()
  const [tab, setTab] = useState<Tab>('investments')
  const [editVenture, setEditVenture] = useState(false)
  const [investmentModal, setInvestmentModal] = useState<Investment | 'new' | null>(null)
  const [payoutModal, setPayoutModal] = useState<Payout | 'new' | null>(null)

  const venture = data.ventures.find((v) => v.id === id)
  const money = (n: number) => formatMoney(n, data.settings)

  const investments = useMemo(
    () =>
      data.investments
        .filter((i) => i.ventureId === id)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [data.investments, id],
  )
  const payouts = useMemo(
    () => data.payouts.filter((p) => p.ventureId === id).sort((a, b) => b.date.localeCompare(a.date)),
    [data.payouts, id],
  )
  const stats = useMemo(
    () => (venture ? statsFor(venture, data.investments, data.payouts) : null),
    [venture, data.investments, data.payouts],
  )
  const byCategory = useMemo(
    () => groupSum(investments, (i) => i.category, (i) => i.amount),
    [investments],
  )
  const byItem = useMemo(() => groupSum(investments, (i) => i.item, (i) => i.amount), [investments])
  const byKind = useMemo(() => groupSum(payouts, (p) => p.kind, (p) => p.amount), [payouts])
  const months = useMemo(() => monthlySeries(investments, payouts).slice(-14), [investments, payouts])

  if (!venture || !stats) {
    return (
      <div className="page">
        <Empty
          title="Investment not found"
          message="It may have been deleted."
          action={
            <Link className="btn btn-primary" to="/">
              Back to home
            </Link>
          }
        />
      </div>
    )
  }

  const palette = (index: number) =>
    [
      seriesColor('#2a78d6', dark),
      seriesColor('#eb6834', dark),
      seriesColor('#1baf7a', dark),
      seriesColor('#eda100', dark),
      seriesColor('#e87ba4', dark),
      '#008300',
    ][index % 6]

  return (
    <div className="page">
      <div className="page-head">
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span className="dot" style={{ background: seriesColor(venture.color, dark), marginTop: 0 }} />
            <h1>{venture.name}</h1>
            <StatusBadge status={venture.status} />
          </div>
          <div className="sub">
            {venture.category} · started {formatDate(venture.startDate, data.settings.locale)} ·
            held {holdingPeriod(venture.startDate)}
          </div>
          {venture.description && (
            <div className="sub" style={{ maxWidth: 640 }}>
              {venture.description}
            </div>
          )}
        </div>
        <div className="spacer" />
        <Link className="btn" to="/">
          ← Home
        </Link>
        <button onClick={() => setEditVenture(true)}>Edit</button>
        <button onClick={() => setPayoutModal('new')}>+ Return</button>
        <button className="btn-primary" onClick={() => setInvestmentModal('new')}>
          + Investment
        </button>
      </div>

      <div className="grid grid-kpi" style={{ marginBottom: 18 }}>
        <Kpi label="Invested" value={money(stats.invested)} hint={`${stats.investmentCount} entries`} />
        <Kpi
          label="Returns received"
          value={money(stats.returned)}
          hint={`${stats.payoutCount} payouts · ${(stats.recovered * 100).toFixed(0)}% recovered`}
        />
        <Kpi
          label={stats.currentValue !== undefined ? 'Net incl. current value' : 'Net position'}
          value={money(stats.net)}
          tone={stats.net >= 0 ? 'pos' : 'neg'}
          hint={
            stats.currentValue !== undefined
              ? `Current value ${money(stats.currentValue)}`
              : `ROI ${formatPercent(stats.roi)}`
          }
        />
        <Kpi
          label="Annualised (XIRR)"
          value={formatPercent(stats.xirr)}
          tone={(stats.xirr ?? 0) >= 0 ? 'pos' : 'neg'}
          hint={`ROI ${formatPercent(stats.roi)}`}
        />
      </div>

      <div className="tabs">
        <button className={tab === 'investments' ? 'active' : ''} onClick={() => setTab('investments')}>
          Investments ({investments.length})
        </button>
        <button className={tab === 'returns' ? 'active' : ''} onClick={() => setTab('returns')}>
          Returns ({payouts.length})
        </button>
        <button className={tab === 'breakdown' ? 'active' : ''} onClick={() => setTab('breakdown')}>
          Breakdown
        </button>
      </div>

      {tab === 'investments' &&
        (investments.length === 0 ? (
          <Empty
            title="No investments logged"
            message="Add the first entry — how much went in, on what date, and for what."
            action={
              <button className="btn-primary" onClick={() => setInvestmentModal('new')}>
                + Add investment
              </button>
            }
          />
        ) : (
          <div className="card">
            <div className="card-head">
              <h3>Every rupee that went in</h3>
              <div className="spacer" />
              <button
                className="btn-sm"
                onClick={() =>
                  download(`${venture.name}-investments.csv`, investmentsCsv(data, venture.id))
                }
              >
                Export CSV
              </button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Item</th>
                    <th>Category</th>
                    <th>Paid by</th>
                    <th className="wrap-cell">Notes</th>
                    <th className="num">Amount</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {investments.map((i) => (
                    <tr key={i.id}>
                      <td>{formatDate(i.date, data.settings.locale)}</td>
                      <td>{i.item}</td>
                      <td>
                        <span className="badge">{i.category}</span>
                      </td>
                      <td className="muted">{i.paymentMode}</td>
                      <td className="wrap-cell muted">{i.notes || '—'}</td>
                      <td className="num">{money(i.amount)}</td>
                      <td>
                        <div className="row-actions">
                          <button className="btn-ghost btn-sm" onClick={() => setInvestmentModal(i)}>
                            Edit
                          </button>
                          <ConfirmButton onConfirm={() => deleteInvestment(i.id)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={5}>Total invested · {investments.length} entries</td>
                    <td className="num">{money(stats.invested)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        ))}

      {tab === 'returns' &&
        (payouts.length === 0 ? (
          <Empty
            title="No returns recorded"
            message="Log profit shares, dividends, rent or a sale as they come in."
            action={
              <button className="btn-primary" onClick={() => setPayoutModal('new')}>
                + Record a return
              </button>
            }
          />
        ) : (
          <div className="card">
            <div className="card-head">
              <h3>Everything that came back</h3>
              <div className="spacer" />
              <button
                className="btn-sm"
                onClick={() => download(`${venture.name}-returns.csv`, payoutsCsv(data, venture.id))}
              >
                Export CSV
              </button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th className="wrap-cell">Notes</th>
                    <th className="num">Amount</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((p) => (
                    <tr key={p.id}>
                      <td>{formatDate(p.date, data.settings.locale)}</td>
                      <td>
                        <span className="badge">{p.kind}</span>
                      </td>
                      <td className="wrap-cell muted">{p.notes || '—'}</td>
                      <td className="num pos">{money(p.amount)}</td>
                      <td>
                        <div className="row-actions">
                          <button className="btn-ghost btn-sm" onClick={() => setPayoutModal(p)}>
                            Edit
                          </button>
                          <ConfirmButton onConfirm={() => deletePayout(p.id)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}>Total returns · {payouts.length} payouts</td>
                    <td className="num">{money(stats.returned)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        ))}

      {tab === 'breakdown' && (
        <div className="grid grid-2-wide">
          <div className="card">
            <div className="card-head">
              <h3>Spend by category</h3>
            </div>
            <div className="card-pad">
              <Donut
                slices={byCategory.slice(0, 6).map((c, idx) => ({
                  label: c.label,
                  value: c.total,
                  color: palette(idx),
                }))}
                centerLabel="Invested"
                centerValue={formatMoney(stats.invested, data.settings, { compact: true })}
                formatValue={money}
              />
            </div>
          </div>
          <div className="card">
            <div className="card-head">
              <h3>Month by month</h3>
            </div>
            <div className="card-pad">
              <GroupedBars
                points={months.map((m) => ({
                  label: formatMonth(m.month, data.settings.locale),
                  a: m.invested,
                  b: m.returned,
                }))}
                seriesA="Invested"
                seriesB="Returned"
                colorA={dark ? '#3987e5' : '#2a78d6'}
                colorB="#008300"
                formatValue={money}
              />
            </div>
          </div>
          <div className="card">
            <div className="card-head">
              <h3>Biggest line items</h3>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="num">Amount</th>
                    <th className="num">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {byItem.slice(0, 10).map((r) => (
                    <tr key={r.label}>
                      <td>{r.label}</td>
                      <td className="num">{money(r.total)}</td>
                      <td className="num muted">
                        {stats.invested ? ((r.total / stats.invested) * 100).toFixed(1) : '0.0'}%
                      </td>
                    </tr>
                  ))}
                  {byItem.length === 0 && (
                    <tr>
                      <td colSpan={3} className="muted">
                        No investments logged yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card">
            <div className="card-head">
              <h3>Returns by type</h3>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th className="num">Amount</th>
                    <th className="num">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {byKind.map((r) => (
                    <tr key={r.label}>
                      <td style={{ textTransform: 'capitalize' }}>{r.label}</td>
                      <td className="num">{money(r.total)}</td>
                      <td className="num muted">
                        {stats.returned ? ((r.total / stats.returned) * 100).toFixed(1) : '0.0'}%
                      </td>
                    </tr>
                  ))}
                  {byKind.length === 0 && (
                    <tr>
                      <td colSpan={3} className="muted">
                        No returns recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="summary-bar">
        <div className="stat">
          <div className="k">Total investment</div>
          <div className="v">{money(stats.invested)}</div>
        </div>
        <div className="stat">
          <div className="k">Returns received</div>
          <div className="v pos">{money(stats.returned)}</div>
        </div>
        {stats.currentValue !== undefined && (
          <div className="stat">
            <div className="k">Current value</div>
            <div className="v">{money(stats.currentValue)}</div>
          </div>
        )}
        <div className="stat">
          <div className="k">Net</div>
          <div className={`v ${stats.net >= 0 ? 'pos' : 'neg'}`}>
            {money(stats.net)} ({formatPercent(stats.roi)})
          </div>
        </div>
        <div className="spacer" />
        <ConfirmButton
          className="btn-sm"
          label="Delete this investment type"
          confirmLabel="Delete everything in it?"
          onConfirm={() => {
            deleteVenture(venture.id)
            navigate('/')
          }}
        />
      </div>

      {editVenture && <VentureForm venture={venture} onClose={() => setEditVenture(false)} />}
      {investmentModal && (
        <InvestmentForm
          ventureId={venture.id}
          investment={investmentModal === 'new' ? undefined : investmentModal}
          onClose={() => setInvestmentModal(null)}
        />
      )}
      {payoutModal && (
        <PayoutForm
          ventureId={venture.id}
          payout={payoutModal === 'new' ? undefined : payoutModal}
          onClose={() => setPayoutModal(null)}
        />
      )}
    </div>
  )
}
