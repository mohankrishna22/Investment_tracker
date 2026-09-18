import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { decodePairing } from '../lib/sync'
import { useSync } from '../lib/syncEngine'

/** Landing spot for a pairing link or QR scan from an already-connected device. */
export default function Pair() {
  const { payload = '' } = useParams()
  const { connect } = useSync()
  const navigate = useNavigate()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const config = decodePairing(payload)
    if (!config) {
      setFailed(true)
      return
    }
    void connect(config).then(() => navigate('/', { replace: true }))
  }, [payload, connect, navigate])

  return (
    <div className="page">
      <div className="card empty">
        <h3>{failed ? 'That pairing link is not valid' : 'Pairing this device…'}</h3>
        <p>
          {failed
            ? 'Generate a fresh one from Settings on the device that already has your data.'
            : 'Connecting to your cloud sync and pulling your data down.'}
        </p>
        {failed && (
          <Link className="btn btn-primary" to="/settings">
            Open settings
          </Link>
        )}
      </div>
    </div>
  )
}
