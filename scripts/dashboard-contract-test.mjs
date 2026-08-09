import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isWeekendDate, toDisplaySlots } from "../public/filters.js";

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
assert.match(html, /id="weekendFilter"[^>]*type="checkbox"|type="checkbox"[^>]*id="weekendFilter"/, "weekend checkbox");
assert.doesNotMatch(html, /themeToggle|Light mode|Dark mode/, "permanent dark markup");

assert.match(app, /facilityCount/, "facility metric rendering");
assert.match(app, /sportMeta/, "sport-aware copy");
assert.match(app, /tennis:\s*\{[\s\S]*?facilityCount:\s*6,/, "six tracked tennis venues");
assert.match(app, /basketball:\s*\{[\s\S]*?facilityCount:\s*9,/, "nine tracked basketball venues");
assert.match(app, /clearFilters\.addEventListener/, "filter reset behavior");
assert.match(app, /weekendFilter\.addEventListener/, "weekend filter behavior");
assert.match(app, /weekendFilter\.checked\s*=\s*false/, "Clear resets weekend filter");
assert.doesNotMatch(app, /localStorage|data-theme|themeToggle/, "theme switching removed");
assert.match(app, /bookingMethod\s*===\s*["']phone["']/, "phone booking branch");
assert.match(app, /tel:\$\{slot\.bookingPhone\.replace\(\/\\D\/g,\s*["']{2}\)\}/, "telephone URL generation");
assert.match(app, /Phone booking/, "phone booking badge");
assert.match(komaoka, /Call to reserve; availability is manually updated\./, "manual-update warning");
assert.match(app, /Source calendar/, "Komaoka source calendar link");
assert.match(app, /sourceUrl/, "source calendar metadata");

assert.match(css, /--acid:\s*#adff52/i, "acid-lime design token");
assert.match(css, /--cyan:\s*#58dbff/i, "cyan design token");
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

console.log("Dashboard contract passed.");
