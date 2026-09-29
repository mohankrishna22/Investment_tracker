import { useEffect, useState } from 'react'

export const BUILD_ID = __BUILD_ID__

const CHECK_EVERY_MS = 5 * 60 * 1000

/**
 * Reports whether a newer build has been deployed since this tab loaded.
 *
 * Phones in particular keep a tab alive for days, resuming it from memory rather
 * than reloading — so without this, a device can run old code indefinitely.
 */
export function useUpdateCheck() {
  const [latest, setLatest] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    const check = async () => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, {
          cache: 'no-store',
        })
        if (!response.ok) return // e.g. the dev server, which has no version file
        const { build } = (await response.json()) as { build?: string }
        if (live && build) setLatest(build)
      } catch {
        // Offline or blocked: no news is fine, try again next time.
      }
    }
    void check()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check()
    }
    document.addEventListener('visibilitychange', onVisible)
    const timer = setInterval(check, CHECK_EVERY_MS)
    return () => {
      live = false
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(timer)
    }
  }, [])

  return { updateAvailable: latest !== null && latest !== BUILD_ID, latest }
}
