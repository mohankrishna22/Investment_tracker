import { useRef, useState } from 'react'
import { useStore } from '../lib/store'
import { demoData } from '../lib/demo'
import { download } from '../lib/csv'
import { ConfirmButton, Field } from '../components/ui'
import { normalise } from '../lib/store'

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD', 'JPY']
const LOCALES = ['en-IN', 'en-US', 'en-GB', 'de-DE', 'fr-FR', 'ja-JP']

export default function Settings() {
  const { data, updateSettings, replaceAll, resetAll } = useStore()
  const fileInput = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')

  const exportBackup = () => {
    download(
      `investment-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(data, null, 2),
      'application/json',
    )
    setMessage('Backup downloaded.')
  }

  const importBackup = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text())
      const next = normalise(parsed)
      if (!next.ventures.length && !next.investments.length) {
        setMessage('That file had no investments in it — nothing was changed.')
        return
      }
      replaceAll(next)
      setMessage(
        `Restored ${next.ventures.length} investment types and ${next.investments.length} entries.`,
      )
    } catch {
      setMessage('Could not read that file — it needs to be a backup exported from here.')
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <div className="sub">
            Everything lives in this browser only — no account, no server, nothing leaves your device.
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
              <Field label="Theme">
                <select
                  value={data.settings.theme}
                  onChange={(e) => updateSettings({ theme: e.target.value as never })}
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
              Browser storage is per-device. Export a backup before clearing site data or moving to a
              new machine.
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
            <div className="inline-note">Restoring replaces everything currently stored.</div>
          </div>
        </div>

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
              Deletes every investment type, entry and return stored in this browser. There is no undo.
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
