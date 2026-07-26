import { isWeekendDate } from "./filters.js";

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
let activeSport = "tennis";

const sportMeta = {
  tennis: {
    index: "01",
    eyebrow: "Kanagawa public sports · live availability",
    title: "Your next court starts here.",
    description: "Requestable public tennis courts, refreshed from official Kanagawa and Yokohama reservation services.",
    source: "Kanagawa + Yokohama",
    resultsTitle: "Open tennis courts",
    facilityCount: 6,
    facilityLabel: "Courts tracked"
  },
  basketball: {
    index: "02",
    eyebrow: "Yokohama public gyms · live availability",
    title: "Game time starts here.",
    description: "Open basketball gym slots across eight Yokohama facilities, refreshed from the official city reservation service.",
    source: "Yokohama system",
    resultsTitle: "Open basketball gyms",
    facilityCount: 8,
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
  }).format(new Date(`${value}T00:00:00+09:00`)).toUpperCase();
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
    slot.provider
  ].join(" ").toLowerCase().includes(query);
}

function filteredSlots() {
  const date = els.dateFilter.value;
  const bucket = els.timeFilter.value;
  const query = els.searchFilter.value.trim().toLowerCase();

  return data.slots.filter((slot) => {
    return (slot.sport || "tennis") === activeSport &&
      (!date || slot.date === date) &&
      (!bucket || timeBucket(slot) === bucket) &&
      (!els.weekendFilter.checked || isWeekendDate(slot.date)) &&
      matchesSearch(slot, query);
  });
}

function renderDateOptions() {
  const previousDate = els.dateFilter.value;
  const dates = [...new Set(data.slots
    .filter((slot) => (slot.sport || "tennis") === activeSport)
    .map((slot) => slot.date))];

  els.dateFilter.replaceChildren(new Option("All dates", ""));
  for (const date of dates) {
    const option = document.createElement("option");
    option.value = date;
    option.textContent = formatDate(date);
    els.dateFilter.append(option);
  }
  els.dateFilter.value = dates.includes(previousDate) ? previousDate : "";
}

function groupSlotsByDate(slots) {
  const groups = new Map();
  for (const slot of slots) {
    const dateSlots = groups.get(slot.date) || [];
    dateSlots.push(slot);
    groups.set(slot.date, dateSlots);
  }
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
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
  const slots = filteredSlots();
  els.resultCount.textContent = `${slots.length} result${slots.length === 1 ? "" : "s"}`;
  els.emptyState.hidden = slots.length > 0;
  els.slots.setAttribute("aria-busy", "false");

  if (slots.length === 0) {
    els.slots.replaceChildren();
    return;
  }

  const groupElements = groupSlotsByDate(slots).map(([date, dateSlots]) => {
    const section = document.createElement("section");
    section.className = "date-group";
    section.setAttribute("aria-label", `${formatDate(date)} availability`);

    const header = document.createElement("div");
    header.className = "date-group-header";
    header.innerHTML = `
      <div class="date-lockup">
        <span class="date-group-day-name">${formatDayName(date)}</span>
        <h3 class="date-group-date-label">${formatDateLabel(date)}</h3>
      </div>
      <span class="date-group-count">${dateSlots.length} available</span>
    `;
    section.appendChild(header);

    const slotsGrid = document.createElement("div");
    slotsGrid.className = "date-group-slots";

    for (const slot of dateSlots) {
      const card = document.createElement("article");
      card.className = "slot-card";
      const distance = slot.distanceFromYokohamaStationKm != null
        ? `${escapeHtml(slot.distanceFromYokohamaStationKm)} km from Yokohama Station`
        : escapeHtml(slot.area || "Public facility");
      const actionLabel = slot.provider === "yokohama" ? "Open system" : "Reserve";
      const court = slot.courtName ? `<small>${escapeHtml(slot.courtName)}</small>` : "";
      const note = slot.linkNote ? `<p class="slot-card-note">${escapeHtml(slot.linkNote)}</p>` : "";

      card.innerHTML = `
        <div class="slot-card-time">
          <strong>${escapeHtml(slot.startTime)}</strong>
          <span>to ${escapeHtml(slot.endTime)}</span>
        </div>
        <div class="slot-card-court">
          <span class="slot-card-facility">${escapeHtml(slot.facilityName)}</span>
          <strong>${escapeHtml(slot.roomName)}</strong>
          ${court}
        </div>
        <div class="slot-card-meta">
          <span>${distance}</span>
          <span>${escapeHtml(slot.provider || "official")} source</span>
        </div>
        <div class="slot-card-status-row">
          <span class="status"><i aria-hidden="true"></i>${escapeHtml(slot.statusLabel)}</span>
          <a href="${escapeHtml(safeUrl(slot.link))}" target="_blank" rel="noopener noreferrer" class="reserve-btn">
            ${actionLabel}<span aria-hidden="true">↗</span>
          </a>
        </div>
        ${note}
      `;
      slotsGrid.appendChild(card);
    }

    section.appendChild(slotsGrid);
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
  els.facilityCount.textContent = String(content.facilityCount);
  els.facilityMetricLabel.textContent = content.facilityLabel;
  els.health.textContent = data.ok ? "Live data online" : "Latest check incomplete";
  els.health.parentElement.classList.toggle("error", !data.ok);
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

els.dateFilter.addEventListener("change", render);
els.timeFilter.addEventListener("change", render);
els.searchFilter.addEventListener("input", render);
els.weekendFilter.addEventListener("change", render);
els.clearFilters.addEventListener("click", () => {
  els.dateFilter.value = "";
  els.timeFilter.value = "";
  els.searchFilter.value = "";
  els.weekendFilter.checked = false;
  render();
  els.dateFilter.focus();
});

for (const tab of els.sportTabs) {
  tab.addEventListener("click", () => {
    activeSport = tab.dataset.sport;
    for (const item of els.sportTabs) {
      const selected = item === tab;
      item.classList.toggle("active", selected);
      item.setAttribute("aria-selected", String(selected));
    }
    renderSummary();
    renderDateOptions();
    render();
  });
}

load();
