"use client"

import { useCallback } from 'react'
import { useUser, useFirestore } from '@/firebase'
import { doc, updateDoc } from 'firebase/firestore'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'

/**
 * Links/unlinks a local bike to an Intervals.icu gear ID. Km syncing itself
 * (pushing Intervals.icu distance deltas into bikes/components/chains) now
 * lives in the shared IntervalsProvider's syncAll() — see
 * @/hooks/use-intervals — so every "Sync" button in the app does the exact
 * same thing regardless of which page it's on.
 */
export function useGearSync() {
  const { user } = useUser()
  const db = useFirestore()

  const linkBike = useCallback(async (bikeId: string, externalGearId: string | null) => {
    if (!user || !db) return
    const bikeRef = doc(db, `users/${user.uid}/bikes`, bikeId)
    await updateDoc(bikeRef, { externalGearId }).catch(() => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: bikeRef.path, operation: 'update' }))
    })
  }, [user, db])

  return { linkBike }
}
