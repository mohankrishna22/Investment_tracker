import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../lib/store'
import { statsForPerson, type SideStats } from '../lib/lending'
import { formatDate, formatMoney } from '../lib/format'
import { seriesColor, type Loan, type LoanDirection, type Repayment, type Settings } from '../lib/types'
import { download, toCsv } from '../lib/csv'
import { ConfirmButton, Empty, Kpi } from '../components/ui'
import { LoanForm, PersonForm, RepaymentForm } from '../components/lendingForms'

const STATUS_LABEL: Record<string, string> = {
  settled: 'Settled',
  partial: 'Part paid',
  open: 'Outstanding',
  'written-off': 'Written off',
}

/** One direction's ledger — the loans, then the repayments against them. */
function SideLedger({
  side,
  direction,
  repayments,
  settings,
  onEditLoan,
  onEditRepayment,
  onAddLoan,
  onAddRepayment,
  onDeleteLoan,
  onDeleteRepayment,
  onExport,
}: {
  side: SideStats
  direction: LoanDirection
  repayments: Repayment[]
  settings: Settings
  onEditLoan: (loan: Loan) => void
  onEditRepayment: (repayment: Repayment) => void
  onAddLoan: () => void
  onAddRepayment: () => void
  onDeleteLoan: (id: string) => void
  onDeleteRepayment: (id: string) => void
  onExport: () => void
}) {
  const lending = direction === 'out'
  const money = (n: number) => formatMoney(n, settings)
  const states = [...side.states].sort((a, b) => b.loan.date.localeCompare(a.loan.date))
  const sorted = [...repayments].sort((a, b) => b.date.localeCompare(a.date))

  if (states.length === 0) {
    return (
      <Empty
        title={lending ? 'Nothing lent to them' : 'Nothing borrowed from them'}
        message={
          lending
            ? 'Record what you gave them — how much, when, and what it was for.'
            : 'Record what you took from them — how much, when, and what it was for.'
        }
        action={
          <button className="btn-primary" onClick={onAddLoan}>
            {lending ? '+ Record money you lent' : '+ Record money you borrowed'}
          </button>
        }
      />
    )
  }

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card">
        <div className="card-head">
          <h3>{lending ? 'Everything you lent them' : 'Everything you borrowed'}</h3>
          <div className="spacer" />
          <button className="btn-sm" onClick={onExport}>
            Export CSV
          </button>
        </div>
        <div className="table-wrap">
          <table className="stack-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>What for</th>
                <th>Due</th>
                <th>Status</th>
                <th className="num">Amount</th>
                <th className="num">Outstanding</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {states.map((s) => (
                <tr key={s.loan.id}>
                  <td data-label="Date">{formatDate(s.loan.date, settings.locale)}</td>
                  <td data-label="What for" className="table-lead">
                    {s.loan.purpose}
                    {s.loan.notes && <div className="muted">{s.loan.notes}</div>}
                  </td>
                  <td data-label="Due" className={s.overdue ? 'neg' : 'muted'}>
                    {s.loan.dueDate ? formatDate(s.loan.dueDate, settings.locale) : '—'}
                  </td>
                  <td data-label="Status">
                    <span
                      className={`badge ${
                        s.status === 'settled' ? 'active' : s.overdue ? 'overdue' : ''
                      }`}
                    >
                      {s.overdue ? `${s.daysOverdue}d overdue` : STATUS_LABEL[s.status]}
                    </span>
                  </td>
                  <td data-label="Amount" className="num">
                    {money(s.loan.amount)}
                  </td>
                  <td
                    data-label="Outstanding"
                    className={`num ${s.outstanding > 0 ? 'neg' : 'muted'}`}
                  >
                    {s.outstanding > 0 ? money(s.outstanding) : '—'}
                  </td>
                  <td className="row-actions-cell">
                    <div className="row-actions">
                      <button className="btn-ghost btn-sm" onClick={() => onEditLoan(s.loan)}>
                        Edit
                      </button>
                      <ConfirmButton onConfirm={() => onDeleteLoan(s.loan.id)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} className="table-lead">
                  {lending ? 'Total lent' : 'Total borrowed'} · {side.loanCount}{' '}
                  {side.loanCount === 1 ? 'loan' : 'loans'}
                </td>
                <td data-label="Amount" className="num">
                  {money(side.principal + side.writtenOff)}
                </td>
                <td data-label="Outstanding" className="num">
                  {money(side.outstanding)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="card-pad" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="inline-note" style={{ marginTop: 0 }}>
            Repayments are applied to the oldest unsettled loan first, so the status column
            shows which ones that money has cleared.
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>{lending ? 'What they paid back' : 'What you paid back'}</h3>
          <div className="spacer" />
          <button className="btn-sm" onClick={onAddRepayment}>
            + Repayment
          </button>
        </div>
        {sorted.length === 0 ? (
          <div className="card-pad muted">
            {lending
              ? 'Nothing has come back yet.'
              : 'You have not paid any of this back yet.'}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="stack-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="wrap-cell">Notes</th>
                  <th className="num">Amount</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r.id}>
                    <td data-label="Date" className="table-lead">
                      {formatDate(r.date, settings.locale)}
                    </td>
                    <td data-label="Notes" className={`wrap-cell muted ${r.notes ? '' : 'is-empty'}`}>
                      {r.notes || '—'}
                    </td>
                    <td data-label="Amount" className={`num ${lending ? 'pos' : ''}`}>
                      {money(r.amount)}
                    </td>
                    <td className="row-actions-cell">
                      <div className="row-actions">
                        <button className="btn-ghost btn-sm" onClick={() => onEditRepayment(r)}>
                          Edit
                        </button>
                        <ConfirmButton onConfirm={() => onDeleteRepayment(r.id)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2} className="table-lead">
                    Total · {sorted.length} {sorted.length === 1 ? 'payment' : 'payments'}
                  </td>
                  <td data-label="Total" className="num">
                    {money(side.repaid)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default function PersonDetail({ dark }: { dark: boolean }) {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { data, deleteLoan, deleteRepayment, deletePerson } = useStore()
  const [tab, setTab] = useState<LoanDirection>('out')
  const [editPerson, setEditPerson] = useState(false)
  const [loanModal, setLoanModal] = useState<Loan | 'new' | null>(null)
  const [repaymentModal, setRepaymentModal] = useState<Repayment | 'new' | null>(null)

  const person = data.people.find((p) => p.id === id)
  const money = (n: number) => formatMoney(n, data.settings)

  const stats = useMemo(
    () => (person ? statsForPerson(person, data.loans, data.repayments) : null),
    [person, data.loans, data.repayments],
  )
  const repayments = useMemo(
    () => data.repayments.filter((r) => r.personId === id),
    [data.repayments, id],
  )

  if (!person || !stats) {
    return (
      <div className="page">
        <Empty
          title="Person not found"
          message="They may have been deleted."
          action={
            <Link className="btn btn-primary" to="/lending">
              Back to loans
            </Link>
          }
        />
      </div>
    )
  }

  const side = tab === 'out' ? stats.out : stats.in

  const exportCsv = () =>
    download(
      `${person.name}-loans.csv`,
      toCsv(
        ['Direction', 'Type', 'Date', 'Amount', 'Purpose / notes', 'Due', 'Status', 'Outstanding'],
        [
          ...data.loans
            .filter((l) => l.personId === person.id)
            .flatMap((loan) => {
              const state = [...stats.out.states, ...stats.in.states].find(
                (s) => s.loan.id === loan.id,
              )
              return [
                [
                  loan.direction === 'out' ? 'Lent out' : 'Borrowed',
                  'Loan',
                  loan.date,
                  loan.amount,
                  loan.purpose + (loan.notes ? ` — ${loan.notes}` : ''),
                  loan.dueDate ?? '',
                  state ? STATUS_LABEL[state.status] : '',
                  state?.outstanding ?? '',
                ],
              ]
            }),
          ...repayments.map((r) => [
            r.direction === 'out' ? 'Lent out' : 'Borrowed',
            r.direction === 'out' ? 'They paid me' : 'I paid them',
            r.date,
            r.amount,
            r.notes,
            '',
            'Received',
            '',
          ]),
        ],
      ),
    )

  return (
    <div className="page">
      <div className="page-head">
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span className="dot" style={{ background: seriesColor(person.color, dark), marginTop: 0 }} />
            <h1>{person.name}</h1>
            {stats.maxDaysOverdue > 0 ? (
              <span className="badge overdue">{stats.maxDaysOverdue}d overdue</span>
            ) : stats.net === 0 ? (
              <span className="badge badge-plain active">Settled</span>
            ) : stats.net > 0 ? (
              <span className="badge badge-plain">Owes you</span>
            ) : (
              <span className="badge badge-plain planned">You owe</span>
            )}
          </div>
          <div className="sub">
            {person.contact || 'No contact saved'}
            {stats.firstDate && ` · since ${formatDate(stats.firstDate, data.settings.locale)}`}
          </div>
          {person.notes && (
            <div className="sub" style={{ maxWidth: 640 }}>
              {person.notes}
            </div>
          )}
        </div>
        <div className="spacer" />
        <Link className="btn" to="/lending">
          ← Loans
        </Link>
        <button onClick={() => setEditPerson(true)}>Edit</button>
        <button onClick={() => setRepaymentModal('new')}>+ Repayment</button>
        <button className="btn-primary" onClick={() => setLoanModal('new')}>
          + Loan
        </button>
      </div>

      <div className="grid grid-kpi" style={{ marginBottom: 18 }}>
        <Kpi
          label="They owe you"
          value={money(stats.out.outstanding)}
          hint={`${money(stats.out.principal)} lent · ${money(stats.out.repaid)} back`}
        />
        <Kpi
          label="You owe them"
          value={money(stats.in.outstanding)}
          hint={`${money(stats.in.principal)} borrowed · ${money(stats.in.repaid)} repaid`}
        />
        <Kpi
          label="Net"
          value={money(Math.abs(stats.net))}
          tone={stats.net > 0 ? 'pos' : stats.net < 0 ? 'neg' : undefined}
          hint={
            stats.net === 0
              ? 'All square'
              : stats.net > 0
                ? `${person.name} owes you`
                : `You owe ${person.name}`
          }
        />
        <Kpi
          label="Next due"
          value={
            side.nextDue ? formatDate(side.nextDue, data.settings.locale) : '—'
          }
          hint={
            stats.maxDaysOverdue > 0
              ? `Longest overdue ${stats.maxDaysOverdue} days`
              : 'On the tab you are viewing'
          }
        />
      </div>

      {(stats.out.credit > 0 || stats.in.credit > 0) && (
        <div className="banner">
          <span>
            More has been paid back than was ever lent on one side — worth checking whether a
            loan is missing from the list.
          </span>
        </div>
      )}

      {stats.hasBoth && (
        <div className="banner">
          <span>
            You and {person.name} owe each other. Net, {
              stats.net > 0
                ? `${person.name} is ${money(stats.net)} behind`
                : stats.net < 0
                  ? `you are ${money(-stats.net)} behind`
                  : 'you are square'
            }.
          </span>
        </div>
      )}

      <div className="tabs">
        <button className={tab === 'out' ? 'active' : ''} onClick={() => setTab('out')}>
          Lent out ({stats.out.loanCount})
        </button>
        <button className={tab === 'in' ? 'active' : ''} onClick={() => setTab('in')}>
          Borrowed ({stats.in.loanCount})
        </button>
      </div>

      <SideLedger
        side={side}
        direction={tab}
        repayments={repayments.filter((r) => r.direction === tab)}
        settings={data.settings}
        onEditLoan={setLoanModal}
        onEditRepayment={setRepaymentModal}
        onAddLoan={() => setLoanModal('new')}
        onAddRepayment={() => setRepaymentModal('new')}
        onDeleteLoan={deleteLoan}
        onDeleteRepayment={deleteRepayment}
        onExport={exportCsv}
      />

      <div className="summary-bar">
        <div className="stat">
          <div className="k">They owe you</div>
          <div className="v">{money(stats.out.outstanding)}</div>
        </div>
        <div className="stat">
          <div className="k">You owe them</div>
          <div className="v">{money(stats.in.outstanding)}</div>
        </div>
        <div className="stat">
          <div className="k">Net</div>
          <div className={`v ${stats.net > 0 ? 'pos' : stats.net < 0 ? 'neg' : 'muted'}`}>
            {money(Math.abs(stats.net))}
          </div>
        </div>
        <div className="spacer" />
        <ConfirmButton
          className="btn-sm"
          label="Delete this person"
          confirmLabel="Delete their whole history?"
          onConfirm={() => {
            deletePerson(person.id)
            navigate('/lending')
          }}
        />
      </div>

      {editPerson && <PersonForm person={person} onClose={() => setEditPerson(false)} />}
      {loanModal && (
        <LoanForm
          personId={person.id}
          loan={loanModal === 'new' ? undefined : loanModal}
          defaultDirection={tab}
          onClose={() => setLoanModal(null)}
        />
      )}
      {repaymentModal && (
        <RepaymentForm
          personId={person.id}
          repayment={repaymentModal === 'new' ? undefined : repaymentModal}
          defaultDirection={tab}
          suggested={side.outstanding}
          onClose={() => setRepaymentModal(null)}
        />
      )}
    </div>
  )
}
