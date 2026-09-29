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
import { COLLECTIONS, DATA_VERSION, NEVER, normalise, useStore } from './store'
import type { AppData } from './types'
import {
  loadSyncConfig,
  pullSnapshot,
  pushSnapshot,
  saveSyncConfig,
  type RemoteSnapshot,
  type SyncConfig,
} from './sync'

export type SyncState = 'off' | 'idle' | 'syncing' | 'error' | 'outdated'

interface SyncContextValue {
  config: SyncConfig | null
  state: SyncState
  error: string | null
  lastSyncedAt: string | null
  /** Set when both copies changed since the last sync and one had to win. */
  conflictNote: string | null
  /** Set when a stale device's write was caught and the cloud copy repaired. */
  repairNote: string | null
  /** What the cloud holds, fetched on demand for the diagnostics panel. */
  inspectCloud: () => Promise<CloudSummary | null>
  /** Throws away this device's copy and takes the cloud's. */
  pullFromCloud: () => Promise<void>
  dismissRepair: () => void
  connect: (config: SyncConfig) => Promise<void>
  disconnect: () => void
  syncNow: () => Promise<void>
  dismissConflict: () => void
}

const SyncContext = createContext<SyncContextValue | null>(null)

const MARKER_KEY = 'investment-tracker/sync-marker'
const PUSH_DEBOUNCE_MS = 1500
const POLL_MS = 60_000

export interface CloudSummary {
  updatedAt: string
  version: number
  counts: Record<(typeof COLLECTIONS)[number], number | null>
}

/**
 * A snapshot written by an older build is missing whole collections that build
 * never knew existed — not emptied, absent. Taking it at face value would erase
 * them here too. Put back anything the writer could not have known about.
 *
 * Only collections that are absent from the raw payload are restored, so an
 * older build can never resurrect something it deliberately deleted: it cannot
 * delete what it cannot see.
 */
function healStaleWrite(local: AppData, remoteRaw: AppData) {
  const writerVersion = typeof remoteRaw.version === 'number' ? remoteRaw.version : 1
  if (writerVersion >= DATA_VERSION) return { data: remoteRaw, repaired: false }

  const merged = { ...remoteRaw } as unknown as Record<string, unknown>
  let repaired = false
  for (const key of COLLECTIONS) {
    const absent = !(key in (remoteRaw as object))
    const localHasSome = Array.isArray(local[key]) && local[key].length > 0
    if (absent && localHasSome) {
      merged[key] = local[key]
      repaired = true
    }
  }
  return { data: merged as unknown as AppData, repaired }
}

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
  const [repairNote, setRepairNote] = useState<string | null>(null)

  // The engine reads the live data without re-subscribing every effect to it.
  const dataRef = useRef(data)
  dataRef.current = data
  const busy = useRef(false)
  // A sync requested while one is running is remembered, not dropped — otherwise
  // an edit made during a background poll would wait for the next poll to leave.
  const again = useRef(false)

  /** Takes the cloud copy, first repairing it if an out-of-date device wrote it. */
  const adopt = useCallback(
    async (cfg: SyncConfig, remote: RemoteSnapshot) => {
      const { data: healed, repaired } = healStaleWrite(dataRef.current, remote.data)
      if (!repaired) {
        replaceAll(remote.data, { keepTimestamp: true })
        writeMarker({ remoteAt: remote.updatedAt, localAt: remote.data.updatedAt })
        setLastSyncedAt(remote.updatedAt)
        return
      }
      // Put the repaired copy back so every other device picks it up too.
      const fixed = { ...normalise(healed), updatedAt: new Date().toISOString() }
      replaceAll(fixed, { keepTimestamp: true })
      const remoteAt = await pushSnapshot(cfg, fixed)
      writeMarker({ remoteAt, localAt: fixed.updatedAt })
      setLastSyncedAt(remoteAt)
      setRepairNote(
        'Another device running an older version of the app saved without your loans. They were restored from this device and the cloud copy repaired. Reload the app on your other devices to update them.',
      )
    },
    [replaceAll],
  )

  const runSync = useCallback(async () => {
    if (!config) return
    if (busy.current) {
      again.current = true
      return
    }
    busy.current = true
    setState('syncing')
    setError(null)
    try {
      const local = dataRef.current
      const marker = readMarker()
      const remote = await pullSnapshot(config)

      // Written by a newer build than this one: reading it could drop fields
      // this build does not know, and writing over it certainly would.
      const remoteVersion = remote && typeof remote.data.version === 'number' ? remote.data.version : 1
      if (remote && remoteVersion > DATA_VERSION) {
        setState('outdated')
        setError(
          'Your data was saved by a newer version of the app. Reload this page to update before syncing — nothing has been changed on this device.',
        )
        return
      }

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
        await adopt(config, remote)
      } else if (remoteChanged && !localChanged) {
        await adopt(config, remote)
      } else if (localChanged && !remoteChanged) {
        const remoteAt = await pushSnapshot(config, local)
        writeMarker({ remoteAt, localAt: local.updatedAt })
        setLastSyncedAt(remoteAt)
      } else if (localChanged && remoteChanged) {
        // Both moved since the last sync. Newest edit wins; say so out loud.
        const bothHaveData = !isEmpty(local) && !isEmpty(remote.data)
        if ((remote.data.updatedAt ?? '') > local.updatedAt) {
          await adopt(config, remote)
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
      if (again.current) {
        again.current = false
        setTimeout(() => void runSyncRef.current(), 0)
      }
    }
  }, [config, adopt])

  const runSyncRef = useRef(runSync)
  runSyncRef.current = runSync

  const inspectCloud = useCallback(async (): Promise<CloudSummary | null> => {
    if (!config) return null
    const remote = await pullSnapshot(config)
    if (!remote) return null
    const raw = remote.data as unknown as Record<string, unknown>
    const counts = Object.fromEntries(
      COLLECTIONS.map((key) => [key, Array.isArray(raw[key]) ? (raw[key] as unknown[]).length : null]),
    ) as CloudSummary['counts']
    return {
      updatedAt: remote.updatedAt,
      version: typeof remote.data.version === 'number' ? remote.data.version : 1,
      counts,
    }
  }, [config])

  const pullFromCloud = useCallback(async () => {
    if (!config) return
    const remote = await pullSnapshot(config)
    if (!remote) return
    await adopt(config, remote)
  }, [config, adopt])

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
      repairNote,
      connect,
      disconnect,
      syncNow: runSync,
      dismissConflict: () => setConflictNote(null),
      dismissRepair: () => setRepairNote(null),
      inspectCloud,
      pullFromCloud,
    }),
    [
      config,
      state,
      error,
      lastSyncedAt,
      conflictNote,
      repairNote,
      connect,
      disconnect,
      runSync,
      inspectCloud,
      pullFromCloud,
    ],
  )

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
}

export function useSync() {
  const ctx = useContext(SyncContext)
  if (!ctx) throw new Error('useSync must be used inside <SyncProvider>')
  return ctx
}
