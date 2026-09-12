"use client"

// ── Notifications push (FCM) — chantier "repenser planification/séances/
// feedback" (voir CLAUDE.md) ────────────────────────────────────────────
//
// Le jeton FCM est enregistré dans `users/{uid}/fcmTokens/{token}` (le
// jeton lui-même comme id de document — base64url-safe par construction,
// jamais de `/`, donc sûr comme segment de path Firestore ; réinscrire le
// même appareil réécrit le même doc plutôt que d'empiler des doublons).
// Envoyé côté serveur par push-notifications.ts (Admin SDK, en dehors de
// tout contexte utilisateur connecté — voir firebase-admin.ts).

import { useCallback, useEffect, useState } from 'react'
import { doc, deleteDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { deleteToken, getMessaging, getToken, isSupported } from 'firebase/messaging'
import { useUser, useFirestore, useFirebaseApp } from '@/firebase'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'

// Généré côté Firebase Console (Project Settings → Cloud Messaging → Web
// configuration → "Web Push certificates" → Generate key pair) — pas un
// secret (c'est la clé PUBLIQUE utilisée par l'API Push du navigateur),
// mais spécifique au projet, donc pas committée en dur comme le reste de
// src/firebase/config.ts. `undefined` tant que non configuré :
// requestPermissionAndRegister() échoue proprement plutôt que de tenter un
// enregistrement voué à échouer.
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY

export type PushPermissionState = NotificationPermission | 'unsupported'

export function usePushNotifications() {
  const { user } = useUser()
  const db = useFirestore()
  const app = useFirebaseApp()
  const [permission, setPermission] = useState<PushPermissionState>('default')
  const [isRegistering, setIsRegistering] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('unsupported')
      return
    }
    setPermission(Notification.permission)
  }, [])

  const requestPermissionAndRegister = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !user || !db) return false
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setPermission('unsupported')
      return false
    }
    if (!(await isSupported().catch(() => false))) {
      setPermission('unsupported')
      return false
    }
    if (!VAPID_KEY) return false

    setIsRegistering(true)
    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      if (result !== 'granted') return false

      // Le service worker (public/sw.js) est déjà enregistré au chargement
      // de l'app (layout.tsx) — on attend juste qu'il soit prêt plutôt que
      // d'en enregistrer un second.
      const registration = await navigator.serviceWorker.ready
      const messaging = getMessaging(app)
      const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration })
      if (!token) return false

      const ref = doc(db, `users/${user.uid}/fcmTokens/${token}`)
      const data = { token, userId: user.uid, userAgent: navigator.userAgent, updatedAt: serverTimestamp() }
      try {
        await setDoc(ref, data, { merge: true })
      } catch {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'create', requestResourceData: data }))
        return false
      }
      return true
    } finally {
      setIsRegistering(false)
    }
  }, [user, db, app])

  /** Désactive les notifications sur CET appareil — révoque le jeton côté FCM et supprime son doc. */
  const unregister = useCallback(async (): Promise<void> => {
    if (typeof window === 'undefined' || !user || !db) return
    if (!(await isSupported().catch(() => false))) return
    try {
      const registration = await navigator.serviceWorker.ready
      const messaging = getMessaging(app)
      const token = VAPID_KEY ? await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration }).catch(() => null) : null
      await deleteToken(messaging).catch(() => {})
      if (token) {
        const ref = doc(db, `users/${user.uid}/fcmTokens/${token}`)
        await deleteDoc(ref).catch(() => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'delete' }))
        })
      }
    } catch {
      // Best-effort — désactiver ne doit jamais planter l'UI, même si le
      // jeton était déjà invalide/absent.
    }
  }, [user, db, app])

  return {
    permission,
    isRegistering,
    isConfigured: !!VAPID_KEY,
    requestPermissionAndRegister,
    unregister,
  }
}
