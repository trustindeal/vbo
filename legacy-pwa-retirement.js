const LEGACY_CACHE_PATTERN = /^vbo-cache(?:-v\d+)?$/;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.allSettled(
      cacheNames
        .filter((name) => LEGACY_CACHE_PATTERN.test(name))
        .map((name) => caches.delete(name))
    );

    await self.clients.claim();
    const windowClients = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    });

    await self.registration.unregister();
    await Promise.allSettled(
      windowClients
        .filter((client) => {
          const url = new URL(client.url);
          return url.origin === self.location.origin && !url.pathname.startsWith("/login/");
        })
        .map((client) => client.navigate(client.url))
    );
  })());
});
