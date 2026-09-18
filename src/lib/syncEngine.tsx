import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { NEVER, useStore } from './store'
import type { AppData } from './types'
import {
  loadSyncConfig,
  pullSnapshot,
  pushSnapshot,
  saveSyncConfig,
  type SyncConfig,
} from './sync'

export type SyncState = 'off' | 'idle' | 'syncing' | 'error'

interface SyncContextValue {
  config: SyncConfig | null
  state: SyncState
  error: string | null
  lastSyncedAt: string | null
  /** Set when both copies changed since the last sync and one had to win. */
  conflictNote: string | null
  connect: (config: SyncConfig) => Promise<void>
  disconnect: () => void
  syncNow: () => Promise<void>
  dismissConflict: () => void
}

const SyncContext = createContext<SyncContextValue | null>(null)

const MARKER_KEY = 'investment-tracker/sync-marker'
const PUSH_DEBOUNCE_MS = 1500
const POLL_MS = 60_000

const isEmpty = (d: AppData) =>
  d.ventures.length === 0 && d.investments.length === 0 && d.payouts.length === 0

/** What the last successful sync left behind, used to tell edits from echoes. */
interface Marker {
  remoteAt: string
  localAt: string
}

function readMarker(): Marker | null {
  try {
    const raw = localStorage.getItem(MARKER_KEY)
    return raw ? (JSON.parse(raw) as Marker) : null
  } catch {
    return null
  }
}

function writeMarker(marker: Marker) {
  try {
    localStorage.setItem(MARKER_KEY, JSON.stringify(marker))
  } catch {
    /* non-fatal: the next sync just re-compares timestamps */
  }
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const { data, replaceAll } = useStore()
  const [config, setConfig] = useState<SyncConfig | null>(loadSyncConfig)
  const [state, setState] = useState<SyncState>(() => (loadSyncConfig() ? 'idle' : 'off'))
  const [error, setError] = useState<string | null>(null)
  const [conflictNote, setConflictNote] = useState<string | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(() => readMarker()?.remoteAt ?? null)

  // The engine reads the live data without re-subscribing every effect to it.
  const dataRef = useRef(data)
  dataRef.current = data
  const busy = useRef(false)

  const runSync = useCallback(async () => {
    if (!config || busy.current) return
    busy.current = true
    setState('syncing')
    setError(null)
    try {
      const local = dataRef.current
      const marker = readMarker()
      const remote = await pullSnapshot(config)

      const localChanged = !marker || marker.localAt !== local.updatedAt
      const remoteChanged = !marker || !remote || marker.remoteAt !== remote.updatedAt

      if (!remote) {
        // Nothing stored yet — this device seeds the row.
        const remoteAt = await pushSnapshot(config, local)
        writeMarker({ remoteAt, localAt: local.updatedAt })
        setLastSyncedAt(remoteAt)
      } else if (local.updatedAt === NEVER && !isEmpty(remote.data)) {
        // A device that has never been edited always takes what is already there.
        // Checked by timestamp, not emptiness: a deliberate erase must still sync.
        replaceAll(remote.data, { keepTimestamp: true })
        writeMarker({ remoteAt: remote.updatedAt, localAt: remote.data.updatedAt })
        setLastSyncedAt(remote.updatedAt)
      } else if (remoteChanged && !localChanged) {
        replaceAll(remote.data, { keepTimestamp: true })
        writeMarker({ remoteAt: remote.updatedAt, localAt: remote.data.updatedAt })
        setLastSyncedAt(remote.updatedAt)
      } else if (localChanged && !remoteChanged) {
        const remoteAt = await pushSnapshot(config, local)
        writeMarker({ remoteAt, localAt: local.updatedAt })
        setLastSyncedAt(remoteAt)
      } else if (localChanged && remoteChanged) {
        // Both moved since the last sync. Newest edit wins; say so out loud.
        const bothHaveData = !isEmpty(local) && !isEmpty(remote.data)
        if ((remote.data.updatedAt ?? '') > local.updatedAt) {
          replaceAll(remote.data, { keepTimestamp: true })
          writeMarker({ remoteAt: remote.updatedAt, localAt: remote.data.updatedAt })
          setLastSyncedAt(remote.updatedAt)
          if (bothHaveData)
            setConflictNote(
              'This device and another one both changed data since the last sync. The other device was more recent, so its version was kept.',
            )
        } else {
          const remoteAt = await pushSnapshot(config, local)
          writeMarker({ remoteAt, localAt: local.updatedAt })
          setLastSyncedAt(remoteAt)
          if (bothHaveData)
            setConflictNote(
              'This device and another one both changed data since the last sync. This device was more recent, so its version was kept.',
            )
        }
      } else {
        setLastSyncedAt(remote.updatedAt)
      }
      setState('idle')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setState('error')
    } finally {
      busy.current = false
    }
  }, [config, replaceAll])

  // Sync on start, when the tab comes back to the front, and on a slow poll.
  useEffect(() => {
    if (!config) return
    void runSync()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void runSync()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onVisible)
    const timer = setInterval(() => void runSync(), POLL_MS)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onVisible)
      clearInterval(timer)
    }
  }, [config, runSync])

  // Push local edits shortly after they settle.
  useEffect(() => {
    if (!config) return
    const marker = readMarker()
    if (marker && marker.localAt === data.updatedAt) return
    const timer = setTimeout(() => void runSync(), PUSH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [config, data.updatedAt, runSync])

  const connect = useCallback(async (next: SyncConfig) => {
    saveSyncConfig(next)
    try {
      localStorage.removeItem(MARKER_KEY)
    } catch {
      /* nothing cached to clear */
    }
    setConfig(next)
    setState('idle')
    setError(null)
  }, [])

  const disconnect = useCallback(() => {
    saveSyncConfig(null)
    try {
      localStorage.removeItem(MARKER_KEY)
    } catch {
      /* nothing cached to clear */
    }
    setConfig(null)
    setState('off')
    setError(null)
    setLastSyncedAt(null)
  }, [])

  const value = useMemo<SyncContextValue>(
    () => ({
      config,
      state,
      error,
      lastSyncedAt,
      conflictNote,
      connect,
      disconnect,
      syncNow: runSync,
      dismissConflict: () => setConflictNote(null),
    }),
    [config, state, error, lastSyncedAt, conflictNote, connect, disconnect, runSync],
  )

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
}

export function useSync() {
  const ctx = useContext(SyncContext)
  if (!ctx) throw new Error('useSync must be used inside <SyncProvider>')
  return ctx
}
