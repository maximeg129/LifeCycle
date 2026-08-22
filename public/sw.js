// Minimal app-shell service worker.
//
// Scope is intentionally narrow: this app's real data (Firestore) already
// has its own IndexedDB-backed offline persistence, and the Intervals.icu
// proxy routes must never be cached (they'd go stale immediately). All this
// worker does is keep the app shell reachable — icons/manifest, and a
// last-known page as a fallback — when the network is flaky or briefly gone.

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
