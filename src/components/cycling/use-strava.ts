"use client"

// ── Connexion Strava (OAuth) + rafraîchissement de jeton ────────────────
//
// Retour utilisateur : "let's integrate Strava publishing of activities" —
// suite du "Strava en attente" documenté dans CLAUDE.md ("Export d'une
// séance muscu vers Intervals.icu"). Portée : la PUBLICATION d'une
// activité (musculation, voir use-strava-log-export.ts) — jamais une
// lecture/synchro entrante Strava, qui reste le rôle d'Intervals.icu.
//
// Jetons stockés dans users/{uid}/settings/strava (même patron "un doc par
// intégration" que settings/intervals) — jamais lus/écrits par une route
// serveur (voir Authentification, CLAUDE.md : pas de Firebase Admin SDK
// côté serveur), donc toujours via ce hook côté client. Le flow OAuth
// lui-même (authorize/callback) vit dans src/app/api/strava/ — voir ces
// routes pour le détail de comment les jetons remontent jusqu'ici
// (fragment d'URL, consommé une fois par strava-card.tsx).

import { useCallback } from 'react'
import { doc, deleteDoc, setDoc, getDoc } from 'firebase/firestore'
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'

export interface StravaSettingsDoc {
  accessToken: string
  refreshToken: string
  expiresAt: number // unix seconds
  athleteId: number | null
  connectedAt?: string
}

/** Marge de sécurité avant expiration réelle (secondes) — rafraîchit un peu à l'avance plutôt que de risquer un appel avec un jeton tout juste expiré. */
const REFRESH_MARGIN_SECONDS = 120

export function useStrava() {
  const { user } = useUser()
  const db = useFirestore()

  const settingsRef = useMemoFirebase(() => {
    if (!user || !db) return null
    return doc(db, `users/${user.uid}/settings/strava`)
  }, [db, user])
  const { data: settings, isLoading } = useDoc<StravaSettingsDoc>(settingsRef)

  const isConnected = !!settings?.accessToken

  /**
   * Renvoie un access_token forcément valide — le rafraîchit d'abord via
   * /api/strava/refresh si expiré/proche d'expirer, et persiste le nouveau
   * couple de jetons (Strava fait tourner le refresh_token à chaque
   * appel — l'ancien devient inutilisable). `null` si jamais connecté ou
   * si le rafraîchissement échoue (jeton révoqué côté Strava) — jamais un
   * jeton périmé renvoyé tel quel.
   */
  const getValidAccessToken = useCallback(async (): Promise<string | null> => {
    if (!user || !db) return null
    const ref = doc(db, `users/${user.uid}/settings/strava`)
    const snap = await getDoc(ref)
    const current = snap.data() as StravaSettingsDoc | undefined
    if (!current?.accessToken) return null

    const nowSeconds = Math.floor(Date.now() / 1000)
    if (current.expiresAt - nowSeconds > REFRESH_MARGIN_SECONDS) {
      return current.accessToken
    }

    const res = await fetch('/api/strava/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: current.refreshToken }),
    })
    if (!res.ok) return null
    const refreshed = await res.json() as { accessToken: string; refreshToken: string; expiresAt: number }
    const patch: Partial<StravaSettingsDoc> = {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      expiresAt: refreshed.expiresAt,
    }
    await setDoc(ref, patch, { merge: true }).catch(() => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'update', requestResourceData: patch }))
    })
    return refreshed.accessToken
  }, [user, db])

  const disconnect = useCallback(async () => {
    if (!user || !db || !settings?.accessToken) return
    // Best-effort — révoquer côté Strava est une politesse, pas une
    // condition : le document Firestore local est supprimé même si l'appel
    // échoue (jeton déjà expiré/révoqué côté Strava, par exemple).
    await fetch('/api/strava/deauthorize', {
      method: 'POST',
      headers: { 'x-strava-access-token': settings.accessToken },
    }).catch(() => {})
    const ref = doc(db, `users/${user.uid}/settings/strava`)
    await deleteDoc(ref).catch(() => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'delete' }))
    })
  }, [user, db, settings])

  return { settings, isLoading, isConnected, getValidAccessToken, disconnect }
}
