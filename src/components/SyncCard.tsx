import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { useSync, type CloudSummary } from '../lib/syncEngine'
import { useStore } from '../lib/store'
import { BUILD_ID } from '../lib/useUpdateCheck'
import { newSyncId, normaliseUrl, pairingLink } from '../lib/sync'
import { ConfirmButton, Field } from './ui'

const STATUS_TEXT: Record<string, string> = {
  off: 'Not connected',
  idle: 'Up to date',
  syncing: 'Syncing…',
  error: 'Sync failed',
  outdated: 'Update needed',
}

const LABELS: Record<string, string> = {
  ventures: 'Investment types',
  investments: 'Investments',
  payouts: 'Returns',
  people: 'People',
  loans: 'Loans',
  repayments: 'Repayments',
}

/**
 * Puts this device's counts beside the cloud's, so "is my phone showing the same
 * thing as my Mac?" has an answer you can read rather than guess at.
 */
function Diagnostics({ locale }: { locale: string }) {
  const { inspectCloud, pullFromCloud } = useSync()
  const { data } = useStore()
  const [cloud, setCloud] = useState<CloudSummary | null | 'loading' | 'error'>(null)
  const [pulled, setPulled] = useState(false)

  const check = async () => {
    setCloud('loading')
    try {
      setCloud((await inspectCloud()) ?? 'error')
    } catch {
      setCloud('error')
    }
  }

  const local = data as unknown as Record<string, unknown[]>

  return (
    <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <strong style={{ fontSize: 14 }}>Compare with the cloud</strong>
        <span className="muted" style={{ fontSize: 12.5 }}>
          App build <code>{BUILD_ID}</code>
        </span>
        <div style={{ flex: 1 }} />
        <button className="btn-sm" onClick={() => void check()} disabled={cloud === 'loading'}>
          {cloud === 'loading' ? 'Checking…' : 'Check cloud copy'}
        </button>
      </div>

      {cloud === 'error' && (
        <p className="neg" style={{ fontSize: 13.5 }}>
          Could not read the cloud copy. Check the connection and try again.
        </p>
      )}

      {cloud && typeof cloud === 'object' && (
        <>
          <div className="table-wrap" style={{ marginTop: 10 }}>
            <table>
              <thead>
                <tr>
                  <th />
                  <th className="num">This device</th>
                  <th className="num">Cloud</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(LABELS).map(([key, label]) => {
                  const mine = Array.isArray(local[key]) ? local[key].length : 0
                  const theirs = cloud.counts[key as keyof CloudSummary['counts']]
                  const differs = theirs !== mine
                  return (
                    <tr key={key}>
                      <td>{label}</td>
                      <td className="num">{mine}</td>
                      <td className={`num ${differs ? 'neg' : ''}`}>
                        {theirs === null ? 'missing' : theirs}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="inline-note">
            Cloud copy last written{' '}
            {new Date(cloud.updatedAt).toLocaleString(locale || undefined)} by app data
            version {cloud.version}. Red means this device and the cloud disagree.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            <ConfirmButton
              className="btn btn-sm"
              label="Replace this device with the cloud copy"
              confirmLabel="Discard this device's copy?"
              onConfirm={() => {
                void pullFromCloud().then(() => {
                  setPulled(true)
                  void check()
                })
              }}
            />
            {pulled && <span className="pos" style={{ fontSize: 13 }}>Done — this device now matches the cloud.</span>}
          </div>
        </>
      )}
    </div>
  )
}

/** "just now", "3 min ago", or a time for anything older than an hour. */
function relativeTime(iso: string, locale: string) {
  const seconds = Math.round((Date.now() - Date.parse(iso)) / 1000)
  if (seconds < 45) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  return new Date(iso).toLocaleString(locale || undefined)
}

export default function SyncCard({ locale }: { locale: string }) {
  const {
    config,
    state,
    error,
    lastSyncedAt,
    lastCheckedAt,
    conflictNote,
    connect,
    disconnect,
    syncNow,
    dismissConflict,
  } = useSync()
  // Re-render every 30s so "checked 2 min ago" stays true without a click.
  const [, tick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), 30_000)
    return () => clearInterval(timer)
  }, [])
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
          className={`badge badge-plain ${state === 'error' || state === 'outdated' ? 'planned' : state === 'idle' ? 'active' : ''}`}
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
          Connected to <strong>{new URL(config.url).host}</strong>. Changes save automatically
          and pull in when you switch back to this tab.
        </p>
        <div className="sync-times">
          <div>
            <span className="k">Last checked</span>
            <span className="v">
              {state === 'syncing'
                ? 'checking now…'
                : lastCheckedAt
                  ? relativeTime(lastCheckedAt, locale)
                  : 'not yet this session'}
            </span>
          </div>
          <div>
            <span className="k">Cloud last changed</span>
            <span className="v">
              {lastSyncedAt ? new Date(lastSyncedAt).toLocaleString(locale || undefined) : '—'}
            </span>
          </div>
        </div>

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

        <Diagnostics locale={locale} />
      </div>
    </div>
  )
}
