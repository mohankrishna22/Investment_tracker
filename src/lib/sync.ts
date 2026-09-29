import type { AppData } from './types'

/**
 * Cloud sync against a Supabase project the user owns.
 *
 * The anon key ships inside the app, so it is treated as public: the snapshots
 * table has row-level security with no policies, and both directions go through
 * security-definer functions that require the sync id. The id is the real
 * secret — long, random, and never in the repository.
 */
export interface SyncConfig {
  url: string
  anonKey: string
  syncId: string
}

const CONFIG_KEY = 'investment-tracker/sync-config'

export function loadSyncConfig(): SyncConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<SyncConfig>
    if (!parsed.url || !parsed.anonKey || !parsed.syncId) return null
    return { url: parsed.url, anonKey: parsed.anonKey, syncId: parsed.syncId }
  } catch {
    return null
  }
}

export function saveSyncConfig(config: SyncConfig | null) {
  try {
    if (config) localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
    else localStorage.removeItem(CONFIG_KEY)
  } catch {
    /* storage unavailable; sync stays off for this session */
  }
}

/** 160 bits of randomness — long enough that the id cannot be guessed. */
export function newSyncId() {
  const bytes = crypto.getRandomValues(new Uint8Array(20))
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function normaliseUrl(url: string) {
  return url.trim().replace(/\/+$/, '')
}

/**
 * Without a limit, a request on a flaky mobile connection can hang for minutes,
 * and sync — which runs one request at a time — would stall behind it.
 */
const REQUEST_TIMEOUT_MS = 20_000

async function rpc<T>(config: SyncConfig, fn: string, body: unknown): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  let response: Response
  try {
    response = await fetch(`${normaliseUrl(config.url)}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (cause) {
    // fetch itself only rejects when the request never completed: no network,
    // DNS, a blocked host, or our timeout. Label it, so callers can tell it
    // apart from a genuine bug elsewhere.
    throw new NetworkError(cause)
  } finally {
    clearTimeout(timer)
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new RpcError(response.status, detail)
  }
  return (await response.json()) as T
}

/** The request never reached the server, or timed out waiting for it. */
export class NetworkError extends Error {
  constructor(readonly cause: unknown) {
    super(cause instanceof Error ? cause.message : 'Network request failed')
  }
}

/** A failed call, keeping the status so callers can tell "missing" from "broken". */
export class RpcError extends Error {
  constructor(
    readonly status: number,
    readonly detail: string,
  ) {
    super(`${status}${detail ? ` — ${detail.slice(0, 200)}` : ''}`)
  }

  /** PostgREST's answer when a function has not been created (e.g. history.sql not run). */
  get missingFunction() {
    return this.status === 404 || this.detail.includes('PGRST202')
  }
}

export interface RemoteSnapshot {
  data: AppData
  updatedAt: string
}

export async function pullSnapshot(config: SyncConfig): Promise<RemoteSnapshot | null> {
  const rows = await rpc<{ data: AppData; updated_at: string }[]>(config, 'pull_snapshot', {
    p_id: config.syncId,
  })
  if (!Array.isArray(rows) || rows.length === 0) return null
  return { data: rows[0].data, updatedAt: rows[0].updated_at }
}

export async function pushSnapshot(config: SyncConfig, data: AppData): Promise<string> {
  return await rpc<string>(config, 'push_snapshot', { p_id: config.syncId, p_data: data })
}

export interface HistoryEntry {
  historyId: number
  savedAt: string
  counts: { ventures: number; investments: number; people: number; loans: number }
}

/** Past cloud versions, newest first. Throws RpcError.missingFunction if not set up. */
export async function listHistory(config: SyncConfig): Promise<HistoryEntry[]> {
  const rows = await rpc<
    {
      history_id: number
      saved_at: string
      ventures: number
      investments: number
      people: number
      loans: number
    }[]
  >(config, 'list_history', { p_id: config.syncId })
  return (Array.isArray(rows) ? rows : []).map((r) => ({
    historyId: r.history_id,
    savedAt: r.saved_at,
    counts: { ventures: r.ventures, investments: r.investments, people: r.people, loans: r.loans },
  }))
}

export async function getHistory(config: SyncConfig, historyId: number): Promise<AppData | null> {
  return await rpc<AppData | null>(config, 'get_history', {
    p_id: config.syncId,
    p_history_id: historyId,
  })
}

/** Round-trips the config through a link the other device can open. */
export function encodePairing(config: SyncConfig) {
  const json = JSON.stringify({ u: config.url, k: config.anonKey, s: config.syncId })
  return btoa(String.fromCharCode(...new TextEncoder().encode(json)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export function decodePairing(payload: string): SyncConfig | null {
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))
    const json = new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)))
    const parsed = JSON.parse(json) as { u?: string; k?: string; s?: string }
    if (!parsed.u || !parsed.k || !parsed.s) return null
    return { url: parsed.u, anonKey: parsed.k, syncId: parsed.s }
  } catch {
    return null
  }
}

export function pairingLink(config: SyncConfig) {
  const { origin, pathname } = window.location
  return `${origin}${pathname}#/pair/${encodePairing(config)}`
}
