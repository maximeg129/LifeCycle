"use client"

// ── Export d'une séance muscu loguée vers Strava ────────────────────────
//
// Retour utilisateur : "let's integrate Strava publishing of activities".
// Miroir de use-strength-log-export.ts (Intervals.icu) — même geste
// manuel, même patron de note optionnelle avant envoi (voir
// StrengthLogExportButton, partagé entre les deux) — mais l'API Strava
// (contrairement à Intervals.icu) exige une durée réelle (`elapsed_time`),
// donc `canExportLog(log)` gate séance par séance plutôt qu'un simple
// booléen global : jamais une durée inventée pour une séance loguée
// rétroactivement (log-strength-session-dialog.tsx, qui ne suit pas le
// temps — voir StrengthSessionLog.durationSeconds).

import { useCallback, useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { useUser, useFirestore } from '@/firebase'
import { useToast } from '@/hooks/use-toast'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { formatStrengthLogDescription, type StrengthSessionLogWithId } from './strength-log-types'
import { useStrava } from './use-strava'

export function useStravaLogExport() {
  const { user } = useUser()
  const db = useFirestore()
  const { toast } = useToast()
  const { isConnected, getValidAccessToken } = useStrava()
  const [sendingLogId, setSendingLogId] = useState<string | null>(null)

  /** Raison de désactivation propre à CETTE séance, ou undefined si exportable — voir StrengthLogExportButton.disabledReason. */
  const disabledReasonFor = useCallback((log: StrengthSessionLogWithId): string | undefined => {
    if (log.durationSeconds == null) {
      return "Durée non suivie — l'export Strava nécessite une séance chronométrée en direct."
    }
    return undefined
  }, [])

  const exportLog = useCallback(async (log: StrengthSessionLogWithId, note?: string): Promise<boolean> => {
    if (!isConnected) {
      toast({ variant: 'destructive', title: 'Strava non connecté', description: 'Connectez votre compte dans Réglages.' })
      return false
    }
    // Pas d'upsert côté Strava pour une activité manuelle (comme
    // Intervals.icu) — renvoyer créerait un doublon plutôt qu'une mise à
    // jour. stravaActivityId, posé au premier envoi réussi, est la seule
    // garde.
    if (log.stravaActivityId) {
      toast({ title: 'Déjà exportée', description: 'Cette séance est déjà sur Strava.' })
      return false
    }
    const disabledReason = disabledReasonFor(log)
    if (disabledReason) {
      toast({ variant: 'destructive', title: 'Export impossible', description: disabledReason })
      return false
    }
    setSendingLogId(log.id)
    try {
      const accessToken = await getValidAccessToken()
      if (!accessToken) {
        throw new Error('Jeton Strava indisponible — reconnectez votre compte dans Réglages.')
      }

      const trimmedNote = note?.trim()
      const description = trimmedNote
        ? `${formatStrengthLogDescription(log.exercises)}\n\nNotes : ${trimmedNote}`
        : formatStrengthLogDescription(log.exercises)

      const res = await fetch('/api/strava/activities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-strava-access-token': accessToken,
        },
        body: JSON.stringify({
          name: log.title,
          startDateLocal: log.date,
          description,
          durationSeconds: log.durationSeconds,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Erreur ${res.status}`)
      }
      const result = await res.json() as { id: number }

      if (user && db) {
        const ref = doc(db, `users/${user.uid}/strengthSessionLogs/${log.id}`)
        const patch = { stravaActivityId: String(result.id), ...(trimmedNote ? { sessionNotes: trimmedNote } : {}) }
        await updateDoc(ref, patch).catch(() => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'update', requestResourceData: patch }))
        })
      }

      toast({ title: 'Envoyé sur Strava', description: log.title })
      return true
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erreur inconnue'
      toast({ variant: 'destructive', title: "Échec de l'envoi", description: message })
      return false
    } finally {
      setSendingLogId(null)
    }
  }, [isConnected, getValidAccessToken, user, db, toast, disabledReasonFor])

  return { exportLog, sendingLogId, canExport: isConnected, disabledReasonFor }
}
