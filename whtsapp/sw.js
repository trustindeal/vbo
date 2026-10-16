/* VBONotif Service Worker
 * Handles: Web Push notifications, notification click routing, basic offline.
 */

const SW_VERSION = "vbonotif-sw-v1";

self.addEventListener("install", (event) => {
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
});

/* ---------- Web Push ---------- */

self.addEventListener("push", (event) => {
    let payload = {};
    try {
        payload = event.data ? event.data.json() : {};
    } catch (e) {
        payload = { title: "VBONotif", body: (event.data && event.data.text()) || "" };
    }

    const title = payload.title || "New WhatsApp message";
    const body = payload.body || "";
    const iconUrl = payload.icon || "icon/vbo-favicon-192.png";
    const badgeUrl = payload.badge || "icon/vbo-favicon-48.png";
    const data = payload.data || {};

    const options = {
        body: body,
        icon: iconUrl,
        badge: badgeUrl,
        tag: data.tag || ("wa-msg-" + (data.wa_id || "unknown")),
        renotify: true,
        requireInteraction: false,
        data: data,
        timestamp: Date.now()
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

/* ---------- Notification click ---------- */

self.addEventListener("notificationclick", (event) => {
    event.notification.close();

    const data = event.notification.data || {};
    const waId = data.wa_id || "";
    const targetUrl = data.url || ("inbox.html" + (waId ? ("?wa=" + encodeURIComponent(waId)) : ""));

    event.waitUntil((async () => {
        const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        // Try to focus an existing tab
        for (const client of allClients) {
            try {
                const url = new URL(client.url);
                if (url.pathname.endsWith("/inbox.html")) {
                    await client.focus();
                    client.postMessage({ type: "vbonotif-open-chat", wa_id: waId });
                    return;
                }
            } catch (e) {}
        }
        // Otherwise open a new one
        if (self.clients.openWindow) {
            await self.clients.openWindow(targetUrl);
        }
    })());
});

/* ---------- Push subscription change ---------- */

self.addEventListener("pushsubscriptionchange", (event) => {
    event.waitUntil((async () => {
        try {
            const reg = await self.registration.pushManager.subscribe(event.oldSubscription ? event.oldSubscription.options : { userVisibleOnly: true });
            const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
            for (const client of allClients) {
                client.postMessage({ type: "vbonotif-resubscribe", subscription: reg.toJSON() });
            }
        } catch (e) {
            // Silent — client will handle resubscription on next load
        }
    })());
});

/* ---------- Minimal offline fallback ---------- */

self.addEventListener("fetch", (event) => {
    if (event.request.method !== "GET") return;
    // Only serve offline page as fallback for navigations
    if (event.request.mode === "navigate") {
        event.respondWith((async () => {
            try {
                return await fetch(event.request);
            } catch (e) {
                return new Response(
                    "<!doctype html><meta charset=\"utf-8\"><title>Offline</title>" +
                    "<body style=\"font-family:system-ui;padding:40px;text-align:center;color:#54656f\">" +
                    "<h2>You are offline</h2><p>Please check your internet connection.</p></body>",
                    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
                );
            }
        })());
    }
});
