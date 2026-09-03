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
//
// ── Sorties liées à une chaîne (retour utilisateur) ────────────────────────
// "Est-ce qu'en cliquant sur les km on peut voir les sorties liées ?" — deux
// options envisagées : (1) reconstruire la liste à la volée en filtrant les
// activités par gear.id + date au clic, ou (2) stocker les activités qui ont
// contribué à chaque sync, choisie explicitement par l'utilisateur ("l'option
// 2 semble plus robuste") — plus rapide à afficher (pas de fetch au clic), et
// PAS moins fiable pour l'usage réel : la chaîne actuellement montée est déjà
// l'unique destination du delta km (`planKmDeltaUpdate`), donc lui attribuer
// aussi la liste des sorties dans le MÊME appel `updateDoc` que le delta
// (`extractLinkedRides` → `newlyLinkedRides` ci-dessous) élimine tout risque
// de l'attribuer à la mauvaise chaîne — jamais deux écritures séparées qui
// pourraient diverger si le montage change entre les deux. Seule limite
// honnête, symétrique à celle déjà acceptée pour le km total lui-même
// (`computeGearKmFromActivities` ne redescend jamais si une activité est
// supprimée après coup côté Intervals.icu) : un snapshot pris au moment du
// sync, jamais recalculé rétroactivement si l'historique change ensuite.

import { doc, updateDoc, arrayUnion } from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import type { BikeComponent } from './gear-types'
import type { Chain, LinkedRide } from './chain-types'

export interface ApplyKmDeltaParams {
  db: Firestore
  uid: string
  /** Non-retired components for this bike (any category). */
  bikeComponents: BikeComponent[]
  /** All chains for this bike, any status — used to find the mounted one. */
  bikeChains: Chain[]
  delta: number
  /** Real activities behind this sync's delta (from `extractLinkedRides`) — omitted/empty for the manual km-edit path, which has no real rides to attribute. */
  newlyLinkedRides?: LinkedRide[]
}

export interface ApplyKmDeltaResult {
  chainUpdated: boolean
  componentsUpdated: number
}

export interface ActivityKmLike {
  // Nested, not a flat gear_id — Intervals.icu's API has no top-level
  // gear_id field at all; the linked bike/shoe is under gear.id (confirmed
  // via a live debug dump after gearTotals came back empty despite a full
  // activity history being fetched correctly).
  gear?: { id?: string } | null
  start_date_local?: string
  distance?: number // meters
}

/** `ActivityKmLike` plus what's needed to record the activity itself as a linked ride, not just count its distance. */
export interface ActivityLinkLike extends ActivityKmLike {
  id: string
  name?: string
}

/**
 * Shared match rule for "does this activity belong in this bike's km sync" —
 * same gear id, real distance, and (when a cutoff is given) strictly after
 * it. Used by both `computeGearKmFromActivities` (the sum) and
 * `extractLinkedRides` (the same activities, kept whole) so the two can
 * never disagree on which activities counted.
 */
function matchesGearSinceCutoff(a: ActivityKmLike, externalGearId: string, sinceDateExclusive: string | null): boolean {
  if (a.gear?.id !== externalGearId) return false
  if (!a.distance || a.distance <= 0) return false
  if (sinceDateExclusive && a.start_date_local) {
    return a.start_date_local.slice(0, 10) > sinceDateExclusive
  }
  return true
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
    .filter((a) => matchesGearSinceCutoff(a, externalGearId, sinceDateExclusive))
    .reduce((sum, a) => sum + (a.distance || 0), 0)
  return Math.round(totalMeters / 1000)
}

/**
 * The individual activities behind a `computeGearKmFromActivities` delta —
 * exact same match rule, kept whole instead of summed, so a chain can record
 * precisely which sorties contributed once its km bumps (see file header).
 * Per-activity km is rounded individually here for display, so summing this
 * list can differ by a km or two from `computeGearKmFromActivities`'s own
 * total (rounded once, from the raw meter sum) — a display nuance, not a
 * data bug: the chain's actual km total always comes from that function, not
 * from summing this list back up.
 */
export function extractLinkedRides(activities: ActivityLinkLike[], externalGearId: string, sinceDateExclusive: string | null): LinkedRide[] {
  return activities
    .filter((a) => matchesGearSinceCutoff(a, externalGearId, sinceDateExclusive))
    .map((a) => ({
      activityId: a.id,
      name: a.name ?? null,
      date: (a.start_date_local ?? '').slice(0, 10),
      km: Math.round((a.distance || 0) / 1000),
    }))
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
export async function applyKmDeltaToBikeDependents({ db, uid, bikeComponents, bikeChains, delta, newlyLinkedRides }: ApplyKmDeltaParams): Promise<ApplyKmDeltaResult> {
  if (delta <= 0) return { chainUpdated: false, componentsUpdated: 0 }

  const { chainToUpdate, componentsToUpdate } = planKmDeltaUpdate(bikeComponents, bikeChains)

  if (chainToUpdate) {
    const chainRef = doc(db, `users/${uid}/chains`, chainToUpdate.id)
    // Same `chainToUpdate` — the chain planKmDeltaUpdate already picked as
    // the one currently mounted — same updateDoc call as the km bump below:
    // the ride list can never land on a different chain than the km delta
    // itself, even if a mount changes between two separate writes (there
    // isn't a second write to race against).
    await updateDoc(chainRef, {
      kmSinceWax: chainToUpdate.kmSinceWax + delta,
      totalKm: chainToUpdate.totalKm + delta,
      ...(newlyLinkedRides && newlyLinkedRides.length > 0 ? { linkedRides: arrayUnion(...newlyLinkedRides) } : {}),
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
