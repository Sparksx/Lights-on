const CACHE_NAME = 'lights-on-v7';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './js/main.js',
  './js/state.js',
  './js/utils.js',
  './js/dom.js',
  './js/canvas.js',
  './js/upgrades-data.js',
  './js/upgrades.js',
  './js/save.js',
  './js/ui.js',
  './js/interaction.js',
  './js/click.js',
  './js/victory.js',
  './js/intro.js',
  './js/game-loop.js',
  './js/effects/halos.js',
  './js/effects/stars.js',
  './js/effects/constellations.js',
  './js/effects/pulsar.js',
  './js/effects/bigbang.js',
  './js/effects/blackhole.js',
  './js/effects/bursts.js',
  './js/effects/prism.js',
  './js/effects/lightning.js',
  './icons/icon.svg',
  './icons/icon-192.svg',
  './manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first strategy: always try to fetch from network,
// update cache with fresh response, fall back to cache if offline.
self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request)
      .then((response) => {
        // Only cache successful same-origin GET requests
        if (response.ok && e.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});
