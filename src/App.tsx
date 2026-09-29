import { useCallback, useState } from 'react'
import { HashRouter, Link, Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { StoreProvider, useStore } from './lib/store'
import { SyncProvider, useSync } from './lib/syncEngine'
import { useTheme } from './lib/theme'
import Dashboard from './pages/Dashboard'
import VentureDetail from './pages/VentureDetail'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import Pair from './pages/Pair'
import Lending from './pages/Lending'
import PersonDetail from './pages/PersonDetail'
import { currencySymbol } from './lib/format'
import { forgetUnlock, isUnlocked } from './lib/lock'
import { useAutoLock } from './lib/useAutoLock'
import { useUpdateCheck } from './lib/useUpdateCheck'
import Lock from './components/Lock'

/**
 * App-wide notices that must not be missed, whichever page is open: a newer
 * build is live, this build is too old to sync safely, or a stale device's
 * damage was caught and repaired.
 */
function AppBanners() {
  const { updateAvailable, latest } = useUpdateCheck()
  const { state, repairNote, dismissRepair } = useSync()
  // GitHub Pages lets browsers cache the HTML for ten minutes, so a plain reload
  // just after a deploy can hand back the same stale page. A fresh query string
  // is a different URL as far as that cache is concerned.
  const reload = () => {
    const url = new URL(window.location.href)
    url.searchParams.set('v', latest ?? Date.now().toString(36))
    window.location.replace(url.toString())
  }

  return (
    <>
      {state === 'outdated' ? (
        <div className="app-banner danger" role="alert">
          <span>
            This copy of the app is out of date, so syncing is paused to protect your data.
          </span>
          <button className="btn-primary btn-sm" onClick={reload}>
            Reload now
          </button>
        </div>
      ) : (
        updateAvailable && (
          <div className="app-banner" role="status">
            <span>A newer version of the app is available.</span>
            <button className="btn-primary btn-sm" onClick={reload}>
              Reload
            </button>
          </div>
        )
      )}
      {repairNote && (
        <div className="app-banner" role="status">
          <span>{repairNote}</span>
          <button className="btn-sm" onClick={dismissRepair}>
            Got it
          </button>
        </div>
      )}
    </>
  )
}

/** A quiet indicator; the detail lives in Settings. */
function SyncBadge() {
  const { config, state } = useSync()
  if (!config) return null
  const label =
    state === 'syncing'
      ? 'Syncing…'
      : state === 'error'
        ? 'Sync failed'
        : state === 'outdated'
          ? 'Update needed'
          : 'Synced'
  return (
    <Link
      to="/settings"
      className={`badge badge-plain ${state === 'error' || state === 'outdated' ? 'planned' : state === 'idle' ? 'active' : ''}`}
      title="Cloud sync status"
    >
      {label}
    </Link>
  )
}

function Shell({ onLock, dark }: { onLock: () => void; dark: boolean }) {
  const { data, updateSettings } = useStore()

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-mark">{currencySymbol(data.settings)}</span>
          <span className="brand-text">Investment Tracker</span>
        </Link>
        <nav className="nav">
          <NavLink to="/" end>
            Investments
          </NavLink>
          <NavLink to="/lending">Loans</NavLink>
          <NavLink to="/reports">Reports</NavLink>
          <NavLink to="/settings">Settings</NavLink>
        </nav>
        <div className="topbar-spacer" />
        <SyncBadge />
        <button
          className="btn-ghost btn-sm"
          title="Toggle light and dark"
          onClick={() => updateSettings({ theme: dark ? 'light' : 'dark' })}
        >
          {dark ? '☀️' : '🌙'}
        </button>
        <button
          className="btn-ghost btn-sm"
          title="Lock and ask for the access code again"
          onClick={onLock}
        >
          Lock
        </button>
      </header>
      <AppBanners />
      <Routes>
        <Route path="/" element={<Dashboard dark={dark} />} />
        <Route path="/venture/:id" element={<VentureDetail dark={dark} />} />
        <Route path="/lending" element={<Lending dark={dark} />} />
        <Route path="/lending/:id" element={<PersonDetail dark={dark} />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/pair/:payload" element={<Pair />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

/** Sits inside the store so the lock screen wears the saved theme too. */
function Gate() {
  const { data } = useStore()
  const dark = useTheme(data.settings.theme)
  const [unlocked, setUnlocked] = useState(isUnlocked)
  const [expired, setExpired] = useState(false)

  const lock = useCallback(() => {
    forgetUnlock()
    setUnlocked(false)
  }, [])

  useAutoLock(
    unlocked,
    useCallback(() => {
      lock()
      setExpired(true)
    }, [lock]),
  )

  if (!unlocked)
    return (
      <Lock
        expired={expired}
        onUnlock={() => {
          setExpired(false)
          setUnlocked(true)
        }}
      />
    )

  return (
    // Hash routing keeps deep links working on static hosts like GitHub Pages.
    <HashRouter>
      <SyncProvider>
        <Shell dark={dark} onLock={lock} />
      </SyncProvider>
    </HashRouter>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Gate />
    </StoreProvider>
  )
}
