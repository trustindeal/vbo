const CACHE_NAME = "kwikkwash-team-shell-v2";
const APP_PATH = "/kwikkwash/teamlogin/";
const APP_SHELL = [
  APP_PATH,
  `${APP_PATH}index.html`,
  `${APP_PATH}styles.css`,
  `${APP_PATH}app.js`,
  `${APP_PATH}offline.html`,
  `${APP_PATH}manifest.webmanifest`,
  `${APP_PATH}assets/kwikkwash-team-192.png`,
  `${APP_PATH}assets/kwikkwash-team-512.png`,
  `${APP_PATH}assets/kwikkwash-team-maskable-512.png`,
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(
      names
        .filter((name) => name.startsWith("kwikkwash-team-shell-") && name !== CACHE_NAME)
        .map((name) => caches.delete(name))
    ))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(APP_PATH)) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(`${APP_PATH}offline.html`))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
