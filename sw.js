/* FiyatAvcısı Service Worker — v2 */
const CACHE_NAME = 'fiyatavcisi-v2';
const PRECACHE = [
  '/',
  '/index.html',
  '/favicon.ico',
  '/favicon.svg',
  '/site.webmanifest',
  '/indirim-takvimi.html'
];

// Install — pre-cache main assets
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE.map(url => new Request(url, { cache: 'reload' })));
    }).catch(() => { /* ignore individual failures */ })
  );
});

// Activate — clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — network-first strategy, fall back to cache
self.addEventListener('fetch', event => {
  // Only handle same-origin + http(s) requests
  if (!event.request.url.startsWith(self.location.origin) &&
      !event.request.url.startsWith('https://')) return;

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // For navigation requests (HTML pages) — network first
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        return res;
      }).catch(() => caches.match(event.request).then(r => r || caches.match('/index.html')))
    );
    return;
  }

  // For external API calls (exchange rates, store APIs) — network only
  if (event.request.url.includes('cdn.jsdelivr.net') ||
      event.request.url.includes('googleapis.com') ||
      event.request.url.includes('pagead')) {
    event.respondWith(fetch(event.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // For other assets — stale-while-revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(event.request).then(cached => {
        const networkFetch = fetch(event.request).then(res => {
          if (res.ok) cache.put(event.request, res.clone());
          return res;
        }).catch(() => cached);
        return cached || networkFetch;
      });
    })
  );
});
