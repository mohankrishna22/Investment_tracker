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

async function rpc<T>(config: SyncConfig, fn: string, body: unknown): Promise<T> {
  const response = await fetch(`${normaliseUrl(config.url)}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(
      `${response.status} ${response.statusText}${detail ? ` — ${detail.slice(0, 200)}` : ''}`,
    )
  }
  return (await response.json()) as T
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
