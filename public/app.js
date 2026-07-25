const els = {
  health: document.querySelector("#health"),
  slotCount: document.querySelector("#slotCount"),
  lastChecked: document.querySelector("#lastChecked"),
  dateWindow: document.querySelector("#dateWindow"),
  dateFilter: document.querySelector("#dateFilter"),
  timeFilter: document.querySelector("#timeFilter"),
  searchFilter: document.querySelector("#searchFilter"),
  statusMix: document.querySelector("#statusMix"),
  themeToggle: document.querySelector("#themeToggle"),
  resultCount: document.querySelector("#resultCount"),
  slots: document.querySelector("#slots"),
  emptyState: document.querySelector("#emptyState"),
  eyebrow: document.querySelector("#eyebrow"),
  pageTitle: document.querySelector("#pageTitle"),
  pageDescription: document.querySelector("#pageDescription"),
  facilitySource: document.querySelector("#facilitySource"),
  resultsTitle: document.querySelector("#resultsTitle"),
  sportTabs: [...document.querySelectorAll(".sport-tab")]
};

let data = { slots: [], summary: {} };
let theme = localStorage.getItem("theme") || "dark";
let activeSport = "tennis";

const sportContent = {
  tennis: {
    eyebrow: "Kanagawa public courts",
    title: "Kanagawa tennis availability",
    description: "Requestable court slots refreshed every two hours from the official e-kanagawa and Yokohama reservation services.",
    source: "Kanagawa + Yokohama",
    resultsTitle: "Requestable tennis slots"
  },
  basketball: {
    eyebrow: "Near Yokohama Station",
    title: "Yokohama basketball availability",
    description: "Open gym slots at the closest municipal courts, sourced only from Yokohama's official reservation system.",
    source: "Yokohama system only",
    resultsTitle: "Nearby basketball slots"
  }
};

function applyTheme() {
  document.documentElement.dataset.theme = theme;
  els.themeToggle.textContent = theme === "dark" ? "Light mode" : "Dark mode";
  els.themeToggle.setAttribute("aria-pressed", String(theme === "dark"));
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Tokyo"
  }).format(new Date(`${value}T00:00:00+09:00`));
}

function formatChecked(value) {
  if (!value) return "--";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone: "Asia/Tokyo"
  }).format(new Date(value));
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

function formatDayName(value) {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    timeZone: "Asia/Tokyo"
  }).format(new Date(`${value}T00:00:00+09:00`));
}

function formatDateLabel(value) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    timeZone: "Asia/Tokyo"
  }).format(new Date(`${value}T00:00:00+09:00`));
}

function groupSlotsByDate(slots) {
  const groups = {};
  for (const slot of slots) {
    if (!groups[slot.date]) {
      groups[slot.date] = [];
    }
    groups[slot.date].push(slot);
  }
  return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
}

function render() {
  const slots = filteredSlots();
  els.resultCount.textContent = `${slots.length} result${slots.length === 1 ? "" : "s"}`;
  els.emptyState.hidden = slots.length > 0;

  if (slots.length === 0) {
    els.slots.replaceChildren();
    return;
  }

  const groups = groupSlotsByDate(slots);

  const groupElements = groups.map(([date, dateSlots]) => {
    const section = document.createElement("section");
    section.className = "date-group";

    const header = document.createElement("div");
    header.className = "date-group-header";
    header.innerHTML = `
      <span class="date-group-day-name">${formatDayName(date)}</span>
      <h3 class="date-group-date-label">${formatDateLabel(date)}</h3>
    `;
    section.appendChild(header);

    const slotsGrid = document.createElement("div");
    slotsGrid.className = "date-group-slots";

    for (const slot of dateSlots) {
      const card = document.createElement("article");
      card.className = "slot-card";
      card.innerHTML = `
        <div class="slot-card-time">${slot.startTime} - ${slot.endTime}</div>
        <div class="slot-card-court">
          <span class="slot-card-facility">${slot.facilityName}</span>
          <strong>${slot.roomName}</strong>
          ${slot.courtName ? `<br><small>${slot.courtName}</small>` : ""}
          ${slot.distanceFromYokohamaStationKm != null ? `<br><small>${slot.distanceFromYokohamaStationKm} km from Yokohama Station</small>` : ""}
        </div>
        <div class="slot-card-status-row">
          <span class="status">${slot.statusLabel}</span>
          <a href="${slot.link}" target="_blank" rel="noreferrer" class="reserve-btn">${slot.provider === "yokohama" ? "Open system" : "Reserve"}</a>
        </div>
        ${slot.linkNote ? `<small class="slot-card-note">${slot.linkNote}</small>` : ""}
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
  const content = sportContent[activeSport];
  els.eyebrow.textContent = content.eyebrow;
  els.pageTitle.textContent = content.title;
  els.pageDescription.textContent = content.description;
  els.facilitySource.textContent = content.source;
  els.resultsTitle.textContent = content.resultsTitle;
  els.health.textContent = data.ok ? "Live data" : "Check failed";
  els.health.classList.toggle("error", !data.ok);
  els.slotCount.textContent = String(sportSlots.length);
  els.lastChecked.textContent = formatChecked(data.generatedAt);

  const dates = data.summary?.datesChecked || [];
  els.dateWindow.textContent = dates.length
    ? `${formatDate(dates[0])} - ${formatDate(dates[dates.length - 1])}`
    : "--";

  const statusCounts = sportSlots.reduce((counts, slot) => {
    counts[slot.statusLabel] = (counts[slot.statusLabel] || 0) + 1;
    return counts;
  }, {});
  els.statusMix.textContent = Object.entries(statusCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([status, count]) => `${status} ${count}`)
    .join(", ") || "--";
}

async function load() {
  try {
    const response = await fetch("data/availability.json", { cache: "no-store" });
    data = await response.json();
  } catch (error) {
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
els.themeToggle.addEventListener("click", () => {
  theme = theme === "dark" ? "light" : "dark";
  localStorage.setItem("theme", theme);
  applyTheme();
});

applyTheme();
load();
