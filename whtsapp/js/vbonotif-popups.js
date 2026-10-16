(() => {
  "use strict";
  if (window.__vboPopupsInstalled) return;
  window.__vboPopupsInstalled = true;

  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = "css/vbonotif-popups.css";
  document.head.appendChild(css);

  function showAlert(message) {
    let overlay = document.getElementById("vboPopupOverlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "vboPopupOverlay";
      overlay.className = "vbo-popup-overlay";
      overlay.innerHTML = `
        <section class="vbo-popup" role="alertdialog" aria-modal="true"
                 aria-labelledby="vboPopupTitle" aria-describedby="vboPopupMessage">
          <div class="vbo-popup-mark">i</div>
          <h2 id="vboPopupTitle">Notification</h2>
          <div id="vboPopupMessage" class="vbo-popup-message"></div>
          <div class="vbo-popup-actions">
            <button type="button" id="vboPopupOk">OK</button>
          </div>
        </section>`;
      document.body.appendChild(overlay);
    }

    document.getElementById("vboPopupMessage").textContent = String(message ?? "");
    overlay.classList.add("vbo-popup-visible");

    const close = () => {
      overlay.classList.remove("vbo-popup-visible");
      document.removeEventListener("keydown", onKey);
    };
    const onKey = event => {
      if (event.key === "Escape") close();
    };

    document.getElementById("vboPopupOk").onclick = close;
    document.addEventListener("keydown", onKey);
    document.getElementById("vboPopupOk").focus();
  }

  window.alert = showAlert;

  window.vboToast = (message, type = "info") => {
    let host = document.getElementById("vboToastHost");
    if (!host) {
      host = document.createElement("div");
      host.id = "vboToastHost";
      host.className = "vbo-toast-host";
      document.body.appendChild(host);
    }
    const toast = document.createElement("div");
    toast.className = "vbo-toast vbo-toast-" + (["success","error","warning","info"].includes(type) ? type : "info");
    toast.textContent = String(message ?? "");
    host.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("vbo-toast-visible"));
    setTimeout(() => {
      toast.classList.remove("vbo-toast-visible");
      setTimeout(() => toast.remove(), 250);
    }, 3500);
  };
})();
