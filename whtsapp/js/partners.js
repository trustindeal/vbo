(function(){
  var API = "https://app.vbo.co.in/api/v1/auth";
  var PAGES = [
    { key: "inbox",        label: "Inbox",              locked: true  },
    { key: "dashboard",    label: "Dashboard",          locked: false },
    { key: "contacts",     label: "Contacts",           locked: false },
    { key: "send_message", label: "Send Message",       locked: false },
    { key: "templates",    label: "Templates",          locked: false },
    { key: "wallet",       label: "Wallet / Credits",   locked: false },
    { key: "reports",      label: "Reports",            locked: false },
    { key: "integrations", label: "API & Integrations", locked: false },
    { key: "chatbot",      label: "Chatbot",            locked: false }
  ];
  var CURRENT = null;

  function tok() { return localStorage.getItem("vbonotif_token") || ""; }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function(m) {
      return { "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#39;" }[m];
    });
  }

  function showMsg(text, ok) {
    var el = document.getElementById("pl-msg");
    el.textContent = text;
    el.className = "pl-msg on " + (ok ? "ok" : "err");
    setTimeout(function(){ el.className = "pl-msg"; }, 4000);
  }

  function apiCall(path, opts) {
    opts = opts || {};
    var headers = Object.assign({
      "Authorization": "Bearer " + tok(),
      "Content-Type": "application/json"
    }, opts.headers || {});
    return fetch(API + path, { method: opts.method || "GET", headers: headers, body: opts.body })
      .then(function(r) {
        return r.text().then(function(t) {
          var data = {};
          try { data = JSON.parse(t); } catch (e) {}
          if (!r.ok) throw new Error(data.detail || ("HTTP " + r.status));
          return data;
        });
      });
  }

  function renderChips(pages) {
    if (!pages || !pages.length) return '<span class="pl-chip empty">—</span>';
    return '<div class="pl-chips">' + pages.map(function(k) {
      var isLocked = (k === "inbox");
      return '<span class="pl-chip' + (isLocked ? ' locked' : '') + '">' + esc(k.replace("_", " ")) + '</span>';
    }).join("") + '</div>';
  }

  function load() {
    var body = document.getElementById("pl-body");
    var cnt = document.getElementById("pl-count");
    var refreshBtn = document.getElementById("pl-refresh-btn");
    if (refreshBtn) refreshBtn.disabled = true;

    apiCall("/partner-logins").then(function(d) {
      var list = d.partners || [];
      if (cnt) cnt.textContent = list.length + " partner" + (list.length === 1 ? "" : "s");
      if (!list.length) {
        body.innerHTML = '<div class="pl-skeleton">Koi partner nahi mila. Kwikkwash API check karo.</div>';
        return;
      }
      var html = '<table class="pl"><thead><tr>' +
        '<th>Partner</th><th>City</th><th>Phone</th><th>Username</th>' +
        '<th>Access</th><th>Status</th><th>Actions</th>' +
        '</tr></thead><tbody>';
      list.forEach(function(p) {
        var payload = JSON.stringify(p).replace(/'/g, "&#39;");
        var actions = '<button class="btn-pl btn-pl-primary" onclick=\'plOpenModal(' + payload + ')\'>' + (p.has_login ? "Edit" : "Create") + '</button>';
        if (p.has_login) {
          actions += ' <button class="btn-pl btn-pl-ghost" onclick="plDelete(\'' + esc(p.partner_code) + '\')">Delete</button>';
        }
        var status = p.has_login
          ? '<span class="pl-status active">Active</span>'
          : '<span class="pl-status none">No Login</span>';
        var uname = p.username
          ? '<span class="pl-username">' + esc(p.username) + '</span>'
          : '<span class="pl-empty">—</span>';
        var access = p.has_login ? renderChips(p.allowed_pages || ["inbox"]) : '<span class="pl-empty">—</span>';
        html += '<tr>' +
          '<td><span class="pl-fname">' + esc(p.franchise_name || "-") + '</span></td>' +
          '<td><span class="pl-city">' + esc(p.city || "-") + '</span></td>' +
          '<td>' + esc(p.phone || "-") + '</td>' +
          '<td>' + uname + '</td>' +
          '<td>' + access + '</td>' +
          '<td>' + status + '</td>' +
          '<td><div class="pl-actions">' + actions + '</div></td>' +
          '</tr>';
      });
      html += '</tbody></table>';
      body.innerHTML = html;
    }).catch(function(e) {
      body.innerHTML = '<div class="pl-skeleton">Error: ' + esc(e.message) + '</div>';
    }).then(function() {
      if (refreshBtn) refreshBtn.disabled = false;
    });
  }

  window.plLoad = load;

  window.plOpenModal = function(p) {
    CURRENT = p;
    document.getElementById("pl-modal-title").textContent = p.has_login ? "Edit Login" : "Create Login";
    document.getElementById("pl-modal-info").textContent = (p.franchise_name || "") + " \u2022 " + (p.city || "") + " \u2022 " + (p.phone || "");
    document.getElementById("pl-username").value = p.username || "";
    document.getElementById("pl-password").value = "";
    var wrap = document.getElementById("pl-pages-wrap");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "pl-pages-wrap";
      wrap.style.cssText = "margin: 10px 0 12px;";
      var pwd = document.getElementById("pl-password");
      pwd.parentNode.insertBefore(wrap, pwd.nextSibling);
    }
    var allowed = p.allowed_pages || ["inbox"];
    var parts = ['<div class="pg-title">Menu Access <span class="pg-hint">(Inbox always on)</span></div>', '<div class="pg-list">'];
    PAGES.forEach(function(pg) {
      var checked = (pg.locked || allowed.indexOf(pg.key) >= 0) ? " checked" : "";
      var disabled = pg.locked ? " disabled" : "";
      var cls = pg.locked ? "pg-item pg-locked" : "pg-item";
      parts.push('<label class="' + cls + '"><input type="checkbox" data-page="' + pg.key + '"' + checked + disabled + '><span>' + pg.label + '</span></label>');
    });
    parts.push('</div>');
    wrap.innerHTML = parts.join("");
    document.getElementById("pl-modal").classList.add("on");
  };

  window.plCloseModal = function() {
    document.getElementById("pl-modal").classList.remove("on");
    CURRENT = null;
  };

  window.plSave = function() {
    if (!CURRENT) return;
    var u = document.getElementById("pl-username").value.trim();
    var p = document.getElementById("pl-password").value;
    if (!u || p.length < 6) { showMsg("Username required; password min 6 chars", false); return; }
    var allowed_pages = ["inbox"];
    var checks = document.querySelectorAll("#pl-pages-wrap input[type=checkbox]");
    for (var i = 0; i < checks.length; i++) {
      if (checks[i].checked && allowed_pages.indexOf(checks[i].dataset.page) < 0) {
        allowed_pages.push(checks[i].dataset.page);
      }
    }
    var btn = document.getElementById("pl-save-btn");
    btn.disabled = true; btn.textContent = "Saving...";
    apiCall("/partner-logins", {
      method: "POST",
      body: JSON.stringify({ partner_code: CURRENT.partner_code, username: u, password: p, allowed_pages: allowed_pages })
    }).then(function() {
      showMsg("Saved", true);
      plCloseModal();
      load();
    }).catch(function(e) {
      showMsg("Error: " + e.message, false);
    }).then(function() {
      btn.disabled = false; btn.textContent = "Save";
    });
  };

  window.plDelete = function(code) {
    if (!confirm("Delete login for partner " + code + "? Partner won't be able to log in.")) return;
    apiCall("/partner-logins/" + encodeURIComponent(code), { method: "DELETE" }).then(function() {
      showMsg("Deleted", true);
      load();
    }).catch(function(e) {
      showMsg("Error: " + e.message, false);
    });
  };

  if (!tok()) { window.location.href = "index.html"; return; }
  load();
})();
