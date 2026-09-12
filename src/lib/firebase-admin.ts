// ── Firebase Admin SDK — usage MINIMAL et SCOPÉ, réservé aux routes serveur ──
// qui n'ont AUCUN contexte utilisateur connecté à exploiter ────────────────
//
// ⚠️ Reverse consciemment une règle déjà actée ailleurs dans ce projet
// (CLAUDE.md, "Authentification"/"Sécurité & protection des données") :
// "Firestore n'est lu/écrit que côté client, aucun accès Admin côté
// serveur." Cette règle tient toujours pour TOUT le reste de l'app — elle
// ne s'applique juste pas à un webhook entrant (Intervals.icu POSTe vers
// notre serveur, il n'y a par définition aucun utilisateur Firebase Auth
// connecté à ce moment-là) ni à l'envoi d'une notification push déclenchée
// côté serveur. Deux appelants seulement : `/api/intervals/webhook` (voir
// CLAUDE.md, chantier "repenser planification/séances/feedback") et
// `push-notifications.ts` — jamais un accès Admin généralisé au reste de
// l'app, jamais un contournement des règles Firestore pour un chemin qui
// pourrait passer par le client à la place.
//
// Authentification : Application Default Credentials (ADC) — aucune clé de
// service à générer ni à stocker. Firebase App Hosting exécute le backend
// sur Cloud Run, qui attache automatiquement un compte de service ; ADC le
// trouve tout seul via les métadonnées de l'instance. Le SEUL geste
// opérationnel requis (pas faisable depuis ce sandbox, aucun accès
// `gcloud`/`firebase`) : s'assurer que ce compte de service a le rôle IAM
// "Cloud Datastore User" (Firestore) — et "Firebase Cloud Messaging API
// Admin" s'il manque — sur le projet. Par défaut, le compte de service
// Compute Engine utilisé par App Hosting a déjà un accès Firestore assez
// large (rôle Editor hérité) ; à vérifier concrètement au premier essai en
// prod plutôt que supposé.
//
// Fichier "plain" (pas 'use server') : exporte des valeurs (l'instance
// Admin), pas seulement des fonctions async — même raison que
// outputContract.ts/evidence/constants.ts (voir CLAUDE.md, "Un fichier
// 'use server' ne peut exporter QUE des fonctions async").

import { getApps, initializeApp, cert, type App } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'

/**
 * Réutilise l'app déjà initialisée si ce module est importé plusieurs fois
 * dans le même process (Next.js peut recharger des modules à chaud en dev,
 * `initializeApp()` lève si appelée deux fois pour la même app par défaut).
 *
 * `GOOGLE_APPLICATION_CREDENTIALS_JSON` (optionnel) : repli pour le
 * développement local, où ADC n'est généralement pas disponible (pas de
 * métadonnées d'instance GCP) — un compte de service JSON collé dans une
 * variable d'environnement locale (jamais committé, jamais utilisé en
 * prod). Absent → `initializeApp()` sans argument, qui utilise ADC — le
 * chemin réellement emprunté en production sur Firebase App Hosting.
 */
function getAdminApp(): App {
  const existing = getApps()
  if (existing.length > 0) return existing[0]

  const localCredentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
  if (localCredentialsJson) {
    return initializeApp({ credential: cert(JSON.parse(localCredentialsJson)) })
  }
  return initializeApp()
}

export function adminFirestore() {
  return getFirestore(getAdminApp())
}

export function adminMessaging() {
  return getMessaging(getAdminApp())
}
