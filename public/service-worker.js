// WakeForce Service Worker

const CACHE_NAME = 'wakeforce-v2';
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

// ── Push ──────────────────────────────────────────────────────
// Fired by the server (via Web Push) at alarm time — wakes the SW even when
// the app is closed, shows a lock-screen notification with sound + vibration.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = {};
  }

  const title = data.title || '⏰ WakeForce Alarm';
  const options = {
    body: data.body || 'Alarm! Tap to open and complete your task to turn it off.',
    tag: 'wakeforce-alarm',
    renotify: true,
    requireInteraction: true,
    silent: false,
    vibrate: [500, 200, 500, 200, 500, 200, 500],
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: data.url || '/', alarmId: data.alarmId || null },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification click ────────────────────────────────────────
// Opens / focuses the app at the alarm route so the task overlay starts.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(
    (event.notification.data && event.notification.data.url) || '/',
    self.location.origin
  ).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            if ('navigate' in client) {
              return client.navigate(target).then((c) => (c || client).focus());
            }
            return client.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(target);
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
