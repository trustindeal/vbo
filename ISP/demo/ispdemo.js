function toggleOptions(clickedBtn) {
  const allDropdowns = document.querySelectorAll(".dropdown-options");
  allDropdowns.forEach(drop => {
    if (drop !== clickedBtn.nextElementSibling) drop.classList.remove("show");
  });
  const drop = clickedBtn.nextElementSibling;
  drop.classList.toggle("show");
}

function playErrorSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.value = 420;
    gain.gain.value = 0.08;

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.12);
  } catch (error) {}

  const popup = document.getElementById("popupMessage");
  popup.classList.add("show");
  setTimeout(() => popup.classList.remove("show"), 2000);
}

function showComingSoon() {
  const popup = document.getElementById("popupMessage");
  popup.classList.add("show");
  setTimeout(() => popup.classList.remove("show"), 2000);
}

function showAccessPopup(title) {
  const popup = document.getElementById("accessPopup");
  const popupTitle = document.getElementById("accessPopupTitle");

  popupTitle.textContent = title;
  popup.classList.add("show");
}

function hideAccessPopup() {
  document.getElementById("accessPopup").classList.remove("show");
}

function closeAccessPopup(event) {
  if (event.target.id === "accessPopup") {
    hideAccessPopup();
  }
}

// Tab System
let tabIdCounter = 0;
const tabs = [];

function normalizeFrameUrl(url) {
  try {
    const normalizedUrl = new URL(url, window.location.href);

    if (window.location.protocol === 'https:' && normalizedUrl.protocol === 'http:') {
      normalizedUrl.protocol = 'https:';
    }

    return normalizedUrl.href;
  } catch (error) {
    return url;
  }
}

function showFrameFallback(contentDiv, url) {
  contentDiv.innerHTML = '';

  const fallbackWrap = document.createElement('div');
  fallbackWrap.className = 'frame-fallback';

  const message = document.createElement('p');
  message.textContent = 'This page cannot be displayed here. Open it in a new tab.';

  const fallbackLink = document.createElement('a');
  fallbackLink.href = url;
  fallbackLink.target = '_blank';
  fallbackLink.rel = 'noopener noreferrer';
  fallbackLink.textContent = 'Open page';

  fallbackWrap.appendChild(message);
  fallbackWrap.appendChild(fallbackLink);
  contentDiv.appendChild(fallbackWrap);
}

function initTabs() {
  const homeId = tabIdCounter++;
  const homeBtn = document.createElement('div');
  homeBtn.className = 'tab-btn active';
  homeBtn.textContent = 'Home';
  homeBtn.onclick = () => switchTab(homeId);
  document.getElementById('tab-bar').appendChild(homeBtn);

  const homeContent = document.getElementById('home-content');
  homeContent.classList.add('tab-content', 'active');

  tabs.push({id: homeId, btn: homeBtn, content: homeContent, isHome: true});
}

function openTab(url, title) {
  const frameUrl = normalizeFrameUrl(url);

  if (url.includes('docs.google.com/spreadsheets')) {

    window.open(frameUrl, '_blank', 'noopener,noreferrer');
    return;
  }

  const tabId = tabIdCounter++;
  const tabBtn = document.createElement('div');
  tabBtn.className = 'tab-btn';
  tabBtn.textContent = title;

  const closeSpan = document.createElement('span');
  closeSpan.className = 'close-tab';
  closeSpan.textContent = 'x';
  closeSpan.onclick = (e) => {
    e.stopPropagation();
    closeTab(tabId);
  };

  tabBtn.appendChild(closeSpan);
  tabBtn.onclick = () => switchTab(tabId);

  document.getElementById('tab-bar').appendChild(tabBtn);

  const contentDiv = document.createElement('div');
  contentDiv.className = 'tab-content';
  contentDiv.style.position = 'absolute';
  contentDiv.style.top = '0';
  contentDiv.style.left = '0';
  contentDiv.style.width = '100%';
  contentDiv.style.height = '100%';
  contentDiv.style.display = 'none';
  contentDiv.style.overflow = 'auto';

  const iframe = document.createElement('iframe');
  iframe.src = frameUrl;
  iframe.style.width = '100%';
  iframe.style.height = 'calc(100% - 30px)';
  iframe.style.border = 'none';
  iframe.style.display = 'block';

  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation allow-downloads');

  iframe.onload = function() {};

  iframe.onerror = function() {
    showFrameFallback(contentDiv, frameUrl);
  };

  contentDiv.appendChild(iframe);
  document.getElementById('tab-contents').appendChild(contentDiv);

  tabs.push({id: tabId, btn: tabBtn, content: contentDiv, isHome: false});
  switchTab(tabId);
}

function switchTab(tabId) {
  tabs.forEach(tab => {
    tab.content.style.display = 'none';
    tab.btn.classList.remove('active');
    tab.content.classList.remove('active');
  });

  const tab = tabs.find(t => t.id === tabId);
  if (tab) {
    tab.content.style.display = 'block';
    tab.btn.classList.add('active');
    tab.content.classList.add('active');
  }
}

function closeTab(tabId) {
  const index = tabs.findIndex(t => t.id === tabId);
  if (index === -1 || tabs[index].isHome) return;

  const tab = tabs[index];
  tab.content.style.opacity = '0';
  tab.content.style.transform = 'translateX(20px)';
  tab.btn.style.opacity = '0';
  tab.btn.style.transform = 'translateX(20px)';

  setTimeout(() => {
    tab.btn.remove();
    tab.content.remove();
    tabs.splice(index, 1);

    if (tabs.length > 0) {
      switchTab(tabs[Math.max(0, index - 1)].id);
    }
  }, 800);
}

function logout() {
  localStorage.clear();
  sessionStorage.clear();
  showComingSoon();
}

window.addEventListener('load', () => {
  initTabs();
});
