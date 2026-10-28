function toggleOptions(clickedBtn) {
  const allDropdowns = document.querySelectorAll(".dropdown-options");
  allDropdowns.forEach(drop => {
    if (drop !== clickedBtn.nextElementSibling) drop.classList.remove("show");
  });
  const drop = clickedBtn.nextElementSibling;
  drop.classList.toggle("show");
}

function playErrorSound() {
  document.getElementById("errorSound").play();
  const popup = document.getElementById("popupMessage");
  popup.classList.add("show");
  setTimeout(() => popup.classList.remove("show"), 2000);
}

// Tab System
let tabIdCounter = 0;
const tabs = [];

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
  if (url.includes('docs.google.com/spreadsheets') ||
      url.includes('del-desk.excitel.in') ||
      url.includes('partners.denonline.in')) {

    window.open(url, '_blank');
    return;
  }

  const tabId = tabIdCounter++;
  const tabBtn = document.createElement('div');
  tabBtn.className = 'tab-btn';
  tabBtn.textContent = title;

  const closeSpan = document.createElement('span');
  closeSpan.className = 'close-tab';
  closeSpan.textContent = '×';
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
  iframe.src = url;
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = 'none';
  iframe.style.display = 'block';

  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation allow-downloads allow-web-share');

  iframe.onload = function() {};

  iframe.onerror = function() {
    contentDiv.innerHTML = '';
    const fallbackLink = document.createElement('a');
    fallbackLink.href = url;
    fallbackLink.target = '_blank';
    fallbackLink.textContent = 'This site cannot be displayed in frame. Click to open in new tab.';
    fallbackLink.style.display = 'block';
    fallbackLink.style.padding = '20px';
    fallbackLink.style.textAlign = 'center';
    contentDiv.appendChild(fallbackLink);
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
  const domain = window.location.hostname;

  document.cookie.split(";").forEach(function(c) {
    if (c.trim().split("=")[0].includes(domain)) {
      document.cookie =
        c.trim().split("=")[0] +
        "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=" + domain;
    }
  });

  localStorage.clear();
  sessionStorage.clear();

  window.location.href = "https://vbo.co.in";
}

const ADMIN_BOOKINGS_API = 'https://app.vbo.co.in/kwikkwash/bookings';
const adminAnalyticsState = {
  branches: { Rampur: null, Moradabad: null },
  range: 'yearly',
  chartType: 'line'
};

function parseAdminDate(value) {
  if (!value) return null;
  const text = String(value).trim();
  const date = new Date(text.length === 10 ? `${text}T00:00:00` : text.replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildAdminBuckets(range) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (range === 'yearly') {
    return Array.from({ length: 12 }, (_, index) => {
      const start = new Date(today.getFullYear(), today.getMonth() - (11 - index), 1);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
      return { start, end, label: start.toLocaleDateString('en-IN', { month: 'short' }) };
    });
  }

  const settings = range === 'monthly'
    ? { count: 6, days: 5 }
    : range === 'quarterly'
      ? { count: 13, days: 7 }
      : { count: 7, days: 1 };
  const periodStart = new Date(today);
  periodStart.setDate(periodStart.getDate() - (settings.count * settings.days - 1));

  return Array.from({ length: settings.count }, (_, index) => {
    const start = new Date(periodStart);
    start.setDate(start.getDate() + index * settings.days);
    const end = new Date(start);
    end.setDate(end.getDate() + settings.days - 1);
    end.setHours(23, 59, 59, 999);
    const label = range === 'weekly'
      ? start.toLocaleDateString('en-IN', { weekday: 'short' })
      : range === 'quarterly'
        ? `W${index + 1}`
        : start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    return { start, end, label };
  });
}

function getAdminBookingDate(booking) {
  return parseAdminDate(booking.booking_date || booking.created_at);
}

function adminBookingsInRange(bookings, buckets) {
  const start = buckets[0].start;
  const end = buckets[buckets.length - 1].end;
  return (Array.isArray(bookings) ? bookings : []).filter(booking => {
    const date = getAdminBookingDate(booking);
    return date && date >= start && date <= end;
  });
}

function adminCountsByBucket(bookings, buckets) {
  return buckets.map(bucket => (Array.isArray(bookings) ? bookings : []).filter(booking => {
    const date = getAdminBookingDate(booking);
    return date && date >= bucket.start && date <= bucket.end;
  }).length);
}

function renderAdminTrend(buckets) {
  const rampurCounts = adminCountsByBucket(adminAnalyticsState.branches.Rampur, buckets);
  const moradabadCounts = adminCountsByBucket(adminAnalyticsState.branches.Moradabad, buckets);
  const rampurTotal = rampurCounts.reduce((sum, count) => sum + count, 0);
  const moradabadTotal = moradabadCounts.reduce((sum, count) => sum + count, 0);
  const rangeLabel = `${adminAnalyticsState.range[0].toUpperCase()}${adminAnalyticsState.range.slice(1)} Bookings`;

  document.getElementById('adminTrendLabel').textContent = rangeLabel;
  document.getElementById('adminRampurTotal').textContent = Array.isArray(adminAnalyticsState.branches.Rampur) ? rampurTotal : '--';
  document.getElementById('adminMoradabadTotal').textContent = Array.isArray(adminAnalyticsState.branches.Moradabad) ? moradabadTotal : '--';

  const axis = document.getElementById('adminChartAxis');
  axis.style.gridTemplateColumns = `repeat(${buckets.length}, 1fr)`;
  axis.innerHTML = buckets.map(bucket => `<span>${bucket.label}</span>`).join('');

  const width = 700;
  const height = 180;
  const padX = 36;
  const padTop = 30;
  const padBottom = 50;
  const plotBottom = height - padBottom;
  const plotHeight = plotBottom - padTop;
  const maxValue = Math.max(...rampurCounts, ...moradabadCounts, 1);
  const groupWidth = (width - padX * 2) / buckets.length;
  const xAt = index => padX + groupWidth * (index + 0.5);
  const yAt = count => plotBottom - (count / maxValue) * plotHeight;
  const gridLines = [0, 0.33, 0.66, 1].map(ratio => {
    const y = padTop + plotHeight * ratio;
    return `<line x1="${padX}" y1="${y}" x2="${width - padX}" y2="${y}" stroke="#e8edf2" stroke-width="1"/>`;
  }).join('');

  const lineSeries = (counts, city, valueOffset) => {
    const points = counts.map((count, index) => ({ x: xAt(index), y: yAt(count), count }));
    const line = `<polyline class="admin-partner-line ${city}" points="${points.map(point => `${point.x},${point.y}`).join(' ')}" fill="none" vector-effect="non-scaling-stroke"/>`;
    const markers = points.map(point => {
      const labelY = Math.min(height - 8, Math.max(14, point.y + valueOffset));
      return `<g>
        <text class="admin-point-value ${city}" x="${point.x}" y="${labelY}" text-anchor="middle">${point.count}</text>
        <circle class="admin-marker-halo ${city}" cx="${point.x}" cy="${point.y}" r="8"/>
        <circle class="admin-marker ${city}" cx="${point.x}" cy="${point.y}" r="4.5"/>
        <title>${city === 'rampur' ? 'Rampur' : 'Moradabad'}: ${point.count}</title>
      </g>`;
    }).join('');
    return line + markers;
  };

  const barSeries = () => {
    const barWidth = Math.min(18, groupWidth * 0.27);
    return buckets.map((bucket, index) => {
      const center = xAt(index);
      return [
        { city: 'rampur', count: rampurCounts[index], x: center - barWidth - 3 },
        { city: 'moradabad', count: moradabadCounts[index], x: center + 3 }
      ].map(item => {
        const barHeight = item.count ? Math.max(3, (item.count / maxValue) * plotHeight) : 2;
        const y = plotBottom - barHeight;
        return `<g>
          <rect class="admin-partner-bar ${item.city}" x="${item.x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="4"/>
          <text class="admin-bar-value ${item.city}" x="${item.x + barWidth / 2}" y="${Math.max(14, y - 6)}" text-anchor="middle">${item.count}</text>
          <title>${item.city === 'rampur' ? 'Rampur' : 'Moradabad'}: ${item.count}</title>
        </g>`;
      }).join('');
    }).join('');
  };

  const chartContent = adminAnalyticsState.chartType === 'bar'
    ? barSeries()
    : lineSeries(rampurCounts, 'rampur', -11) + lineSeries(moradabadCounts, 'moradabad', 18);
  const chart = document.getElementById('adminTrendChart');
  chart.innerHTML = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">${gridLines}${chartContent}</svg>`;
  chart.setAttribute('aria-label', `${rangeLabel}: Rampur ${rampurTotal}, Moradabad ${moradabadTotal}`);
}

function renderAdminDonut(city, bookings, buckets) {
  const prefix = city.toLowerCase();
  const recent = adminBookingsInRange(bookings, buckets);
  const completedStatuses = new Set(['completed', 'complete', 'done', 'delivered']);
  const cancelledStatuses = new Set(['cancelled', 'canceled', 'rejected']);
  const completed = recent.filter(item => completedStatuses.has(String(item.status || '').toLowerCase())).length;
  const cancelled = recent.filter(item => cancelledStatuses.has(String(item.status || '').toLowerCase())).length;
  const active = Math.max(0, recent.length - completed - cancelled);
  const total = recent.length;
  const completedAngle = total ? (completed / total) * 360 : 0;
  const activeAngle = total ? completedAngle + (active / total) * 360 : 0;
  const donut = document.getElementById(`${prefix}Donut`);

  donut.style.setProperty('--completed-angle', `${completedAngle}deg`);
  donut.style.setProperty('--active-angle', `${activeAngle}deg`);
  donut.classList.toggle('empty', !total);
  donut.setAttribute('aria-label', `${city}: ${completed} completed, ${active} active, ${cancelled} cancelled`);
  document.getElementById(`${prefix}DonutTotal`).textContent = Array.isArray(bookings) ? total : '--';
  document.getElementById(`${prefix}Completed`).textContent = Array.isArray(bookings) ? completed : '--';
  document.getElementById(`${prefix}Active`).textContent = Array.isArray(bookings) ? active : '--';
  document.getElementById(`${prefix}Cancelled`).textContent = Array.isArray(bookings) ? cancelled : '--';
}

function renderAdminAnalytics() {
  const buckets = buildAdminBuckets(adminAnalyticsState.range);
  renderAdminTrend(buckets);
  renderAdminDonut('Rampur', adminAnalyticsState.branches.Rampur, buckets);
  renderAdminDonut('Moradabad', adminAnalyticsState.branches.Moradabad, buckets);
}

async function fetchAdminBranchBookings(city) {
  const response = await fetch(`${ADMIN_BOOKINGS_API}?city=${encodeURIComponent(city)}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  const bookings = Array.isArray(payload) ? payload : (Array.isArray(payload.data) ? payload.data : []);
  const hasCityValues = bookings.some(item => item.city);
  return hasCityValues
    ? bookings.filter(item => String(item.city || '').trim().toLowerCase() === city.toLowerCase())
    : bookings;
}

async function initAdminAnalytics() {
  const chart = document.getElementById('adminTrendChart');
  if (!chart) return;

  const rangeSelect = document.getElementById('analyticsRange');
  rangeSelect.addEventListener('change', () => {
    adminAnalyticsState.range = rangeSelect.value;
    renderAdminAnalytics();
  });

  document.querySelectorAll('.admin-chart-button').forEach(button => {
    button.addEventListener('click', () => {
      adminAnalyticsState.chartType = button.dataset.adminChart;
      document.querySelectorAll('.admin-chart-button').forEach(item => {
        const active = item === button;
        item.classList.toggle('active', active);
        item.setAttribute('aria-pressed', String(active));
      });
      renderAdminAnalytics();
    });
  });

  const cities = ['Rampur', 'Moradabad'];
  const results = await Promise.allSettled(cities.map(fetchAdminBranchBookings));
  results.forEach((result, index) => {
    adminAnalyticsState.branches[cities[index]] = result.status === 'fulfilled' ? result.value : null;
  });

  if (results.every(result => result.status === 'rejected')) {
    chart.innerHTML = '<span class="analytics-empty">Performance data unavailable</span>';
    document.getElementById('adminChartAxis').innerHTML = '';
  } else {
    renderAdminAnalytics();
  }
}

window.addEventListener('load', () => {
  initTabs();
  initAdminAnalytics();
});
