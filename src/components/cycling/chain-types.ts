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
  createdAt: Timestamp
}

export interface WaxHistoryEntry {
  id: string
  chainId: string
  date: string // ISO date
  kmAtWax: number // km ridden since the previous wax
  notes: string
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
