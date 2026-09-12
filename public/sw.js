// Minimal app-shell service worker.
//
// Scope is intentionally narrow: this app's real data (Firestore) already
// has its own IndexedDB-backed offline persistence, and the Intervals.icu
// proxy routes must never be cached (they'd go stale immediately). All this
// worker does is keep the app shell reachable — icons/manifest, and a
// last-known page as a fallback — when the network is flaky or briefly gone.
//
// ── Notifications push (Firebase Cloud Messaging) — chantier "repenser
// planification/séances/feedback" (voir CLAUDE.md) ─────────────────────
//
// Ce fichier est DÉJÀ le service worker enregistré à la racine du site
// (voir layout.tsx, navigator.serviceWorker.register('/sw.js')) — on y
// ajoute FCM plutôt que d'enregistrer un second worker séparé
// (firebase-messaging-sw.js, le nom par défaut attendu par le SDK) : deux
// workers à la racine entreraient en conflit de scope. use-push-
// notifications.ts passe explicitement CETTE registration à getToken()
// pour que le SDK sache où chercher.
//
// `importScripts` (pas un import ES — un service worker classique, non
// bundlé par Next.js) charge le SDK "compat" (namespacé `firebase.*`), la
// seule variante utilisable hors module JS. Config dupliquée depuis
// src/firebase/config.ts plutôt qu'importée : ce fichier n'est jamais
// traité par le build Next.js (servi tel quel depuis /public), donc pas
// d'accès aux modules TS de l'app — mais ce sont les MÊMES valeurs
// publiques (déjà committées en clair là-bas, jamais des secrets : la
// sécurité vient des règles Firestore, pas de masquer ce config).
importScripts('https://www.gstatic.com/firebasejs/11.9.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/11.9.1/firebase-messaging-compat.js')

firebase.initializeApp({
  projectId: 'studio-3385001327-4400b',
  appId: '1:622545003442:web:2a80517446655631227aab',
  apiKey: 'AIzaSyBi7hKnSpAFwl2nqjnZ3q36c3PJiaBI-wY',
  authDomain: 'studio-3385001327-4400b.firebaseapp.com',
  messagingSenderId: '622545003442',
})

// Reçoit une notification alors que l'app n'a le focus dans AUCUN onglet —
// c'est le cas d'usage même de ce chantier (l'analyse d'une séance muscu
// tourne pendant que l'athlète a fermé l'app, ou l'activité vélo arrive
// via webhook alors que le téléphone est en poche). `payload.data.url`
// (jamais `payload.notification`, réservé au texte affiché) porte le
// chemin à ouvrir au clic — voir push-notifications.ts.
firebase.messaging().onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'LifeCycle'
  const body = payload.notification?.body || ''
  self.registration.showNotification(title, {
    body,
    icon: '/icon-192.png',
    data: { url: payload.data?.url || '/' },
  })
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsList) => {
      for (const client of clientsList) {
        if (client.url.includes(url) && 'focus' in client) return client.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    })
  )
})

const CACHE_NAME = 'lifecycle-shell-v1'
const SHELL_ASSETS = ['/manifest.json', '/icon.svg', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  // Never cache API calls (Intervals.icu proxy) or Next's own data endpoints.
  if (url.pathname.startsWith('/api/')) return

  // Navigations: network-first, falling back to the last cached copy of the
  // same page (or the app shell) when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          return response
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
    )
    return
  }

  // Static assets (Next build output, icons, fonts): cache-first.
  if (url.pathname.startsWith('/_next/static/') || SHELL_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        const copy = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
        return response
      }))
    )
  }
})
