import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { decodePairing, type SyncConfig } from '../lib/sync'
import { useSync } from '../lib/syncEngine'
import { useStore } from '../lib/store'
import { countsOf, isEmpty } from '../lib/schema'

/**
 * Landing spot for a pairing link or QR scan from an already-connected device.
 *
 * A device that already holds data has to choose what happens to it. Merging
 * silently used to spread whatever was here — sample data included — to every
 * other device.
 */
export default function Pair() {
  const { payload = '' } = useParams()
  const { connect } = useSync()
  const { data } = useStore()
  const navigate = useNavigate()
  const [config, setConfig] = useState<SyncConfig | null | 'invalid'>(null)
  const [hasLocal] = useState(() => !isEmpty(data))

  useEffect(() => {
    const decoded = decodePairing(payload)
    if (!decoded) {
      setConfig('invalid')
      return
    }
    setConfig(decoded)
    // Nothing here to protect: just connect.
    if (!hasLocal) void connect(decoded).then(() => navigate('/', { replace: true }))
  }, [payload, connect, navigate, hasLocal])

  const choose = (takeCloud: boolean) => {
    if (!config || config === 'invalid') return
    void connect(config, { takeCloud }).then(() => navigate('/', { replace: true }))
  }

  if (config === 'invalid') {
    return (
      <div className="page">
        <div className="card empty">
          <h3>That pairing link is not valid</h3>
          <p>Generate a fresh one from Settings on the device that already has your data.</p>
          <Link className="btn btn-primary" to="/settings">
            Open settings
          </Link>
        </div>
      </div>
    )
  }

  if (!hasLocal) {
    return (
      <div className="page">
        <div className="card empty">
          <h3>Pairing this device…</h3>
          <p>Connecting to your cloud sync and pulling your data down.</p>
        </div>
      </div>
    )
  }

  const counts = countsOf(data)
  return (
    <div className="page">
      <div className="card" style={{ maxWidth: 620, margin: '0 auto' }}>
        <div className="card-head">
          <h3>This device already has data</h3>
        </div>
        <div className="card-pad">
          <p style={{ marginTop: 0 }}>
            It holds {counts.ventures} investment types, {counts.people} people and{' '}
            {counts.loans} loans. What should happen to them?
          </p>
          <div className="grid" style={{ gap: 10 }}>
            <button className="btn-primary choice" onClick={() => choose(true)}>
              <strong>Use the data in the cloud</strong>
              <span>
                Recommended. This device will show exactly what your other devices show. Its
                current data is kept as a safety copy in Settings, in case you want it back.
              </span>
            </button>
            <button className="choice" onClick={() => choose(false)}>
              <strong>Combine this device's data with the cloud</strong>
              <span>
                Everything here is added to your synced data and appears on every device.
                Only choose this if the data here is real and not yet anywhere else.
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
