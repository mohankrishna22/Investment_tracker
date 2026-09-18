import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { useSync } from '../lib/syncEngine'
import { newSyncId, normaliseUrl, pairingLink } from '../lib/sync'
import { ConfirmButton, Field } from './ui'

const STATUS_TEXT: Record<string, string> = {
  off: 'Not connected',
  idle: 'Up to date',
  syncing: 'Syncing…',
  error: 'Sync failed',
}

export default function SyncCard({ locale }: { locale: string }) {
  const { config, state, error, lastSyncedAt, conflictNote, connect, disconnect, syncNow, dismissConflict } =
    useSync()
  const [form, setForm] = useState({ url: '', anonKey: '', syncId: '' })
  const [qr, setQr] = useState('')
  const [showPairing, setShowPairing] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!config || !showPairing) {
      setQr('')
      return
    }
    let live = true
    QRCode.toDataURL(pairingLink(config), { width: 240, margin: 1 })
      .then((url) => live && setQr(url))
      .catch(() => live && setQr(''))
    return () => {
      live = false
    }
  }, [config, showPairing])

  if (!config) {
    return (
      <div className="card">
        <div className="card-head">
          <h3>Cloud sync</h3>
        </div>
        <div className="card-pad">
          <p className="muted" style={{ marginTop: 0 }}>
            Connect a free Supabase project and this tracker will keep the same data on
            every device you pair. Run <code>supabase/schema.sql</code> in the SQL editor
            first, then paste the project URL and anon key from{' '}
            <strong>Project Settings → API</strong>.
          </p>
          <form
            className="form-grid"
            onSubmit={(e) => {
              e.preventDefault()
              if (!form.url || !form.anonKey) return
              void connect({
                url: normaliseUrl(form.url),
                anonKey: form.anonKey.trim(),
                syncId: form.syncId.trim() || newSyncId(),
              })
            }}
          >
            <Field label="Project URL" wide>
              <input
                required
                value={form.url}
                placeholder="https://xxxxxxxx.supabase.co"
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              />
            </Field>
            <Field label="Anon public key" wide>
              <input
                required
                value={form.anonKey}
                placeholder="eyJhbGciOi…"
                onChange={(e) => setForm((f) => ({ ...f, anonKey: e.target.value }))}
              />
            </Field>
            <Field label="Sync ID" wide>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={form.syncId}
                  placeholder="Left blank, a new one is generated"
                  onChange={(e) => setForm((f) => ({ ...f, syncId: e.target.value }))}
                />
                <button type="button" onClick={() => setForm((f) => ({ ...f, syncId: newSyncId() }))}>
                  Generate
                </button>
              </div>
              <div className="inline-note">
                This is the only thing keeping your data private — treat it like a password.
              </div>
            </Field>
            <div className="field-wide">
              <button type="submit" className="btn-primary">
                Connect
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="card-head">
        <h3>Cloud sync</h3>
        <div className="spacer" />
        <span
          className={`badge badge-plain ${state === 'error' ? 'planned' : state === 'idle' ? 'active' : ''}`}
        >
          {STATUS_TEXT[state] ?? state}
        </span>
      </div>
      <div className="card-pad">
        {conflictNote && (
          <div className="banner">
            <span>{conflictNote}</span>
            <div className="spacer" />
            <button className="btn-sm" onClick={dismissConflict}>
              Got it
            </button>
          </div>
        )}
        {error && (
          <div className="banner" style={{ background: 'transparent', borderColor: 'var(--neg)' }}>
            <span className="neg">{error}</span>
          </div>
        )}

        <p className="muted" style={{ marginTop: 0 }}>
          Connected to <strong>{new URL(config.url).host}</strong>
          {lastSyncedAt && (
            <>
              {' '}
              · last synced {new Date(lastSyncedAt).toLocaleString(locale || undefined)}
            </>
          )}
          . Changes save automatically and pull in when you switch back to this tab.
        </p>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => void syncNow()} disabled={state === 'syncing'}>
            Sync now
          </button>
          <button onClick={() => setShowPairing((v) => !v)}>
            {showPairing ? 'Hide pairing code' : 'Pair another device'}
          </button>
          <ConfirmButton
            className="btn btn-danger"
            label="Disconnect"
            confirmLabel="Stop syncing this device?"
            onConfirm={disconnect}
          />
        </div>

        {showPairing && (
          <div style={{ marginTop: 18 }}>
            <p className="muted" style={{ marginTop: 0 }}>
              Scan this on your other device, or open the link there. It carries the project
              key and sync ID, so treat it like a password — don't post it anywhere.
            </p>
            {qr && (
              <img
                src={qr}
                alt="Pairing QR code"
                width={220}
                height={220}
                style={{ borderRadius: 12, background: '#fff', padding: 8 }}
              />
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  void navigator.clipboard
                    ?.writeText(pairingLink(config))
                    .then(() => setCopied(true))
                    .catch(() => setCopied(false))
                }}
              >
                {copied ? 'Copied' : 'Copy pairing link'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
