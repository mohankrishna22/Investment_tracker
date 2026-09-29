import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { Settings } from './types'

type ThemePreference = Settings['theme']

/**
 * Theme is a per-device preference, so it lives in this device's storage rather
 * than in the synced data. It used to be synced, which meant switching the phone
 * to dark mode flipped the Mac too — and counted as an edit that had to sync.
 */
const KEY = 'investment-tracker/theme'

function readPreference(fallback: ThemePreference): ThemePreference {
  try {
    const stored = localStorage.getItem(KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch {
    /* fall through */
  }
  return fallback
}

/**
 * Returns the device's theme preference and whether dark is live, and applies it.
 * `legacy` is the old synced setting, used once as the starting point.
 */
export function useTheme(legacy: ThemePreference) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => readPreference(legacy))
  const [dark, setDark] = useState(false)

  const setPreference = useCallback((next: ThemePreference) => {
    try {
      localStorage.setItem(KEY, next)
    } catch {
      /* the choice still applies for this session */
    }
    setPreferenceState(next)
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const isDark = preference === 'dark' || (preference === 'system' && media.matches)
      document.documentElement.dataset.theme = isDark ? 'dark' : 'light'
      const meta = document.querySelector('meta[name="theme-color"]')
      meta?.setAttribute('content', isDark ? '#0b1020' : '#f5f7fb')
      setDark(isDark)
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [preference])

  return { dark, preference, setPreference }
}

export interface ThemeControls {
  dark: boolean
  preference: ThemePreference
  setPreference: (next: ThemePreference) => void
}

export const ThemeContext = createContext<ThemeControls | null>(null)

export function useThemeControls() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useThemeControls must be used inside ThemeContext')
  return ctx
}
