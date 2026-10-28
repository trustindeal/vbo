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
  iframe.style.height = 'calc(100% - 30px)';
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

  window.location.href = "https://kwikkwash.com";
}

const PERFORMANCE_API = 'https://app.vbo.co.in/kwikkwash/bookings';
const performanceState = {
  bookings: null,
  branches: { Rampur: null, Moradabad: null },
  range: 'yearly',
  chartType: 'line'
};

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseApiDate(value) {
  if (!value) return null;
  const text = String(value).trim();
  const date = new Date(text.length === 10 ? `${text}T00:00:00` : text.replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildRangeBuckets(range) {
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

function getBookingDate(booking) {
  return parseApiDate(booking.booking_date || booking.created_at);
}

function bookingsInBuckets(bookings, buckets) {
  const start = buckets[0].start;
  const end = buckets[buckets.length - 1].end;
  return bookings.filter(booking => {
    const date = getBookingDate(booking);
    return date && date >= start && date <= end;
  });
}

function renderPerformanceGraphs(bookings, buckets, range) {
  const recentBookings = bookingsInBuckets(bookings, buckets);
  const countByBucket = cityBookings => buckets.map(bucket => (Array.isArray(cityBookings) ? cityBookings : []).filter(booking => {
    const date = getBookingDate(booking);
    return date && date >= bucket.start && date <= bucket.end;
  }).length);
  const rampurCounts = countByBucket(performanceState.branches.Rampur);
  const moradabadCounts = countByBucket(performanceState.branches.Moradabad);
  const rampurTotal = rampurCounts.reduce((sum, count) => sum + count, 0);
  const moradabadTotal = moradabadCounts.reduce((sum, count) => sum + count, 0);

  document.getElementById('bookingTrendLabel').textContent = `${range[0].toUpperCase()}${range.slice(1)} Bookings`;
  document.getElementById('rampurSeriesTotal').textContent = Array.isArray(performanceState.branches.Rampur) ? rampurTotal : '--';
  document.getElementById('moradabadSeriesTotal').textContent = Array.isArray(performanceState.branches.Moradabad) ? moradabadTotal : '--';
  const axis = document.getElementById('bookingsAxis');
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
  const gridLines = [0, 0.33, 0.66, 1].map(ratio => {
    const y = padTop + plotHeight * ratio;
    return `<line x1="${padX}" y1="${y}" x2="${width - padX}" y2="${y}" stroke="#edf0f2" stroke-width="1"/>`;
  }).join('');

  const groupWidth = (width - padX * 2) / buckets.length;
  const xAt = index => padX + groupWidth * (index + 0.5);
  const yAt = count => plotBottom - (count / maxValue) * plotHeight;
  const lineSeries = (counts, city, valueOffset) => {
    const points = counts.map((count, index) => ({ x: xAt(index), y: yAt(count), count }));
    const polyline = `<polyline class="partner-line ${city}" points="${points.map(point => `${point.x},${point.y}`).join(' ')}" fill="none" vector-effect="non-scaling-stroke"/>`;
    const markers = points.map(point => {
      const labelY = Math.min(height - 8, Math.max(14, point.y + valueOffset));
      return `<g class="partner-point ${city}">
        <text class="partner-point-value ${city}" x="${point.x}" y="${labelY}" text-anchor="middle">${point.count}</text>
        <circle class="partner-marker-halo ${city}" cx="${point.x}" cy="${point.y}" r="8"/>
        <circle class="partner-marker ${city}" cx="${point.x}" cy="${point.y}" r="4.5"/>
        <title>${city === 'rampur' ? 'Rampur' : 'Moradabad'}: ${point.count}</title>
      </g>`;
    }).join('');
    return polyline + markers;
  };

  const barSeries = () => {
    const barWidth = Math.min(18, groupWidth * 0.27);
    return buckets.map((bucket, index) => {
      const center = padX + groupWidth * (index + 0.5);
      return [
        { city: 'rampur', count: rampurCounts[index], x: center - barWidth - 3 },
        { city: 'moradabad', count: moradabadCounts[index], x: center + 3 }
      ].map(item => {
        const barHeight = item.count ? Math.max(3, (item.count / maxValue) * plotHeight) : 2;
        const y = plotBottom - barHeight;
        return `<g class="partner-bar-group ${item.city}">
          <rect class="partner-bar ${item.city}" x="${item.x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="4"/>
          <text class="partner-bar-value ${item.city}" x="${item.x + barWidth / 2}" y="${Math.max(14, y - 6)}" text-anchor="middle">${item.count}</text>
          <title>${item.city === 'rampur' ? 'Rampur' : 'Moradabad'}: ${item.count}</title>
        </g>`;
      }).join('');
    }).join('');
  };

  const chartContent = performanceState.chartType === 'bar'
    ? barSeries()
    : lineSeries(rampurCounts, 'rampur', -11) + lineSeries(moradabadCounts, 'moradabad', 18);

  document.getElementById('bookingsChart').innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
      ${gridLines}
      ${chartContent}
    </svg>`;
  document.getElementById('bookingsChart').setAttribute('aria-label', `${range} partner bookings: Rampur ${rampurTotal}, Moradabad ${moradabadTotal}`);

  const completedStatuses = new Set(['completed', 'complete', 'done', 'delivered']);
  const cancelledStatuses = new Set(['cancelled', 'canceled', 'rejected']);
  const completed = recentBookings.filter(item => completedStatuses.has(String(item.status || '').toLowerCase())).length;
  const cancelled = recentBookings.filter(item => cancelledStatuses.has(String(item.status || '').toLowerCase())).length;
  const active = Math.max(0, recentBookings.length - completed - cancelled);
  const total = recentBookings.length;
  const completionRate = total ? Math.round((completed / total) * 100) : 0;
  const completedAngle = total ? (completed / total) * 360 : 0;
  const activeAngle = total ? completedAngle + (active / total) * 360 : 0;
  const donut = document.getElementById('statusDonut');

  donut.style.setProperty('--completed-angle', `${completedAngle}deg`);
  donut.style.setProperty('--active-angle', `${activeAngle}deg`);
  donut.style.background = total ? '' : '#e5e7eb';
  document.getElementById('completionRate').textContent = `${completionRate}%`;
  document.getElementById('donutTotal').textContent = total;
  document.getElementById('completedCount').textContent = completed;
  document.getElementById('activeCountGraph').textContent = active;
  document.getElementById('cancelledCount').textContent = cancelled;
}

function renderPerformanceDashboard() {
  const buckets = buildRangeBuckets(performanceState.range);
  renderPerformanceGraphs(performanceState.bookings || [], buckets, performanceState.range);
}

async function fetchBranchBookings(city) {
  const response = await fetch(`${PERFORMANCE_API}?city=${encodeURIComponent(city)}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  const bookings = Array.isArray(payload) ? payload : (Array.isArray(payload.data) ? payload.data : []);
  const hasCityValues = bookings.some(item => item.city);
  return hasCityValues
    ? bookings.filter(item => String(item.city || '').trim().toLowerCase() === city.toLowerCase())
    : bookings;
}

async function initPerformanceGraphs() {
  const city = document.body.dataset.city;
  const chart = document.getElementById('bookingsChart');
  if (!city || !chart) return;

  const rangeSelect = document.getElementById('performanceRange');
  rangeSelect.addEventListener('change', () => {
    performanceState.range = rangeSelect.value;
    renderPerformanceDashboard();
  });
  document.querySelectorAll('.chart-type-button').forEach(button => {
    button.addEventListener('click', () => {
      performanceState.chartType = button.dataset.chartType;
      document.querySelectorAll('.chart-type-button').forEach(item => {
        const isActive = item === button;
        item.classList.toggle('active', isActive);
        item.setAttribute('aria-pressed', String(isActive));
      });
      renderPerformanceDashboard();
    });
  });

  const cities = ['Rampur', 'Moradabad'];
  const results = await Promise.allSettled(cities.map(fetchBranchBookings));
  results.forEach((result, index) => {
    performanceState.branches[cities[index]] = result.status === 'fulfilled' ? result.value : null;
  });

  performanceState.bookings = performanceState.branches[city] || null;
  renderPerformanceDashboard();

  if (!Array.isArray(performanceState.bookings)) {
    document.getElementById('completionRate').textContent = '--';
    document.getElementById('statusDonut').style.background = '#e5e7eb';
  }
}

window.addEventListener('load', () => {
  initTabs();
  initPerformanceGraphs();
});
