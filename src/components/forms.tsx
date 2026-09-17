import { useState, type FormEvent } from 'react'
import { Field, Modal } from './ui'
import { today, useStore } from '../lib/store'
import {
  EXPENSE_CATEGORIES,
  PALETTE,
  PAYMENT_MODES,
  RETURN_KINDS,
  type Investment,
  type Payout,
  type Venture,
} from '../lib/types'

const num = (v: string) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export function VentureForm({
  venture,
  onClose,
  onCreated,
}: {
  venture?: Venture
  onClose: () => void
  onCreated?: (v: Venture) => void
}) {
  const { addVenture, updateVenture, data } = useStore()
  const [form, setForm] = useState({
    name: venture?.name ?? '',
    category: venture?.category ?? '',
    description: venture?.description ?? '',
    startDate: venture?.startDate ?? today(),
    status: venture?.status ?? 'active',
    targetAmount: venture?.targetAmount ? String(venture.targetAmount) : '',
    currentValue: venture?.currentValue ? String(venture.currentValue) : '',
    color: venture?.color ?? '',
  })

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    const payload = {
      name: form.name.trim(),
      category: form.category.trim() || 'Uncategorised',
      description: form.description.trim(),
      startDate: form.startDate,
      status: form.status as Venture['status'],
      targetAmount: form.targetAmount ? num(form.targetAmount) : undefined,
      currentValue: form.currentValue ? num(form.currentValue) : undefined,
      color: form.color,
    }
    if (venture) {
      updateVenture(venture.id, payload)
    } else {
      const created = addVenture(payload)
      onCreated?.(created)
    }
    onClose()
  }

  const knownCategories = [...new Set(data.ventures.map((v) => v.category).filter(Boolean))]

  return (
    <Modal title={venture ? 'Edit investment type' : 'New investment type'} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Name" wide>
            <input
              autoFocus
              required
              value={form.name}
              placeholder="e.g. Brew & Bloom Cafe"
              onChange={(e) => set({ name: e.target.value })}
            />
          </Field>
          <Field label="Category">
            <input
              list="venture-categories"
              value={form.category}
              placeholder="e.g. Food & Beverage"
              onChange={(e) => set({ category: e.target.value })}
            />
            <datalist id="venture-categories">
              {knownCategories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="Started on">
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => set({ startDate: e.target.value })}
            />
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={(e) => set({ status: e.target.value as never })}>
              <option value="active">Active</option>
              <option value="planned">Planned</option>
              <option value="closed">Closed</option>
            </select>
          </Field>
          <Field label="Capital target (optional)">
            <input
              type="number"
              min="0"
              step="any"
              value={form.targetAmount}
              placeholder="0"
              onChange={(e) => set({ targetAmount: e.target.value })}
            />
          </Field>
          <Field label="Current value (optional)">
            <input
              type="number"
              min="0"
              step="any"
              value={form.currentValue}
              placeholder="0"
              onChange={(e) => set({ currentValue: e.target.value })}
            />
          </Field>
          <Field label="Notes" wide>
            <textarea
              value={form.description}
              placeholder="Stake, partners, terms — anything worth remembering."
              onChange={(e) => set({ description: e.target.value })}
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
                  onClick={() => set({ color: c })}
                  style={{
                    width: 28,
                    height: 28,
                    padding: 0,
                    borderRadius: 8,
                    background: c,
                    border:
                      form.color === c ? '2px solid var(--text)' : '1px solid var(--border)',
                  }}
                />
              ))}
            </div>
            <div className="inline-note">
              Leave unpicked and the next free colour is assigned automatically.
            </div>
          </div>
        </div>
        <div className="form-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            {venture ? 'Save changes' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export function InvestmentForm({
  ventureId,
  investment,
  onClose,
}: {
  ventureId: string
  investment?: Investment
  onClose: () => void
}) {
  const { addInvestment, updateInvestment, data } = useStore()
  const [form, setForm] = useState({
    ventureId: investment?.ventureId ?? ventureId,
    date: investment?.date ?? today(),
    amount: investment ? String(investment.amount) : '',
    item: investment?.item ?? '',
    category: investment?.category ?? 'Capital',
    paymentMode: investment?.paymentMode ?? PAYMENT_MODES[0],
    notes: investment?.notes ?? '',
  })
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const payload = {
      ventureId: form.ventureId,
      date: form.date,
      amount: num(form.amount),
      item: form.item.trim() || 'Unlabelled',
      category: form.category,
      paymentMode: form.paymentMode,
      notes: form.notes.trim(),
    }
    if (payload.amount <= 0) return
    if (investment) updateInvestment(investment.id, payload)
    else addInvestment(payload)
    onClose()
  }

  return (
    <Modal title={investment ? 'Edit investment' : 'Add investment'} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Investment type">
            <select value={form.ventureId} onChange={(e) => set({ ventureId: e.target.value })}>
              {data.ventures.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date">
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
          <Field label="Spent on (item)" wide>
            <input
              value={form.item}
              placeholder="e.g. Espresso machine"
              onChange={(e) => set({ item: e.target.value })}
            />
          </Field>
          <Field label="Expense category">
            <select value={form.category} onChange={(e) => set({ category: e.target.value })}>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Paid by">
            <select
              value={form.paymentMode}
              onChange={(e) => set({ paymentMode: e.target.value })}
            >
              {PAYMENT_MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Notes" wide>
            <textarea value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Field>
        </div>
        <div className="form-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            {investment ? 'Save changes' : 'Add investment'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export function PayoutForm({
  ventureId,
  payout,
  onClose,
}: {
  ventureId: string
  payout?: Payout
  onClose: () => void
}) {
  const { addPayout, updatePayout, data } = useStore()
  const [form, setForm] = useState({
    ventureId: payout?.ventureId ?? ventureId,
    date: payout?.date ?? today(),
    amount: payout ? String(payout.amount) : '',
    kind: payout?.kind ?? 'profit',
    notes: payout?.notes ?? '',
  })
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const payload = {
      ventureId: form.ventureId,
      date: form.date,
      amount: num(form.amount),
      kind: form.kind as Payout['kind'],
      notes: form.notes.trim(),
    }
    if (payload.amount <= 0) return
    if (payout) updatePayout(payout.id, payload)
    else addPayout(payload)
    onClose()
  }

  return (
    <Modal title={payout ? 'Edit return' : 'Record a return'} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Investment type">
            <select value={form.ventureId} onChange={(e) => set({ ventureId: e.target.value })}>
              {data.ventures.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date">
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) => set({ date: e.target.value })}
            />
          </Field>
          <Field label="Amount received">
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
          <Field label="Type">
            <select value={form.kind} onChange={(e) => set({ kind: e.target.value as never })}>
              {RETURN_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k[0].toUpperCase() + k.slice(1)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Notes" wide>
            <textarea value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Field>
        </div>
        <div className="form-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            {payout ? 'Save changes' : 'Add return'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
