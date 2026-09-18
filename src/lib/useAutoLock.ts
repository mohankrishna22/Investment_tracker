import { useEffect } from 'react'
import { IDLE_LIMIT_MS, isUnlocked, msUntilLock, touchUnlock } from './lock'

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const
// Don't write to storage on every single event — once a minute is plenty.
const TOUCH_THROTTLE_MS = 60_000
const CHECK_INTERVAL_MS = 15_000

/** Locks the app again after 30 idle minutes, and on return to a stale tab. */
export function useAutoLock(unlocked: boolean, onExpire: () => void) {
  useEffect(() => {
    if (!unlocked) return
    let lastTouch = 0

    const touch = () => {
      const now = Date.now()
      // A tab left open past the deadline must expire, not be revived by a click.
      if (!isUnlocked()) return onExpire()
      if (now - lastTouch < TOUCH_THROTTLE_MS) return
      lastTouch = now
      touchUnlock()
    }

    const check = () => {
      if (msUntilLock() === 0) onExpire()
    }

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, touch, { passive: true })
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', onVisible)
    const timer = setInterval(check, CHECK_INTERVAL_MS)

    return () => {
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, touch)
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(timer)
    }
  }, [unlocked, onExpire])
}

export { IDLE_LIMIT_MS }
