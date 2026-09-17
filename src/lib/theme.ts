import { useEffect, useState } from 'react'
import type { Settings } from './types'

/** Applies the stored preference to <html> and reports whether dark is live. */
export function useTheme(preference: Settings['theme']) {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const isDark = preference === 'dark' || (preference === 'system' && media.matches)
      document.documentElement.dataset.theme = isDark ? 'dark' : 'light'
      setDark(isDark)
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [preference])

  return dark
}
