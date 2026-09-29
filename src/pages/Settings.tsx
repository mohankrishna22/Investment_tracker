import { useRef, useState } from 'react'
import { useStore } from '../lib/store'
import { demoData } from '../lib/demo'
import { ConfirmButton, Field } from '../components/ui'
import { normalise } from '../lib/store'
import SyncCard from '../components/SyncCard'
import SafetyCopies from '../components/SafetyCopies'
import CloudHistory from '../components/CloudHistory'
import { isEmpty } from '../lib/schema'
import { daysSinceBackup, downloadBackup } from '../lib/backupReminder'
import { useThemeControls } from '../lib/theme'
import { planImport } from '../lib/csvImport'
import { uid } from '../lib/store'

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD', 'JPY']
const LOCALES = ['en-IN', 'en-US', 'en-GB', 'de-DE', 'fr-FR', 'ja-JP']

export default function Settings() {
  const { data, updateSettings, replaceAll, resetAll, addMany } = useStore()
  const csvInput = useRef<HTMLInputElement>(null)
  const { preference, setPreference } = useThemeControls()
  const fileInput = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')

  const exportBackup = () => {
    downloadBackup(data)
    setMessage('Backup downloaded.')
  }
  const since = daysSinceBackup()

  const importBackup = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text())
      const next = normalise(parsed)
      // A backup holding only loans is still a backup — the check covers every
      // kind of record, not just investments.
      if (isEmpty(next)) {
        setMessage('That file had no records in it — nothing was changed.')
        return
      }
      replaceAll(next)
      setMessage(
        `Restored ${next.ventures.length} investment types, ${next.investments.length} investments, ` +
          `${next.people.length} people and ${next.loans.length} loans.`,
      )
    } catch {
      setMessage('Could not read that file — it needs to be a backup exported from here.')
    }
  }

  const importCsv = async (files: FileList) => {
    const loaded = await Promise.all(
      [...files].map(async (file) => ({ name: file.name, text: await file.text() })),
    )
    const { add, summary } = planImport(loaded, data, uid)
    const added = summary.investments + summary.payouts + summary.loans + summary.repayments
    if (added > 0) addMany(add)
    const parts = [
      summary.investments && `${summary.investments} investments`,
      summary.payouts && `${summary.payouts} returns`,
      summary.loans && `${summary.loans} loans`,
      summary.repayments && `${summary.repayments} repayments`,
    ].filter(Boolean)
    const notes = [
      summary.newVentures && `created ${summary.newVentures} investment types`,
      summary.newPeople && `created ${summary.newPeople} people`,
      summary.duplicates && `skipped ${summary.duplicates} already here`,
      summary.invalid && `skipped ${summary.invalid} unreadable rows`,
      summary.unrecognised.length && `did not recognise ${summary.unrecognised.join(', ')}`,
    ].filter(Boolean)
    setMessage(
      (added > 0 ? `Imported ${parts.join(', ')}.` : 'Nothing new to import.') +
        (notes.length ? ` (${notes.join('; ')}.)` : ''),
    )
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <div className="sub">
            Your data lives in this browser. Turn on cloud sync below to share it with your
            other devices.
          </div>
        </div>
      </div>

      {message && (
        <div className="banner">
          <span>{message}</span>
          <div className="spacer" />
          <button className="btn-sm" onClick={() => setMessage('')}>
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-2">
        <SyncCard locale={data.settings.locale} />

        <div className="card">
          <div className="card-head">
            <h3>Display</h3>
          </div>
          <div className="card-pad">
            <div className="form-grid">
              <Field label="Your name (optional)">
                <input
                  value={data.settings.ownerName}
                  placeholder="Shown on the home page"
                  onChange={(e) => updateSettings({ ownerName: e.target.value })}
                />
              </Field>
              <Field label="Currency">
                <select
                  value={data.settings.currency}
                  onChange={(e) => updateSettings({ currency: e.target.value })}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Number & date format">
                <select
                  value={data.settings.locale}
                  onChange={(e) => updateSettings({ locale: e.target.value })}
                >
                  {LOCALES.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Theme (this device only)">
                <select
                  value={preference}
                  onChange={(e) => setPreference(e.target.value as never)}
                >
                  <option value="system">Match system</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </Field>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Backup & restore</h3>
          </div>
          <div className="card-pad">
            <p className="muted" style={{ marginTop: 0 }}>
              A backup is a point-in-time copy you keep yourself — worth taking before an erase
              or a restore, and the only way back if sync ever carries a mistake across devices.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={exportBackup}>Download backup (JSON)</button>
              <button onClick={() => fileInput.current?.click()}>Restore from backup</button>
              <input
                ref={fileInput}
                type="file"
                accept="application/json"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void importBackup(file)
                  e.target.value = ''
                }}
              />
            </div>
            <div className="inline-note">
              Restoring replaces everything currently stored. Last backup from this device:{' '}
              <strong>
                {since === null ? 'never' : since === 0 ? 'today' : `${since} day${since === 1 ? '' : 's'} ago`}
              </strong>
              .
            </div>

            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
              <button onClick={() => csvInput.current?.click()}>Import from CSV</button>
              <input
                ref={csvInput}
                type="file"
                accept=".csv,text/csv"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files?.length) void importCsv(e.target.files)
                  e.target.value = ''
                }}
              />
              <div className="inline-note">
                Adds records from CSVs this app exported — investments, returns, or loans, including
                per-person exports. Nothing is replaced, and anything already here is skipped, so
                importing the same file twice is safe. You can pick several files at once.
              </div>
            </div>
          </div>
        </div>

        <CloudHistory locale={data.settings.locale} />

        <SafetyCopies locale={data.settings.locale} />

        <div className="card">
          <div className="card-head">
            <h3>Sample data</h3>
          </div>
          <div className="card-pad">
            <p className="muted" style={{ marginTop: 0 }}>
              Load three example ventures with a couple of years of history to see how the reports
              behave. This replaces your current data, so back it up first.
            </p>
            <ConfirmButton
              className="btn"
              label="Load sample portfolio"
              confirmLabel="Replace current data?"
              onConfirm={() => {
                replaceAll(demoData())
                setMessage('Sample portfolio loaded.')
              }}
            />
          </div>
        </div>

        <div className="card danger-zone">
          <div className="card-head">
            <h3>Danger zone</h3>
          </div>
          <div className="card-pad">
            <p className="muted" style={{ marginTop: 0 }}>
              Deletes every investment type, entry and return stored in this browser. With cloud
              sync on, the erase is pushed to your other devices too. There is no undo.
            </p>
            <ConfirmButton
              className="btn btn-danger"
              label="Erase all data"
              confirmLabel="Really erase everything?"
              onConfirm={() => {
                resetAll()
                setMessage('All data erased.')
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
