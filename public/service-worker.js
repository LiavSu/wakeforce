// WakeForce Service Worker

const CACHE_NAME = 'wakeforce-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// ── Install ───────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Skip waiting — become active immediately
  self.skipWaiting();
});

// ── Activate ──────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => {
        // Take control of all open clients immediately
        return self.clients.claim();
      })
      .then(() => {
        // Notify all open clients to check alarm state
        return self.clients.matchAll({ type: 'window' }).then((clients) => {
          clients.forEach((c) =>
            c.postMessage({ type: 'SW_ACTIVATED' })
          );
        });
      })
  );
});

// ── Fetch ─────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Skip cross-origin requests (e.g., Google Fonts, TF.js CDN)
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    // For cross-origin, just fetch without caching
    event.respondWith(fetch(event.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          // Cache only allowlisted same-origin paths
          const url = new URL(event.request.url);
          if (response.ok && event.request.method === 'GET' && url.origin === self.location.origin && STATIC_ASSETS.some(a => url.pathname === a || url.pathname.startsWith(a))) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline and not cached — return nothing meaningful
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/index.html');
          }
          return new Response('', { status: 503, statusText: 'Offline' });
        });
    })
  );
});
