const els = {
  health: document.querySelector("#health"),
  slotCount: document.querySelector("#slotCount"),
  lastChecked: document.querySelector("#lastChecked"),
  dateWindow: document.querySelector("#dateWindow"),
  dateFilter: document.querySelector("#dateFilter"),
  timeFilter: document.querySelector("#timeFilter"),
  searchFilter: document.querySelector("#searchFilter"),
  resultCount: document.querySelector("#resultCount"),
  slots: document.querySelector("#slots"),
  emptyState: document.querySelector("#emptyState")
};

let data = { slots: [], summary: {} };

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

function slotCard(slot) {
  const article = document.createElement("article");
  article.className = "slot";
  article.innerHTML = `
    <div class="slot-header">
      <div>
        <div class="date">${formatDate(slot.date)}</div>
        <div class="time">${slot.startTime}-${slot.endTime}</div>
      </div>
      <span class="status">${slot.statusLabel}</span>
    </div>
    <div class="court">
      <strong>${slot.roomName}</strong><br>
      ${slot.courtName || "Mitsuike Park"}
    </div>
    <a href="${slot.link}" target="_blank" rel="noreferrer">Open official page</a>
  `;
  return article;
}

function render() {
  const slots = filteredSlots();
  els.slots.replaceChildren(...slots.map(slotCard));
  els.resultCount.textContent = `${slots.length} result${slots.length === 1 ? "" : "s"}`;
  els.emptyState.hidden = slots.length > 0;
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

load();
