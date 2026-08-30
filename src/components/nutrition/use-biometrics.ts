"use client"

// Taille/âge/sexe pour le calcul du métabolisme de base (Mifflin-St Jeor,
// voir computeBMR() dans fueling-types.ts) — contrairement au poids
// (auto-synchronisé depuis Intervals.icu), Intervals.icu n'expose aucun de
// ces trois champs dans son API athlète : saisie manuelle uniquement, comme
// users/{uid}/settings/powerCurve (use-power-curve.ts) mais sans volet auto
// puisqu'il n'y a ici aucune source à fusionner.

import { doc } from 'firebase/firestore'
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase'
import type { Sex } from './fueling-types'

export interface BiometricsDoc {
  heightCm?: number
  age?: number
  sex?: Sex
  updatedAt?: unknown
}

export function useBiometrics() {
  const { user } = useUser()
  const db = useFirestore()

  const ref = useMemoFirebase(() => {
    if (!user || !db) return null
    return doc(db, `users/${user.uid}/settings/biometrics`)
  }, [db, user])
  const { data, isLoading } = useDoc<BiometricsDoc>(ref)

  return { data: data ?? null, isLoading, ref }
}
