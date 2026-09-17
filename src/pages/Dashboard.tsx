import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { monthlySeries, portfolioStats, statsFor } from '../lib/calc'
import { formatDate, formatMoney, formatMonth, formatPercent, holdingPeriod } from '../lib/format'
import { seriesColor } from '../lib/types'
import { Donut, GroupedBars } from '../components/charts'
import { Empty, Kpi, StatusBadge } from '../components/ui'
import { VentureForm, InvestmentForm, PayoutForm } from '../components/forms'

type SortKey = 'invested' | 'returned' | 'roi' | 'recent' | 'name'

export default function Dashboard({ dark }: { dark: boolean }) {
  const { data } = useStore()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState<SortKey>('invested')
  const [modal, setModal] = useState<null | 'venture' | 'investment' | 'payout'>(null)

  const money = (n: number) => formatMoney(n, data.settings)
  const compact = (n: number) => formatMoney(n, data.settings, { compact: true })

  const rows = useMemo(
    () =>
      data.ventures.map((v) => ({ venture: v, stats: statsFor(v, data.investments, data.payouts) })),
    [data.ventures, data.investments, data.payouts],
  )

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = rows.filter(
      ({ venture }) =>
        (status === 'all' || venture.status === status) &&
        (!q ||
          venture.name.toLowerCase().includes(q) ||
          venture.category.toLowerCase().includes(q) ||
          venture.description.toLowerCase().includes(q)),
    )
    const sorters: Record<SortKey, (a: typeof filtered[0], b: typeof filtered[0]) => number> = {
      invested: (a, b) => b.stats.invested - a.stats.invested,
      returned: (a, b) => b.stats.returned - a.stats.returned,
      roi: (a, b) => b.stats.roi - a.stats.roi,
      recent: (a, b) => (b.stats.lastDate ?? '').localeCompare(a.stats.lastDate ?? ''),
      name: (a, b) => a.venture.name.localeCompare(b.venture.name),
    }
    return [...filtered].sort(sorters[sort])
  }, [rows, query, status, sort])

  const totals = useMemo(() => portfolioStats(data), [data])

  const allocation = useMemo(() => {
    const ranked = rows
      .filter((r) => r.stats.invested > 0)
      .sort((a, b) => b.stats.invested - a.stats.invested)
    const top = ranked.slice(0, 6).map((r) => ({
      label: r.venture.name,
      value: r.stats.invested,
      color: seriesColor(r.venture.color, dark),
    }))
    const rest = ranked.slice(6)
    if (rest.length) {
      top.push({
        label: `Other (${rest.length})`,
        value: rest.reduce((a, r) => a + r.stats.invested, 0),
        color: dark ? '#8a94ab' : '#6b7589',
      })
    }
    return top
  }, [rows, dark])

  const months = useMemo(
    () => monthlySeries(data.investments, data.payouts).slice(-14),
    [data.investments, data.payouts],
  )

  const recent = useMemo(() => {
    const name = (id: string) => data.ventures.find((v) => v.id === id)?.name ?? 'Unknown'
    return [
      ...data.investments.map((i) => ({
        id: i.id,
        kind: 'out' as const,
        date: i.date,
        title: i.item,
        venture: name(i.ventureId),
        ventureId: i.ventureId,
        amount: i.amount,
      })),
      ...data.payouts.map((p) => ({
        id: p.id,
        kind: 'in' as const,
        date: p.date,
        title: `${p.kind[0].toUpperCase()}${p.kind.slice(1)} received`,
        venture: name(p.ventureId),
        ventureId: p.ventureId,
        amount: p.amount,
      })),
    ]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 8)
  }, [data])

  if (data.ventures.length === 0) {
    return (
      <div className="page">
        <Empty
          title="No investments yet"
          message="Create your first investment type — a business, a property, a fund — then log what you put in and what comes back."
          action={
            <button className="btn-primary" onClick={() => setModal('venture')}>
              + New investment type
            </button>
          }
        />
        <p className="muted" style={{ textAlign: 'center', marginTop: 16 }}>
          Want to look around first? <Link to="/settings">Load sample data</Link>.
        </p>
        {modal === 'venture' && (
          <VentureForm onClose={() => setModal(null)} onCreated={(v) => navigate(`/venture/${v.id}`)} />
        )}
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{data.settings.ownerName ? `${data.settings.ownerName}'s portfolio` : 'Portfolio'}</h1>
          <div className="sub">
            {totals.ventureCount} investment {totals.ventureCount === 1 ? 'type' : 'types'} ·{' '}
            {totals.activeCount} active · {totals.investmentCount} entries logged
          </div>
        </div>
        <div className="spacer" />
        <button onClick={() => setModal('payout')}>+ Return</button>
        <button onClick={() => setModal('investment')}>+ Investment</button>
        <button className="btn-primary" onClick={() => setModal('venture')}>
          + Investment type
        </button>
      </div>

      <div className="grid grid-kpi" style={{ marginBottom: 18 }}>
        <Kpi label="Total invested" value={money(totals.invested)} hint={`${totals.investmentCount} entries`} />
        <Kpi
          label="Returns received"
          value={money(totals.returned)}
          hint={`${(totals.recovered * 100).toFixed(0)}% of capital recovered`}
        />
        <Kpi
          label="Net position"
          value={money(totals.net)}
          tone={totals.net >= 0 ? 'pos' : 'neg'}
          hint={`ROI ${formatPercent(totals.roi)}`}
        />
        <Kpi
          label="Annualised (XIRR)"
          value={formatPercent(totals.xirr)}
          tone={(totals.xirr ?? 0) >= 0 ? 'pos' : 'neg'}
          hint={totals.firstDate ? `Tracking ${holdingPeriod(totals.firstDate)}` : 'Needs a month of history'}
        />
      </div>

      <div className="grid grid-2" style={{ marginBottom: 18 }}>
        <div className="card">
          <div className="card-head">
            <h3>Where the capital sits</h3>
          </div>
          <div className="card-pad">
            <Donut
              slices={allocation}
              centerLabel="Invested"
              centerValue={compact(totals.invested)}
              formatValue={money}
            />
          </div>
        </div>
        <div className="card">
          <div className="card-head">
            <h3>Money in and out by month</h3>
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
      </div>

      <div className="toolbar">
        <input
          className="search"
          placeholder="Search investments…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="planned">Planned</option>
          <option value="closed">Closed</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
          <option value="invested">Sort: most invested</option>
          <option value="returned">Sort: most returned</option>
          <option value="roi">Sort: best ROI</option>
          <option value="recent">Sort: latest activity</option>
          <option value="name">Sort: name</option>
        </select>
        <span className="muted" style={{ marginLeft: 'auto' }}>
          {visible.length} of {rows.length} shown
        </span>
      </div>

      {visible.length === 0 ? (
        <Empty title="Nothing matches" message="Try a different search term or status filter." />
      ) : (
        <div className="grid grid-cards">
          {visible.map(({ venture, stats }) => {
            const funded = venture.targetAmount
              ? Math.min(1, stats.invested / venture.targetAmount)
              : Math.min(1, stats.recovered)
            return (
              <Link key={venture.id} to={`/venture/${venture.id}`} className="card venture-card">
                <div className="venture-top">
                  <span className="dot" style={{ background: seriesColor(venture.color, dark) }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="venture-name">{venture.name}</div>
                    <div className="venture-meta">
                      {venture.category} · {stats.investmentCount} entries ·{' '}
                      {stats.lastDate
                        ? `last ${formatDate(stats.lastDate, data.settings.locale)}`
                        : 'no entries yet'}
                    </div>
                  </div>
                  <StatusBadge status={venture.status} />
                </div>

                <div className="stat-row">
                  <div className="stat">
                    <div className="k">Invested</div>
                    <div className="v">{money(stats.invested)}</div>
                  </div>
                  <div className="stat">
                    <div className="k">Returned</div>
                    <div className="v">{money(stats.returned)}</div>
                  </div>
                  <div className="stat">
                    <div className="k">Net</div>
                    <div className={`v ${stats.net >= 0 ? 'pos' : 'neg'}`}>
                      {money(stats.net)}{' '}
                      <span style={{ fontSize: 12.5, fontWeight: 600 }}>
                        ({formatPercent(stats.roi, 0)})
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="bar">
                    <span
                      style={{
                        width: `${funded * 100}%`,
                        background: seriesColor(venture.color, dark),
                      }}
                    />
                  </div>
                  <div className="venture-meta" style={{ marginTop: 6 }}>
                    {venture.targetAmount
                      ? `${(funded * 100).toFixed(0)}% of ${money(venture.targetAmount)} target funded`
                      : `${(stats.recovered * 100).toFixed(0)}% of capital returned so far`}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {recent.length > 0 && (
        <div className="card" style={{ marginTop: 18 }}>
          <div className="card-head">
            <h3>Recent activity</h3>
          </div>
          <div className="activity">
            {recent.map((r) => (
              <Link key={r.id} to={`/venture/${r.ventureId}`} className="activity-row">
                <span
                  className="icon"
                  style={{
                    background: r.kind === 'in' ? 'rgba(0,131,0,.14)' : 'var(--accent-soft)',
                    color: r.kind === 'in' ? 'var(--pos)' : 'var(--accent)',
                  }}
                >
                  {r.kind === 'in' ? '↓' : '↑'}
                </span>
                <div className="main">
                  <div className="t">{r.title}</div>
                  <div className="s">
                    {r.venture} · {formatDate(r.date, data.settings.locale)}
                  </div>
                </div>
                <div className={`amt ${r.kind === 'in' ? 'pos' : ''}`}>
                  {r.kind === 'in' ? '+' : '−'}
                  {money(r.amount)}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="summary-bar">
        <div className="stat">
          <div className="k">Total investment</div>
          <div className="v">{money(totals.invested)}</div>
        </div>
        <div className="stat">
          <div className="k">Total returns received</div>
          <div className="v pos">{money(totals.returned)}</div>
        </div>
        {totals.currentValue !== undefined && (
          <div className="stat">
            <div className="k">Current value</div>
            <div className="v">{money(totals.currentValue)}</div>
          </div>
        )}
        <div className="stat">
          <div className="k">Net position</div>
          <div className={`v ${totals.net >= 0 ? 'pos' : 'neg'}`}>{money(totals.net)}</div>
        </div>
        <div className="spacer" />
        <div className="stat">
          <div className="k">Overall ROI</div>
          <div className={`v ${totals.roi >= 0 ? 'pos' : 'neg'}`}>{formatPercent(totals.roi)}</div>
        </div>
      </div>

      {modal === 'venture' && (
        <VentureForm onClose={() => setModal(null)} onCreated={(v) => navigate(`/venture/${v.id}`)} />
      )}
      {modal === 'investment' && (
        <InvestmentForm ventureId={data.ventures[0].id} onClose={() => setModal(null)} />
      )}
      {modal === 'payout' && (
        <PayoutForm ventureId={data.ventures[0].id} onClose={() => setModal(null)} />
      )}
    </div>
  )
}
