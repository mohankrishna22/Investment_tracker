import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { dueSoon, lendingTotals, statsForPerson } from '../lib/lending'
import { formatDate, formatMoney } from '../lib/format'
import { seriesColor } from '../lib/types'
import { Empty, Kpi } from '../components/ui'
import { LoanForm, PersonForm, RepaymentForm } from '../components/lendingForms'

type Filter = 'all' | 'owing' | 'overdue' | 'settled'
type SortKey = 'outstanding' | 'lent' | 'recent' | 'name'

export default function Lending({ dark }: { dark: boolean }) {
  const { data } = useStore()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<SortKey>('outstanding')
  const [modal, setModal] = useState<null | 'person' | 'loan' | 'repayment'>(null)

  const money = (n: number) => formatMoney(n, data.settings)

  const rows = useMemo(
    () => data.people.map((person) => ({ person, stats: statsForPerson(person, data.loans, data.repayments) })),
    [data.people, data.loans, data.repayments],
  )

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matches = rows.filter(({ person, stats }) => {
      if (q && !`${person.name} ${person.contact} ${person.notes}`.toLowerCase().includes(q))
        return false
      if (filter === 'owing') return stats.outstanding > 0
      if (filter === 'overdue') return stats.overdueAmount > 0
      if (filter === 'settled') return stats.outstanding === 0 && stats.loanCount > 0
      return true
    })
    const sorters: Record<SortKey, (a: typeof matches[0], b: typeof matches[0]) => number> = {
      outstanding: (a, b) => b.stats.outstanding - a.stats.outstanding,
      lent: (a, b) => b.stats.lent - a.stats.lent,
      recent: (a, b) => (b.stats.lastDate ?? '').localeCompare(a.stats.lastDate ?? ''),
      name: (a, b) => a.person.name.localeCompare(b.person.name),
    }
    return [...matches].sort(sorters[sort])
  }, [rows, query, filter, sort])

  const totals = useMemo(() => lendingTotals(data), [data])
  const chase = useMemo(() => dueSoon(data, 30), [data])

  if (data.people.length === 0) {
    return (
      <div className="page">
        <Empty
          title="Nobody owes you anything yet"
          message="Add a friend, then record what you lent them and what has come back. Due dates are optional, but they are what makes the reminders work."
          action={
            <button className="btn-primary" onClick={() => setModal('person')}>
              + Add a person
            </button>
          }
        />
        {modal === 'person' && (
          <PersonForm onClose={() => setModal(null)} onCreated={(p) => navigate(`/lending/${p.id}`)} />
        )}
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Lending</h1>
          <div className="sub">
            {totals.peopleCount} {totals.peopleCount === 1 ? 'person' : 'people'} ·{' '}
            {totals.owingCount} still owing
            {totals.overdueCount > 0 && ` · ${totals.overdueCount} overdue`}
          </div>
        </div>
        <div className="spacer" />
        <button onClick={() => setModal('repayment')}>+ Repayment</button>
        <button onClick={() => setModal('loan')}>+ Money lent</button>
        <button className="btn-primary" onClick={() => setModal('person')}>
          + Person
        </button>
      </div>

      <div className="grid grid-kpi" style={{ marginBottom: 18 }}>
        <Kpi label="Total lent" value={money(totals.lent)} hint={`${data.loans.length} loans`} />
        <Kpi
          label="Repaid so far"
          value={money(totals.repaid)}
          tone="pos"
          hint={`${(totals.recoveredShare * 100).toFixed(0)}% of what went out`}
        />
        <Kpi
          label="Still owed"
          value={money(totals.outstanding)}
          hint={`Across ${totals.owingCount} ${totals.owingCount === 1 ? 'person' : 'people'}`}
        />
        <Kpi
          label="Overdue"
          value={money(totals.overdueAmount)}
          tone={totals.overdueAmount > 0 ? 'neg' : undefined}
          hint={
            totals.overdueAmount > 0
              ? `${totals.overdueCount} ${totals.overdueCount === 1 ? 'person is' : 'people are'} past the agreed date`
              : 'Nothing past its date'
          }
        />
      </div>

      {chase.length > 0 && (
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="card-head">
            <h3>Worth a nudge</h3>
            <div className="spacer" />
            <span className="muted">Overdue, or due in the next 30 days</span>
          </div>
          <div className="activity">
            {chase.slice(0, 8).map(({ person, state }) => (
              <Link key={state.loan.id} to={`/lending/${person.id}`} className="activity-row">
                <span
                  className="icon"
                  style={{
                    background: state.overdue
                      ? 'color-mix(in srgb, var(--neg) 14%, transparent)'
                      : 'var(--accent-soft)',
                    color: state.overdue ? 'var(--neg)' : 'var(--accent)',
                  }}
                >
                  {state.overdue ? '!' : '•'}
                </span>
                <div className="main">
                  <div className="t">{person.name}</div>
                  <div className="s">
                    {state.loan.purpose} ·{' '}
                    {state.overdue
                      ? `${state.daysOverdue} ${state.daysOverdue === 1 ? 'day' : 'days'} overdue`
                      : `due ${formatDate(state.loan.dueDate ?? '', data.settings.locale)}`}
                  </div>
                </div>
                <div className={`amt ${state.overdue ? 'neg' : ''}`}>{money(state.outstanding)}</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="toolbar">
        <input
          className="search"
          placeholder="Search people…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
          <option value="all">Everyone</option>
          <option value="owing">Still owing</option>
          <option value="overdue">Overdue only</option>
          <option value="settled">Settled up</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
          <option value="outstanding">Sort: most owed</option>
          <option value="lent">Sort: most lent</option>
          <option value="recent">Sort: latest activity</option>
          <option value="name">Sort: name</option>
        </select>
        <span className="muted" style={{ marginLeft: 'auto' }}>
          {visible.length} of {rows.length} shown
        </span>
      </div>

      {visible.length === 0 ? (
        <Empty title="Nothing matches" message="Try a different search term or filter." />
      ) : (
        <div className="grid grid-cards">
          {visible.map(({ person, stats }) => {
            const repaidShare = stats.lent > 0 ? Math.min(1, stats.repaid / stats.lent) : 1
            return (
              <Link key={person.id} to={`/lending/${person.id}`} className="card venture-card">
                <div className="venture-top">
                  <span className="dot" style={{ background: seriesColor(person.color, dark) }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="venture-name">{person.name}</div>
                    <div className="venture-meta">
                      {stats.loanCount} {stats.loanCount === 1 ? 'loan' : 'loans'}
                      {person.contact && ` · ${person.contact}`}
                      {stats.lastDate &&
                        ` · last ${formatDate(stats.lastDate, data.settings.locale)}`}
                    </div>
                  </div>
                  {stats.overdueAmount > 0 ? (
                    <span className="badge overdue">
                      {stats.maxDaysOverdue}d overdue
                    </span>
                  ) : stats.outstanding === 0 ? (
                    <span className="badge active">Settled</span>
                  ) : (
                    <span className="badge">Owing</span>
                  )}
                </div>

                <div className="stat-row">
                  <div className="stat">
                    <div className="k">Lent</div>
                    <div className="v">{money(stats.lent)}</div>
                  </div>
                  <div className="stat">
                    <div className="k">Repaid</div>
                    <div className="v pos">{money(stats.repaid)}</div>
                  </div>
                  <div className="stat">
                    <div className="k">Outstanding</div>
                    <div className={`v ${stats.outstanding > 0 ? 'neg' : 'pos'}`}>
                      {money(stats.outstanding)}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="bar">
                    <span
                      style={{
                        width: `${repaidShare * 100}%`,
                        background: stats.overdueAmount > 0 ? 'var(--neg)' : 'var(--pos)',
                      }}
                    />
                  </div>
                  <div className="venture-meta" style={{ marginTop: 6 }}>
                    {stats.outstanding === 0
                      ? stats.loanCount === 0
                        ? 'No loans recorded'
                        : 'All settled up'
                      : `${(repaidShare * 100).toFixed(0)}% repaid${
                          stats.nextDue
                            ? ` · next due ${formatDate(stats.nextDue, data.settings.locale)}`
                            : ''
                        }`}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <div className="summary-bar">
        <div className="stat">
          <div className="k">Total lent</div>
          <div className="v">{money(totals.lent)}</div>
        </div>
        <div className="stat">
          <div className="k">Repaid</div>
          <div className="v pos">{money(totals.repaid)}</div>
        </div>
        <div className="stat">
          <div className="k">Still owed</div>
          <div className={`v ${totals.outstanding > 0 ? 'neg' : 'pos'}`}>
            {money(totals.outstanding)}
          </div>
        </div>
        {totals.writtenOff > 0 && (
          <div className="stat">
            <div className="k">Written off</div>
            <div className="v muted">{money(totals.writtenOff)}</div>
          </div>
        )}
      </div>

      {modal === 'person' && (
        <PersonForm onClose={() => setModal(null)} onCreated={(p) => navigate(`/lending/${p.id}`)} />
      )}
      {modal === 'loan' && <LoanForm personId={data.people[0].id} onClose={() => setModal(null)} />}
      {modal === 'repayment' && (
        <RepaymentForm personId={data.people[0].id} onClose={() => setModal(null)} />
      )}
    </div>
  )
}
