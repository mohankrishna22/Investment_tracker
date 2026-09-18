import { useState, type FormEvent } from 'react'
import { checkCode, touchUnlock } from '../lib/lock'

export default function Lock({ onUnlock, expired }: { onUnlock: () => void; expired?: boolean }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const ok = await checkCode(code)
    setBusy(false)
    if (!ok) {
      setError(true)
      setCode('')
      return
    }
    touchUnlock()
    onUnlock()
  }

  return (
    <div className="lock-screen">
      <form className="card lock-card" onSubmit={submit}>
        <div className="brand-mark lock-mark">🔒</div>
        <h1>Investment Tracker</h1>
        <p className="muted">{expired ? 'Locked after 30 idle minutes.' : 'Enter your access code to continue.'}</p>
        <input
          className={`lock-input ${error ? 'shake' : ''}`}
          value={code}
          onChange={(e) => {
            setCode(e.target.value.replace(/\D/g, '').slice(0, 8))
            setError(false)
          }}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          placeholder="••••"
          aria-label="Access code"
          aria-invalid={error}
        />
        <div aria-live="polite" className={`lock-error ${error ? 'visible' : ''}`}>
          {error ? 'That code is not right.' : ' '}
        </div>
        <p className="lock-note">Locks itself again after 30 minutes of inactivity.</p>
        <button type="submit" className="btn-primary lock-submit" disabled={!code || busy}>
          Unlock
        </button>
      </form>
    </div>
  )
}
