"use client"

// ── Connexion OAuth Intervals.icu — chantier "repenser planification/
// séances/feedback" (pièce B2, voir CLAUDE.md) ────────────────────────────
//
// ADDITIONNELLE à la clé API personnelle déjà utilisée partout ailleurs
// dans l'app (users/{uid}/settings/intervals) — cette connexion OAuth ne
// sert QU'À une chose : recevoir les webhooks Intervals.icu (ACTIVITY_
// ANALYZED) pour déclencher l'analyse IA automatique d'une sortie vélo,
// même app fermée (voir /api/intervals/webhook/route.ts). Rien d'autre
// dans l'app ne lit/n'écrit via ce jeton — la clé API personnelle continue
// de couvrir tous les appels Intervals.icu existants.
//
// Jetons stockés dans users/{uid}/settings/intervalsOAuth (même patron "un
// doc par intégration" que settings/strava) — jamais lus/écrits par une
// route serveur pour cette partie CLIENT-FACING (voir Authentification,
// CLAUDE.md), contrairement au mapping athlete_id→uid (intervalsOAuthAthletes,
// Admin SDK, voir /api/intervals-oauth/callback) qui DOIT rester
// server-only pour rester sûr.
//
// ⚠️ Pas de rafraîchissement de jeton (voir intervals-oauth-api.ts) —
// jamais construit sur une supposition, la doc collée par l'utilisateur ne
// documente aucun refresh_token dans la réponse d'échange.

import { useCallback } from 'react'
import { doc, deleteDoc } from 'firebase/firestore'
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'

export interface IntervalsOAuthSettingsDoc {
  accessToken: string
  athleteId: string
  athleteName: string | null
  scope: string
  connectedAt?: string
}

export function useIntervalsOAuth() {
  const { user } = useUser()
  const db = useFirestore()

  const settingsRef = useMemoFirebase(() => {
    if (!user || !db) return null
    return doc(db, `users/${user.uid}/settings/intervalsOAuth`)
  }, [db, user])
  const { data: settings, isLoading } = useDoc<IntervalsOAuthSettingsDoc>(settingsRef)

  const isConnected = !!settings?.accessToken

  const disconnect = useCallback(async () => {
    if (!user || !db || !settings?.accessToken) return
    // Best-effort — voir /api/intervals-oauth/disconnect/route.ts : le
    // document Firestore local est supprimé même si l'appel échoue.
    await fetch('/api/intervals-oauth/disconnect', {
      method: 'POST',
      headers: {
        'x-intervals-oauth-access-token': settings.accessToken,
        'x-intervals-oauth-athlete-id': settings.athleteId,
      },
    }).catch(() => {})
    const ref = doc(db, `users/${user.uid}/settings/intervalsOAuth`)
    await deleteDoc(ref).catch(() => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'delete' }))
    })
  }, [user, db, settings])

  return { settings, isLoading, isConnected, disconnect }
}
