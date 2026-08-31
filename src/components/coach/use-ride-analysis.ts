"use client"

// ── "Analyse complète de la sortie" — glue between the single-activity
// Intervals.icu proxy route, the pure stream-crunching in
// ride-analysis-types.ts, the AI flow, and Firestore ────────────────────
//
// One analysis per activity (users/{uid}/rideAnalyses/{activityId}),
// overwritten on "Régénérer" — same overwrite-on-regenerate shape as
// workoutProposals. Lazy: nothing is fetched until generate() is called
// (activityId is passed as null while the dialog is closed), so opening
// the Sorties tab never triggers per-row Intervals.icu calls — only an
// explicit "Analyser" click does.

import { useCallback, useState } from 'react'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { format } from 'date-fns'
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase'
import { useToast } from '@/hooks/use-toast'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { useAthlete } from '@/hooks/use-intervals'
import { useCoachMemory } from '@/components/cycling/use-coach-memory'
import { useGovernor } from '@/components/cycling/use-governor'
import { useKJBudget } from '@/components/cycling/use-kj-budget'
import { buildCoachContext } from '@/components/cycling/coach-context'
import { rideAnalysis, type RideAnalysisOutput } from '@/ai/flows/ride-analysis-flow'
import { bestAverageWatts, bestRpe, feelToScore, type IntervalsActivity, type IntervalsActivityStream } from '@/lib/intervals-api'
import { computeNormalizedPower, computePowerZoneDistribution, computeHrZoneDistribution, computeSplitAnalysis, average, type PowerZoneBucket, type HrZoneBucket } from './ride-analysis-types'
import { computeDurabilityProfile } from '@/domain/cycling/metrics/durability'
import { computeDecoupling } from '@/domain/cycling/metrics/decoupling'
import { computePowerZoneDistribution3, type ThreeZoneBucket } from '@/domain/cycling/metrics/zones'
import { describeActionDispatchError } from '@/lib/utils'

interface IntervalsCredentialsDoc {
  intervalsAthleteId?: string
  intervalsApiKey?: string
}

interface StoredRideAnalysis {
  userId: string
  analysis: RideAnalysisOutput
}

function toZoneInput(zones: (PowerZoneBucket | HrZoneBucket)[] | null, totalSeconds: number) {
  if (!zones) return undefined
  return zones.map((z) => ({
    zone: z.zone,
    label: z.label,
    minutes: Math.round((z.seconds / 60) * 10) / 10,
    pctOfRide: totalSeconds > 0 ? Math.round((z.seconds / totalSeconds) * 1000) / 10 : 0,
  }))
}

/** Même conversion que toZoneInput, pour le modèle 3 zones (id-based plutôt que zone-number-based). */
function toThreeZoneInput(zones: ThreeZoneBucket[] | null, totalSeconds: number) {
  if (!zones) return undefined
  return zones.map((z) => ({
    id: z.id,
    label: z.label,
    minutes: Math.round((z.seconds / 60) * 10) / 10,
    pctOfRide: totalSeconds > 0 ? Math.round((z.seconds / totalSeconds) * 1000) / 10 : 0,
  }))
}

/** activityId: pass null while there's nothing to load yet (e.g. a closed dialog) — avoids an Intervals.icu fetch per row just from the Sorties list rendering. */
export function useRideAnalysis(activityId: string | null) {
  const { user } = useUser()
  const db = useFirestore()
  const { toast } = useToast()
  const athlete = useAthlete()
  const memory = useCoachMemory()
  const governor = useGovernor()
  const budget = useKJBudget(governor.status, athlete.data?.weight)

  const credsRef = useMemoFirebase(() => {
    if (!user || !db) return null
    return doc(db, `users/${user.uid}/settings/intervals`)
  }, [db, user])
  const { data: creds } = useDoc<IntervalsCredentialsDoc>(credsRef)

  const analysisRef = useMemoFirebase(() => {
    if (!user || !db || !activityId) return null
    return doc(db, `users/${user.uid}/rideAnalyses/${activityId}`)
  }, [db, user, activityId])
  const { data: stored, isLoading: isLoadingStored } = useDoc<StoredRideAnalysis>(analysisRef)

  const [isGenerating, setIsGenerating] = useState(false)

  const generate = useCallback(async (): Promise<boolean> => {
    if (!user || !db || !activityId) return false
    if (!creds?.intervalsAthleteId || !creds?.intervalsApiKey) {
      toast({ variant: 'destructive', title: 'Intervals.icu non connecté', description: 'Renseignez vos identifiants dans Réglages.' })
      return false
    }
    setIsGenerating(true)
    try {
      const res = await fetch(`/api/intervals/activities/${activityId}`, {
        headers: {
          'x-intervals-athlete-id': creds.intervalsAthleteId,
          'x-intervals-api-key': creds.intervalsApiKey,
        },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Erreur ${res.status}`)
      }
      const { activity, streams, streamsError }: { activity: IntervalsActivity; streams: IntervalsActivityStream | null; streamsError: string | null } = await res.json()

      // Streams failing is not fatal (the route degrades to `streams: null`
      // rather than failing the whole request) — most commonly a Strava-
      // synced activity whose second-by-second data Intervals.icu itself
      // couldn't pull ("Cannot read Strava activity API", confirmed live —
      // not something this app can work around). The analysis still runs
      // on the activity-level summary fetched above; this is a heads-up,
      // not an error, so it's a plain (non-destructive) toast.
      if (streams == null && streamsError) {
        toast({
          title: 'Détail seconde par seconde indisponible',
          description: activity.source === 'STRAVA'
            ? "Intervals.icu n'a pas pu récupérer le détail de cette sortie synchronisée depuis Strava — l'analyse se base sur les données globales (puissance moyenne, charge, durée...)."
            : "Intervals.icu n'a pas retourné le détail de cette sortie — l'analyse se base sur les données globales (puissance moyenne, charge, durée...).",
        })
      }

      const watts = streams?.watts?.data
      const heartrate = streams?.heartrate?.data
      const cadence = streams?.cadence?.data

      const ftp = athlete.data?.ftp ?? null
      // No physiological max HR is surfaced by useAthlete() today — this
      // ride's own recorded max_heartrate is a reasonable per-ride
      // reference for zone bucketing, and it's always available whenever
      // an HR stream is (both come off the same activity).
      const maxHr = activity.max_heartrate ?? null

      const normalizedWatts = watts ? computeNormalizedPower(watts) : null
      const avgWatts = bestAverageWatts(activity)
      const variabilityIndex = normalizedWatts != null && avgWatts != null && avgWatts > 0
        ? Math.round((normalizedWatts / avgWatts) * 100) / 100
        : undefined
      const powerZones = computePowerZoneDistribution(watts, ftp)
      const hrZones = computeHrZoneDistribution(heartrate, maxHr)
      // Distribution 3 zones (R18, Seiler, domain/cycling/metrics/zones.ts)
      // — même flux watts/FTP que powerZones (modèle 7 zones Coggan)
      // ci-dessus, mais un modèle distinct : la cible ~80% basse intensité
      // qu'il permet de vérifier n'a de sens que sur ce modèle-là, jamais
      // sur les 7 zones (voir power-zones-3-zone-distribution-required).
      const threeZoneBuckets = computePowerZoneDistribution3(watts, ftp)
      const split = computeSplitAnalysis(watts)
      const avgCadence = cadence ? average(cadence) ?? undefined : undefined

      // Durabilité (R07/R08/R10, ride-analysis-2-power-profile-by-accumulated-tier)
      // — MMP à chaque palier de travail accumulé franchi PENDANT cette
      // sortie. null sans flux watts ou sans poids athlète connu (le kJ/kg
      // n'est pas calculable sans poids) ; le flow gère déjà l'absence
      // proprement (aucune section durabilité dans le prompt).
      const durabilityProfile = computeDurabilityProfile(watts, athlete.data?.weight)
      const durability = durabilityProfile?.map((t) => ({
        tierKJPerKg: t.tierKJPerKg,
        reached: t.reachedAtSampleIndex != null,
        mmp: Object.entries(t.mmpByDurationSeconds)
          .filter((entry): entry is [string, number] => entry[1] != null)
          .map(([durationSeconds, mmpWatts]) => ({ durationSeconds: Number(durationSeconds), watts: mmpWatts })),
      }))

      // Découplage Pw:HR (R06, ride-analysis-3-decoupling-context) — même
      // flux watts/heartrate déjà récupérés ci-dessus, null si l'une des
      // deux séries manque ou si elles n'ont pas la même longueur.
      const decoupling = watts && heartrate ? computeDecoupling(watts, heartrate) ?? undefined : undefined

      const totalSeconds = activity.moving_time ?? watts?.length ?? heartrate?.length ?? 0

      const today = format(new Date(), 'yyyy-MM-dd')
      const coachContext = buildCoachContext({
        today,
        injuries: memory.injuries,
        lifestyle: memory.lifestyle,
        goals: memory.goals,
        rememberedFacts: memory.rememberedFacts,
        kjBudget: { realized: budget.realized, target: budget.target, baseline: budget.baseline },
        governorStatus: governor.status,
      })

      const result = await rideAnalysis({
        activity: {
          name: activity.name ?? undefined,
          type: activity.type ?? undefined,
          date: activity.start_date_local?.slice(0, 10) ?? today,
          distanceKm: activity.distance != null ? Math.round(activity.distance / 100) / 10 : undefined,
          durationMinutes: activity.moving_time != null ? Math.round(activity.moving_time / 60) : 0,
          avgWatts: avgWatts ?? undefined,
          normalizedWatts: normalizedWatts ?? undefined,
          variabilityIndex,
          avgHeartrate: activity.average_heartrate ?? undefined,
          maxHeartrate: activity.max_heartrate ?? undefined,
          avgCadence,
          elevationGainM: activity.total_elevation_gain ?? undefined,
          trainingLoad: activity.icu_training_load ?? undefined,
          intensity: activity.icu_intensity ?? undefined,
          rpe: bestRpe(activity) ?? undefined,
          feel: feelToScore(activity) ?? undefined,
        },
        powerZones: toZoneInput(powerZones, totalSeconds),
        hrZones: toZoneInput(hrZones, totalSeconds),
        threeZoneDistribution: toThreeZoneInput(threeZoneBuckets, totalSeconds),
        split: split ?? undefined,
        decoupling,
        athlete: athlete.isConfigured && athlete.data ? {
          ftp: athlete.data.ftp,
          ctl: athlete.data.ctl,
          atl: athlete.data.atl,
          tsb: athlete.data.tsb,
        } : undefined,
        durability,
        coachContext,
      })

      if (!result.ok) {
        toast({ variant: 'destructive', title: "L'IA n'a pas pu analyser la sortie", description: result.error })
        return false
      }

      const ref = doc(db, `users/${user.uid}/rideAnalyses/${activityId}`)
      const data = { userId: user.uid, analysis: result.data, createdAt: serverTimestamp() }
      try {
        await setDoc(ref, data)
      } catch {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'create', requestResourceData: data }))
        return false
      }
      return true
    } catch (e) {
      toast({ variant: 'destructive', title: "L'IA n'a pas pu analyser la sortie", description: describeActionDispatchError(e) })
      return false
    } finally {
      setIsGenerating(false)
    }
  }, [user, db, activityId, creds, athlete.data, athlete.isConfigured, memory.injuries, memory.lifestyle, memory.goals, memory.rememberedFacts, budget.realized, budget.target, budget.baseline, governor.status, toast])

  return {
    analysis: stored?.analysis ?? null,
    isLoadingStored,
    isGenerating,
    canAnalyze: !!creds?.intervalsAthleteId && !!creds?.intervalsApiKey,
    generate,
  }
}
