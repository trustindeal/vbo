const LEGACY_CACHE = "vbo-cache";
const ISOLATED_PWA_PREFIXES = ["/login/", "/kwikkwash/teamlogin/"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(LEGACY_CACHE).then((cache) => cache.addAll(["/"])));
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (
    url.origin !== self.location.origin ||
    ISOLATED_PWA_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});
