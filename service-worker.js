/* ============================================================
   MY MONEY — service-worker.js
   App shell caching + runtime caching untuk CDN + offline
   ============================================================ */
'use strict';

const CACHE_NAME = 'my-money-cache-v1';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/themes.css',
  './css/style.css',
  './css/animations.css',
  './css/responsive.css',
  './js/utils.js',
  './js/database.js',
  './js/dashboard.js',
  './js/transactions.js',
  './js/salary.js',
  './js/savings.js',
  './js/reports.js',
  './js/settings.js',
  './js/app.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
  './assets/icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Navigasi halaman: network-first, fallback ke cache (app shell)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Aset same-origin: cache-first, lalu network (dan simpan ke cache)
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then(cached => cached ||
        fetch(req).then(res => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, copy));
          }
          return res;
        })
      )
    );
    return;
  }

  // CDN (font, css, js pihak ketiga): stale-while-revalidate
  if (url.hostname.includes('cdn.jsdelivr.net') ||
      url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com') ||
      url.hostname.includes('unpkg.com')) {
    event.respondWith(
      caches.match(req).then(cached => {
        const fetched = fetch(req).then(res => {
          if (res.ok || (res.type === 'opaque')) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, copy));
          }
          return res;
        }).catch(() => cached);
        return cached || fetched;
      })
    );
  }
});
