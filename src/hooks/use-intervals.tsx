'use client'

// ── Shared Intervals.icu data — single source of truth ─────────────────────
//
// Every page used to call useAthlete()/useActivities()/useWellness()/
// useFitnessChart() independently, each spinning up its own fetch + React
// state. That meant two instances of the "same" hook on different parts of
// the tree (e.g. cycling/page.tsx and GearTab) held two different snapshots,
// and refreshing one never touched the other — the exact bug behind
// "Sync km"/"Synchroniser" silently disagreeing with each other.
//
// This file now holds ONE provider (mounted once, at the app root) with one
// copy of each dataset, plus a single syncAll() that both re-fetches every
// read AND pushes km deltas to Firestore (bikes/components/chains). Every
// "Sync" button in the app — wherever it's rendered — calls the exact same
// function and gets the exact same result everywhere, immediately.
//
// The four hooks below (useAthlete, useActivities, useWellness,
// useFitnessChart) keep their original signatures and return shapes on
// purpose, so every existing call site keeps working unchanged — they're
// now thin, range-filtered views over the shared context instead of
// independent fetchers.

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react'
import { format, subDays } from 'date-fns'
import { collection, doc, getDocs, updateDoc } from 'firebase/firestore'
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase'
import { useToast } from '@/hooks/use-toast'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import type { IntervalsAthlete, IntervalsActivity, IntervalsWellness, IntervalsFitnessDay } from '@/lib/intervals-api'
import type { Bike, BikeComponent } from '@/components/cycling/gear-types'
import type { Chain } from '@/components/cycling/chain-types'
import { applyKmDeltaToBikeDependents, computeGearKmFromActivities } from '@/components/cycling/km-sync'

// ── Credentials ──────────────────────────────────────────────────────

interface IntervalsCredentials {
  intervalsAthleteId: string
  intervalsApiKey: string
}

function useIntervalsCredentials() {
  const { user } = useUser()
  const db = useFirestore()

  const settingsRef = useMemoFirebase(() => {
    if (!user || !db) return null
    return doc(db, `users/${user.uid}/settings/intervals`)
  }, [db, user])

  const { data, isLoading } = useDoc<IntervalsCredentials>(settingsRef)

  const isConfigured = !!data?.intervalsAthleteId && !!data?.intervalsApiKey

  return {
    athleteId: data?.intervalsAthleteId ?? null,
    apiKey: data?.intervalsApiKey ?? null,
    isConfigured,
    isLoading,
  }
}

function buildHeaders(athleteId: string, apiKey: string) {
  return {
    'x-intervals-athlete-id': athleteId,
    'x-intervals-api-key': apiKey,
  }
}

async function fetchProxy<T>(path: string, athleteId: string, apiKey: string): Promise<T> {
  const res = await fetch(path, { headers: buildHeaders(athleteId, apiKey) })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `API error ${res.status}`)
  }
  return res.json()
}

// ── Fetch windows ────────────────────────────────────────────────────
// A superset of every consumer's needed range (kJ budget: 77d, governor:
// 35d, PMC chart: 84d, cycling journal: 30d…) — each hook below filters
// this shared data down to whatever range it was actually asked for.

const ACTIVITIES_WINDOW_DAYS = 90
const WELLNESS_WINDOW_DAYS = 90
const FITNESS_WINDOW_DAYS = 90

function inRange(dateStr: string | undefined, oldest: string, newest?: string): boolean {
  if (!dateStr) return false
  const d = dateStr.slice(0, 10)
  if (d < oldest) return false
  if (newest && d > newest) return false
  return true
}

// ── Context ──────────────────────────────────────────────────────────

export interface SyncAllResult {
  bikesUpdated: number
  componentsUpdated: number
  totalNewKm: number
}

interface IntervalsContextValue {
  isConfigured: boolean
  athlete: IntervalsAthlete | null
  activities: IntervalsActivity[]
  wellness: IntervalsWellness[]
  fitness: IntervalsFitnessDay[]
  isLoading: boolean
  error: string | null
  isSyncing: boolean
  lastSyncedAt: Date | null
  syncAll: () => Promise<SyncAllResult | null>
}

const IntervalsContext = createContext<IntervalsContextValue | null>(null)

export function IntervalsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser()
  const db = useFirestore()
  const { toast } = useToast()
  const creds = useIntervalsCredentials()

  const [athlete, setAthlete] = useState<IntervalsAthlete | null>(null)
  const [activities, setActivities] = useState<IntervalsActivity[]>([])
  const [wellness, setWellness] = useState<IntervalsWellness[]>([])
  const [fitness, setFitness] = useState<IntervalsFitnessDay[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)

  const fetchReads = useCallback(async (athleteId: string, apiKey: string) => {
    const today = new Date()
    const newest = format(today, 'yyyy-MM-dd')
    const activitiesOldest = format(subDays(today, ACTIVITIES_WINDOW_DAYS), 'yyyy-MM-dd')
    const wellnessOldest = format(subDays(today, WELLNESS_WINDOW_DAYS), 'yyyy-MM-dd')
    const fitnessOldest = format(subDays(today, FITNESS_WINDOW_DAYS), 'yyyy-MM-dd')

    const [athleteData, activitiesData, wellnessData, fitnessData] = await Promise.all([
      fetchProxy<IntervalsAthlete>('/api/intervals/athlete', athleteId, apiKey),
      fetchProxy<IntervalsActivity[]>(`/api/intervals/activities?oldest=${activitiesOldest}&newest=${newest}`, athleteId, apiKey),
      fetchProxy<IntervalsWellness[]>(`/api/intervals/wellness?oldest=${wellnessOldest}&newest=${newest}`, athleteId, apiKey),
      fetchProxy<IntervalsFitnessDay[]>(`/api/intervals/fitness-chart?oldest=${fitnessOldest}&newest=${newest}`, athleteId, apiKey),
    ])

    setAthlete(athleteData)
    setActivities(activitiesData)
    setWellness(wellnessData)
    setFitness(fitnessData)
    return { athleteData, activitiesData }
  }, [])

  // Initial/background load: reads only, never writes — km deltas are only
  // ever applied from an explicit syncAll() click.
  useEffect(() => {
    if (!creds.isConfigured || !creds.athleteId || !creds.apiKey) return
    let cancelled = false
    setIsLoading(true)
    setError(null)
    fetchReads(creds.athleteId, creds.apiKey)
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Erreur inconnue') })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [creds.isConfigured, creds.athleteId, creds.apiKey, fetchReads])

  const syncAll = useCallback(async (): Promise<SyncAllResult | null> => {
    if (!creds.athleteId || !creds.apiKey) return null

    setIsSyncing(true)
    try {
      const { activitiesData } = await fetchReads(creds.athleteId, creds.apiKey)
      setError(null)

      // Apply km deltas to bikes/components/chains — the write side of
      // sync, gated behind this explicit action only.
      let bikesUpdated = 0
      let componentsUpdated = 0
      let totalNewKm = 0

      if (user && db) {
        const [bikesSnap, componentsSnap, chainsSnap] = await Promise.all([
          getDocs(collection(db, `users/${user.uid}/bikes`)),
          getDocs(collection(db, `users/${user.uid}/components`)),
          getDocs(collection(db, `users/${user.uid}/chains`)),
        ])
        const bikes = bikesSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Bike[]
        const components = componentsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as BikeComponent[]
        const chains = chainsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Chain[]
        const todayStr = format(new Date(), 'yyyy-MM-dd')

        for (const bike of bikes) {
          if (!bike.externalGearId) continue

          // Ground truth: sum real activity distances tagged with this
          // gear_id, not Intervals.icu's own gear.distance rollup — that
          // field has been confirmed (via live debug data) to undercount
          // gear whose rides sync directly from Wahoo, bypassing Strava.
          const delta = computeGearKmFromActivities(activitiesData, bike.externalGearId, bike.lastSyncDate)
          if (delta <= 0) continue

          const newTotalKm = bike.totalKm + delta
          const bikeRef = doc(db, `users/${user.uid}/bikes`, bike.id)
          await updateDoc(bikeRef, { totalKm: newTotalKm, lastSyncDate: todayStr }).catch(() => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: bikeRef.path, operation: 'update' }))
          })
          bikesUpdated++
          totalNewKm += delta

          const bikeComponents = components.filter((c) => c.bikeId === bike.id && c.status !== 'retired')
          const result = await applyKmDeltaToBikeDependents({
            db,
            uid: user.uid,
            bikeComponents,
            bikeChains: chains.filter((c) => c.bikeId === bike.id),
            delta,
          })
          componentsUpdated += result.componentsUpdated
        }
      }

      setLastSyncedAt(new Date())
      toast(totalNewKm > 0
        ? {
          title: 'Synchronisation terminée',
          description: `+${totalNewKm} km sur ${bikesUpdated} vélo${bikesUpdated > 1 ? 's' : ''}, ${componentsUpdated} composant${componentsUpdated > 1 ? 's' : ''} mis à jour.`,
        }
        : { title: 'Synchronisation terminée', description: 'Toutes les données Intervals.icu sont déjà à jour.' })

      return { bikesUpdated, componentsUpdated, totalNewKm }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erreur inconnue'
      setError(message)
      toast({ variant: 'destructive', title: 'Erreur de synchronisation', description: message })
      return null
    } finally {
      setIsSyncing(false)
    }
  }, [creds.athleteId, creds.apiKey, user, db, fetchReads, toast])

  const value: IntervalsContextValue = {
    isConfigured: creds.isConfigured,
    athlete,
    activities,
    wellness,
    fitness,
    isLoading: creds.isLoading || isLoading,
    error,
    isSyncing,
    lastSyncedAt,
    syncAll,
  }

  return <IntervalsContext.Provider value={value}>{children}</IntervalsContext.Provider>
}

function useIntervalsContext(): IntervalsContextValue {
  const ctx = useContext(IntervalsContext)
  if (!ctx) throw new Error('Intervals.icu hooks must be used within <IntervalsProvider> (mounted at the app root).')
  return ctx
}

/** The one hook every "Sync" button in the app calls — same action, same result, wherever it's rendered. */
export function useIntervalsSync() {
  const ctx = useIntervalsContext()
  return { syncAll: ctx.syncAll, isSyncing: ctx.isSyncing, lastSyncedAt: ctx.lastSyncedAt, isConfigured: ctx.isConfigured }
}

// ── Compat hooks — same signatures/return shapes as before ─────────────
// Backed by the shared context instead of an independent fetch. `refresh`
// now runs the full syncAll() (reads + km deltas), so any leftover caller
// of .refresh() gets the complete, correct behavior too.

export function useAthlete() {
  const ctx = useIntervalsContext()
  return { data: ctx.athlete, isLoading: ctx.isLoading, error: ctx.error, isConfigured: ctx.isConfigured, refresh: ctx.syncAll }
}

export function useActivities(oldest: string, newest?: string) {
  const ctx = useIntervalsContext()
  const data = useMemo(
    () => ctx.activities.filter((a) => inRange(a.start_date_local, oldest, newest)),
    [ctx.activities, oldest, newest]
  )
  return { data, isLoading: ctx.isLoading, error: ctx.error, isConfigured: ctx.isConfigured, refresh: ctx.syncAll }
}

export function useWellness(oldest: string, newest: string) {
  const ctx = useIntervalsContext()
  const data = useMemo(
    () => ctx.wellness.filter((w) => inRange(w.id, oldest, newest)),
    [ctx.wellness, oldest, newest]
  )
  return { data, isLoading: ctx.isLoading, error: ctx.error, isConfigured: ctx.isConfigured, refresh: ctx.syncAll }
}

export function useFitnessChart(oldest: string, newest: string) {
  const ctx = useIntervalsContext()
  const data = useMemo(
    () => ctx.fitness.filter((f) => inRange(f.date, oldest, newest)),
    [ctx.fitness, oldest, newest]
  )
  return { data, isLoading: ctx.isLoading, error: ctx.error, isConfigured: ctx.isConfigured, refresh: ctx.syncAll }
}
