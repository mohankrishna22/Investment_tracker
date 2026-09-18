/**
 * A front-door access code.
 *
 * This is a curtain, not a lock. The app is a static bundle, so everything
 * here ships to the browser and anyone willing to open devtools can walk past
 * it. Storing the SHA-256 digest rather than the code itself only stops the
 * number being read straight out of the source; a four-digit code falls to a
 * brute-force in milliseconds. Real protection would have to be checked by a
 * server that holds the data.
 */
const CODE_HASH = 'dca7ee6e13502915ed529e99704e17bd4d0449bec91453223f9c073d1034b382'

const UNLOCK_KEY = 'investment-tracker/unlocked'

export async function checkCode(code: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code.trim()))
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return hex === CODE_HASH
}

/** sessionStorage forgets on tab close; localStorage is the "trust this device" case. */
export function isUnlocked() {
  try {
    return (
      sessionStorage.getItem(UNLOCK_KEY) === 'yes' || localStorage.getItem(UNLOCK_KEY) === 'yes'
    )
  } catch {
    return false
  }
}

export function rememberUnlock(persist: boolean) {
  try {
    sessionStorage.setItem(UNLOCK_KEY, 'yes')
    if (persist) localStorage.setItem(UNLOCK_KEY, 'yes')
  } catch {
    // Private mode can refuse writes; the session simply stays unlocked in memory.
  }
}

export function forgetUnlock() {
  try {
    sessionStorage.removeItem(UNLOCK_KEY)
    localStorage.removeItem(UNLOCK_KEY)
  } catch {
    /* nothing to clear */
  }
}
