import { useState, type FormEvent } from 'react'
import { checkCode, rememberUnlock } from '../lib/lock'

export default function Lock({ onUnlock }: { onUnlock: () => void }) {
  const [code, setCode] = useState('')
  const [trust, setTrust] = useState(true)
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
    rememberUnlock(trust)
    onUnlock()
  }

  return (
    <div className="lock-screen">
      <form className="card lock-card" onSubmit={submit}>
        <div className="brand-mark lock-mark">🔒</div>
        <h1>Investment Tracker</h1>
        <p className="muted">Enter your access code to continue.</p>
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
        <label className="lock-trust">
          <input type="checkbox" checked={trust} onChange={(e) => setTrust(e.target.checked)} />
          <span>Stay unlocked on this device</span>
        </label>
        <button type="submit" className="btn-primary lock-submit" disabled={!code || busy}>
          Unlock
        </button>
      </form>
    </div>
  )
}
