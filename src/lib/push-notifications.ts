// ── Envoi de notification push — appelé UNIQUEMENT depuis des routes
// serveur qui n'ont pas de contexte utilisateur (voir firebase-admin.ts)
// ────────────────────────────────────────────────────────────────────────
//
// Best-effort par construction : une notification qui échoue ne doit
// JAMAIS faire échouer l'appelant (l'analyse elle-même est déjà persistée
// avant l'appel — voir les deux appelants prévus, la route webhook
// Intervals.icu et la fin d'une séance muscu). Un jeton FCM qui n'est plus
// valide (app désinstallée, permission révoquée, jeton périmé) est
// supprimé silencieusement de `fcmTokens` — pas une erreur applicative,
// juste un ménage normal.

import { adminFirestore, adminMessaging } from './firebase-admin'

export interface PushNotificationPayload {
  title: string
  body: string
  /** Chemin relatif (ex. "/coach?tab=journal") ouvert au clic sur la notification — voir firebase-messaging service worker handler. */
  url?: string
}

/**
 * Envoie `payload` à TOUS les appareils enregistrés de `uid`
 * (`users/{uid}/fcmTokens/{token}`, un doc par jeton enregistré côté
 * client via use-push-notifications.ts). Silencieux si l'athlète n'a
 * activé les notifications sur aucun appareil (collection vide) — ce
 * n'est jamais une erreur, juste une fonctionnalité non activée.
 */
export async function sendPushNotification(uid: string, payload: PushNotificationPayload): Promise<void> {
  const db = adminFirestore()
  const tokensSnap = await db.collection(`users/${uid}/fcmTokens`).get()
  if (tokensSnap.empty) return

  const messaging = adminMessaging()
  await Promise.all(
    tokensSnap.docs.map(async (tokenDoc) => {
      const token = (tokenDoc.data() as { token?: string }).token
      if (!token) return
      try {
        // `data.url` (jamais `webpush.fcmOptions.link`) — le service worker
        // (public/sw.js) surcharge l'affichage par défaut via
        // onBackgroundMessage, donc c'est LUI qui décide de la destination
        // au clic (notificationclick), en lisant ce même champ `data`.
        await messaging.send({
          token,
          notification: { title: payload.title, body: payload.body },
          data: payload.url ? { url: payload.url } : undefined,
        })
      } catch (e) {
        // Jeton mort (app désinstallée, permission révoquée...) — le
        // supprimer évite de retenter indéfiniment un envoi voué à
        // échouer. Toute autre erreur (réseau, quota) reste silencieuse :
        // best-effort, jamais bloquant pour l'appelant.
        const code = (e as { code?: string } | null)?.code
        if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
          await tokenDoc.ref.delete().catch(() => {})
        }
      }
    })
  )
}
