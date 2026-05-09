let tabIdCounter = 0;
const tabs = [];
let toastTimer;
let sidebarAnimationTimer;
const SIDEBAR_STATE_KEY = "fieldmanager-desktop-sidebar-collapsed";

function isDesktopViewport() {
  return window.innerWidth > 920;
}

function toggleOptions(clickedBtn) {
  if (isDesktopSidebarCollapsed()) {
    setDesktopSidebarState(false);
    return;
  }

  const allButtons = document.querySelectorAll(".menu-toggle");
  const allDropdowns = document.querySelectorAll(".dropdown-options");
  const currentDropdown = clickedBtn.nextElementSibling;
  const isOpen = currentDropdown.classList.contains("show");

  allDropdowns.forEach((dropdown) => dropdown.classList.remove("show"));
  allButtons.forEach((button) => button.setAttribute("aria-expanded", "false"));

  if (!isOpen) {
    currentDropdown.classList.add("show");
    clickedBtn.setAttribute("aria-expanded", "true");
  }
}

function toggleDrawer() {
  const isOpen = document.body.classList.toggle("drawer-open");
  const toggleButton = document.querySelector(".drawer-toggle");
  if (toggleButton) {
    toggleButton.setAttribute("aria-expanded", String(isOpen));
  }
}

function closeDrawer() {
  document.body.classList.remove("drawer-open");
  const toggleButton = document.querySelector(".drawer-toggle");
  if (toggleButton) {
    toggleButton.setAttribute("aria-expanded", "false");
  }
}

function setDesktopSidebarState(collapsed) {
  if (!isDesktopViewport()) {
    document.body.classList.remove("desktop-sidebar-collapsed", "desktop-sidebar-expanded-animating", "desktop-sidebar-collapsing");
    localStorage.setItem(SIDEBAR_STATE_KEY, collapsed ? "true" : "false");
    return;
  }

  document.body.classList.remove("desktop-sidebar-expanded-animating", "desktop-sidebar-collapsing");
  document.body.classList.add(collapsed ? "desktop-sidebar-collapsing" : "desktop-sidebar-expanded-animating");
  document.body.classList.toggle("desktop-sidebar-collapsed", collapsed);
  const railToggle = document.querySelector(".sidebar-rail-toggle");
  if (railToggle) {
    railToggle.setAttribute("aria-expanded", String(!collapsed));
    railToggle.setAttribute("aria-label", collapsed ? "Expand navigation" : "Collapse navigation");
    railToggle.innerHTML = collapsed
      ? '<i class="bi bi-chevron-right"></i>'
      : '<i class="bi bi-chevron-left"></i>';
  }
  localStorage.setItem(SIDEBAR_STATE_KEY, collapsed ? "true" : "false");
  clearTimeout(sidebarAnimationTimer);
  sidebarAnimationTimer = setTimeout(() => {
    document.body.classList.remove("desktop-sidebar-expanded-animating", "desktop-sidebar-collapsing");
  }, 560);
}

function toggleDesktopSidebar() {
  const collapsed = !document.body.classList.contains("desktop-sidebar-collapsed");
  setDesktopSidebarState(collapsed);
}

function isDesktopSidebarCollapsed() {
  return isDesktopViewport() && document.body.classList.contains("desktop-sidebar-collapsed");
}

function showToast(message) {
  const popup = document.getElementById("popupMessage");
  popup.querySelector("span").textContent = message;
  popup.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    popup.classList.remove("show");
  }, 2200);
}

function playErrorSound() {
  const sound = document.getElementById("errorSound");
  if (sound && sound.getAttribute("src")) {
    sound.currentTime = 0;
    sound.play().catch(() => {});
  }
  showToast("Coming soon");
}

function initTabs() {
  const homeId = tabIdCounter++;
  const homeBtn = document.createElement("button");
  homeBtn.className = "tab-btn active";
  homeBtn.type = "button";
  homeBtn.textContent = "Home";
  homeBtn.onclick = () => switchTab(homeId);

  const homeContent = document.getElementById("home-content");
  homeContent.classList.add("active");

  document.getElementById("tab-bar").appendChild(homeBtn);
  tabs.push({ id: homeId, btn: homeBtn, content: homeContent, isHome: true });
}

function createBlockedContent(url, title) {
  const contentDiv = document.createElement("section");
  contentDiv.className = "tab-content";
  contentDiv.innerHTML =
    '<div class="fallback-panel"><div class="fallback-copy"><h3>' +
    title +
    '</h3><p>This page cannot be displayed inside the workspace because the site is not supported. Click below to open it in your browser instead.</p><a class="fallback-link" href="' +
    url +
    '" target="_blank" rel="noopener noreferrer">Open page</a></div></div>';
  return contentDiv;
}

function handleMenuLinkClick(event, url, title) {
  event.preventDefault();
  if (isDesktopSidebarCollapsed()) {
    setDesktopSidebarState(false);
    return false;
  }
  openTab(url, title);
  return false;
}

function openTab(url, title) {
  const existingTab = tabs.find((tab) => !tab.isHome && tab.url === url);
  if (existingTab) {
    switchTab(existingTab.id);
    closeDrawer();
    return;
  }

  const tabId = tabIdCounter++;
  const tabBtn = document.createElement("button");
  tabBtn.className = "tab-btn";
  tabBtn.type = "button";
  tabBtn.onclick = () => switchTab(tabId);
  tabBtn.append(document.createTextNode(title));

  const closeSpan = document.createElement("span");
  closeSpan.className = "close-tab";
  closeSpan.textContent = "x";
  closeSpan.onclick = (event) => {
    event.stopPropagation();
    closeTab(tabId);
  };

  tabBtn.appendChild(closeSpan);
  document.getElementById("tab-bar").appendChild(tabBtn);

  const blockedHosts = ["google.com", "docs.google.com"];
  const shouldUseFallback = blockedHosts.some((host) => url.includes(host));

  let contentDiv;
  if (shouldUseFallback) {
    contentDiv = createBlockedContent(url, title);
  } else {
    contentDiv = document.createElement("section");
    contentDiv.className = "tab-content";

    const iframe = document.createElement("iframe");
    iframe.className = "tab-frame";
    iframe.src = url;
    iframe.title = title;
    iframe.setAttribute(
      "sandbox",
      "allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation allow-downloads"
    );

    iframe.onerror = function () {
      const fallbackContent = createBlockedContent(url, title);
      contentDiv.replaceChildren(...fallbackContent.childNodes);
    };

    contentDiv.appendChild(iframe);
  }

  document.getElementById("tab-contents").appendChild(contentDiv);

  tabs.push({ id: tabId, btn: tabBtn, content: contentDiv, isHome: false, url });
  switchTab(tabId);
  closeDrawer();
}

function switchTab(tabId) {
  tabs.forEach((tab) => {
    tab.content.style.display = "none";
    tab.content.classList.remove("active");
    tab.btn.classList.remove("active");
  });

  const activeTab = tabs.find((tab) => tab.id === tabId);
  if (!activeTab) {
    return;
  }

  activeTab.content.style.display = "block";
  activeTab.content.classList.add("active");
  activeTab.btn.classList.add("active");
}

function closeTab(tabId) {
  const index = tabs.findIndex((tab) => tab.id === tabId);
  if (index === -1 || tabs[index].isHome) {
    return;
  }

  const closingTab = tabs[index];
  closingTab.btn.remove();
  closingTab.content.remove();
  tabs.splice(index, 1);

  const fallbackTab = tabs[Math.max(index - 1, 0)];
  if (fallbackTab) {
    switchTab(fallbackTab.id);
  }
}

function logout() {
  localStorage.clear();
  sessionStorage.clear();
  window.location.href = "https://vbo.co.in";
}

function bindComingSoon() {
  document.querySelectorAll("[data-coming-soon='true']").forEach((button) => {
    button.addEventListener("click", () => {
      if (isDesktopSidebarCollapsed()) {
        setDesktopSidebarState(false);
        return;
      }
      playErrorSound();
      closeDrawer();
    });
  });
}

window.addEventListener("click", (event) => {
  if (!event.target.closest(".menu-card")) {
    document.querySelectorAll(".dropdown-options").forEach((dropdown) => dropdown.classList.remove("show"));
    document.querySelectorAll(".menu-toggle").forEach((button) => button.setAttribute("aria-expanded", "false"));
  }
});

window.addEventListener("load", () => {
  const savedSidebarState = localStorage.getItem(SIDEBAR_STATE_KEY);
  setDesktopSidebarState(savedSidebarState === "true");
  initTabs();
  bindComingSoon();
});

window.addEventListener("resize", () => {
  if (!isDesktopViewport()) {
    document.body.classList.remove("desktop-sidebar-collapsed", "desktop-sidebar-expanded-animating", "desktop-sidebar-collapsing");
    closeDrawer();
    return;
  }

  const savedSidebarState = localStorage.getItem(SIDEBAR_STATE_KEY);
  document.body.classList.remove("desktop-sidebar-expanded-animating", "desktop-sidebar-collapsing");
  document.body.classList.toggle("desktop-sidebar-collapsed", savedSidebarState === "true");
});
