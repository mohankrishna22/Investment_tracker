import { useState, type FormEvent } from 'react'
import { Field, Modal } from './ui'
import { today, useStore } from '../lib/store'
import {
  LOAN_PURPOSES,
  PALETTE,
  type Loan,
  type LoanDirection,
  type Person,
  type Repayment,
} from '../lib/types'

const num = (v: string) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export function PersonForm({
  person,
  onClose,
  onCreated,
}: {
  person?: Person
  onClose: () => void
  onCreated?: (p: Person) => void
}) {
  const { addPerson, updatePerson } = useStore()
  const [form, setForm] = useState({
    name: person?.name ?? '',
    contact: person?.contact ?? '',
    notes: person?.notes ?? '',
    color: person?.color ?? '',
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    const payload = {
      name: form.name.trim(),
      contact: form.contact.trim(),
      notes: form.notes.trim(),
      color: form.color,
    }
    if (person) updatePerson(person.id, payload)
    else onCreated?.(addPerson(payload))
    onClose()
  }

  return (
    <Modal title={person ? 'Edit person' : 'Add a person'} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Name" wide>
            <input
              autoFocus
              required
              value={form.name}
              placeholder="e.g. Ravi"
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </Field>
          <Field label="Contact (optional)" wide>
            <input
              value={form.contact}
              placeholder="Phone, email, or how you know them"
              onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
            />
          </Field>
          <Field label="Notes" wide>
            <textarea
              value={form.notes}
              placeholder="Anything worth remembering about the arrangement."
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </Field>
          <div className="field-wide">
            <span
              style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}
            >
              Colour
            </span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Colour ${c}`}
                  onClick={() => setForm((f) => ({ ...f, color: c }))}
                  style={{
                    width: 28,
                    height: 28,
                    padding: 0,
                    borderRadius: 8,
                    background: c,
                    border: form.color === c ? '2px solid var(--text)' : '1px solid var(--border)',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="form-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            {person ? 'Save changes' : 'Add'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export function LoanForm({
  personId,
  loan,
  onClose,
  defaultDirection = 'out',
}: {
  personId: string
  loan?: Loan
  onClose: () => void
  defaultDirection?: LoanDirection
}) {
  const { addLoan, updateLoan, data } = useStore()
  const [form, setForm] = useState({
    personId: loan?.personId ?? personId,
    direction: loan?.direction ?? defaultDirection,
    date: loan?.date ?? today(),
    amount: loan ? String(loan.amount) : '',
    purpose: loan?.purpose ?? 'Personal',
    dueDate: loan?.dueDate ?? '',
    notes: loan?.notes ?? '',
    writtenOff: loan?.writtenOff ?? false,
  })
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))
  const lending = form.direction === 'out'

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const payload = {
      personId: form.personId,
      direction: form.direction,
      date: form.date,
      amount: num(form.amount),
      purpose: form.purpose.trim() || 'Personal',
      dueDate: form.dueDate || undefined,
      notes: form.notes.trim(),
      writtenOff: form.writtenOff,
    }
    if (payload.amount <= 0) return
    if (loan) updateLoan(loan.id, payload)
    else addLoan(payload)
    onClose()
  }

  return (
    <Modal
      title={loan ? 'Edit loan' : lending ? 'Record money you lent' : 'Record money you borrowed'}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="form-grid">
          <div className="field-wide">
            <span className="field-label">Which way did the money go?</span>
            <div className="segmented">
              <button
                type="button"
                className={lending ? 'active' : ''}
                onClick={() => set({ direction: 'out' })}
              >
                I lent it out
              </button>
              <button
                type="button"
                className={!lending ? 'active' : ''}
                onClick={() => set({ direction: 'in' })}
              >
                I borrowed it
              </button>
            </div>
          </div>
          <Field label="Person">
            <select value={form.personId} onChange={(e) => set({ personId: e.target.value })}>
              {data.people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={lending ? 'Date given' : 'Date received'}>
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) => set({ date: e.target.value })}
            />
          </Field>
          <Field label="Amount">
            <input
              type="number"
              required
              min="0"
              step="any"
              autoFocus
              value={form.amount}
              placeholder="0"
              onChange={(e) => set({ amount: e.target.value })}
            />
          </Field>
          <Field label={lending ? 'Expected back by (optional)' : 'Promised to repay by (optional)'}>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => set({ dueDate: e.target.value })}
            />
          </Field>
          <Field label="What for">
            <input
              list="loan-purposes"
              value={form.purpose}
              onChange={(e) => set({ purpose: e.target.value })}
            />
            <datalist id="loan-purposes">
              {LOAN_PURPOSES.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </Field>
          <Field label="Notes" wide>
            <textarea value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Field>
          <label
            className="field-wide"
            style={{ display: 'flex', gap: 9, alignItems: 'center', fontSize: 14 }}
          >
            <input
              type="checkbox"
              style={{ width: 'auto' }}
              checked={form.writtenOff}
              onChange={(e) => set({ writtenOff: e.target.checked })}
            />
            <span>
              {lending ? 'Written off — stop counting this as owed to you' : 'Forgiven — stop counting this as owed by you'}
              <span className="inline-note" style={{ marginTop: 2 }}>
                Keeps the record without it weighing on the outstanding total.
              </span>
            </span>
          </label>
        </div>
        <div className="form-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            {loan ? 'Save changes' : lending ? 'Add loan' : 'Add borrowing'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export function RepaymentForm({
  personId,
  repayment,
  onClose,
  suggested,
  defaultDirection = 'out',
}: {
  personId: string
  repayment?: Repayment
  onClose: () => void
  /** Pre-fills with what is still owed, which is usually the right answer. */
  suggested?: number
  defaultDirection?: LoanDirection
}) {
  const { addRepayment, updateRepayment, data } = useStore()
  const [form, setForm] = useState({
    personId: repayment?.personId ?? personId,
    direction: repayment?.direction ?? defaultDirection,
    date: repayment?.date ?? today(),
    amount: repayment ? String(repayment.amount) : '',
    notes: repayment?.notes ?? '',
  })
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))
  const incoming = form.direction === 'out'

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const payload = {
      personId: form.personId,
      direction: form.direction,
      date: form.date,
      amount: num(form.amount),
      notes: form.notes.trim(),
    }
    if (payload.amount <= 0) return
    if (repayment) updateRepayment(repayment.id, payload)
    else addRepayment(payload)
    onClose()
  }

  return (
    <Modal
      title={
        repayment ? 'Edit repayment' : incoming ? 'They paid you back' : 'You paid them back'
      }
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="form-grid">
          <div className="field-wide">
            <span className="field-label">Which way did the money go?</span>
            <div className="segmented">
              <button
                type="button"
                className={incoming ? 'active' : ''}
                onClick={() => set({ direction: 'out' })}
              >
                They paid me
              </button>
              <button
                type="button"
                className={!incoming ? 'active' : ''}
                onClick={() => set({ direction: 'in' })}
              >
                I paid them
              </button>
            </div>
          </div>
          <Field label="Person">
            <select value={form.personId} onChange={(e) => set({ personId: e.target.value })}>
              {data.people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={incoming ? 'Date received' : 'Date paid'}>
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) => set({ date: e.target.value })}
            />
          </Field>
          <Field label="Amount" wide>
            <input
              type="number"
              required
              min="0"
              step="any"
              autoFocus
              value={form.amount}
              placeholder="0"
              onChange={(e) => set({ amount: e.target.value })}
            />
            {!repayment && suggested !== undefined && suggested > 0 && (
              <button
                type="button"
                className="btn-sm"
                style={{ marginTop: 8 }}
                onClick={() => set({ amount: String(suggested) })}
              >
                Settle in full ({Math.round(suggested).toLocaleString()})
              </button>
            )}
          </Field>
          <Field label="Notes" wide>
            <textarea value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Field>
        </div>
        <div className="inline-note">
          This goes against the oldest unsettled {incoming ? 'loan you gave' : 'amount you owe'}{' '}
          first.
        </div>
        <div className="form-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            {repayment ? 'Save changes' : 'Add repayment'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
