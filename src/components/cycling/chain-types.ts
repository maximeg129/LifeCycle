import { Timestamp } from 'firebase/firestore'

export type ChainStatus = 'stockage' | 'montee' | 'retiree'

export interface Chain {
  id: string
  bikeId: string // dedicated bike, set at creation, never reassigned
  label: string
  status: ChainStatus
  lastWaxDate: string | null // ISO date
  mountedDate: string | null // ISO date
  kmSinceWax: number
  totalKm: number
  waxThresholdKm: number
  replaceThresholdKm: number
  /**
   * Real Intervals.icu activities that fed into this chain's km, appended by
   * `applyKmDeltaToBikeDependents()` (km-sync.ts) every sync — never touched
   * by the manual km-edit path, which has no real activities to attribute.
   * Kept for the chain's whole lifetime, across mount/unmount cycles (same
   * "never delete the record" convention as `waxHistory`) — `ridesSinceMount`
   * is what scopes it down to the CURRENT mount period for display, not a
   * reset on unmount. Absent on a chain created before this field existed —
   * every reader must default to `[]`.
   */
  linkedRides?: LinkedRide[]
  createdAt: Timestamp
}

/** One real Intervals.icu activity that contributed km to a chain, recorded at sync time. */
export interface LinkedRide {
  activityId: string
  name: string | null
  date: string // yyyy-MM-dd, from the activity's start_date_local
  km: number
}

export interface WaxHistoryEntry {
  id: string
  chainId: string
  waxDate: string // ISO date — when the chain was waxed for this cycle
  mountDate: string | null // ISO date — when it went on the bike, if known
  unmountDate: string | null // ISO date — when it came back off, if known/finished
  km: number // km ridden during this cycle
  notes: string
  /** Whether this entry's km were folded into the chain's totalKm, so edits/deletes can reverse it correctly. */
  countedInTotal: boolean
  createdAt: Timestamp
}

export const DEFAULT_WAX_THRESHOLD_KM = 250
export const DEFAULT_REPLACE_THRESHOLD_KM = 7000

export const CHAIN_STATUS_LABELS: Record<ChainStatus, string> = {
  stockage: 'En stockage',
  montee: 'Montée',
  retiree: 'Retirée',
}

export type WaxLevel = 'ok' | 'warning' | 'critical'

/** How urgently a mounted chain needs re-waxing, based on km since last wax vs. its threshold. */
export function computeWaxLevel(chain: Pick<Chain, 'kmSinceWax' | 'waxThresholdKm'>): WaxLevel {
  if (!chain.waxThresholdKm || chain.waxThresholdKm <= 0) return 'ok'
  const ratio = chain.kmSinceWax / chain.waxThresholdKm
  if (ratio >= 1) return 'critical'
  if (ratio >= 0.8) return 'warning'
  return 'ok'
}

/** Whether the chain's lifetime km suggests checking physical wear (stretch) with a chain checker tool. */
export function needsReplacementCheck(chain: Pick<Chain, 'totalKm' | 'replaceThresholdKm'>): boolean {
  if (!chain.replaceThresholdKm || chain.replaceThresholdKm <= 0) return false
  return chain.totalKm >= chain.replaceThresholdKm
}

export function waxProgressPct(chain: Pick<Chain, 'kmSinceWax' | 'waxThresholdKm'>): number {
  if (!chain.waxThresholdKm || chain.waxThresholdKm <= 0) return 0
  return Math.min(100, Math.round((chain.kmSinceWax / chain.waxThresholdKm) * 100))
}

/**
 * `linkedRides` scoped to the chain's CURRENT mount period — retour
 * utilisateur : "pas depuis le dernier fartage mais depuis le dernier
 * montage" (kmSinceWax resets at every fartage, but a chain usually stays
 * mounted across several fartages, so scoping the ride list by wax date
 * would hide rides the athlete would still expect to see). `mountedDate` is
 * a plain yyyy-MM-dd string, comparable lexicographically like everywhere
 * else in this codebase (see `computeGearKmFromActivities`). Never mounted
 * yet (`mountedDate` null) → no period to scope to, so `[]` rather than
 * guessing. Newest first — most recent ride is what the athlete wants to
 * confirm first ("did this sync actually pick up my ride this morning?").
 */
export function ridesSinceMount(chain: Pick<Chain, 'linkedRides' | 'mountedDate'>): LinkedRide[] {
  if (!chain.mountedDate) return []
  return (chain.linkedRides ?? [])
    .filter((r) => r.date >= chain.mountedDate!)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}
