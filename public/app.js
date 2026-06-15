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
  emptyState: document.querySelector("#emptyState")
};

let data = { slots: [], summary: {} };
let theme = localStorage.getItem("theme") || "dark";

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
    slot.courtName
  ].join(" ").toLowerCase().includes(query);
}

function filteredSlots() {
  const date = els.dateFilter.value;
  const bucket = els.timeFilter.value;
  const query = els.searchFilter.value.trim().toLowerCase();

  return data.slots.filter((slot) => {
    return (!date || slot.date === date) &&
      (!bucket || timeBucket(slot) === bucket) &&
      matchesSearch(slot, query);
  });
}

function renderDateOptions() {
  const dates = [...new Set(data.slots.map((slot) => slot.date))];
  for (const date of dates) {
    const option = document.createElement("option");
    option.value = date;
    option.textContent = formatDate(date);
    els.dateFilter.append(option);
  }
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
          <strong>${slot.roomName}</strong>
          ${slot.courtName ? `<br><small>${slot.courtName}</small>` : ''}
        </div>
        <div class="slot-card-status-row">
          <span class="status">${slot.statusLabel}</span>
          <a href="${slot.link}" target="_blank" rel="noreferrer" class="reserve-btn">Reserve</a>
        </div>
      `;
      slotsGrid.appendChild(card);
    }

    section.appendChild(slotsGrid);
    return section;
  });

  els.slots.replaceChildren(...groupElements);
}

function renderSummary() {
  els.health.textContent = data.ok ? "Live data" : "Check failed";
  els.health.classList.toggle("error", !data.ok);
  els.slotCount.textContent = String(data.summary?.openSlotCount ?? 0);
  els.lastChecked.textContent = formatChecked(data.generatedAt);

  const dates = data.summary?.datesChecked || [];
  els.dateWindow.textContent = dates.length
    ? `${formatDate(dates[0])} - ${formatDate(dates[dates.length - 1])}`
    : "--";

  const statusCounts = data.summary?.statusCounts || {};
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
els.themeToggle.addEventListener("click", () => {
  theme = theme === "dark" ? "light" : "dark";
  localStorage.setItem("theme", theme);
  applyTheme();
});

applyTheme();
load();
