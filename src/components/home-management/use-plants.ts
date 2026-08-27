"use client"

import { useCallback } from 'react'
import { collection, doc, setDoc, deleteDoc, serverTimestamp, Timestamp, query, orderBy } from 'firebase/firestore'
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { getHealthStatus } from './plant-types'
import type { IdentifyPlantOutput } from '@/ai/flows/identify-plant-flow'

export interface Plant {
  id: string
  nickname: string
  species?: string
  location: string
  wateringFrequencyDays: number
  wateringAmountMl: number
  lastWateringDate?: { seconds: number } | null
  purchaseDate?: { seconds: number } | null
  healthScore?: number
  healthStatus?: 'green' | 'yellow' | 'red'
  lastAnalysisAlerts?: string[]
  lastHealthAnalysis?: string
  lastHydrationPlan?: IdentifyPlantOutput['hydrationPlan'] | null
  lastGeneralCare?: string[]
  lastAnalysisDate?: { seconds: number } | null
  thumbnailUrl?: string | null
  notes?: string
}

export interface PlantAnalysis {
  id: string
  healthScore: number
  healthAnalysis: string
  alerts: string[]
  hydrationPlan: IdentifyPlantOutput['hydrationPlan']
  generalCare: string[]
  thumbnailUrl?: string | null
  createdAt?: { seconds: number }
}

export interface PlantFormInput {
  nickname: string
  species?: string
  location: string
  wateringFrequencyDays: number
  wateringAmountMl: number
  purchaseDate: string | null // yyyy-mm-dd
  notes: string
  scan?: { result: IdentifyPlantOutput; thumbnailUrl: string | null }
}

function dateOnlyToTimestamp(dateStr: string | null): Timestamp | null {
  return dateStr ? Timestamp.fromDate(new Date(dateStr + 'T12:00:00')) : null
}

/** Fields shared by add/update whenever a fresh AI scan is included. */
function scanFields(scan: PlantFormInput['scan']) {
  if (!scan) return {}
  return {
    thumbnailUrl: scan.thumbnailUrl,
    healthScore: scan.result.healthScore,
    healthStatus: getHealthStatus(scan.result.healthScore),
    lastAnalysisAlerts: scan.result.alerts,
    lastHealthAnalysis: scan.result.healthAnalysis,
    lastHydrationPlan: scan.result.hydrationPlan,
    lastGeneralCare: scan.result.generalCare,
    lastAnalysisDate: serverTimestamp(),
  }
}

export function usePlants() {
  const { user } = useUser()
  const db = useFirestore()

  const plantsQuery = useMemoFirebase(() => {
    if (!user || !db) return null
    return collection(db, `users/${user.uid}/plants`)
  }, [db, user])
  const { data, isLoading } = useCollection<Plant>(plantsQuery)

  const writeAnalysis = useCallback(async (plantId: string, scan: NonNullable<PlantFormInput['scan']>) => {
    if (!user || !db) return
    const analysisRef = doc(collection(db, `users/${user.uid}/plants/${plantId}/analyses`))
    const data = {
      healthScore: scan.result.healthScore,
      healthAnalysis: scan.result.healthAnalysis,
      alerts: scan.result.alerts,
      hydrationPlan: scan.result.hydrationPlan,
      generalCare: scan.result.generalCare,
      thumbnailUrl: scan.thumbnailUrl,
      createdAt: serverTimestamp(),
      userId: user.uid,
      plantId,
    }
    await setDoc(analysisRef, data).catch(() => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: analysisRef.path, operation: 'create', requestResourceData: data }))
      throw new Error('permission-denied')
    })
  }, [user, db])

  const addPlant = useCallback(async (input: PlantFormInput & { lastWateringDate: string | null; thumbnailUrl: string | null }): Promise<string> => {
    if (!user || !db) throw new Error('not-authenticated')
    const plantRef = doc(collection(db, `users/${user.uid}/plants`))
    const newPlant = {
      nickname: input.nickname,
      species: input.species ?? '',
      location: input.location,
      wateringFrequencyDays: input.wateringFrequencyDays,
      wateringAmountMl: input.wateringAmountMl,
      lastWateringDate: dateOnlyToTimestamp(input.lastWateringDate) ?? serverTimestamp(),
      purchaseDate: dateOnlyToTimestamp(input.purchaseDate),
      healthScore: input.scan?.result.healthScore ?? 75,
      healthStatus: getHealthStatus(input.scan?.result.healthScore ?? 75),
      lastAnalysisAlerts: input.scan?.result.alerts ?? [],
      lastHealthAnalysis: input.scan?.result.healthAnalysis ?? '',
      lastHydrationPlan: input.scan?.result.hydrationPlan ?? null,
      lastGeneralCare: input.scan?.result.generalCare ?? [],
      lastAnalysisDate: input.scan ? serverTimestamp() : null,
      thumbnailUrl: input.thumbnailUrl,
      notes: input.notes,
      userId: user.uid,
      createdAt: serverTimestamp(),
    }
    await setDoc(plantRef, newPlant).catch(() => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: plantRef.path, operation: 'create', requestResourceData: newPlant }))
      throw new Error('permission-denied')
    })
    if (input.scan) await writeAnalysis(plantRef.id, input.scan)
    return plantRef.id
  }, [user, db, writeAnalysis])

  const updatePlant = useCallback(async (plantId: string, input: PlantFormInput) => {
    if (!user || !db) return
    // Matches the original save order: write the analysis history entry
    // first, then the plant doc — a failure here should not silently
    // record an analysis against a plant whose other edits didn't save.
    if (input.scan) await writeAnalysis(plantId, input.scan)
    const plantRef = doc(db, `users/${user.uid}/plants`, plantId)
    const update = {
      nickname: input.nickname,
      location: input.location,
      wateringFrequencyDays: input.wateringFrequencyDays,
      wateringAmountMl: input.wateringAmountMl,
      notes: input.notes,
      purchaseDate: dateOnlyToTimestamp(input.purchaseDate),
      ...scanFields(input.scan),
    }
    await setDoc(plantRef, update, { merge: true }).catch(() => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: plantRef.path, operation: 'update', requestResourceData: update }))
      throw new Error('permission-denied')
    })
  }, [user, db, writeAnalysis])

  const waterPlant = useCallback(async (plantId: string) => {
    if (!user || !db) return
    const plantRef = doc(db, `users/${user.uid}/plants`, plantId)
    const update = { lastWateringDate: serverTimestamp() }
    await setDoc(plantRef, update, { merge: true }).catch(() => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: plantRef.path, operation: 'update', requestResourceData: update }))
      throw new Error('permission-denied')
    })
  }, [user, db])

  const deletePlant = useCallback(async (plantId: string) => {
    if (!user || !db) return
    const plantRef = doc(db, `users/${user.uid}/plants`, plantId)
    await deleteDoc(plantRef).catch(() => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: plantRef.path, operation: 'delete' }))
      throw new Error('permission-denied')
    })
  }, [user, db])

  return { plants: data || [], isLoading, addPlant, updatePlant, waterPlant, deletePlant }
}

/** Health-analysis history for one plant, oldest first — null id means "no plant selected". */
export function usePlantAnalyses(plantId: string | null) {
  const { user } = useUser()
  const db = useFirestore()

  const analysesQuery = useMemoFirebase(() => {
    if (!db || !user || !plantId) return null
    return query(collection(db, `users/${user.uid}/plants/${plantId}/analyses`), orderBy('createdAt', 'asc'))
  }, [db, user, plantId])
  const { data } = useCollection<PlantAnalysis>(analysesQuery)

  return { analyses: data || [] }
}
