"use client"

import { useState, useCallback } from 'react'
import { format, subDays } from 'date-fns'
import { useUser, useFirestore } from '@/firebase'
import { doc, updateDoc } from 'firebase/firestore'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { useToast } from '@/hooks/use-toast'
import type { Bike, BikeComponent } from './gear-types'
import type { IntervalsActivity, IntervalsGear } from '@/lib/intervals-api'

interface UseGearSyncParams {
  bikes: Bike[]
  components: BikeComponent[]
  athleteId: string | null
  apiKey: string | null
}

interface SyncResult {
  bikesUpdated: number
  componentsUpdated: number
  totalNewKm: number
}

export function useGearSync({ bikes, components, athleteId, apiKey }: UseGearSyncParams) {
  const { user } = useUser()
  const db = useFirestore()
  const { toast } = useToast()
  const [isSyncing, setIsSyncing] = useState(false)

  const syncKm = useCallback(async (): Promise<SyncResult | null> => {
    if (!user || !db || !athleteId || !apiKey) return null

    setIsSyncing(true)
    try {
      // Fetch last 90 days of activities
      const oldest = format(subDays(new Date(), 90), 'yyyy-MM-dd')
      const newest = format(new Date(), 'yyyy-MM-dd')

      const res = await fetch(`/api/intervals/activities?oldest=${oldest}&newest=${newest}`, {
        headers: {
          'x-intervals-athlete-id': athleteId,
          'x-intervals-api-key': apiKey,
        },
      })

      if (!res.ok) throw new Error(`API error ${res.status}`)
      const activities: IntervalsActivity[] = await res.json()

      // Group activities by gear_id and sum distance (meters -> km)
      const kmByGear = new Map<string, number>()
      for (const act of activities) {
        if (!act.gear_id || !act.distance) continue
        // Only count activities after the bike's last sync date
        const bike = bikes.find(b => b.externalGearId === act.gear_id)
        if (bike?.lastSyncDate && act.start_date_local) {
          if (act.start_date_local.slice(0, 10) <= bike.lastSyncDate) continue
        }
        kmByGear.set(act.gear_id, (kmByGear.get(act.gear_id) || 0) + act.distance / 1000)
      }

      let bikesUpdated = 0
      let componentsUpdated = 0
      let totalNewKm = 0

      // Update each mapped bike
      for (const bike of bikes) {
        if (!bike.externalGearId) continue
        const newKm = kmByGear.get(bike.externalGearId)
        if (!newKm || newKm < 0.1) continue

        const roundedKm = Math.round(newKm)
        const updatedTotalKm = bike.totalKm + roundedKm

        // Update bike km
        const bikeRef = doc(db, `users/${user.uid}/bikes`, bike.id)
        await updateDoc(bikeRef, {
          totalKm: updatedTotalKm,
          lastSyncDate: newest,
        }).catch(() => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({ path: bikeRef.path, operation: 'update' }))
        })

        bikesUpdated++
        totalNewKm += roundedKm

        // Update all active components for this bike
        const bikeComponents = components.filter(c => c.bikeId === bike.id && c.status !== 'retired')
        for (const comp of bikeComponents) {
          const updatedCompKm = comp.currentKm + roundedKm
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

      const result = { bikesUpdated, componentsUpdated, totalNewKm }

      if (totalNewKm > 0) {
        toast({
          title: 'Synchronisation terminee',
          description: `+${Math.round(totalNewKm)} km repartis sur ${bikesUpdated} velo${bikesUpdated > 1 ? 's' : ''}, ${componentsUpdated} composant${componentsUpdated > 1 ? 's' : ''} mis a jour.`,
        })
      } else {
        toast({ title: 'Deja a jour', description: 'Aucun nouveau kilometre a synchroniser.' })
      }

      return result
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
  }, [user, db, athleteId, apiKey, bikes, components, toast])

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
