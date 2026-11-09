const CLIENT_ID = "224714556804-81spvp5794l9rfrslif4o27k4u5fr1ig.apps.googleusercontent.com";
const AUTH_ENDPOINT = "https://script.google.com/macros/s/AKfycbzhGqwlkWCJOJBXNRQ0qD-KC_Ws02UQ3Nti8b9x8_EEb7wMSxTMgXRc4GkHlYpkZ5OCTg/exec";
const UNASSIGNED_FALLBACK_URL = "https://www.google.com";
const APP_PATH = "/kwikkwash/teamlogin/";

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
  initialiseGoogleSignIn();
  updateInstallState();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register(`${APP_PATH}sw.js`, { scope: APP_PATH }).catch((error) => {
      console.error("Kwikkwash service worker registration failed", error);
    });
  }
});
