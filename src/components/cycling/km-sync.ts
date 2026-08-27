"use client"

// ── Shared km-delta propagation — single source of truth ──────────────────
//
// Whenever a bike's total km advances (via the Intervals.icu "Sync km"
// button, or a manual edit of the km field), every dependent needs to move
// by the same delta: the bike's active components, AND — if the bike has
// dedicated hot-wax rotation chains — the currently mounted chain. Both
// update paths call this single function so they can't silently drift apart
// again (which is exactly what happened: the manual-edit path was never
// updated when chain tracking was added, so a manual km correction bumped
// components but left the mounted chain's km frozen).

import { doc, updateDoc } from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import type { BikeComponent } from './gear-types'
import type { Chain } from './chain-types'

export interface ApplyKmDeltaParams {
  db: Firestore
  uid: string
  /** Non-retired components for this bike (any category). */
  bikeComponents: BikeComponent[]
  /** All chains for this bike, any status — used to find the mounted one. */
  bikeChains: Chain[]
  delta: number
}

export interface ApplyKmDeltaResult {
  chainUpdated: boolean
  componentsUpdated: number
}

export interface ActivityKmLike {
  gear_id?: string
  start_date_local?: string
  distance?: number // meters
}

/**
 * Ground-truth km delta for one bike since its last sync: sums the real
 * distance of activities tagged with its linked gear_id, rather than
 * trusting Intervals.icu's own /athlete `bikes[].distance` rollup.
 *
 * Confirmed via a live debug dump: that rollup field undercounts bikes with
 * activities synced directly from Wahoo (bypassing Strava) — one bike
 * matched Intervals.icu's own website exactly, two others were tens of
 * thousands of km behind it. Individual activities (which do carry gear_id
 * regardless of sync source) are the reliable ground truth.
 *
 * On a bike's first-ever sync (sinceDateExclusive is null), sums every
 * matching activity in the fetched window — bounded by that window, so it
 * can't retroactively double-count years of history. On every sync after
 * that, only activities strictly after the last sync date count.
 */
export function computeGearKmFromActivities(activities: ActivityKmLike[], externalGearId: string, sinceDateExclusive: string | null): number {
  const totalMeters = activities
    .filter((a) => {
      if (a.gear_id !== externalGearId) return false
      if (!a.distance || a.distance <= 0) return false
      if (sinceDateExclusive && a.start_date_local) {
        return a.start_date_local.slice(0, 10) > sinceDateExclusive
      }
      return true
    })
    .reduce((sum, a) => sum + (a.distance || 0), 0)
  return Math.round(totalMeters / 1000)
}

export interface KmDeltaPlan<TComponent, TChain> {
  /** The currently-mounted chain for this bike, or null if none/no rotation chains configured. */
  chainToUpdate: TChain | null
  /** Components to bump — excludes a generic 'chain' component when a dedicated rotation chain already covers it, to avoid double-counting. */
  componentsToUpdate: TComponent[]
}

/**
 * Pure decision of what a km delta should touch — no Firestore I/O, so it's
 * cheap to unit-test the exact rule that caused this bug (manual km edits
 * silently skipping the mounted chain) without mocking Firestore.
 */
export function planKmDeltaUpdate<TComponent extends { category: string }, TChain extends { status: string }>(
  bikeComponents: TComponent[],
  bikeChains: TChain[]
): KmDeltaPlan<TComponent, TChain> {
  const hasRotationChains = bikeChains.length > 0
  const chainToUpdate = bikeChains.find((c) => c.status === 'montee') ?? null
  const componentsToUpdate = bikeComponents.filter((c) => !(hasRotationChains && c.category === 'chain'))
  return { chainToUpdate, componentsToUpdate }
}

/** Bumps a bike's non-chain components and its currently-mounted hot-wax chain by `delta` km. No-op if delta <= 0. */
export async function applyKmDeltaToBikeDependents({ db, uid, bikeComponents, bikeChains, delta }: ApplyKmDeltaParams): Promise<ApplyKmDeltaResult> {
  if (delta <= 0) return { chainUpdated: false, componentsUpdated: 0 }

  const { chainToUpdate, componentsToUpdate } = planKmDeltaUpdate(bikeComponents, bikeChains)

  if (chainToUpdate) {
    const chainRef = doc(db, `users/${uid}/chains`, chainToUpdate.id)
    await updateDoc(chainRef, {
      kmSinceWax: chainToUpdate.kmSinceWax + delta,
      totalKm: chainToUpdate.totalKm + delta,
    }).catch(() => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: chainRef.path, operation: 'update' }))
    })
  }

  for (const comp of componentsToUpdate) {
    const compRef = doc(db, `users/${uid}/components`, comp.id)
    const updatedKm = comp.currentKm + delta
    const status = updatedKm >= comp.thresholdKm ? 'critical' : updatedKm >= comp.thresholdKm * 0.8 ? 'warning' : 'active'
    await updateDoc(compRef, { currentKm: updatedKm, status }).catch(() => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: compRef.path, operation: 'update' }))
    })
  }

  return { chainUpdated: !!chainToUpdate, componentsUpdated: componentsToUpdate.length }
}
