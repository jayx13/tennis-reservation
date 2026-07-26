import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isWeekendDate } from "../public/filters.js";

const [configText, html, app, css, localServer, workflow, readme] = await Promise.all([
  readFile(new URL("../reservation.config.json", import.meta.url), "utf8"),
  readFile(new URL("../public/index.html", import.meta.url), "utf8"),
  readFile(new URL("../public/app.js", import.meta.url), "utf8"),
  readFile(new URL("../public/styles.css", import.meta.url), "utf8"),
  readFile(new URL("./start.mjs", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/check-reservations.yml", import.meta.url), "utf8"),
  readFile(new URL("../README.md", import.meta.url), "utf8")
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
assert.match(app, /basketball:\s*\{[\s\S]*?facilityCount:\s*8,/, "eight tracked basketball venues");
assert.match(app, /clearFilters\.addEventListener/, "filter reset behavior");
assert.match(app, /weekendFilter\.addEventListener/, "weekend filter behavior");
assert.match(app, /weekendFilter\.checked\s*=\s*false/, "Clear resets weekend filter");
assert.doesNotMatch(app, /localStorage|data-theme|themeToggle/, "theme switching removed");

assert.match(css, /--acid:\s*#adff52/i, "acid-lime design token");
assert.match(css, /--cyan:\s*#58dbff/i, "cyan design token");
assert.match(css, /\.brand-mark/, "brand styling");
assert.match(css, /\.slot-card/, "result-row styling");
assert.match(css, /@media\s*\(max-width:/, "responsive breakpoint");
assert.match(css, /prefers-reduced-motion/, "reduced-motion support");
assert.match(css, /:focus-visible/, "keyboard focus treatment");
assert.match(css, /\.weekend-toggle/, "weekend filter styling");

assert.equal(isWeekendDate("2026-07-25"), true, "Saturday is weekend");
assert.equal(isWeekendDate("2026-07-26"), true, "Sunday is weekend");
assert.equal(isWeekendDate("2026-07-27"), false, "Monday is not weekend");

assert.match(localServer, /setInterval\(runScraper,\s*60 \* 60 \* 1000\)/, "hourly local refresh");
assert.match(workflow, /cron:\s*["']0 \* \* \* \*["']/, "hourly GitHub Actions refresh");
assert.match(html, /<strong>1h<\/strong>/, "hourly UI metric");
assert.doesNotMatch(readme, /every 2 hours/i, "hourly README copy");

console.log("Dashboard contract passed.");
