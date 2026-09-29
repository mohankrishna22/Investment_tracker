import { useEffect, useState } from 'react'
import { useStore } from '../lib/store'
import { listSafetyCopies, type SafetyCopy } from '../lib/safety'
import { download } from '../lib/csv'
import { ConfirmButton } from './ui'

const SUMMARY: [string, string][] = [
  ['ventures', 'investment types'],
  ['people', 'people'],
  ['loans', 'loans'],
  ['repayments', 'repayments'],
]

/**
 * Lists the automatic copies sync keeps before it ever shrinks this device's
 * data, and restores one on request. A restore is an ordinary edit, so it syncs
 * out to every other device like any other change.
 */
export default function SafetyCopies({ locale }: { locale: string }) {
  const { replaceAll } = useStore()
  const [copies, setCopies] = useState<SafetyCopy[]>(listSafetyCopies)
  const [restored, setRestored] = useState<string | null>(null)

  useEffect(() => {
    const refresh = () => setCopies(listSafetyCopies())
    window.addEventListener('safety-copies-changed', refresh)
    return () => window.removeEventListener('safety-copies-changed', refresh)
  }, [])

  return (
    <div className="card">
      <div className="card-head">
        <h3>Automatic safety copies</h3>
      </div>
      <div className="card-pad">
        <p className="muted" style={{ marginTop: 0 }}>
          Whenever sync is about to replace this device's data with something that has fewer
          records, the previous copy is kept here first. The last {10} are kept on this device.
        </p>

        {restored && (
          <div className="banner">
            <span>Restored the copy from {restored}. It will sync to your other devices.</span>
          </div>
        )}

        {copies.length === 0 ? (
          <p className="muted" style={{ marginBottom: 0 }}>
            None yet — sync has not had to shrink anything on this device.
          </p>
        ) : (
          <div className="activity" style={{ margin: '0 -16px' }}>
            {copies.map((copy) => {
              const when = new Date(copy.savedAt).toLocaleString(locale || undefined)
              return (
                <div key={copy.savedAt} className="activity-row" style={{ flexWrap: 'wrap' }}>
                  <div className="main">
                    <div className="t">{when}</div>
                    <div className="s">
                      {copy.reason} ·{' '}
                      {SUMMARY.map(([key, label]) => `${copy.counts[key] ?? 0} ${label}`).join(' · ')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="btn-sm"
                      onClick={() =>
                        download(
                          `investment-tracker-safety-${copy.savedAt.slice(0, 19).replace(/:/g, '-')}.json`,
                          JSON.stringify(copy.data, null, 2),
                          'application/json',
                        )
                      }
                    >
                      Download
                    </button>
                    <ConfirmButton
                      className="btn btn-sm"
                      label="Restore"
                      confirmLabel="Replace current data?"
                      onConfirm={() => {
                        replaceAll(copy.data)
                        setRestored(when)
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
