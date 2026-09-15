import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as dashboardFilters from "../public/filters.js";

const { isWeekendDate, toDisplaySlots } = dashboardFilters;
assert.deepEqual(dashboardFilters.normalizeSchedule(undefined), {
  saturday: true,
  sunday: true,
  weekdayEvenings: true,
  weekdayStart: "19:00"
});
assert.deepEqual(dashboardFilters.normalizeSchedule({
  saturday: false,
  sunday: "yes",
  weekdayEvenings: false,
  weekdayStart: "25:00"
}), {
  saturday: false,
  sunday: true,
  weekdayEvenings: false,
  weekdayStart: "19:00"
});
assert.notEqual(dashboardFilters.normalizeSchedule(undefined), dashboardFilters.normalizeSchedule(undefined));

const preferenceSchedule = dashboardFilters.normalizeSchedule(undefined);
const preferenceSlots = [
  { id: "weekend-evening", date: "2026-09-19", startTime: "19:00", facilityName: "C", provider: "yokohama", facilityCode: "3", distanceFromYokohamaStationKm: 7 },
  { id: "weekend-day", date: "2026-09-20", startTime: "09:00", facilityName: "B", provider: "yokohama", facilityCode: "2", distanceFromYokohamaStationKm: 4 },
  { id: "weekday-evening", date: "2026-09-21", startTime: "20:00", facilityName: "A", provider: "yokohama", facilityCode: "1", distanceFromYokohamaStationKm: 2 },
  { id: "weekday-day", date: "2026-09-21", startTime: "18:00", facilityName: "D", provider: "yokohama", facilityCode: "4", distanceFromYokohamaStationKm: 1 }
];
assert.deepEqual(preferenceSlots.map(slot => dashboardFilters.preferenceTier(slot, preferenceSchedule)), [0, 1, 2, 3]);
assert.deepEqual(dashboardFilters.rankSlots(preferenceSlots, preferenceSchedule, "best", "recommended").map(slot => slot.id), [
  "weekend-evening", "weekend-day", "weekday-evening"
]);
assert.deepEqual(dashboardFilters.rankSlots(preferenceSlots, preferenceSchedule, "all", "recommended").map(slot => slot.id), [
  "weekend-evening", "weekend-day", "weekday-evening", "weekday-day"
]);
assert.deepEqual(dashboardFilters.rankSlots(preferenceSlots, preferenceSchedule, "all", "soonest").map(slot => slot.id), [
  "weekend-evening", "weekend-day", "weekday-day", "weekday-evening"
]);
assert.deepEqual(dashboardFilters.rankSlots(preferenceSlots, preferenceSchedule, "all", "startTime").map(slot => slot.id), [
  "weekend-day", "weekday-day", "weekend-evening", "weekday-evening"
]);
assert.deepEqual(dashboardFilters.rankSlots(preferenceSlots, preferenceSchedule, "all", "distance").map(slot => slot.id), [
  "weekday-day", "weekday-evening", "weekend-day", "weekend-evening"
]);
assert.deepEqual(preferenceSlots.map(slot => slot.id), ["weekend-evening", "weekend-day", "weekday-evening", "weekday-day"]);
assert.deepEqual(dashboardFilters.kawasakiBookingLinks(), [
  { label: "Basketball", url: "https://www.fureai-net.city.kawasaki.jp/web/?IKIND=2000" },
  { label: "Barbecue", url: "https://www.fureai-net.city.kawasaki.jp/web/?IKIND=1000" }
]);
assert.equal(
  dashboardFilters.bookingLink({ reservationUrl: "https://example.com/legacy" }),
  "https://example.com/legacy"
);
assert.equal(
  dashboardFilters.bookingLink({ link: "https://example.com/current", reservationUrl: "https://example.com/legacy" }),
  "https://example.com/current"
);
assert.equal(dashboardFilters.matchesRegion({}, "kanagawa"), true);
assert.equal(dashboardFilters.matchesRegion({ provider: "ekanagawa" }, "kanagawa"), true);
assert.equal(dashboardFilters.matchesRegion({}, "kawasaki"), false);
assert.equal(dashboardFilters.venueKey({ facilityCode: "42" }), "ekanagawa|42");
const healthNow = Date.parse("2026-09-14T12:00:00Z");
const healthySnapshot = { ok: true, generatedAt: "2026-09-14T11:00:00Z", checks: [] };
assert.equal(dashboardFilters.availabilityHealth(healthySnapshot, healthNow).warning, false);
assert.equal(dashboardFilters.availabilityHealth({ ...healthySnapshot, checks: [{ error: "timeout" }] }, healthNow).label, "Latest check incomplete");
assert.equal(dashboardFilters.availabilityHealth({ ...healthySnapshot, generatedAt: "2026-09-14T09:59:00Z" }, healthNow).label, "Data older than 2 hours");
assert.equal(dashboardFilters.availabilityHealth({ ...healthySnapshot, generatedAt: null }, healthNow).warning, true);
assert.deepEqual(dashboardFilters.dateSlotCounts([{ date: "2026-09-15" }], ["2026-09-14", "2026-09-15"]), [["2026-09-14", 0], ["2026-09-15", 1]]);

const [configText, html, app, css, localServer, workflow, readme, komaoka] = await Promise.all([
  readFile(new URL("../reservation.config.json", import.meta.url), "utf8"),
  readFile(new URL("../public/index.html", import.meta.url), "utf8"),
  readFile(new URL("../public/app.js", import.meta.url), "utf8"),
  readFile(new URL("../public/styles.css", import.meta.url), "utf8"),
  readFile(new URL("./start.mjs", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/check-reservations.yml", import.meta.url), "utf8"),
  readFile(new URL("../README.md", import.meta.url), "utf8"),
  readFile(new URL("./komaoka.mjs", import.meta.url), "utf8")
]);

const config = JSON.parse(configText);
const basketballFacilities = config.yokohama.facilities.filter(({ sport }) => sport === "basketball");
const expectedFacilities = new Map([
  ["1", "鶴見スポーツセンター"],
  ["2", "神奈川スポーツセンター"],
  ["3", "西スポーツセンター"],
  ["4", "中スポーツセンター"],
  ["5", "南スポーツセンター"],
  ["6", "港南スポーツセンター"],
  ["7", "保土ケ谷スポーツセンター"],
  ["19", "平沼記念体育館"]
]);

assert.equal(basketballFacilities.length, expectedFacilities.size, "basketball facility count");
for (const facility of basketballFacilities) {
  assert.equal(expectedFacilities.get(facility.code), facility.name, `facility ${facility.code}`);
  assert.equal(facility.purposeCode, "9", `${facility.name} basketball purpose code`);
}

assert.match(html, /class="skip-link" href="#main-content"/, "skip link");
assert.match(html, /id="main-content"/, "main landmark target");
assert.match(html, /class="brand-mark"/, "Night Arena brand");
assert.match(html, /id="facilityCount"/, "facility metric");
assert.match(html, /id="clearFilters"/, "filter reset control");
for (const id of [
  "viewBest", "viewAll", "editSchedule", "scheduleDialog", "scheduleForm",
  "sortFilter", "filterDialog", "filterDialogOpen", "filterDialogClose",
  "toast", "bestMatchCount", "allSlotCount"
]) {
  assert.match(html, new RegExp(`id=["']${id}["']`), `${id} UI contract`);
}
assert.match(html, /<dialog[^>]+id="scheduleDialog"/, "schedule editor uses native dialog");
assert.match(html, /<dialog[^>]+id="filterDialog"/, "mobile filters use native dialog");
assert.match(html, /id="toast"[^>]+aria-live="polite"/, "toast is announced accessibly");
assert.match(html, /aria-label="Availability view"/, "view switch has an accessible label");
assert.match(html, /id="weekendFilter"[^>]*type="checkbox"|type="checkbox"[^>]*id="weekendFilter"/, "weekend checkbox");
assert.doesNotMatch(html, /themeToggle|Light mode|Dark mode/, "permanent dark markup");

assert.match(app, /facilityCount/, "facility metric rendering");
assert.match(app, /sportMeta/, "sport-aware copy");
assert.match(app, /data\.coverage/, "venue totals use coverage metadata");
assert.match(app, /Venues with openings/, "fallback total accurately labeled");
assert.match(app, /clearFilters\.addEventListener/, "filter reset behavior");
assert.match(app, /court-finder-schedule/, "saved schedule storage key");
assert.match(app, /normalizeSchedule/, "schedule state normalization");
assert.match(app, /rankSlots/, "ranked feed rendering");
assert.match(app, /viewMode/, "Best and All view state");
assert.match(app, /sortMode/, "sort mode state");
assert.match(app, /scheduleDialog\.showModal\(\)/, "native schedule dialog wiring");
assert.match(app, /filterDialog\.showModal\(\)/, "native mobile filter dialog wiring");
assert.match(app, /startViewTransition/, "progressive view transitions");
assert.match(app, /toast\.classList\.add\(["']show["']\)/, "toast feedback");
assert.match(app, /<time datetime=/, "result cards use semantic time markup");
assert.match(app, /weekendFilter\.addEventListener/, "weekend filter behavior");
assert.match(app, /weekendFilter\.checked\s*=\s*false/, "Clear resets weekend filter");
assert.doesNotMatch(app, /data-theme|themeToggle/, "theme switching removed");
assert.match(app, /localStorage/, "saved venue preferences");
assert.match(app, /bookingMethod\s*===\s*["']phone["']/, "phone booking branch");
assert.match(app, /tel:\$\{slot\.bookingPhone\.replace\(\/\\D\/g,\s*["']{2}\)\}/, "telephone URL generation");
assert.match(app, /Phone booking/, "phone booking badge");
assert.match(komaoka, /Availability is manually updated by the facility\. Call to confirm\./, "manual-update warning");
assert.match(app, /Source calendar/, "Komaoka source calendar link");
assert.match(app, /sourceUrl/, "source calendar metadata");

assert.match(css, /--acid:\s*#d9f279/i, "lime design token");
assert.match(css, /--forest:\s*#183f31/i, "forest design token");
assert.match(html, /id="themeSwitch"/, "theme switcher control");
assert.match(html, /class="theme-switch"/, "theme switcher styling hook");
assert.match(app, /themeSwitch/, "theme switch wiring");
assert.match(app, /updateThemeUI/, "theme UI updates");
assert.match(css, /prefers-color-scheme:\s*dark/i, "system dark mode media query");
assert.match(css, /\[data-color-scheme=["']dark["']\]/i, "dark mode token overrides");
assert.match(css, /\.brand-mark/, "brand styling");
assert.match(css, /\.slot-card/, "result-row styling");
assert.match(css, /@media\s*\(max-width:/, "responsive breakpoint");
assert.match(css, /prefers-reduced-motion/, "reduced-motion support");
assert.match(css, /:focus-visible/, "keyboard focus treatment");
assert.match(css, /\.weekend-toggle/, "weekend filter styling");
assert.match(css, /\.slot-card-komaoka/, "Komaoka card styling");
assert.match(css, /\.booking-badge-phone/, "phone booking badge styling");
assert.match(css, /\.slot-card-courts/, "Komaoka court grouping styling");
assert.match(css, /\.reserve-btn-phone/, "phone booking CTA styling");
assert.match(css, /\.slot-source-link/, "source calendar link styling");
assert.match(css, /\.slot-card-warning/, "manual-update warning styling");
assert.match(css, /\.slot-source-link\s*\{[\s\S]*?min-height:\s*44px;/, "source calendar tap target");
assert.match(css, /@media\s*\(max-width:\s*680px\)\s*\{[\s\S]*?\.slot-card-komaoka\s*\{[\s\S]*?grid-template-columns:\s*1fr\s*[;}]/, "Komaoka mobile card stacks");
assert.equal(dashboardFilters.matchesRegion({ provider: "komaoka" }, "yokohama"), true, "phone venue included in Yokohama");
assert.equal(dashboardFilters.matchesRegion({ provider: "kawasaki" }, "yokohama"), false, "region separation");
assert.notEqual(dashboardFilters.venueKey({ provider: "kawasaki", facilityCode: "1" }), dashboardFilters.venueKey({ provider: "yokohama", facilityCode: "1" }), "favorites isolated by provider");

function displaySlot(provider, roomCode, roomName, startTime, endTime) {
  return {
    provider,
    facilityCode: provider === "komaoka" ? "c12500" : roomCode,
    roomCode,
    roomName,
    date: "2026-08-17",
    startTime,
    endTime
  };
}

const displayInput = [
  displaySlot("komaoka", "41", "Court A", "13:00", "17:00"),
  displaySlot("komaoka", "42", "Court B", "13:00", "17:00"),
  displaySlot("komaoka", "43", "Court C", "19:00", "21:00"),
  displaySlot("yokohama", "9", "Main Gym", "13:00", "17:00")
];
const grouped = toDisplaySlots(displayInput);

assert.deepEqual(grouped.map((slot) => slot.roomNames), [
  ["Court A", "Court B"],
  ["Court C"],
  ["Main Gym"]
], "Komaoka courts share only matching display ranges");
assert.equal(grouped.length, 3, "Komaoka matching display ranges render once");
assert.notStrictEqual(grouped[0], displayInput[0], "display grouping does not mutate normalized slots");
assert.deepEqual(displayInput.map((slot) => slot.roomNames), [undefined, undefined, undefined, undefined], "normalized slots stay unchanged");
assert.equal(typeof dashboardFilters.legacyCourtName, "function", "legacy court display behavior is defined");
assert.equal(dashboardFilters.legacyCourtName({
  provider: "komaoka",
  roomNames: ["Court A", "Court B"],
  courtName: "Court A"
}), "", "Komaoka grouped courts suppress the duplicate legacy label");
assert.deepEqual([
  ...grouped[0].roomNames,
  dashboardFilters.legacyCourtName({ ...grouped[0], courtName: "Court A" })
].filter(Boolean), ["Court A", "Court B"], "each grouped Komaoka court displays once");
assert.equal(dashboardFilters.legacyCourtName({
  provider: "yokohama",
  roomNames: ["Main Gym", "Sub Gym"],
  courtName: "Main Gym"
}), "", "grouped rows suppress the duplicate legacy label");
assert.equal(dashboardFilters.legacyCourtName({
  provider: "yokohama",
  roomNames: ["Main Gym"],
  courtName: "Main Gym"
}), "Main Gym", "ungrouped legacy rows retain their court label");

const sortedCourts = toDisplaySlots([
  displaySlot("komaoka", "51", "Court C", "09:00", "11:00"),
  displaySlot("komaoka", "52", "Court A", "09:00", "11:00"),
  displaySlot("komaoka", "53", "Court B", "09:00", "11:00"),
  displaySlot("komaoka", "52", "Court A", "09:00", "11:00")
]);
assert.deepEqual(sortedCourts[0].roomNames, ["Court A", "Court B", "Court C"], "Komaoka court labels deduplicate and sort");

const separateNonKomaoka = toDisplaySlots([
  displaySlot("yokohama", "9", "Main Gym", "13:00", "17:00"),
  displaySlot("yokohama", "9", "Main Gym", "13:00", "17:00")
]);
assert.equal(separateNonKomaoka.length, 2, "non-Komaoka slots keep one display row per normalized slot");

assert.equal(isWeekendDate("2026-07-25"), true, "Saturday is weekend");
assert.equal(isWeekendDate("2026-07-26"), true, "Sunday is weekend");
assert.equal(isWeekendDate("2026-07-27"), false, "Monday is not weekend");

assert.match(localServer, /setInterval\(runScraper,\s*60 \* 60 \* 1000\)/, "hourly local refresh");
assert.match(workflow, /cron:\s*["']0 \* \* \* \*["']/, "hourly GitHub Actions refresh");
assert.match(html, /<strong>1h<\/strong>/, "hourly UI metric");
assert.doesNotMatch(readme, /every 2 hours/i, "hourly README copy");

assert.match(readme, /Komaoka Community Center/, "Komaoka documented");
assert.match(readme, /045-571-0035/, "Komaoka phone documented");
assert.match(readme, /manually updated/i, "manual freshness caveat documented");
assert.match(readme, /nine Yokohama venues/i, "basketball venue count documented");
assert.match(readme, /from today through the corresponding date two months later/i, "rolling Komaoka horizon documented");
assert.match(readme, /clamped to the last day of a shorter target month/i, "Komaoka month-end horizon documented");
console.log("Dashboard contract passed.");
