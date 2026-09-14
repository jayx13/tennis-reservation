import { availableParkNames, buildAvailabilityHierarchy, isWeekendDate, venueKey, matchesRegion, availabilityHealth, dateSlotCounts } from "./filters.js";

const els = {
  health: document.querySelector("#health"),
  slotCount: document.querySelector("#slotCount"),
  facilityCount: document.querySelector("#facilityCount"),
  facilityMetricLabel: document.querySelector("#facilityMetricLabel"),
  lastChecked: document.querySelector("#lastChecked"),
  dateWindow: document.querySelector("#dateWindow"),
  dateFilter: document.querySelector("#dateFilter"),
  timeFilter: document.querySelector("#timeFilter"),
  searchFilter: document.querySelector("#searchFilter"),
  weekendFilter: document.querySelector("#weekendFilter"),
  clearFilters: document.querySelector("#clearFilters"),
  statusMix: document.querySelector("#statusMix"),
  resultCount: document.querySelector("#resultCount"),
  slots: document.querySelector("#slots"),
  emptyState: document.querySelector("#emptyState"),
  eyebrow: document.querySelector("#eyebrow"),
  pageTitle: document.querySelector("#pageTitle"),
  pageDescription: document.querySelector("#pageDescription"),
  facilitySource: document.querySelector("#facilitySource"),
  resultsTitle: document.querySelector("#resultsTitle"),
  sportIndex: document.querySelector("#sportIndex"),
  sportTabs: [...document.querySelectorAll(".sport-tab")]
};

let data = { ok: false, slots: [], summary: {} };
function readSaved(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage may be disabled. */ }
}
const preferences = readSaved("court-finder-preferences", {});
let activeSport = preferences?.sport === "basketball" ? "basketball" : "tennis";
let activeRegion = ["kanagawa", "yokohama", "kawasaki"].includes(preferences?.region) ? preferences.region : "";
const savedVenues = readSaved("court-finder-venues", []);
const favorites = new Set(Array.isArray(savedVenues) ? savedVenues : []);
const disclosureState = new Map();
const favoritesFilter = document.querySelector("#favoritesFilter");
const dateStrip = document.querySelector("#dateStrip");
const activeFilters = document.querySelector("#activeFilters");
const themeSwitch = document.querySelector("#themeSwitch");
const themeMeta = document.querySelector('meta[name="theme-color"]');

function currentTheme() {
  const scheme = document.documentElement.getAttribute("data-color-scheme");
  if (scheme === "dark" || scheme === "light") return scheme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function updateThemeUI(theme) {
  const isDark = theme === "dark";
  document.documentElement.setAttribute("data-color-scheme", theme);
  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.classList.toggle("light", !isDark);
  if (themeMeta) {
    themeMeta.setAttribute("content", isDark ? "#0c1310" : "#f6f5ed");
  }
  if (themeSwitch) {
    themeSwitch.setAttribute("aria-label", isDark ? "Switch to light appearance" : "Switch to dark appearance");
    themeSwitch.setAttribute("title", isDark ? "Switch to light appearance" : "Switch to dark appearance");
    const icon = themeSwitch.querySelector(".theme-switch-icon");
    const label = themeSwitch.querySelector(".theme-switch-label");
    if (icon) icon.textContent = isDark ? "☀️" : "🌙";
    if (label) label.textContent = isDark ? "Light" : "Dark";
  }
}

function setTheme(theme, persist = false) {
  updateThemeUI(theme);
  if (persist) {
    save("court-finder-theme", theme);
  }
}

const initialSavedTheme = readSaved("court-finder-theme", null);
updateThemeUI(initialSavedTheme || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));

if (themeSwitch) {
  themeSwitch.addEventListener("click", () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    setTheme(next, true);
  });
}

try {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    if (!readSaved("court-finder-theme", null)) {
      updateThemeUI(e.matches ? "dark" : "light");
    }
  });
} catch {
  /* matchMedia fallback */
}

const sportMeta = {
  tennis: {
    index: "01",
    eyebrow: "The public court field guide / Tennis",
    title: "More court time. Less searching.",
    description: "Find your next game across Kanagawa, Yokohama and Kawasaki. Choose a day, save a venue, make it happen.",
    source: "Kanagawa · Yokohama · Kawasaki",
    resultsTitle: "Open tennis courts",
    facilityLabel: "Courts tracked"
  },
  basketball: {
    index: "02",
    eyebrow: "The public court field guide / Basketball",
    title: "Game time starts here.",
    description: "Open basketball gym slots across nine tracked facilities, including Komaoka Community Center phone booking, refreshed from official city reservation services.",
    source: "Yokohama system + Komaoka",
    resultsTitle: "Open basketball gyms",
    facilityLabel: "Gyms tracked"
  }
};

function formatDate(value) {
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Tokyo"
  }).format(new Date(`${value}T00:00:00+09:00`));
}

function formatChecked(value) {
  if (!value) return "unavailable";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone: "Asia/Tokyo"
  }).format(new Date(value));
}

function formatDayName(value) {
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    timeZone: "Asia/Tokyo"
  }).format(new Date(`${value}T00:00:00+09:00`));
}

function formatDateLabel(value) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    timeZone: "Asia/Tokyo"
  }).format(new Date(`${value}T00:00:00+09:00`)).toUpperCase();
}

function timeBucket(slot) {
  const hour = Number(slot.startTime.slice(0, 2));
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

function matchesSearch(slot, query) {
  if (!query) return true;
  return [
    slot.date,
    slot.startTime,
    slot.endTime,
    slot.statusLabel,
    slot.facilityName,
    slot.roomName,
    slot.courtName,
    slot.area,
    slot.provider,
    slot.indoor ? "indoor" : ""
  ].join(" ").toLowerCase().includes(query);
}

function filteredSlots(ignoreDate = false) {
  const date = els.dateFilter.value;
  const bucket = els.timeFilter.value;
  const query = els.searchFilter.value.trim().toLowerCase();

  return data.slots.filter((slot) => {
    return (slot.sport || "tennis") === activeSport &&
      (ignoreDate || !date || slot.date === date) &&
      matchesRegion(slot, activeRegion) &&
      (!favoritesFilter.checked || favorites.has(venueKey(slot))) &&
      (!bucket || timeBucket(slot) === bucket) &&
      (!els.weekendFilter.checked || isWeekendDate(slot.date)) &&
      matchesSearch(slot, query);
  });
}

function renderDateOptions() {
  const previousDate = els.dateFilter.value;
  const dates = dateSlotCounts(data.slots.filter((slot) => (slot.sport || "tennis") === activeSport), data.summary?.datesChecked).map(([date]) => date);

  els.dateFilter.replaceChildren(new Option("All dates", ""));
  for (const date of dates) {
    const option = document.createElement("option");
    option.value = date;
    option.textContent = formatDate(date);
    els.dateFilter.append(option);
  }
  els.dateFilter.value = dates.includes(previousDate) ? previousDate : "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "#";
  } catch {
    return "#";
  }
}

function render() {
  for (const section of els.slots.querySelectorAll("details")) disclosureState.set(section.dataset.stateKey, section.open);
  renderControls();
  const slots = filteredSlots();
  els.resultCount.textContent = `${slots.length} result${slots.length === 1 ? "" : "s"}`;
  els.emptyState.hidden = slots.length > 0;
  els.slots.setAttribute("aria-busy", "false");

  if (slots.length === 0) {
    els.slots.replaceChildren();
    return;
  }

  const groupElements = buildAvailabilityHierarchy(slots).map((dateGroup) => {
    const { date } = dateGroup;
    const dateFacilities = dateGroup.timeGroups.flatMap((group) => group.facilities);
    const dateParks = availableParkNames(dateFacilities);
    const section = document.createElement("details");
    section.className = "date-group date-disclosure";
    section.dataset.date = date;
    section.dataset.stateKey = `${activeSport}|${date}`;
    section.open = disclosureState.get(`${activeSport}|${date}`) ?? false;
    if (!disclosureState.has(`${activeSport}|${date}`)) section.open = date === els.dateFilter.value || date === slots[0]?.date;
    section.addEventListener("toggle", () => { if (section.isConnected) disclosureState.set(section.dataset.stateKey, section.open); });
    section.setAttribute("aria-label", `${formatDate(date)} availability`);

    const header = document.createElement("summary");
    header.className = "date-group-header disclosure-summary";
    header.innerHTML = `
      <div class="date-summary-copy">
        <div class="date-lockup">
          <span class="date-group-day-name">${formatDayName(date)}</span>
          <span class="date-group-separator" aria-hidden="true">·</span>
          <h3 class="date-group-date-label">${formatDateLabel(date)}</h3>
        </div>
        <span class="date-park-list" aria-label="Available parks">
          ${dateParks.map((park) => `<span class="park-chip">${escapeHtml(park)}</span>`).join("")}
        </span>
      </div>
      <span class="date-group-count">${dateParks.length} park${dateParks.length === 1 ? "" : "s"}</span>
    `;
    section.appendChild(header);

    const timeline = document.createElement("div");
    timeline.className = "availability-timeline";

    for (const timeGroup of dateGroup.timeGroups) {
      const timeSection = document.createElement("details");
      const timeParks = availableParkNames(timeGroup.facilities);
      timeSection.className = "time-group time-disclosure";
      timeSection.dataset.stateKey = `${activeSport}|${date}|${timeGroup.startTime}|${timeGroup.endTime}`;
      timeSection.open = disclosureState.get(timeSection.dataset.stateKey) ?? true;
      timeSection.addEventListener("toggle", () => { if (timeSection.isConnected) disclosureState.set(timeSection.dataset.stateKey, timeSection.open); });
      timeSection.setAttribute("aria-label", timeGroup.endTime ? `${timeGroup.startTime} to ${timeGroup.endTime}` : `From ${timeGroup.startTime}`);
      timeSection.innerHTML = `
        <summary class="time-group-header disclosure-summary">
          <div class="time-summary-copy">
            <div class="time-group-range">
              ${timeGroup.endTime ? `<strong>${escapeHtml(timeGroup.startTime)}</strong><span>—</span><strong>${escapeHtml(timeGroup.endTime)}</strong>` : `<strong>From ${escapeHtml(timeGroup.startTime)}</strong>`}
            </div>
            <span class="time-group-overview">${timeParks.map(escapeHtml).join(" · ")}</span>
          </div>
          <span class="time-group-count">${timeParks.length} park${timeParks.length === 1 ? "" : "s"}</span>
        </summary>
      `;
      const facilityList = document.createElement("div");
      facilityList.className = "time-group-facilities";

      for (const slot of timeGroup.facilities) {
      const card = document.createElement("article");
      const isPhoneBooking = slot.bookingMethod === "phone" && slot.bookingPhone;
      card.className = isPhoneBooking ? "slot-card slot-card-komaoka" : "slot-card";
      const distance = slot.distanceFromYokohamaStationKm != null
        ? `${escapeHtml(slot.distanceFromYokohamaStationKm)} km from Yokohama Station`
        : escapeHtml(slot.area || "Public facility");
      const actionLabel = "Open booking";
      const note = slot.linkNote ? `<p class="slot-card-warning">${escapeHtml(slot.linkNote)}</p>` : "";
      const sourceUrl = safeUrl(slot.sourceUrl);
      const sourceLink = sourceUrl !== "#"
        ? `<a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer" class="slot-source-link">Source calendar<span aria-hidden="true">↗</span></a>`
        : "";
      const action = isPhoneBooking
        ? `<a href="tel:${slot.bookingPhone.replace(/\D/g, "")}" class="reserve-btn reserve-btn-phone">Call Komaoka · ${escapeHtml(slot.bookingPhone)}</a>`
        : `<a href="${escapeHtml(safeUrl(slot.link))}" target="_blank" rel="noopener noreferrer" class="reserve-btn">${actionLabel}<span aria-hidden="true">↗</span></a>`;

      card.innerHTML = `
        <div class="facility-availability-main">
          <span class="slot-card-facility">${escapeHtml(slot.facilityName)}${slot.indoor && !/\(indoor\)/i.test(slot.facilityName) ? ' <span class="indoor-label">(indoor)</span>' : ""}</span>
          <div class="facility-courts" aria-label="Available courts">
            ${slot.courtNames.map((court) => `<span class="court-pill">${escapeHtml(court)}</span>`).join("")}
          </div>
        </div>
        <div class="slot-card-meta">
          <span>${distance}</span>
          <span>${escapeHtml(slot.provider || "official")} source</span>
        </div>
        <div class="slot-card-status-row">
          <span class="status"><i aria-hidden="true"></i>${escapeHtml(slot.statusLabel)}</span>
          ${isPhoneBooking ? '<span class="booking-badge-phone">Phone booking</span>' : ""}
          ${action}
        </div>
        ${note}
        ${sourceLink}
      `;
        const favorite = document.createElement("button");
        favorite.type = "button";
        favorite.className = "favorite-btn";
        const key = venueKey(slot);
        favorite.setAttribute("aria-pressed", String(favorites.has(key)));
        favorite.setAttribute("aria-label", `Save ${slot.facilityName}`);
        favorite.textContent = favorites.has(key) ? "★ Saved" : "☆ Save";
        favorite.addEventListener("click", () => {
          if (favorites.has(key)) favorites.delete(key); else favorites.add(key);
          save("court-finder-venues", [...favorites]);
          if (favoritesFilter.checked) render();
          else {
            for (const button of els.slots.querySelectorAll(".favorite-btn")) {
              if (button.dataset.venue === key) {
                button.setAttribute("aria-pressed", String(favorites.has(key)));
                button.textContent = favorites.has(key) ? "★ Saved" : "☆ Save";
              }
            }
          }
        });
        favorite.dataset.venue = key;
        card.querySelector(".facility-availability-main").append(favorite);
        facilityList.appendChild(card);
      }
      timeSection.appendChild(facilityList);
      timeline.appendChild(timeSection);
    }

    section.appendChild(timeline);
    return section;
  });

  els.slots.replaceChildren(...groupElements);
}

function renderSummary() {
  const sportSlots = data.slots.filter((slot) => (slot.sport || "tennis") === activeSport);
  const content = sportMeta[activeSport];

  els.eyebrow.textContent = content.eyebrow;
  els.pageTitle.textContent = content.title;
  els.pageDescription.textContent = content.description;
  els.facilitySource.textContent = content.source;
  els.resultsTitle.textContent = content.resultsTitle;
  els.sportIndex.textContent = content.index;
  const coverage = Array.isArray(data.coverage) ? data.coverage.filter((venue) => (venue.sport || "tennis") === activeSport) : sportSlots;
  els.facilityCount.textContent = String(new Set(coverage.map(venueKey)).size);
  els.facilityMetricLabel.textContent = Array.isArray(data.coverage) ? "Venues tracked" : "Venues with openings";
  const health = availabilityHealth(data);
  els.health.textContent = health.label;
  els.health.parentElement.classList.toggle("error", health.warning);
  els.slotCount.textContent = String(sportSlots.length);
  els.lastChecked.textContent = formatChecked(data.generatedAt);

  const dates = data.summary?.datesChecked || [];
  els.dateWindow.textContent = dates.length
    ? `${formatDate(dates[0])} — ${formatDate(dates[dates.length - 1])}`
    : "Unavailable";

  const statusCounts = sportSlots.reduce((counts, slot) => {
    counts[slot.statusLabel] = (counts[slot.statusLabel] || 0) + 1;
    return counts;
  }, {});
  els.statusMix.textContent = Object.entries(statusCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([label, count]) => `${label} ${count}`)
    .join(" · ") || "No open slots";
}

async function load() {
  try {
    const response = await fetch("data/availability.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Availability request failed: ${response.status}`);
    data = await response.json();
  } catch {
    data = {
      ok: false,
      generatedAt: null,
      summary: { openSlotCount: 0, datesChecked: [] },
      slots: []
    };
  }

  renderSummary();
  renderDateOptions();
  render();
}

function renderControls() {
  save("court-finder-preferences", { sport: activeSport, region: activeRegion });
  for (const tab of els.sportTabs) {
    tab.classList.toggle("active", tab.dataset.sport === activeSport);
    tab.removeAttribute("aria-selected");
    tab.setAttribute("aria-pressed", String(tab.dataset.sport === activeSport));
  }
  for (const button of document.querySelectorAll("[data-region]")) button.setAttribute("aria-pressed", String(button.dataset.region === activeRegion));
  const counts = new Map(dateSlotCounts(filteredSlots(true), data.summary?.datesChecked));
  dateStrip.replaceChildren();
  for (const [date, count] of [["", [...counts.values()].reduce((sum, value) => sum + value, 0)], ...[...counts].sort(([a], [b]) => a.localeCompare(b))]) {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-pressed", String(els.dateFilter.value === date));
    button.innerHTML = `<span>${date ? escapeHtml(formatDate(date)) : "All dates"}</span><strong>${count}</strong><small>available slots</small>`;
    button.addEventListener("click", () => { els.dateFilter.value = date; disclosureState.set(`${activeSport}|${date}`, true); for (const section of els.slots.querySelectorAll("details")) if (section.dataset.date === date) section.open = true; render(); });
    dateStrip.append(button);
  }
  activeFilters.replaceChildren();
  const filters = [
    [activeRegion, () => { activeRegion = ""; }],
    [els.dateFilter.value && formatDate(els.dateFilter.value), () => { els.dateFilter.value = ""; }],
    [els.timeFilter.value, () => { els.timeFilter.value = ""; }],
    [els.searchFilter.value, () => { els.searchFilter.value = ""; }],
    [els.weekendFilter.checked && "Weekends", () => { els.weekendFilter.checked = false; }],
    [favoritesFilter.checked && "Saved venues", () => { favoritesFilter.checked = false; }]
  ];
  for (const [label, clear] of filters) if (label) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${label} ×`;
    button.setAttribute("aria-label", `Remove ${label} filter`);
    button.addEventListener("click", () => { clear(); render(); });
    activeFilters.append(button);
  }
}
favoritesFilter.addEventListener("change", render);
for (const button of document.querySelectorAll("[data-region]")) button.addEventListener("click", () => { activeRegion = button.dataset.region; render(); });
for (const [id, open] of [["expandAll", true], ["collapseAll", false]]) document.querySelector(`#${id}`).addEventListener("click", () => {
  for (const section of els.slots.querySelectorAll("details")) { section.open = open; disclosureState.set(section.dataset.stateKey, open); }
});
els.dateFilter.addEventListener("change", () => {
  for (const section of els.slots.querySelectorAll("details")) if (section.dataset.date === els.dateFilter.value) section.open = true;
  disclosureState.set(`${activeSport}|${els.dateFilter.value}`, true);
  render();
});
els.timeFilter.addEventListener("change", render);
els.searchFilter.addEventListener("input", render);
els.weekendFilter.addEventListener("change", render);
els.clearFilters.addEventListener("click", () => {
  els.dateFilter.value = "";
  els.timeFilter.value = "";
  els.searchFilter.value = "";
  els.weekendFilter.checked = false;
  favoritesFilter.checked = false;
  activeRegion = "";
  render();
  els.dateFilter.focus();
});

for (const tab of els.sportTabs) {
  tab.addEventListener("click", () => {
    activeSport = tab.dataset.sport;
    for (const item of els.sportTabs) {
      const selected = item === tab;
      item.classList.toggle("active", selected);
      item.setAttribute("aria-pressed", String(selected));
    }
    renderSummary();
    renderDateOptions();
    render();
  });
}

load();
