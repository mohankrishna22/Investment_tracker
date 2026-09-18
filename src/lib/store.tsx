import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { AppData, Investment, Payout, Settings, Venture } from './types'
import { nextPaletteColor } from './types'

const STORAGE_KEY = 'investment-tracker/v1'
const DATA_VERSION = 1

/**
 * A store nobody has touched must never look freshly edited: stamping it with
 * "now" would let an empty device win a sync against a device holding real data.
 */
export const NEVER = new Date(0).toISOString()

export const emptyData = (): AppData => ({
  version: DATA_VERSION,
  updatedAt: NEVER,
  ventures: [],
  investments: [],
  payouts: [],
  settings: {
    currency: 'INR',
    locale: 'en-IN',
    theme: 'system',
    ownerName: '',
  },
})

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

export const today = () => new Date().toISOString().slice(0, 10)

/** Merges stored JSON onto a fresh shape so older/partial backups still load. */
export function normalise(raw: unknown): AppData {
  const base = emptyData()
  if (!raw || typeof raw !== 'object') return base
  const input = raw as Partial<AppData>
  return {
    version: DATA_VERSION,
    updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : base.updatedAt,
    ventures: Array.isArray(input.ventures) ? input.ventures : [],
    investments: Array.isArray(input.investments) ? input.investments : [],
    payouts: Array.isArray(input.payouts) ? input.payouts : [],
    settings: { ...base.settings, ...(input.settings ?? {}) },
  }
}

function load(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? normalise(JSON.parse(raw)) : emptyData()
  } catch {
    return emptyData()
  }
}

interface Store {
  data: AppData
  addVenture: (v: Omit<Venture, 'id' | 'createdAt' | 'color'> & { color?: string }) => Venture
  updateVenture: (id: string, patch: Partial<Venture>) => void
  deleteVenture: (id: string) => void
  addInvestment: (i: Omit<Investment, 'id'>) => void
  updateInvestment: (id: string, patch: Partial<Investment>) => void
  deleteInvestment: (id: string) => void
  addPayout: (p: Omit<Payout, 'id'>) => void
  updatePayout: (id: string, patch: Partial<Payout>) => void
  deletePayout: (id: string) => void
  updateSettings: (patch: Partial<Settings>) => void
  replaceAll: (data: AppData, options?: { keepTimestamp?: boolean }) => void
  resetAll: () => void
}

const StoreContext = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(load)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {
      // Quota or private-mode failures must not take the app down.
    }
  }, [data])

  // Keep two tabs of the same tracker in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          setData(normalise(JSON.parse(e.newValue)))
        } catch {
          /* ignore malformed writes */
        }
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  /** Applies a change and stamps it, so sync always knows which copy is newer. */
  const mutate = useCallback((fn: (d: AppData) => AppData) => {
    setData((d) => ({ ...fn(d), updatedAt: new Date().toISOString() }))
  }, [])

  const addVenture = useCallback<Store['addVenture']>(
    (v) => {
      const venture: Venture = {
        ...v,
        id: uid(),
        color: v.color || nextPaletteColor(data.ventures.map((x) => x.color)),
        createdAt: new Date().toISOString(),
      }
      mutate((d) => ({ ...d, ventures: [...d.ventures, venture] }))
      return venture
    },
    [data.ventures, mutate],
  )

  const updateVenture = useCallback<Store['updateVenture']>((id, patch) => {
    mutate((d) => ({
      ...d,
      ventures: d.ventures.map((v) => (v.id === id ? { ...v, ...patch } : v)),
    }))
  }, [mutate])

  const deleteVenture = useCallback<Store['deleteVenture']>((id) => {
    mutate((d) => ({
      ...d,
      ventures: d.ventures.filter((v) => v.id !== id),
      investments: d.investments.filter((i) => i.ventureId !== id),
      payouts: d.payouts.filter((p) => p.ventureId !== id),
    }))
  }, [mutate])

  const addInvestment = useCallback<Store['addInvestment']>((i) => {
    mutate((d) => ({ ...d, investments: [...d.investments, { ...i, id: uid() }] }))
  }, [mutate])

  const updateInvestment = useCallback<Store['updateInvestment']>((id, patch) => {
    mutate((d) => ({
      ...d,
      investments: d.investments.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    }))
  }, [mutate])

  const deleteInvestment = useCallback<Store['deleteInvestment']>((id) => {
    mutate((d) => ({ ...d, investments: d.investments.filter((i) => i.id !== id) }))
  }, [mutate])

  const addPayout = useCallback<Store['addPayout']>((p) => {
    mutate((d) => ({ ...d, payouts: [...d.payouts, { ...p, id: uid() }] }))
  }, [mutate])

  const updatePayout = useCallback<Store['updatePayout']>((id, patch) => {
    mutate((d) => ({
      ...d,
      payouts: d.payouts.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }))
  }, [mutate])

  const deletePayout = useCallback<Store['deletePayout']>((id) => {
    mutate((d) => ({ ...d, payouts: d.payouts.filter((p) => p.id !== id) }))
  }, [mutate])

  const updateSettings = useCallback<Store['updateSettings']>((patch) => {
    mutate((d) => ({ ...d, settings: { ...d.settings, ...patch } }))
  }, [mutate])

  const replaceAll = useCallback<Store['replaceAll']>((next, options) => {
    const normalised = normalise(next)
    // Adopting a remote snapshot keeps its timestamp; a manual restore is a new change.
    setData(
      options?.keepTimestamp
        ? normalised
        : { ...normalised, updatedAt: new Date().toISOString() },
    )
  }, [])
  // An erase is a deliberate edit, so it is stamped and syncs out like any other.
  const resetAll = useCallback(
    () => setData({ ...emptyData(), updatedAt: new Date().toISOString() }),
    [],
  )

  const value = useMemo<Store>(
    () => ({
      data,
      addVenture,
      updateVenture,
      deleteVenture,
      addInvestment,
      updateInvestment,
      deleteInvestment,
      addPayout,
      updatePayout,
      deletePayout,
      updateSettings,
      replaceAll,
      resetAll,
    }),
    [
      data,
      addVenture,
      updateVenture,
      deleteVenture,
      addInvestment,
      updateInvestment,
      deleteInvestment,
      addPayout,
      updatePayout,
      deletePayout,
      updateSettings,
      replaceAll,
      resetAll,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>')
  return ctx
}
