import { format } from 'date-fns'

// Re-exported from account-deletion.ts rather than duplicated here: this
// list previously existed as two separately maintained copies (one for the
// deletion sweep, one for the export), which could silently drift apart
// when a new top-level collection was added to only one of them.
export { TOP_LEVEL_COLLECTIONS } from '@/lib/account-deletion'

export interface UserDataExport {
  exportedAt: string
  uid: string
  data: Record<string, unknown[]>
}

/** Assembles the exported-JSON payload shape, stamped with the export time. */
export function buildExportPayload(uid: string, data: Record<string, unknown[]>): UserDataExport {
  return { exportedAt: new Date().toISOString(), uid, data }
}

/** Filename for the downloaded export, dated so repeat exports don't overwrite each other. */
export function buildExportFilename(date: Date): string {
  return `lifecycle-export-${format(date, 'yyyy-MM-dd')}.json`
}
