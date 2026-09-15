import {
  DEFAULT_SCHEDULE,
  availabilityHealth,
  bookingLink,
  dateSlotCounts,
  isWeekendDate,
  kawasakiBookingLinks,
  legacyCourtName,
  matchesRegion,
  normalizeSchedule,
  preferenceTier,
  rankSlots,
  toDisplaySlots,
  venueKey
} from "./filters.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const els = {
  health: $("#health"), slotCount: $("#slotCount"), facilityCount: $("#facilityCount"),
  facilityMetricLabel: $("#facilityMetricLabel"), lastChecked: $("#lastChecked"), dateWindow: $("#dateWindow"),
  dateFilter: $("#dateFilter"), timeFilter: $("#timeFilter"), regionFilter: $("#regionFilter"),
  sortFilter: $("#sortFilter"), searchFilter: $("#searchFilter"), weekendFilter: $("#weekendFilter"),
  favoritesFilter: $("#favoritesFilter"), clearFilters: $("#clearFilters"), dateStrip: $("#dateStrip"),
  activeFilters: $("#activeFilters"), slots: $("#slots"), emptyState: $("#emptyState"),
  resultCount: $("#resultCount"), resultLabel: $("#resultLabel"), resultsTitle: $("#resultsTitle"),
  sportIndex: $("#sportIndex"), eyebrow: $("#eyebrow"), pageTitle: $("#pageTitle"),
  pageDescription: $("#pageDescription"), facilitySource: $("#facilitySource"), kawasakiLinks: $("#kawasakiLinks"),
  themeSwitch: $("#themeSwitch"), viewBest: $("#viewBest"), viewAll: $("#viewAll"),
  bestMatchCount: $("#bestMatchCount"), allSlotCount: $("#allSlotCount"), editSchedule: $("#editSchedule"),
  scheduleDialog: $("#scheduleDialog"), scheduleForm: $("#scheduleForm"), resetSchedule: $("#resetSchedule"),
  scheduleTimeLabel: $("#scheduleTimeLabel"), filterDialog: $("#filterDialog"),
  filterDialogOpen: $("#filterDialogOpen"), filterDialogClose: $("#filterDialogClose"),
  applyMobileFilters: $("#applyMobileFilters"), mobileDateFilter: $("#mobileDateFilter"),
  mobileTimeFilter: $("#mobileTimeFilter"), mobileRegionFilter: $("#mobileRegionFilter"),
  mobileSearchFilter: $("#mobileSearchFilter"), mobileWeekendFilter: $("#mobileWeekendFilter"),
  mobileFavoritesFilter: $("#mobileFavoritesFilter"), mobileSortFilter: $("#mobileSortFilter"),
  activeFilterCount: $("#activeFilterCount"), toast: $("#toast"), sportTabs: $$(".sport-tab")
};

function readSaved(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Private browsing may disable storage. */ }
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}
function safeUrl(value) {
  try { const url = new URL(value, location.href); return ["http:", "https:", "tel:"].includes(url.protocol) ? url.href : "#"; } catch { return "#"; }
}
function localDate(value) {
  const [year, month, day] = String(value).split("-").map(Number);
  return new Date(year, month - 1, day);
}
function formatDate(value, style = "long") {
  const options = style === "short" ? { month: "short", day: "numeric" } : { weekday: "long", month: "long", day: "numeric" };
  return new Intl.DateTimeFormat("en", options).format(localDate(value));
}
function timeBucket(slot) {
  const hour = Number(String(slot.startTime).slice(0, 2));
  return hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
}
function announce(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(announce.timer);
  announce.timer = setTimeout(() => els.toast.classList.remove("show"), 2400);
}
function transition(update) {
  if (document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) document.startViewTransition(update);
  else update();
}

const preferences = readSaved("court-finder-preferences", {});
let activeSport = preferences.sport === "basketball" ? "basketball" : "tennis";
let viewMode = preferences.viewMode === "all" ? "all" : "best";
let sortMode = ["recommended", "soonest", "startTime", "distance"].includes(preferences.sortMode) ? preferences.sortMode : "recommended";
let schedule = normalizeSchedule(readSaved("court-finder-schedule", DEFAULT_SCHEDULE));
const favorites = new Set(Array.isArray(readSaved("court-finder-venues", [])) ? readSaved("court-finder-venues", []) : []);
let data = { ok: false, slots: [], summary: {}, checks: [] };

const sportMeta = {
  tennis: { number: "01", title: "Tennis", eyebrow: "Kanagawa public tennis · refreshed hourly", headline: "Courts that fit<br><em>your week.</em>" },
  basketball: { number: "02", title: "Basketball", eyebrow: "Yokohama public basketball · refreshed hourly", headline: "Hoops when you<br><em>have time.</em>" }
};

for (const item of kawasakiBookingLinks()) {
  const link = document.createElement("a");
  link.href = item.url; link.target = "_blank"; link.rel = "noopener noreferrer";
  link.innerHTML = `<span>${escapeHtml(item.label)}</span><span aria-hidden="true">↗</span>`;
  els.kawasakiLinks.append(link);
}

function persistPreferences() {
  save("court-finder-preferences", { sport: activeSport, viewMode, sortMode });
}
function filters() {
  return {
    date: els.dateFilter.value,
    time: els.timeFilter.value,
    region: els.regionFilter.value,
    query: els.searchFilter.value.trim().toLowerCase(),
    weekend: els.weekendFilter.checked,
    saved: els.favoritesFilter.checked
  };
}
function matchesSearch(slot, query) {
  return !query || [slot.date, slot.startTime, slot.endTime, slot.statusLabel, slot.facilityName, slot.roomName, slot.courtName, slot.area, slot.provider, slot.indoor ? "indoor" : ""].join(" ").toLowerCase().includes(query);
}
function filteredSlots({ ignoreDate = false } = {}) {
  const state = filters();
  return data.slots.filter((slot) => (slot.sport || "tennis") === activeSport &&
    (ignoreDate || !state.date || slot.date === state.date) && matchesRegion(slot, state.region) &&
    (!state.saved || favorites.has(venueKey(slot))) && (!state.time || timeBucket(slot) === state.time) &&
    (!state.weekend || isWeekendDate(slot.date)) && matchesSearch(slot, state.query));
}
function setOptions(select, options, current) {
  select.replaceChildren(new Option("Any date", ""), ...options.map(([date, count]) => new Option(`${formatDate(date, "short")} · ${count}`, date)));
  select.value = options.some(([date]) => date === current) ? current : "";
}
function renderDateOptions() {
  const options = dateSlotCounts(data.slots.filter((slot) => (slot.sport || "tennis") === activeSport), data.summary?.datesChecked || []);
  const current = els.dateFilter.value;
  setOptions(els.dateFilter, options, current);
  setOptions(els.mobileDateFilter, options, current);
}
function renderDateStrip() {
  const options = dateSlotCounts(filteredSlots({ ignoreDate: true }));
  const current = els.dateFilter.value;
  els.dateStrip.innerHTML = `<button class="date-chip ${current ? "" : "active"}" data-date=""><span>Any</span><strong>${options.reduce((sum, [, count]) => sum + count, 0)}</strong></button>` + options.slice(0, 18).map(([date, count]) => {
    const parsed = localDate(date);
    const day = new Intl.DateTimeFormat("en", { weekday: "short" }).format(parsed);
    return `<button class="date-chip ${date === current ? "active" : ""}" data-date="${date}"><span>${day}</span><strong>${parsed.getDate()} · ${count}</strong></button>`;
  }).join("");
  els.dateStrip.querySelectorAll("[data-date]").forEach((button) => button.addEventListener("click", () => {
    els.dateFilter.value = button.dataset.date;
    transition(render);
  }));
}
function renderActiveFilters() {
  const state = filters();
  const chips = [];
  if (state.date) chips.push(formatDate(state.date, "short"));
  if (state.time) chips.push(state.time);
  if (state.region) chips.push(state.region);
  if (state.query) chips.push(`“${state.query}”`);
  if (state.weekend) chips.push("Weekends");
  if (state.saved) chips.push("Saved");
  els.activeFilters.innerHTML = chips.map((label) => `<span class="filter-chip">${escapeHtml(label)}</span>`).join("");
  els.activeFilterCount.textContent = String(chips.length);
}
function tierLabel(slot) {
  const tier = preferenceTier(slot, schedule);
  return tier === 0 ? "Prime weekend" : tier === 1 ? "Weekend match" : tier === 2 ? "After work" : "Open court";
}
function slotCourtNames(slot) {
  const names = [...(slot.roomNames || []), legacyCourtName(slot)].filter(Boolean);
  return names.length ? [...new Set(names)] : [slot.roomName || slot.courtName || "Available space"];
}
function renderCard(slot) {
  const isPhoneBooking = slot.bookingMethod === "phone" && slot.bookingPhone;
  const sourceUrl = safeUrl(slot.sourceUrl);
  const url = safeUrl(bookingLink(slot));
  const saved = favorites.has(venueKey(slot));
  const courts = slotCourtNames(slot);
  const distance = slot.distanceFromYokohamaStationKm != null ? `${escapeHtml(slot.distanceFromYokohamaStationKm)} km from Yokohama Station` : escapeHtml(slot.area || "Public facility");
  const action = isPhoneBooking
    ? `<a href="tel:${slot.bookingPhone.replace(/\D/g, "")}" class="reserve-btn reserve-btn-phone">Call Komaoka</a>`
    : `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="reserve-btn">Book now <span aria-hidden="true">↗</span></a>`;
  const sourceLink = sourceUrl !== "#" ? `<a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer" class="slot-source-link">Source calendar ↗</a>` : "";
  const note = slot.linkNote ? `<p class="slot-card-warning">${escapeHtml(slot.linkNote)}</p>` : "";
  return `<article class="slot-card ${isPhoneBooking ? "slot-card-komaoka" : ""}" data-venue="${escapeHtml(venueKey(slot))}">
    <div class="slot-time"><time datetime="${escapeHtml(`${slot.date}T${slot.startTime}`)}">${escapeHtml(slot.startTime)}</time><span>to ${escapeHtml(slot.endTime)}</span></div>
    <div class="facility-availability-main"><span class="match-badge ${isPhoneBooking ? "booking-badge-phone" : "booking-badge"}">${isPhoneBooking ? "Phone booking" : tierLabel(slot)}</span><span class="slot-card-facility">${escapeHtml(slot.facilityName)}${slot.indoor && !/\(indoor\)/i.test(slot.facilityName) ? ' <span class="indoor-label">indoor</span>' : ""}</span><div class="slot-card-courts facility-courts">${courts.map((court) => `<span class="court-pill">${escapeHtml(court)}</span>`).join("")}</div></div>
    <div class="slot-meta"><span>${distance}</span><span>${escapeHtml(slot.provider || "official")} source</span></div>
    <div class="slot-actions"><button class="save-button ${saved ? "saved" : ""}" type="button" data-save aria-label="${saved ? "Remove saved venue" : "Save venue"}" aria-pressed="${saved}">${saved ? "★" : "☆"}</button>${action}</div>
    <details class="slot-details"><summary>Booking details</summary><div class="slot-details-content">${sourceLink}${note}</div></details>
  </article>`;
}
function renderSlots(slots) {
  let previousDate = "";
  els.slots.innerHTML = slots.map((slot) => {
    const divider = slot.date === previousDate ? "" : `<div class="date-divider"><time datetime="${escapeHtml(slot.date)}">${escapeHtml(formatDate(slot.date))}</time></div>`;
    previousDate = slot.date;
    return divider + renderCard(slot);
  }).join("");
  els.slots.querySelectorAll("[data-save]").forEach((button) => button.addEventListener("click", () => {
    const key = button.closest("[data-venue]").dataset.venue;
    if (favorites.has(key)) favorites.delete(key); else favorites.add(key);
    save("court-finder-venues", [...favorites]);
    render();
    announce(favorites.has(key) ? "Venue saved" : "Venue removed");
  }));
}
function renderSummary() {
  const sportSlots = data.slots.filter((slot) => (slot.sport || "tennis") === activeSport);
  const best = rankSlots(sportSlots, schedule, "best", "recommended");
  const venues = new Set(sportSlots.map(venueKey));
  const coverage = data.coverage?.[activeSport] ?? data.summary?.coverage?.[activeSport];
  els.slotCount.textContent = sportSlots.length.toLocaleString();
  els.facilityCount.textContent = String(coverage ?? venues.size);
  els.facilityMetricLabel.textContent = coverage ? "Venues tracked" : "Venues with openings";
  els.bestMatchCount.textContent = String(best.length);
  els.allSlotCount.textContent = String(sportSlots.length);
  const meta = sportMeta[activeSport];
  els.eyebrow.textContent = meta.eyebrow;
  els.pageTitle.innerHTML = meta.headline;
  els.sportIndex.textContent = `${meta.number} / ${meta.title}`;
}
function render() {
  const ranked = rankSlots(filteredSlots(), schedule, viewMode, sortMode);
  const displaySlots = toDisplaySlots(ranked);
  renderSummary(); renderDateStrip(); renderActiveFilters(); renderSlots(displaySlots);
  els.resultCount.textContent = String(displaySlots.length);
  els.resultLabel.textContent = displaySlots.length === 1 ? "opening" : "openings";
  els.resultsTitle.textContent = viewMode === "best" ? "Best matches" : "All courts";
  els.emptyState.hidden = displaySlots.length > 0;
  els.slots.hidden = displaySlots.length === 0;
  els.slots.setAttribute("aria-busy", "false");
  for (const [button, selected] of [[els.viewBest, viewMode === "best"], [els.viewAll, viewMode === "all"]]) {
    button.classList.toggle("active", selected); button.setAttribute("aria-pressed", String(selected));
  }
  els.scheduleTimeLabel.textContent = schedule.weekdayStart;
  persistPreferences();
}
function clearFilters() {
  els.dateFilter.value = ""; els.timeFilter.value = ""; els.regionFilter.value = ""; els.searchFilter.value = "";
  els.weekendFilter.checked = false; els.favoritesFilter.checked = false;
  render(); els.dateFilter.focus(); announce("Filters cleared");
}
function updateThemeUI(theme) {
  const isDark = theme === "dark";
  document.documentElement.setAttribute("data-color-scheme", theme);
  $("meta[name='theme-color']").content = isDark ? "#09110e" : "#f4f3ed";
  els.themeSwitch.querySelector(".theme-switch-icon").textContent = isDark ? "☀" : "☾";
  els.themeSwitch.setAttribute("aria-label", isDark ? "Switch appearance" : "Switch appearance");
}
function setView(mode) { viewMode = mode; transition(render); announce(mode === "best" ? "Showing your best matches" : "Showing every court"); }

els.viewBest.addEventListener("click", () => setView("best"));
els.viewAll.addEventListener("click", () => setView("all"));
els.clearFilters.addEventListener("click", clearFilters);
els.weekendFilter.addEventListener("change", render);
els.favoritesFilter.addEventListener("change", render);
els.dateFilter.addEventListener("change", render);
els.timeFilter.addEventListener("change", render);
els.regionFilter.addEventListener("change", render);
els.searchFilter.addEventListener("input", render);
els.sortFilter.addEventListener("change", () => { sortMode = els.sortFilter.value; els.mobileSortFilter.value = sortMode; transition(render); });
els.mobileSortFilter.addEventListener("change", () => { sortMode = els.mobileSortFilter.value; els.sortFilter.value = sortMode; transition(render); });
els.themeSwitch.addEventListener("click", () => { const theme = document.documentElement.dataset.colorScheme === "dark" ? "light" : "dark"; updateThemeUI(theme); save("court-finder-theme", theme); });
els.editSchedule.addEventListener("click", () => {
  for (const key of ["saturday", "sunday", "weekdayEvenings"]) els.scheduleForm.elements[key].checked = schedule[key];
  els.scheduleForm.elements.weekdayStart.value = schedule.weekdayStart;
  els.scheduleDialog.showModal();
});
els.resetSchedule.addEventListener("click", () => {
  for (const key of ["saturday", "sunday", "weekdayEvenings"]) els.scheduleForm.elements[key].checked = DEFAULT_SCHEDULE[key];
  els.scheduleForm.elements.weekdayStart.value = DEFAULT_SCHEDULE.weekdayStart;
});
els.scheduleForm.addEventListener("submit", (event) => {
  if (event.submitter?.value !== "save") return;
  schedule = normalizeSchedule({
    saturday: els.scheduleForm.elements.saturday.checked,
    sunday: els.scheduleForm.elements.sunday.checked,
    weekdayEvenings: els.scheduleForm.elements.weekdayEvenings.checked,
    weekdayStart: els.scheduleForm.elements.weekdayStart.value
  });
  save("court-finder-schedule", schedule); render(); announce("Schedule updated");
});
els.filterDialogOpen.addEventListener("click", () => {
  els.mobileDateFilter.value = els.dateFilter.value; els.mobileTimeFilter.value = els.timeFilter.value;
  els.mobileRegionFilter.value = els.regionFilter.value; els.mobileSearchFilter.value = els.searchFilter.value;
  els.mobileWeekendFilter.checked = els.weekendFilter.checked; els.mobileFavoritesFilter.checked = els.favoritesFilter.checked;
  els.filterDialog.showModal();
});
els.applyMobileFilters.addEventListener("click", () => {
  els.dateFilter.value = els.mobileDateFilter.value; els.timeFilter.value = els.mobileTimeFilter.value;
  els.regionFilter.value = els.mobileRegionFilter.value; els.searchFilter.value = els.mobileSearchFilter.value;
  els.weekendFilter.checked = els.mobileWeekendFilter.checked; els.favoritesFilter.checked = els.mobileFavoritesFilter.checked;
  render();
});
els.filterDialogClose.addEventListener("click", () => els.filterDialog.close());
$("[data-empty-clear]").addEventListener("click", () => { clearFilters(); setView("all"); });
for (const tab of els.sportTabs) tab.addEventListener("click", () => {
  activeSport = tab.dataset.sport;
  els.sportTabs.forEach((item) => { const active = item === tab; item.classList.toggle("active", active); item.setAttribute("aria-pressed", String(active)); });
  renderDateOptions(); transition(render);
});

async function load() {
  try {
    const response = await fetch("data/availability.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    data = await response.json();
    const health = availabilityHealth(data);
    els.health.textContent = health.label;
    els.health.closest(".live-status").classList.toggle("warning", health.warning);
    els.lastChecked.textContent = data.generatedAt ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(data.generatedAt)) : "Unknown";
    const dates = [...new Set(data.slots.map((slot) => slot.date))].sort();
    els.dateWindow.textContent = dates.length ? `${formatDate(dates[0], "short")} – ${formatDate(dates.at(-1), "short")}` : "No date window";
    renderDateOptions(); render();
  } catch (error) {
    els.health.textContent = "Availability unavailable";
    els.slots.setAttribute("aria-busy", "false"); els.slots.replaceChildren();
    els.emptyState.hidden = false; els.emptyState.querySelector("h3").textContent = "Could not load availability";
    els.emptyState.querySelector("p").textContent = "Refresh the page in a moment.";
  }
}

els.sortFilter.value = sortMode;
els.mobileSortFilter.value = sortMode;
updateThemeUI(document.documentElement.dataset.colorScheme || "dark");
load();
