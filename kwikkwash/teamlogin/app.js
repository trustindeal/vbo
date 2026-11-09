const CLIENT_ID = "224714556804-81spvp5794l9rfrslif4o27k4u5fr1ig.apps.googleusercontent.com";
const AUTH_ENDPOINT = "https://script.google.com/macros/s/AKfycbzhGqwlkWCJOJBXNRQ0qD-KC_Ws02UQ3Nti8b9x8_EEb7wMSxTMgXRc4GkHlYpkZ5OCTg/exec";
const UNASSIGNED_FALLBACK_URL = "https://www.google.com";
const APP_PATH = "/kwikkwash/teamlogin/";
const TRUSTED_ACCESS_DURATION = 30 * 24 * 60 * 60 * 1000;
const ACCESS_URL_KEY = "kwikkwash_team_access_url";
const ACCESS_TIME_KEY = "kwikkwash_team_access_verified_at";

let deferredInstallPrompt = null;

const statusElement = document.getElementById("status");
const installButton = document.getElementById("install-button");
const installHelp = document.getElementById("install-help");

function setStatus(message, state = "") {
  statusElement.textContent = message;
  if (state) statusElement.dataset.state = state;
  else delete statusElement.dataset.state;
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function isSafeDestination(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function clearTrustedAccess() {
  try {
    localStorage.removeItem(ACCESS_URL_KEY);
    localStorage.removeItem(ACCESS_TIME_KEY);
  } catch {
    // Login remains available when browser storage is blocked.
  }
}

function saveTrustedAccess(url) {
  try {
    localStorage.setItem(ACCESS_URL_KEY, url);
    localStorage.setItem(ACCESS_TIME_KEY, String(Date.now()));
  } catch {
    // Redirect still works; only the remembered-login convenience is skipped.
  }
}

function getTrustedAccess() {
  try {
    const url = localStorage.getItem(ACCESS_URL_KEY);
    const verifiedAt = Number(localStorage.getItem(ACCESS_TIME_KEY));
    const isFresh = Number.isFinite(verifiedAt) && Date.now() - verifiedAt < TRUSTED_ACCESS_DURATION;

    if (url && isFresh && isSafeDestination(url)) return url;
    clearTrustedAccess();
  } catch {
    // Fall through to Google authentication.
  }
  return null;
}

function consumeLogoutRequest() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("logout") !== "1" && params.get("signed_out") !== "1") return false;

  clearTrustedAccess();
  window.history.replaceState({}, "", APP_PATH);
  return true;
}

async function verifyCredential(credential) {
  setStatus("Verifying your team access…", "busy");
  try {
    const response = await fetch(`${AUTH_ENDPOINT}?id_token=${encodeURIComponent(credential)}`, {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
    });
    if (!response.ok) throw new Error(`Verification returned ${response.status}`);

    const result = await response.json();
    if (!result?.ok || !isSafeDestination(result.url) || result.url === UNASSIGNED_FALLBACK_URL) {
      throw new Error(result?.error || "This account has no assigned team link.");
    }

    saveTrustedAccess(result.url);
    setStatus("Access confirmed. Opening your workspace…", "busy");
    window.location.replace(result.url);
  } catch (error) {
    console.error("Kwikkwash access verification failed", error);
    setStatus("Access could not be verified. Use the registered Google account and try again.", "error");
  }
}

function handleCredentialResponse(response) {
  if (!response?.credential) {
    setStatus("Google sign-in was not completed. Please try again.", "error");
    return;
  }
  verifyCredential(response.credential);
}

function initialiseGoogleSignIn() {
  if (!window.google?.accounts?.id) {
    window.setTimeout(initialiseGoogleSignIn, 200);
    return;
  }

  google.accounts.id.initialize({
    client_id: CLIENT_ID,
    callback: handleCredentialResponse,
    auto_select: false,
    cancel_on_tap_outside: true,
  });

  const googleButtonHost = document.getElementById("google-signin");
  google.accounts.id.renderButton(googleButtonHost, {
    type: "standard",
    theme: "outline",
    size: "large",
    text: "continue_with",
    shape: "rectangular",
    logo_alignment: "left",
    width: Math.min(340, Math.max(220, googleButtonHost.clientWidth)),
  });
}

function updateInstallState() {
  if (!isStandalone()) return;
  installButton.disabled = true;
  installButton.querySelector("span").textContent = "Installed on this device";
  installHelp.hidden = true;
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installHelp.hidden = true;
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  updateInstallState();
  setStatus("Kwikkwash Team has been installed.");
});

installButton.addEventListener("click", async () => {
  if (isStandalone()) {
    updateInstallState();
    return;
  }

  if (!deferredInstallPrompt) {
    installHelp.hidden = false;
    return;
  }

  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
});

window.addEventListener("DOMContentLoaded", () => {
  const signedOut = consumeLogoutRequest();
  const trustedAccessUrl = signedOut ? null : getTrustedAccess();

  if (trustedAccessUrl) {
    setStatus("Welcome back. Opening your workspace…", "busy");
    window.location.replace(trustedAccessUrl);
    return;
  }

  if (signedOut) setStatus("You have been signed out. Continue with Google to sign in again.");
  initialiseGoogleSignIn();
  updateInstallState();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register(`${APP_PATH}sw.js`, { scope: APP_PATH }).catch((error) => {
      console.error("Kwikkwash service worker registration failed", error);
    });
  }
});
