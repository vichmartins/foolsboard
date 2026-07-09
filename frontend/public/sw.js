/* foolsboard service worker — an "app shell" PWA.
 *
 * Goals: instant repeat loads (hashed build assets served from cache) and a
 * graceful offline shell, WITHOUT the classic "stuck on an old build" trap.
 *
 * Strategy:
 *  - Navigations (the HTML shell): NETWORK-FIRST, so a new deploy is always
 *    picked up; when offline, show the offline fallback page (the app itself is
 *    useless without /api data, so a clear "you're offline" screen beats a broken
 *    shell). The cached shell is used only if the fallback is somehow missing.
 *  - /assets/* (content-hashed, immutable): CACHE-FIRST -> instant.
 *  - Other same-origin static (favicon, manifest): stale-while-revalidate.
 *  - /api, /media, /version.json, the WebSocket: never touched (must stay live).
 *
 * Bump CACHE to invalidate everything on a future SW logic change.
 */
const CACHE = 'foolsboard-cache-v2'
const SHELL = '/index.html'
const OFFLINE = '/offline.html'

self.addEventListener('install', (event) => {
  // Precache the offline fallback so it's available even on the very first
  // network drop. Ignore failures (e.g. a flaky install) — the fetch handler
  // still falls back to the cached shell.
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(OFFLINE))
      .catch(() => {}),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  // Live data must always go straight to the network.
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/media/') ||
    url.pathname === '/version.json'
  ) {
    return
  }

  // The HTML shell: network-first so deploys are picked up; cache for offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req)
          const cache = await caches.open(CACHE)
          cache.put(SHELL, fresh.clone())
          return fresh
        } catch {
          // Offline: show the friendly fallback page (or the cached shell if the
          // fallback isn't cached yet).
          const cache = await caches.open(CACHE)
          return (await cache.match(OFFLINE)) || (await cache.match(SHELL)) || Response.error()
        }
      })(),
    )
    return
  }

  // Hashed build assets are immutable -> cache-first (instant repeat loads).
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE)
        const hit = await cache.match(req)
        if (hit) return hit
        const fresh = await fetch(req)
        if (fresh.ok) cache.put(req, fresh.clone())
        return fresh
      })(),
    )
    return
  }

  // Other same-origin static (favicon, manifest, icons): stale-while-revalidate.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE)
      const hit = await cache.match(req)
      const fetching = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone())
          return res
        })
        .catch(() => hit)
      return hit || fetching
    })(),
  )
})
