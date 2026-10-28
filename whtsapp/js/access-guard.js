(function() {
  var PAGE_MAP = {
    "dashboard.html": "dashboard", "inbox.html": "inbox",
    "contacts.html": "contacts", "send-message.html": "send_message",
    "templates.html": "templates", "wallet.html": "wallet",
    "reports.html": "reports", "integrations.html": "integrations",
    "chatbot.html": "chatbot", "partners.html": "partners"
  };
  var currentFile = (location.pathname.split("/").pop() || "").toLowerCase();
  var pageKey = PAGE_MAP[currentFile];
  if (!pageKey) return;
  var tok = localStorage.getItem("vbonotif_token") || "";
  if (!tok) return;

  function hideDisallowed(allowed) {
    var navLinks = document.querySelectorAll("nav a, .nav a");
    for (var i = 0; i < navLinks.length; i++) {
      var href = (navLinks[i].getAttribute("href") || "").split("?")[0].toLowerCase();
      var key = PAGE_MAP[href];
      if (!key) continue;
      if (key === "partners" || allowed.indexOf(key) < 0) {
        navLinks[i].style.display = "none";
      }
    }
  }

  // STEP 1: cached role (synchronous - no flash)
  var cachedRole = localStorage.getItem("vbonotif_role");
  if (cachedRole === "partner") {
    var cachedAllowed;
    try {
      cachedAllowed = JSON.parse(localStorage.getItem("vbonotif_allowed") || '["inbox"]');
    } catch (e) { cachedAllowed = ["inbox"]; }
    if (!Array.isArray(cachedAllowed) || !cachedAllowed.length) cachedAllowed = ["inbox"];
    if (pageKey === "partners" || cachedAllowed.indexOf(pageKey) < 0) {
      if (currentFile !== "inbox.html") { location.replace("inbox.html"); return; }
    }
    hideDisallowed(cachedAllowed);
  }

  // STEP 2: fresh check in background (owner may have changed permissions)
  fetch("https://app.vbo.co.in/api/v1/auth/me", { headers: { "Authorization": "Bearer " + tok } })
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(data) {
      if (!data) return;
      localStorage.setItem("vbonotif_role", data.role || "owner");
      localStorage.setItem("vbonotif_allowed", JSON.stringify(data.allowed_pages || null));
      if (data.role !== "partner") {
        var navLinks = document.querySelectorAll("nav a, .nav a");
        for (var i = 0; i < navLinks.length; i++) navLinks[i].style.display = "";
        return;
      }
      var allowed = data.allowed_pages || ["inbox"];
      hideDisallowed(allowed);
      if (pageKey === "partners" || allowed.indexOf(pageKey) < 0) {
        if (currentFile !== "inbox.html") location.replace("inbox.html");
      }
    }).catch(function() {});
})();
