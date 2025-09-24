// service-worker.js

const CACHE_NAME = 'vbo-cache-v3'; // Change version to force update
const FILES_TO_CACHE = [
  '/',
  '/index.html',
  '/hook.html', // PWA start_url
  '/styles.css',
  '/script.js', // app.js aapke project me ye file naam hai
  '/vbo-favicon-192.png',
  '/icon-512.png'
];

// Install event - cache files
self.addEventListener('install', event => {
  console.log('[ServiceWorker] Install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[ServiceWorker] Caching app shell and start_url');
        return cache.addAll(FILES_TO_CACHE);
      })
  );
  self.skipWaiting();
});

// Activate event - clear old caches
self.addEventListener('activate', event => {
  console.log('[ServiceWorker] Activate');
  event.waitUntil(
    caches.keys().then(keyList => {
      return Promise.all(
        keyList.map(key => {
          if (key !== CACHE_NAME) {
            console.log('[ServiceWorker] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache first, fallback to network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) {
        return response; // serve from cache
      }
      return fetch(event.request) // fallback to network
        .then(networkResponse => {
          // Optional: dynamically cache new requests
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        }).catch(() => {
          // Optional: fallback page if offline
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
    })
  );
});
