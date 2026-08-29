"use client"

import { useMemo } from 'react'
import { doc } from 'firebase/firestore'
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase'
import { usePowerCurveFromIntervals } from '@/hooks/use-intervals'
import { pickPowerRecordsFromCurve, type PowerRecord } from './riegel-types'

export interface PowerCurveDoc {
  shortRecord?: PowerRecord
  mediumRecord?: PowerRecord
  longRecord?: PowerRecord
  updatedAt?: unknown
}

/**
 * Merges manually-entered records (Firestore singleton) with Intervals.icu's
 * real mean-max power curve — same "manual always wins, auto-sync fills the
 * gaps" pattern as mergeDailyWellness (lifestyle-types.ts). Without this,
 * the athlete had to re-type 3 personal-best efforts Intervals.icu already
 * knows from their actual ride files. `data` stays `null` when there's
 * nothing at all (matches the pre-auto-sync contract exactly, so
 * performance-bento.tsx needs no changes to keep working).
 */
export function usePowerCurve() {
  const { user } = useUser()
  const db = useFirestore()

  const ref = useMemoFirebase(() => {
    if (!user || !db) return null
    return doc(db, `users/${user.uid}/settings/powerCurve`)
  }, [db, user])
  const { data: manual, isLoading: loadingManual } = useDoc<PowerCurveDoc>(ref)

  const intervals = usePowerCurveFromIntervals()
  const auto = useMemo(() => {
    // Intervals.icu can return several curves (filtered/compared) — the
    // unfiltered "all" one requested by getPowerCurve() is what we asked
    // for, so just take the first entry rather than guessing at a label.
    const curve = intervals.data[0]
    if (!curve) return { shortRecord: null, mediumRecord: null, longRecord: null }
    return pickPowerRecordsFromCurve(curve.secs, curve.values)
  }, [intervals.data])

  const data = useMemo((): PowerCurveDoc | null => {
    const shortRecord = manual?.shortRecord ?? auto.shortRecord ?? undefined
    const mediumRecord = manual?.mediumRecord ?? auto.mediumRecord ?? undefined
    const longRecord = manual?.longRecord ?? auto.longRecord ?? undefined
    if (!shortRecord && !mediumRecord && !longRecord) return null
    return { shortRecord, mediumRecord, longRecord }
  }, [manual, auto])

  return {
    data,
    manual: manual ?? null,
    auto,
    isConfigured: intervals.isConfigured,
    isLoading: loadingManual || intervals.isLoading,
    ref,
  }
}
