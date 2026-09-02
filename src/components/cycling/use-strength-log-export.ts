"use client"

// ── Export d'une séance muscu loguée vers Intervals.icu ─────────────────
//
// Retour utilisateur : "seras t il possible d'exporter la séance de muscu
// vers Strava et/ou dans intervals". Strava nécessiterait une toute
// nouvelle intégration OAuth (aucune app Strava enregistrée, aucun jeton
// stocké nulle part dans cette app aujourd'hui — le seul "Strava" existant
// est un badge d'affichage en lecture seule sur les activités déjà
// synchronisées VIA Intervals.icu) — hors scope ici, prévu séparément une
// fois l'application Strava créée côté athlète. Intervals.icu, en
// revanche, réutilise l'authentification déjà en place (settings/intervals)
// — voir createManualActivity (intervals-api.ts) pour le contexte sur
// l'endpoint et sa limite (pas de sets/reps structurés, tout en texte
// dans description).

import { useCallback, useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase'
import { useToast } from '@/hooks/use-toast'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { formatStrengthLogDescription, totalWeightLiftedKg, type StrengthSessionLogWithId } from './strength-log-types'

interface IntervalsCredentialsDoc {
  intervalsAthleteId?: string
  intervalsApiKey?: string
}

export function useStrengthLogExport() {
  const { user } = useUser()
  const db = useFirestore()
  const { toast } = useToast()
  const [sendingLogId, setSendingLogId] = useState<string | null>(null)

  const credsRef = useMemoFirebase(() => {
    if (!user || !db) return null
    return doc(db, `users/${user.uid}/settings/intervals`)
  }, [db, user])
  const { data: creds } = useDoc<IntervalsCredentialsDoc>(credsRef)
  const canExport = !!creds?.intervalsAthleteId && !!creds?.intervalsApiKey

  const exportLog = useCallback(async (log: StrengthSessionLogWithId, note?: string): Promise<boolean> => {
    if (!creds?.intervalsAthleteId || !creds?.intervalsApiKey) {
      toast({ variant: 'destructive', title: 'Intervals.icu non connecté', description: 'Renseignez vos identifiants dans Réglages.' })
      return false
    }
    // Pas d'upsert côté Intervals.icu pour une activité manuelle
    // (contrairement à /events) — renvoyer créerait un doublon plutôt que
    // de mettre à jour l'activité existante. intervalsActivityId, posé au
    // premier envoi réussi, est la seule garde.
    if (log.intervalsActivityId) {
      toast({ title: 'Déjà exportée', description: 'Cette séance est déjà sur Intervals.icu.' })
      return false
    }
    setSendingLogId(log.id)
    try {
      // Note de séance — retour utilisateur : "nous pouvons faire une note
      // après la séance avant d'envoyer sur intervalles" (voir
      // StrengthLogExportButton, qui la capture juste avant cet appel).
      // Ajoutée à la description plutôt qu'un champ séparé : Intervals.icu
      // n'a pas de champ "notes" dédié sur une activité manuelle.
      const trimmedNote = note?.trim()
      const description = trimmedNote
        ? `${formatStrengthLogDescription(log.exercises)}\n\nNotes : ${trimmedNote}`
        : formatStrengthLogDescription(log.exercises)
      const activity = {
        name: log.title,
        type: 'WeightTraining',
        startDateLocal: log.date,
        description,
        durationSeconds: log.durationSeconds,
        // Retour utilisateur : "on a la charge, le temps... ça ne les
        // inclut pas" — kg_lifted est calculable sans rien demander de plus
        // (voir totalWeightLiftedKg) ; session_rpe n'est envoyé que si
        // l'athlète l'a réellement saisi (jamais un chiffre inventé pour
        // faire apparaître un "Load" sur Intervals.icu).
        weightLiftedKg: totalWeightLiftedKg(log.exercises),
        sessionRpe: log.sessionRpe,
      }
      const res = await fetch('/api/intervals/activities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-intervals-athlete-id': creds.intervalsAthleteId,
          'x-intervals-api-key': creds.intervalsApiKey,
        },
        body: JSON.stringify(activity),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Erreur ${res.status}`)
      }
      const result = await res.json() as { id: string }

      if (user && db) {
        const ref = doc(db, `users/${user.uid}/strengthSessionLogs/${log.id}`)
        const patch = { intervalsActivityId: String(result.id), ...(trimmedNote ? { sessionNotes: trimmedNote } : {}) }
        await updateDoc(ref, patch).catch(() => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'update', requestResourceData: patch }))
        })
      }

      toast({ title: 'Envoyé sur Intervals.icu', description: log.title })
      return true
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erreur inconnue'
      toast({ variant: 'destructive', title: "Échec de l'envoi", description: message })
      return false
    } finally {
      setSendingLogId(null)
    }
  }, [creds, user, db, toast])

  return { exportLog, sendingLogId, canExport }
}
