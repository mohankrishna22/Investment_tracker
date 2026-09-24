import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../lib/store'
import { allocate, statsForPerson } from '../lib/lending'
import { formatDate, formatMoney } from '../lib/format'
import { seriesColor, type Loan, type Repayment } from '../lib/types'
import { download, toCsv } from '../lib/csv'
import { ConfirmButton, Empty, Kpi } from '../components/ui'
import { LoanForm, PersonForm, RepaymentForm } from '../components/lendingForms'

const STATUS_LABEL: Record<string, string> = {
  settled: 'Settled',
  partial: 'Part paid',
  open: 'Outstanding',
  'written-off': 'Written off',
}

export default function PersonDetail({ dark }: { dark: boolean }) {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { data, deleteLoan, deleteRepayment, deletePerson } = useStore()
  const [tab, setTab] = useState<'loans' | 'repayments'>('loans')
  const [editPerson, setEditPerson] = useState(false)
  const [loanModal, setLoanModal] = useState<Loan | 'new' | null>(null)
  const [repaymentModal, setRepaymentModal] = useState<Repayment | 'new' | null>(null)

  const person = data.people.find((p) => p.id === id)
  const money = (n: number) => formatMoney(n, data.settings)

  const loans = useMemo(() => data.loans.filter((l) => l.personId === id), [data.loans, id])
  const repayments = useMemo(
    () => data.repayments.filter((r) => r.personId === id).sort((a, b) => b.date.localeCompare(a.date)),
    [data.repayments, id],
  )
  const states = useMemo(
    () => allocate(loans, repayments).sort((a, b) => b.loan.date.localeCompare(a.loan.date)),
    [loans, repayments],
  )
  const stats = useMemo(
    () => (person ? statsForPerson(person, data.loans, data.repayments) : null),
    [person, data.loans, data.repayments],
  )

  if (!person || !stats) {
    return (
      <div className="page">
        <Empty
          title="Person not found"
          message="They may have been deleted."
          action={
            <Link className="btn btn-primary" to="/lending">
              Back to lending
            </Link>
          }
        />
      </div>
    )
  }

  const exportCsv = () =>
    download(
      `${person.name}-lending.csv`,
      toCsv(
        ['Type', 'Date', 'Amount', 'Purpose / notes', 'Due', 'Status', 'Outstanding'],
        [
          ...states.map((s) => [
            'Loan',
            s.loan.date,
            s.loan.amount,
            s.loan.purpose + (s.loan.notes ? ` — ${s.loan.notes}` : ''),
            s.loan.dueDate ?? '',
            STATUS_LABEL[s.status],
            s.outstanding,
          ]),
          ...repayments.map((r) => ['Repayment', r.date, r.amount, r.notes, '', 'Received', '']),
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
            {stats.overdueAmount > 0 ? (
              <span className="badge overdue">{stats.maxDaysOverdue}d overdue</span>
            ) : stats.outstanding === 0 ? (
              <span className="badge active">Settled</span>
            ) : (
              <span className="badge">Owing</span>
            )}
          </div>
          <div className="sub">
            {person.contact || 'No contact saved'}
            {stats.firstDate && ` · first loan ${formatDate(stats.firstDate, data.settings.locale)}`}
          </div>
          {person.notes && (
            <div className="sub" style={{ maxWidth: 640 }}>
              {person.notes}
            </div>
          )}
        </div>
        <div className="spacer" />
        <Link className="btn" to="/lending">
          ← Lending
        </Link>
        <button onClick={() => setEditPerson(true)}>Edit</button>
        <button onClick={() => setRepaymentModal('new')}>+ Repayment</button>
        <button className="btn-primary" onClick={() => setLoanModal('new')}>
          + Money lent
        </button>
      </div>

      <div className="grid grid-kpi" style={{ marginBottom: 18 }}>
        <Kpi label="Lent" value={money(stats.lent)} hint={`${stats.loanCount} loans`} />
        <Kpi
          label="Repaid"
          value={money(stats.repaid)}
          tone="pos"
          hint={`${stats.repaymentCount} payments received`}
        />
        <Kpi
          label="Still owed"
          value={money(stats.outstanding)}
          tone={stats.outstanding > 0 ? 'neg' : 'pos'}
          hint={
            stats.nextDue
              ? `Next due ${formatDate(stats.nextDue, data.settings.locale)}`
              : stats.outstanding > 0
                ? 'No date agreed'
                : 'All square'
          }
        />
        <Kpi
          label="Overdue"
          value={money(stats.overdueAmount)}
          tone={stats.overdueAmount > 0 ? 'neg' : undefined}
          hint={
            stats.overdueAmount > 0
              ? `Longest ${stats.maxDaysOverdue} days`
              : 'Nothing past its date'
          }
        />
      </div>

      {stats.credit > 0 && (
        <div className="banner">
          <span>
            They have paid back {money(stats.credit)} more than they were lent — worth checking
            whether a loan is missing from the list.
          </span>
        </div>
      )}

      <div className="tabs">
        <button className={tab === 'loans' ? 'active' : ''} onClick={() => setTab('loans')}>
          Loans ({loans.length})
        </button>
        <button className={tab === 'repayments' ? 'active' : ''} onClick={() => setTab('repayments')}>
          Repayments ({repayments.length})
        </button>
      </div>

      {tab === 'loans' &&
        (states.length === 0 ? (
          <Empty
            title="No loans recorded"
            message="Add the first one — how much, when, and what it was for."
            action={
              <button className="btn-primary" onClick={() => setLoanModal('new')}>
                + Record money lent
              </button>
            }
          />
        ) : (
          <div className="card">
            <div className="card-head">
              <h3>Everything you lent</h3>
              <div className="spacer" />
              <button className="btn-sm" onClick={exportCsv}>
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
                      <td data-label="Date">{formatDate(s.loan.date, data.settings.locale)}</td>
                      <td data-label="What for" className="table-lead">
                        {s.loan.purpose}
                        {s.loan.notes && <div className="muted">{s.loan.notes}</div>}
                      </td>
                      <td data-label="Due" className={s.overdue ? 'neg' : 'muted'}>
                        {s.loan.dueDate
                          ? formatDate(s.loan.dueDate, data.settings.locale)
                          : '—'}
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
                          <button className="btn-ghost btn-sm" onClick={() => setLoanModal(s.loan)}>
                            Edit
                          </button>
                          <ConfirmButton onConfirm={() => deleteLoan(s.loan.id)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4} className="table-lead">
                      Total lent · {loans.length} loans
                    </td>
                    <td data-label="Lent" className="num">
                      {money(stats.lent + stats.writtenOff)}
                    </td>
                    <td data-label="Outstanding" className="num">
                      {money(stats.outstanding)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="card-pad" style={{ borderTop: '1px solid var(--border)' }}>
              <div className="inline-note" style={{ marginTop: 0 }}>
                Repayments are applied to the oldest unsettled loan first, so the status column
                shows which loans that money has cleared.
              </div>
            </div>
          </div>
        ))}

      {tab === 'repayments' &&
        (repayments.length === 0 ? (
          <Empty
            title="Nothing repaid yet"
            message="Record money as it comes back and the loans above settle themselves oldest-first."
            action={
              <button className="btn-primary" onClick={() => setRepaymentModal('new')}>
                + Record a repayment
              </button>
            }
          />
        ) : (
          <div className="card">
            <div className="card-head">
              <h3>What came back</h3>
              <div className="spacer" />
              <button className="btn-sm" onClick={exportCsv}>
                Export CSV
              </button>
            </div>
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
                  {repayments.map((r) => (
                    <tr key={r.id}>
                      <td data-label="Date" className="table-lead">
                        {formatDate(r.date, data.settings.locale)}
                      </td>
                      <td
                        data-label="Notes"
                        className={`wrap-cell muted ${r.notes ? '' : 'is-empty'}`}
                      >
                        {r.notes || '—'}
                      </td>
                      <td data-label="Amount" className="num pos">
                        {money(r.amount)}
                      </td>
                      <td className="row-actions-cell">
                        <div className="row-actions">
                          <button className="btn-ghost btn-sm" onClick={() => setRepaymentModal(r)}>
                            Edit
                          </button>
                          <ConfirmButton onConfirm={() => deleteRepayment(r.id)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2} className="table-lead">
                      Total repaid · {repayments.length} payments
                    </td>
                    <td data-label="Total" className="num">
                      {money(stats.repaid)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        ))}

      <div className="summary-bar">
        <div className="stat">
          <div className="k">Total lent</div>
          <div className="v">{money(stats.lent)}</div>
        </div>
        <div className="stat">
          <div className="k">Repaid</div>
          <div className="v pos">{money(stats.repaid)}</div>
        </div>
        <div className="stat">
          <div className="k">Still owed</div>
          <div className={`v ${stats.outstanding > 0 ? 'neg' : 'pos'}`}>
            {money(stats.outstanding)}
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
          onClose={() => setLoanModal(null)}
        />
      )}
      {repaymentModal && (
        <RepaymentForm
          personId={person.id}
          repayment={repaymentModal === 'new' ? undefined : repaymentModal}
          suggested={stats.outstanding}
          onClose={() => setRepaymentModal(null)}
        />
      )}
    </div>
  )
}
