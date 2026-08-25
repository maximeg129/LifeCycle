"use client"

import { doc } from 'firebase/firestore'
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase'
import type { PowerRecord } from './riegel-types'

export interface PowerCurveDoc {
  shortRecord?: PowerRecord
  mediumRecord?: PowerRecord
  longRecord?: PowerRecord
  updatedAt?: unknown
}

/** Singleton doc alongside the other per-feature settings (Intervals.icu creds, nutrition goals…). */
export function usePowerCurve() {
  const { user } = useUser()
  const db = useFirestore()

  const ref = useMemoFirebase(() => {
    if (!user || !db) return null
    return doc(db, `users/${user.uid}/settings/powerCurve`)
  }, [db, user])
  const { data, isLoading } = useDoc<PowerCurveDoc>(ref)

  return { data: data ?? null, isLoading, ref }
}
