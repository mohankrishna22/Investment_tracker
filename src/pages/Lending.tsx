import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { dueSoon, lendingTotals, statsForPerson } from '../lib/lending'
import { formatDate, formatMoney } from '../lib/format'
import { seriesColor } from '../lib/types'
import { Empty, Kpi } from '../components/ui'
import { LoanForm, PersonForm, RepaymentForm } from '../components/lendingForms'

type Filter = 'all' | 'owes-me' | 'i-owe' | 'overdue' | 'settled'
type SortKey = 'balance' | 'lent' | 'recent' | 'name'

export default function Lending({ dark }: { dark: boolean }) {
  const { data } = useStore()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<SortKey>('balance')
  const [modal, setModal] = useState<null | 'person' | 'loan' | 'repayment'>(null)

  const money = (n: number) => formatMoney(n, data.settings)

  const rows = useMemo(
    () =>
      data.people.map((person) => ({
        person,
        stats: statsForPerson(person, data.loans, data.repayments),
      })),
    [data.people, data.loans, data.repayments],
  )

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matches = rows.filter(({ person, stats }) => {
      if (q && !`${person.name} ${person.contact} ${person.notes}`.toLowerCase().includes(q))
        return false
      if (filter === 'owes-me') return stats.out.outstanding > 0
      if (filter === 'i-owe') return stats.in.outstanding > 0
      if (filter === 'overdue') return stats.out.overdueAmount > 0 || stats.in.overdueAmount > 0
      if (filter === 'settled')
        return (
          stats.out.outstanding === 0 &&
          stats.in.outstanding === 0 &&
          stats.out.loanCount + stats.in.loanCount > 0
        )
      return true
    })
    const sorters: Record<SortKey, (a: typeof matches[0], b: typeof matches[0]) => number> = {
      balance: (a, b) => Math.abs(b.stats.net) - Math.abs(a.stats.net),
      lent: (a, b) => b.stats.out.principal - a.stats.out.principal,
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
          title="No loans tracked yet"
          message="Add someone, then record what you lent them or what you borrowed from them. Dates are optional, but they are what makes the reminders work."
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

  const overdueTotal = totals.overdueToMe + totals.overdueIOwe

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Loans</h1>
          <div className="sub">
            {totals.peopleCount} {totals.peopleCount === 1 ? 'person' : 'people'} ·{' '}
            {totals.owingMeCount} owing you · {totals.owedByMeCount} you owe
          </div>
        </div>
        <div className="spacer" />
        <button onClick={() => setModal('repayment')}>+ Repayment</button>
        <button onClick={() => setModal('loan')}>+ Loan</button>
        <button className="btn-primary" onClick={() => setModal('person')}>
          + Person
        </button>
      </div>

      <div className="grid grid-kpi" style={{ marginBottom: 18 }}>
        <Kpi
          label="Owed to you"
          value={money(totals.owedToMe)}
          hint={`${money(totals.lentTotal)} lent · ${money(totals.receivedBack)} back`}
        />
        <Kpi
          label="You owe"
          value={money(totals.iOwe)}
          hint={`${money(totals.borrowedTotal)} borrowed · ${money(totals.paidBack)} repaid`}
        />
        <Kpi
          label="Net position"
          value={money(Math.abs(totals.net))}
          tone={totals.net >= 0 ? 'pos' : 'neg'}
          hint={
            totals.net === 0
              ? 'All square'
              : totals.net > 0
                ? 'In your favour'
                : 'Against you'
          }
        />
        <Kpi
          label="Overdue"
          value={money(overdueTotal)}
          tone={overdueTotal > 0 ? 'neg' : undefined}
          hint={
            overdueTotal > 0
              ? `${money(totals.overdueToMe)} to chase · ${money(totals.overdueIOwe)} to pay`
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
            {chase.slice(0, 8).map(({ person, state, direction }) => {
              const owedToYou = direction === 'out'
              return (
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
                    {owedToYou ? '↓' : '↑'}
                  </span>
                  <div className="main">
                    <div className="t">
                      {owedToYou ? `Chase ${person.name}` : `Pay ${person.name}`}
                    </div>
                    <div className="s">
                      {state.loan.purpose} ·{' '}
                      {state.overdue
                        ? `${state.daysOverdue} ${state.daysOverdue === 1 ? 'day' : 'days'} overdue`
                        : `due ${formatDate(state.loan.dueDate ?? '', data.settings.locale)}`}
                    </div>
                  </div>
                  <div className={`amt ${state.overdue ? 'neg' : ''}`}>
                    {money(state.outstanding)}
                  </div>
                </Link>
              )
            })}
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
          <option value="owes-me">Owes me</option>
          <option value="i-owe">I owe them</option>
          <option value="overdue">Overdue either way</option>
          <option value="settled">Settled up</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
          <option value="balance">Sort: biggest balance</option>
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
            const settled = stats.out.outstanding === 0 && stats.in.outstanding === 0
            const overdue = stats.out.overdueAmount + stats.in.overdueAmount
            return (
              <Link key={person.id} to={`/lending/${person.id}`} className="card venture-card">
                <div className="venture-top">
                  <span className="dot" style={{ background: seriesColor(person.color, dark) }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="venture-name">{person.name}</div>
                    <div className="venture-meta">
                      {person.contact || 'No contact saved'}
                      {stats.lastDate &&
                        ` · last ${formatDate(stats.lastDate, data.settings.locale)}`}
                    </div>
                  </div>
                  {overdue > 0 ? (
                    <span className="badge overdue">{stats.maxDaysOverdue}d overdue</span>
                  ) : settled ? (
                    <span className="badge badge-plain active">Settled</span>
                  ) : stats.net > 0 ? (
                    <span className="badge badge-plain">Owes you</span>
                  ) : (
                    <span className="badge badge-plain planned">You owe</span>
                  )}
                </div>

                <div className="stat-row">
                  <div className="stat">
                    <div className="k">They owe you</div>
                    <div className={`v ${stats.out.outstanding > 0 ? '' : 'muted'}`}>
                      {money(stats.out.outstanding)}
                    </div>
                  </div>
                  <div className="stat">
                    <div className="k">You owe them</div>
                    <div className={`v ${stats.in.outstanding > 0 ? '' : 'muted'}`}>
                      {money(stats.in.outstanding)}
                    </div>
                  </div>
                  <div className="stat">
                    <div className="k">Net</div>
                    <div className={`v ${stats.net > 0 ? 'pos' : stats.net < 0 ? 'neg' : 'muted'}`}>
                      {stats.net === 0 ? money(0) : money(Math.abs(stats.net))}
                    </div>
                  </div>
                </div>

                <div className="venture-meta">
                  {settled
                    ? stats.out.loanCount + stats.in.loanCount === 0
                      ? 'Nothing recorded yet'
                      : 'All settled up'
                    : stats.net > 0
                      ? `${person.name} owes you ${money(stats.net)}`
                      : stats.net < 0
                        ? `You owe ${person.name} ${money(-stats.net)}`
                        : 'Balanced both ways'}
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <div className="summary-bar">
        <div className="stat">
          <div className="k">Owed to you</div>
          <div className="v">{money(totals.owedToMe)}</div>
        </div>
        <div className="stat">
          <div className="k">You owe</div>
          <div className="v">{money(totals.iOwe)}</div>
        </div>
        <div className="stat">
          <div className="k">Net position</div>
          <div className={`v ${totals.net >= 0 ? 'pos' : 'neg'}`}>
            {money(Math.abs(totals.net))} {totals.net >= 0 ? 'in your favour' : 'against you'}
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
