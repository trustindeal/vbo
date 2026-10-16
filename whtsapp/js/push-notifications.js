/* VBONotif Push Notifications
 * Handles: service worker registration, permission, subscribe/unsubscribe,
 * toggle state persistence (backend), and message routing from SW.
 */

(function () {
    "use strict";

    const SW_PATH = "sw.js";
    const API_BASE = "https://app.vbo.co.in/api/v1/whatsapp/push";
    const LS_KEY = "vbonotif_push_enabled";

    let swRegistration = null;

    function getToken() {
        return localStorage.getItem("vbonotif_token") || "";
    }

    function authHeaders() {
        return {
            "Authorization": "Bearer " + getToken(),
            "Content-Type": "application/json"
        };
    }

    function urlBase64ToUint8Array(base64String) {
        const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
        const rawData = atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    async function fetchVapidPublicKey() {
        const res = await fetch(API_BASE + "/vapid-public-key", {
            headers: authHeaders()
        });
        if (!res.ok) throw new Error("Failed to fetch VAPID public key");
        const data = await res.json();
        if (!data.success || !data.public_key) {
            throw new Error("VAPID public key missing");
        }
        return data.public_key;
    }

    async function registerServiceWorker() {
        if (!("serviceWorker" in navigator)) {
            return null;
        }
        try {
            const reg = await navigator.serviceWorker.register(SW_PATH, { scope: "./" });
            swRegistration = reg;
            return reg;
        } catch (e) {
            console.warn("SW registration failed:", e);
            return null;
        }
    }

    function isPushSupported() {
        return "serviceWorker" in navigator
            && "PushManager" in window
            && "Notification" in window;
    }

    async function getExistingSubscription() {
        if (!swRegistration) return null;
        try {
            return await swRegistration.pushManager.getSubscription();
        } catch (e) {
            return null;
        }
    }

    async function subscribeToPush() {
        if (!isPushSupported()) throw new Error("Push notifications not supported in this browser");
        if (!swRegistration) {
            await registerServiceWorker();
        }
        if (!swRegistration) throw new Error("Service worker not registered");

        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
            throw new Error("Notification permission not granted");
        }

        let sub = await getExistingSubscription();
        if (!sub) {
            const vapidKey = await fetchVapidPublicKey();
            sub = await swRegistration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidKey)
            });
        }

        const subJson = sub.toJSON();
        const res = await fetch(API_BASE + "/subscribe", {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({
                endpoint: subJson.endpoint,
                keys: subJson.keys,
                user_agent: navigator.userAgent
            })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
            throw new Error(data.detail || "Subscribe failed");
        }

        localStorage.setItem(LS_KEY, "1");
        return true;
    }

    async function unsubscribeFromPush() {
        if (!isPushSupported()) return true;
        let sub = await getExistingSubscription();
        if (sub) {
            const endpoint = sub.endpoint;
            try {
                await fetch(API_BASE + "/unsubscribe", {
                    method: "POST",
                    headers: authHeaders(),
                    body: JSON.stringify({ endpoint: endpoint })
                });
            } catch (e) {
                // Silent — best-effort
            }
            try {
                await sub.unsubscribe();
            } catch (e) {}
        }
        localStorage.setItem(LS_KEY, "0");
        return true;
    }

    async function isSubscribedOnServer() {
        const sub = await getExistingSubscription();
        if (!sub) return false;
        try {
            const res = await fetch(API_BASE + "/status", {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify({ endpoint: sub.endpoint })
            });
            if (!res.ok) return false;
            const data = await res.json();
            return !!(data.success && data.enabled);
        } catch (e) {
            return false;
        }
    }

    async function getCurrentState() {
        if (!isPushSupported()) return "unsupported";
        const perm = Notification.permission;
        if (perm === "denied") return "denied";
        const localFlag = localStorage.getItem(LS_KEY);
        if (localFlag === "0") return "off";
        if (perm === "granted") {
            const onServer = await isSubscribedOnServer();
            return onServer ? "on" : "off";
        }
        return "off";
    }

    async function setEnabled(enabled) {
        if (enabled) {
            return subscribeToPush();
        } else {
            return unsubscribeFromPush();
        }
    }

    /* SW message routing */
    navigator.serviceWorker && navigator.serviceWorker.addEventListener("message", (event) => {
        const msg = event.data || {};
        if (msg.type === "vbonotif-open-chat" && msg.wa_id) {
            if (typeof window.openChat === "function") {
                window.openChat(msg.wa_id);
            }
        } else if (msg.type === "vbonotif-resubscribe" && msg.subscription) {
            // Best effort resubscribe to backend
            (async () => {
                try {
                    await fetch(API_BASE + "/subscribe", {
                        method: "POST",
                        headers: authHeaders(),
                        body: JSON.stringify({
                            endpoint: msg.subscription.endpoint,
                            keys: msg.subscription.keys,
                            user_agent: navigator.userAgent
                        })
                    });
                } catch (e) {}
            })();
        }
    });

    /* URL param routing: ?wa=XXXX */
    document.addEventListener("DOMContentLoaded", () => {
        try {
            const params = new URLSearchParams(window.location.search);
            const wa = params.get("wa");
            if (wa && typeof window.openChat === "function") {
                setTimeout(() => window.openChat(wa), 200);
            }
        initToggleUi();
        } catch (e) {}
    });

    /* Toggle UI binding */
    async function initToggleUi() {
        const cbs = [
            document.getElementById("pushToggleCheckbox"),
            document.getElementById("pushToggleCheckboxMenu")
        ].filter(Boolean);
        const stateEls = [
            document.getElementById("pushToggleState"),
            document.getElementById("pushToggleStateMenu")
        ].filter(Boolean);
        if (!cbs.length) return;

        const render = async function () {
            if (!isPushSupported()) {
                cbs.forEach(cb => { cb.disabled = true; cb.checked = false; });
                stateEls.forEach(el => el.textContent = "Unsupported");
                return;
            }
            const state = await getCurrentState();
            const label = state === "on" ? "On" : (state === "denied" ? "Blocked" : "Off");
            stateEls.forEach(el => el.textContent = label);
            cbs.forEach(cb => {
                cb.checked = (state === "on");
                cb.disabled = (state === "denied");
            });
        };

        const onToggle = async function (sourceCb) {
            cbs.forEach(cb => cb.disabled = true);
            stateEls.forEach(el => el.textContent = "...");
            try {
                await setEnabled(sourceCb.checked);
            } catch (e) {
                alert(e.message || "Notification toggle failed");
            } finally {
                await render();
            }
        };

        cbs.forEach(cb => {
            cb.addEventListener("change", function () { onToggle(cb); });
        });

        await render();
    }

    window.VBOPush = {
        isPushSupported,
        getCurrentState,
        setEnabled,
        subscribeToPush,
        unsubscribeFromPush,
        registerServiceWorker
    };
})();
