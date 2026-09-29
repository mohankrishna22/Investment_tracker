import { useState } from 'react'
import { useStore } from '../lib/store'
import { useSync } from '../lib/syncEngine'
import { getHistory, listHistory, RpcError, type HistoryEntry } from '../lib/sync'
import { saveSafetyCopy } from '../lib/safety'
import { download } from '../lib/csv'
import { ConfirmButton } from './ui'

type Status = 'idle' | 'loading' | 'ready' | 'not-installed' | 'error'

const REPO_SQL =
  'https://github.com/mohankrishna22/Investment_tracker/blob/main/supabase/history.sql'

/**
 * Every version the cloud copy has had, kept by the database itself — so a bad
 * write can be undone from any device, even after every device has taken it.
 */
export default function CloudHistory({ locale }: { locale: string }) {
  const { config } = useSync()
  const { data, replaceAll } = useStore()
  const [status, setStatus] = useState<Status>('idle')
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [message, setMessage] = useState('')

  if (!config) return null

  const load = async () => {
    setStatus('loading')
    setMessage('')
    try {
      setEntries(await listHistory(config))
      setStatus('ready')
    } catch (e) {
      setStatus(e instanceof RpcError && e.missingFunction ? 'not-installed' : 'error')
    }
  }

  const fetchVersion = async (entry: HistoryEntry) => {
    const version = await getHistory(config, entry.historyId)
    if (!version) throw new Error('That version is no longer available.')
    return version
  }

  const restore = async (entry: HistoryEntry) => {
    try {
      const version = await fetchVersion(entry)
      saveSafetyCopy(data, 'Before restoring an earlier cloud version')
      // An ordinary restore: stamped as a new change, so it syncs to every device.
      replaceAll(version)
      setMessage(
        `Restored the version from ${new Date(entry.savedAt).toLocaleString(locale || undefined)}. It is syncing to your other devices now.`,
      )
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not restore that version.')
    }
  }

  const save = async (entry: HistoryEntry) => {
    try {
      const version = await fetchVersion(entry)
      download(
        `investment-tracker-cloud-${entry.savedAt.slice(0, 19).replace(/:/g, '-')}.json`,
        JSON.stringify(version, null, 2),
        'application/json',
      )
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not download that version.')
    }
  }

  return (
    <div className="card">
      <div className="card-head">
        <h3>Cloud version history</h3>
        <div className="spacer" />
        <button className="btn-sm" onClick={() => void load()} disabled={status === 'loading'}>
          {status === 'loading' ? 'Loading…' : status === 'ready' ? 'Refresh' : 'Show history'}
        </button>
      </div>
      <div className="card-pad">
        <p className="muted" style={{ marginTop: 0 }}>
          Each time any device saves, the cloud keeps the copy it replaced — up to 200. Restore
          any of them from any device.
        </p>

        {message && (
          <div className="banner">
            <span>{message}</span>
          </div>
        )}

        {status === 'not-installed' && (
          <div className="banner" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
            <strong>Version history is not switched on yet.</strong>
            <span>
              It needs one more SQL script in Supabase, like the first one. In the Supabase
              dashboard open <strong>SQL Editor → New query</strong>, paste the contents of{' '}
              <a href={REPO_SQL} target="_blank" rel="noreferrer">
                supabase/history.sql
              </a>
              , and run it. History starts from that moment.
            </span>
          </div>
        )}

        {status === 'error' && (
          <p className="neg" style={{ marginBottom: 0 }}>
            Could not load the history. Check your connection and try again.
          </p>
        )}

        {status === 'ready' && entries.length === 0 && (
          <p className="muted" style={{ marginBottom: 0 }}>
            No earlier versions yet. The first one is kept the next time anything changes.
          </p>
        )}

        {status === 'ready' && entries.length > 0 && (
          <div className="activity history-list" style={{ margin: '0 -16px' }}>
            {entries.map((entry) => (
              <div key={entry.historyId} className="activity-row" style={{ flexWrap: 'wrap' }}>
                <div className="main">
                  <div className="t">
                    {new Date(entry.savedAt).toLocaleString(locale || undefined)}
                  </div>
                  <div className="s">
                    {entry.counts.ventures} investment types · {entry.counts.investments}{' '}
                    investments · {entry.counts.people} people · {entry.counts.loans} loans
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn-sm" onClick={() => void save(entry)}>
                    Download
                  </button>
                  <ConfirmButton
                    className="btn btn-sm"
                    label="Restore"
                    confirmLabel="Replace current data?"
                    onConfirm={() => void restore(entry)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
