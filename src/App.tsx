import { useCallback, useEffect, useState } from 'react'
import { HashRouter, Link, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { StoreProvider, useStore } from './lib/store'
import { SyncProvider, useSync } from './lib/syncEngine'
import { ThemeContext, useTheme, useThemeControls } from './lib/theme'
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
import { backupNudgeDue, daysSinceBackup, downloadBackup, snoozeBackupNudge } from './lib/backupReminder'
import { isEmpty } from './lib/schema'

/**
 * App-wide notices that must not be missed, whichever page is open: a newer
 * build is live, this build is too old to sync safely, or a stale device's
 * damage was caught and repaired.
 */
function AppBanners() {
  const { updateAvailable, latest } = useUpdateCheck()
  const { state, repairNote, dismissRepair } = useSync()
  const { data } = useStore()
  // Re-evaluated when a backup is taken or the nudge snoozed, from anywhere.
  const [, refresh] = useState(0)
  useEffect(() => {
    const bump = () => refresh((n) => n + 1)
    window.addEventListener('backup-recorded', bump)
    return () => window.removeEventListener('backup-recorded', bump)
  }, [])
  const nudge = backupNudgeDue(!isEmpty(data))
  const since = daysSinceBackup()
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
      {nudge && !repairNote && state !== 'outdated' && (
        <div className="app-banner subtle" role="status">
          <span>
            {since === null
              ? 'You have not downloaded a backup on this device yet.'
              : `Your last backup from this device was ${since} days ago.`}{' '}
            A file you keep yourself is the one copy nothing else can overwrite.
          </span>
          <button className="btn-primary btn-sm" onClick={() => downloadBackup(data)}>
            Download backup
          </button>
          <button className="btn-sm" onClick={() => snoozeBackupNudge()}>
            Remind me in a week
          </button>
        </div>
      )}
    </>
  )
}

/**
 * A quiet indicator; the detail lives in Settings. It says "Synced" only when the
 * cloud really has everything — edits still waiting to leave show as such.
 */
function SyncBadge() {
  const { config, state, pending } = useSync()
  if (!config) return null
  const [label, tone, title] =
    state === 'syncing'
      ? ['Syncing…', '', 'Talking to the cloud']
      : state === 'offline'
        ? ['Offline', 'planned', 'Changes are saved here and will sync when you reconnect']
        : state === 'error'
          ? ['Sync failed', 'planned', 'Open Settings for details']
          : state === 'outdated'
            ? ['Update needed', 'planned', 'Reload the app to update it']
            : pending
              ? ['Saving…', '', 'Changes on this device are about to sync']
              : ['Synced', 'active', 'Everything on this device is in the cloud']
  return (
    <Link to="/settings" className={`badge badge-plain ${tone}`} title={title}>
      {label}
    </Link>
  )
}

function NavLinks() {
  return (
    <>
      <NavLink to="/" end>
        Investments
      </NavLink>
      <NavLink to="/lending">Loans</NavLink>
      <NavLink to="/reports">Reports</NavLink>
      <NavLink to="/settings">Settings</NavLink>
    </>
  )
}

/** Opens each page at its top, instead of wherever the last page was scrolled to. */
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function Shell({ onLock }: { onLock: () => void }) {
  const { data } = useStore()
  const { dark, setPreference } = useThemeControls()

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-mark">{currencySymbol(data.settings)}</span>
          <span className="brand-text">Investment Tracker</span>
        </Link>
        <nav className="nav nav-top" aria-label="Main">
          <NavLinks />
        </nav>
        <div className="topbar-spacer" />
        <SyncBadge />
        <button
          className="btn-ghost btn-sm"
          title="Toggle light and dark"
          onClick={() => setPreference(dark ? 'light' : 'dark')}
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
      {/*
        The phone tab bar lives outside the header on purpose. The header's blur
        (backdrop-filter) makes it the anchor for any position:fixed child, so a
        bar inside it pinned itself to the header — over the Lock button — instead
        of to the bottom of the screen.
      */}
      <nav className="nav nav-bottom" aria-label="Main">
        <NavLinks />
      </nav>
      <ScrollToTop />
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
  const theme = useTheme(data.settings.theme)
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

  return (
    <ThemeContext.Provider value={theme}>
      {unlocked ? (
        // Hash routing keeps deep links working on static hosts like GitHub Pages.
        <HashRouter>
          <SyncProvider>
            <Shell onLock={lock} />
          </SyncProvider>
        </HashRouter>
      ) : (
        <Lock
          expired={expired}
          onUnlock={() => {
            setExpired(false)
            setUnlocked(true)
          }}
        />
      )}
    </ThemeContext.Provider>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Gate />
    </StoreProvider>
  )
}
