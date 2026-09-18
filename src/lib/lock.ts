/**
 * A front-door access code with a 30-minute idle timeout.
 *
 * This is a curtain, not a lock. The app is a static bundle, so everything here
 * ships to the browser and anyone willing to open devtools can walk past it.
 * Storing the SHA-256 digest rather than the code itself only stops the number
 * being read straight out of the source; a four-digit code falls to a
 * brute-force in milliseconds. Real protection would have to be checked by a
 * server that holds the data.
 */
const CODE_HASH = 'dca7ee6e13502915ed529e99704e17bd4d0449bec91453223f9c073d1034b382'

const UNLOCK_KEY = 'investment-tracker/unlocked-until'

export const IDLE_LIMIT_MS = 30 * 60 * 1000

export async function checkCode(code: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code.trim()))
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return hex === CODE_HASH
}

function readExpiry(): number {
  try {
    const raw = localStorage.getItem(UNLOCK_KEY)
    const value = raw ? Number(raw) : 0
    return Number.isFinite(value) ? value : 0
  } catch {
    return 0
  }
}

export function isUnlocked() {
  return readExpiry() > Date.now()
}

/** Pushes the deadline out; called on unlock and on each sign of activity. */
export function touchUnlock() {
  try {
    localStorage.setItem(UNLOCK_KEY, String(Date.now() + IDLE_LIMIT_MS))
  } catch {
    // Private mode can refuse writes; the session stays unlocked only in memory.
  }
}

export function forgetUnlock() {
  try {
    localStorage.removeItem(UNLOCK_KEY)
  } catch {
    /* nothing to clear */
  }
}

/** Milliseconds until the idle timeout bites, or 0 if it already has. */
export function msUntilLock() {
  return Math.max(0, readExpiry() - Date.now())
}
