import type { AppData } from './types'
import { download } from './csv'
import { localIsoDate } from './dates'

/**
 * Remembers when a backup was last downloaded on this device, so the app can
 * nudge before too long passes. Sync and safety copies both live in places that
 * can disappear; a file you saved yourself does not.
 */
const KEY = 'investment-tracker/last-backup'
export const BACKUP_NUDGE_DAYS = 30

export function recordBackup() {
  try {
    localStorage.setItem(KEY, new Date().toISOString())
  } catch {
    /* without storage the nudge just shows again */
  }
  window.dispatchEvent(new Event('backup-recorded'))
}

export function lastBackupAt(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

/** Days since the last backup, or null if there has never been one. */
export function daysSinceBackup(): number | null {
  const at = lastBackupAt()
  if (!at) return null
  const days = (Date.now() - Date.parse(at)) / 86400000
  return Number.isFinite(days) ? Math.floor(days) : null
}


/** Downloads the full data as JSON and records that a backup now exists. */
export function downloadBackup(data: AppData) {
  download(
    `investment-tracker-backup-${localIsoDate()}.json`,
    JSON.stringify(data, null, 2),
    'application/json',
  )
  recordBackup()
}

const SNOOZE_KEY = 'investment-tracker/backup-snooze-until'

export function snoozeBackupNudge(days = 7) {
  try {
    localStorage.setItem(SNOOZE_KEY, new Date(Date.now() + days * 86400000).toISOString())
  } catch {
    /* the nudge will just come back */
  }
  window.dispatchEvent(new Event('backup-recorded'))
}

/** Whether the nudge should show: there is data, no recent backup, and no snooze. */
export function backupNudgeDue(hasData: boolean) {
  if (!hasData) return false
  try {
    const snooze = localStorage.getItem(SNOOZE_KEY)
    if (snooze && Date.parse(snooze) > Date.now()) return false
  } catch {
    /* treat as not snoozed */
  }
  const days = daysSinceBackup()
  return days === null || days >= BACKUP_NUDGE_DAYS
}
