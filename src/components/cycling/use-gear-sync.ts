"use client"

import { useState, useCallback } from 'react'
import { format } from 'date-fns'
import { useUser, useFirestore } from '@/firebase'
import { doc, updateDoc } from 'firebase/firestore'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { useToast } from '@/hooks/use-toast'
import type { Bike, BikeComponent } from './gear-types'
import type { IntervalsGear } from '@/lib/intervals-api'

interface UseGearSyncParams {
  bikes: Bike[]
  components: BikeComponent[]
  athleteId: string | null
  apiKey: string | null
  externalBikes: IntervalsGear[]
}

export function useGearSync({ bikes, components, athleteId, apiKey, externalBikes }: UseGearSyncParams) {
  const { user } = useUser()
  const db = useFirestore()
  const { toast } = useToast()
  const [isSyncing, setIsSyncing] = useState(false)

  /**
   * Sync strategy: use total km from Intervals.icu gear as source of truth.
   * For each linked bike:
   *   newTotalKm = externalGear.distance (meters -> km)
   *   delta = newTotalKm - bike.totalKm
   *   if delta > 0 -> update bike + all active components by delta
   */
  const syncKm = useCallback(async () => {
    if (!user || !db || !athleteId || !apiKey) return null
    if (externalBikes.length === 0) {
      toast({ title: 'Aucun velo externe', description: 'Rechargez la page pour recuperer les velos Intervals.icu.' })
      return null
    }

    setIsSyncing(true)
    try {
      const today = format(new Date(), 'yyyy-MM-dd')
      let bikesUpdated = 0
      let componentsUpdated = 0
      let totalNewKm = 0

      for (const bike of bikes) {
        if (!bike.externalGearId) continue

        // Find matching external gear
        const externalGear = externalBikes.find(g => g.id === bike.externalGearId)
        if (!externalGear || externalGear.distance == null) continue

        const externalTotalKm = Math.round(externalGear.distance / 1000)
        const delta = externalTotalKm - bike.totalKm
        if (delta <= 0) continue

        // Update bike total km
        const bikeRef = doc(db, `users/${user.uid}/bikes`, bike.id)
        await updateDoc(bikeRef, {
          totalKm: externalTotalKm,
          lastSyncDate: today,
        }).catch(() => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({ path: bikeRef.path, operation: 'update' }))
        })

        bikesUpdated++
        totalNewKm += delta

        // Update all active components for this bike
        const bikeComponents = components.filter(c => c.bikeId === bike.id && c.status !== 'retired')
        for (const comp of bikeComponents) {
          const updatedCompKm = comp.currentKm + delta
          const status = updatedCompKm >= comp.thresholdKm
            ? 'critical'
            : updatedCompKm >= comp.thresholdKm * 0.8
              ? 'warning'
              : 'active'

          const compRef = doc(db, `users/${user.uid}/components`, comp.id)
          await updateDoc(compRef, { currentKm: updatedCompKm, status }).catch(() => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: compRef.path, operation: 'update' }))
          })
          componentsUpdated++
        }
      }

      if (totalNewKm > 0) {
        toast({
          title: 'Synchronisation terminee',
          description: `+${totalNewKm} km sur ${bikesUpdated} velo${bikesUpdated > 1 ? 's' : ''}, ${componentsUpdated} composant${componentsUpdated > 1 ? 's' : ''} mis a jour.`,
        })
      } else {
        toast({ title: 'Deja a jour', description: 'Aucun nouveau kilometre depuis la derniere synchronisation.' })
      }

      return { bikesUpdated, componentsUpdated, totalNewKm }
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Erreur de synchronisation',
        description: e instanceof Error ? e.message : 'Erreur inconnue',
      })
      return null
    } finally {
      setIsSyncing(false)
    }
  }, [user, db, athleteId, apiKey, bikes, components, externalBikes, toast])

  // Link a local bike to an Intervals.icu gear ID
  const linkBike = useCallback(async (bikeId: string, externalGearId: string | null) => {
    if (!user || !db) return
    const bikeRef = doc(db, `users/${user.uid}/bikes`, bikeId)
    await updateDoc(bikeRef, { externalGearId }).catch(() => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: bikeRef.path, operation: 'update' }))
    })
  }, [user, db])

  return { syncKm, linkBike, isSyncing }
}
