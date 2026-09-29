import { COLLECTIONS, DATA_VERSION, allIds } from './schema'
import type { AppData } from './types'

/** Deletions older than this are forgotten, keeping the record from growing forever. */
const TOMBSTONE_TTL_MS = 365 * 24 * 3600 * 1000

/**
 * Combines two copies that both changed since they last agreed.
 *
 * Every record from either side is kept — a loan added on the Mac and a
 * repayment added on the phone both survive — unless either side recorded
 * deleting it. Where both sides edited the same record, the copy saved more
 * recently wins for that record only; nothing else from the other side is lost.
 *
 * This replaces "newest copy wins", which threw away every change the other
 * device had made since the last sync.
 */
export function mergeSnapshots(local: AppData, remote: AppData): AppData {
  const localNewer = local.updatedAt >= (remote.updatedAt ?? '')
  const newer = localNewer ? local : remote
  const older = localNewer ? remote : local

  const cutoff = new Date(Date.now() - TOMBSTONE_TTL_MS).toISOString()
  const deleted: Record<string, string> = {}
  for (const source of [older.deleted ?? {}, newer.deleted ?? {}]) {
    for (const [id, at] of Object.entries(source)) {
      if (at >= cutoff && (!deleted[id] || at > deleted[id])) deleted[id] = at
    }
  }

  // Unknown top-level fields from either side ride along; the newer side wins ties.
  const merged = { ...older, ...newer } as unknown as Record<string, unknown>

  for (const key of COLLECTIONS) {
    const byId = new Map<string, { id: string }>()
    for (const item of (older[key] ?? []) as { id: string }[]) byId.set(item.id, item)
    for (const item of (newer[key] ?? []) as { id: string }[]) byId.set(item.id, item)
    merged[key] = [...byId.values()].filter((item) => !deleted[item.id])
  }

  return {
    ...(merged as unknown as AppData),
    version: DATA_VERSION,
    settings: newer.settings,
    deleted,
    updatedAt: new Date().toISOString(),
  }
}

/** True when taking `next` would lose a record `current` holds. */
export function wouldDrop(current: AppData, next: AppData) {
  const keep = new Set(allIds(next))
  return allIds(current).some((id) => !keep.has(id))
}
