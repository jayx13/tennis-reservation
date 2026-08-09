# Komaoka Basketball Availability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Komaoka Community Center's A/B/C basketball availability to the basketball tab with merged times, time-first court grouping, and one-tap telephone booking.

**Architecture:** A focused `scripts/komaoka.mjs` adapter owns CP932 decoding, calendar-grid parsing, bounded weekly collection, retry policy, and slot normalization. `scripts/check-slots.mjs` only orchestrates and merges that adapter's result. A pure display transformation in `public/filters.js` combines equal Komaoka time ranges across courts before `public/app.js` renders the phone-booking presentation.

**Tech Stack:** Node.js ES modules, built-in `fetch`, `TextDecoder("shift_jis")`, `node:assert/strict`, static HTML/CSS/JavaScript; no new runtime dependency.

## Global Constraints

- Komaoka appears only on the basketball tab.
- Source rooms are `r=41`, `r=42`, and `r=43`, displayed as `Court A`, `Court B`, and `Court C`.
- Check every source week intersecting today through the same calendar date two months ahead, inclusive; clamp invalid month-end dates.
- Only structurally valid blank cells are available. Booked, named, closed, unavailable, individual-use, missing, and unknown cells are not available.
- Merge adjacent hours only within the same date and court; keep one normalized record per court.
- Maximum source concurrency is three. Timeout is 15 seconds. Retry transient connection, timeout, HTTP 429, and HTTP 5xx failures once after a delay.
- Komaoka booking phone is `045-571-0035`; browser action is `tel:0455710035`.
- Always display `Availability is manually updated by the facility. Call to confirm.`
- Do not alter other providers' slot data, filtering, or reservation actions.

## File Structure

- Create `scripts/komaoka.mjs`: pure date/parser/merge helpers plus bounded network collector.
- Create `scripts/fixtures/komaoka-week-a.html`: deterministic UTF-8 fixture mirroring the source's weekly table and `rowspan` behavior after decoding.
- Create `scripts/komaoka-test.mjs`: adapter unit and mocked-network tests.
- Modify `scripts/check-slots.mjs`: invoke adapter and merge normalized results/check metadata.
- Modify `reservation.config.json`: Komaoka source, room, phone, horizon, timeout, concurrency, and retry configuration.
- Modify `package.json`: include Komaoka test in `npm test`.
- Modify `public/filters.js`: pure display-row grouping for identical Komaoka date/time ranges.
- Modify `public/app.js`: phone action, court-list rendering, source link, warning, and ninth basketball facility metadata.
- Modify `public/styles.css`: Komaoka badge, grouped-court row, phone CTA, warning, and responsive/focus states.
- Modify `scripts/dashboard-contract-test.mjs`: display transformation and markup/style contracts.
- Modify `README.md`: Komaoka source and phone-booking behavior.

### Task 1: Calendar Parser and Slot Merging

**Files:**

- Create: `scripts/komaoka.mjs`
- Create: `scripts/fixtures/komaoka-week-a.html`
- Create: `scripts/komaoka-test.mjs`
- Modify: `package.json`

**Interfaces:**

- Produces: `reservationEndDate(todayIso, months = 2) -> string`
- Produces: `weeklyStartDates(startIso, endIso) -> string[]`
- Produces: `decodeKomaokaHtml(bytes: ArrayBuffer|Uint8Array) -> string`
- Produces: `parseKomaokaWeek(html, context) -> RawKomaokaSlot[]`
- Produces: `mergeConsecutiveKomaokaSlots(slots) -> KomaokaSlot[]`
- `context`: `{ roomId: string, roomLabel: string, sourceUrl: string, year: number, month: number }`
- `RawKomaokaSlot`: `{ date, startTime, endTime, roomCode, roomName, sourceUrl }`

- [ ] **Step 1: Add a representative weekly fixture**

Create `scripts/fixtures/komaoka-week-a.html` with a seven-day header and the following logical states encoded with the source's actual classes/styles and `rowspan` attributes:

```html
<h2>体育室 A面(1/3)予約状況</h2>
<table class="list" width="100%">
  <tr><td class="list" rowspan="2">体育室 A面(1/3)</td><th>9</th><th>10</th><th>11</th><th>12</th><th>13</th><th>14</th><th>15</th></tr>
  <tr><td>日</td><td>月</td><td>火</td><td>水</td><td>木</td><td>金</td><td>土</td></tr>
  <tr><td>9:00 ～ 10:00</td><td>&nbsp;</td><td rowspan="2" style="background-color:#FFDDDD">×</td><td rowspan="4" style="background-color:#DDDDDD">個人利用</td><td>&nbsp;</td><td rowspan="2" style="background-color:#DDFFDD">閉館</td><td>&nbsp;</td><td>&nbsp;</td></tr>
  <tr><td>10:00 ～ 11:00</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
  <tr><td>11:00 ～ 12:00</td><td style="background-color:#FFDDDD">予約団体</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
  <tr><td>12:00 ～ 13:00</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
</table>
```

Keep the fixture deliberately small. It must exercise blank cells, `×`, a named booking, closed, individual use, and rowspans without copying an entire live page.

- [ ] **Step 2: Write failing date, decoding, parser, fail-closed, and merge tests**

Create `scripts/komaoka-test.mjs` with `node:assert/strict`. Include these exact contracts:

```js
assert.equal(reservationEndDate("2026-08-31", 2), "2026-10-31");
assert.equal(reservationEndDate("2026-12-31", 2), "2027-02-28");
assert.deepEqual(
  weeklyStartDates("2026-08-12", "2026-08-24"),
  ["2026-08-09", "2026-08-16", "2026-08-23"]
);
assert.equal(
  decodeKomaokaHtml(Buffer.from("975c96f189c2945c", "hex")),
  "予約可能"
);

const parsed = parseKomaokaWeek(fixture, {
  roomId: "41",
  roomLabel: "Court A",
  sourceUrl: "https://example.test/display.php?r=41&year=2026&month=08&day=09",
  year: 2026,
  month: 8
});
assert(parsed.some(slot => slot.date === "2026-08-09" && slot.startTime === "09:00"));
assert(!parsed.some(slot => slot.date === "2026-08-10" && slot.startTime === "09:00"));
assert(!parsed.some(slot => slot.date === "2026-08-11"));
assert(!parsed.some(slot => slot.date === "2026-08-13" && slot.startTime === "09:00"));

assert.throws(
  () => parseKomaokaWeek("<table><tr><td>unknown</td></tr></table>", {
    roomId: "41",
    roomLabel: "Court A",
    sourceUrl: "https://example.test/display.php?r=41",
    year: 2026,
    month: 8
  }),
  /Komaoka calendar structure/i
);

assert.deepEqual(
  mergeConsecutiveKomaokaSlots([
    slot("2026-08-09", "09:00", "10:00", "41"),
    slot("2026-08-09", "10:00", "11:00", "41"),
    slot("2026-08-09", "12:00", "13:00", "41"),
    slot("2026-08-09", "10:00", "11:00", "42")
  ]).map(({ roomCode, startTime, endTime }) => ({ roomCode, startTime, endTime })),
  [
    { roomCode: "41", startTime: "09:00", endTime: "11:00" },
    { roomCode: "42", startTime: "10:00", endTime: "11:00" },
    { roomCode: "41", startTime: "12:00", endTime: "13:00" }
  ]
);
```

- [ ] **Step 3: Run the focused test and confirm failure**

Run: `node scripts/komaoka-test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `scripts/komaoka.mjs`.

- [ ] **Step 4: Implement the pure adapter helpers**

In `scripts/komaoka.mjs`:

- use JST-safe ISO date arithmetic rather than local machine timezone arithmetic;
- find Sunday on or before `startIso`, then advance by seven days while `weekStart <= endIso`;
- decode bytes with `new TextDecoder("shift_jis", { fatal: true })`;
- isolate `table.list`, tokenize `tr` and `th`/`td`, decode entities, and strip tags;
- reconstruct the logical grid with a seven-column rowspan occupancy array;
- validate exactly seven numeric day headings, recognized hourly row labels, expected room heading, and no overflow/underflow;
- classify a cell as available only when its stripped text is empty and it has no known booked/unavailable/individual-use marker;
- handle month rollover by advancing the month when a day number decreases across the seven headers;
- sort and merge only exact adjacency for identical date/room keys.

Return plain objects; do not perform network access in these helpers.

- [ ] **Step 5: Add the focused test to the project test command**

Change `package.json` to:

```json
"test": "node scripts/komaoka-test.mjs && node scripts/dashboard-contract-test.mjs"
```

- [ ] **Step 6: Run focused and full tests**

Run: `node scripts/komaoka-test.mjs && npm test`

Expected: `Komaoka tests passed.` and `Dashboard contract passed.`

- [ ] **Step 7: Commit parser deliverable**

```bash
git add package.json scripts/komaoka.mjs scripts/komaoka-test.mjs scripts/fixtures/komaoka-week-a.html
git commit -m "Add Komaoka calendar parser"
```

### Task 2: Bounded Collector and Scraper Integration

**Files:**

- Modify: `scripts/komaoka.mjs`
- Modify: `scripts/komaoka-test.mjs`
- Modify: `scripts/check-slots.mjs`
- Modify: `reservation.config.json`

**Interfaces:**

- Consumes Task 1 parser/date/merge exports.
- Produces: `collectKomaokaAvailability(options) -> Promise<{ slots, checks, statusCounts, facilitiesSeen, roomsSeen }>`
- `options`: `{ config, today, fetchImpl = fetch, sleepImpl, decodeImpl = decodeKomaokaHtml, now = () => new Date().toISOString() }`
- Normalized slot adds `{ sport, statusType, statusLabel, area, purpose, facilityName, courtName, facilityCode, phoneNumber, provider, bookingMethod, bookingPhone, sourceUrl, sourceRetrievedAt, link, linkNote }` to Task 1's time/room fields.

- [ ] **Step 1: Add failing normalized-collection tests with injected fetch**

Extend `scripts/komaoka-test.mjs` with a `response(bytes, status = 200)` helper and deterministic fake fetch. Test one generated week and three rooms:

Set `testConfig.horizonMonths` to `0` so `today: "2026-08-09"` produces exactly one weekly request per room. Have `successfulFixtureFetch` return the UTF-8 fixture bytes; the injected `decodeImpl` below deliberately bypasses production decoding, which is already covered independently by Task 1's CP932 byte test.

```js
const result = await collectKomaokaAvailability({
  config: testConfig,
  today: "2026-08-09",
  fetchImpl: successfulFixtureFetch,
  sleepImpl: async () => {},
  decodeImpl: bytes => Buffer.from(bytes).toString("utf8"),
  now: () => "2026-08-09T10:00:00.000Z"
});
assert.equal(result.checks.length, 3);
assert(result.slots.every(slot => slot.sport === "basketball"));
assert(result.slots.every(slot => slot.provider === "komaoka"));
assert(result.slots.every(slot => slot.bookingMethod === "phone"));
assert(result.slots.every(slot => slot.bookingPhone === "045-571-0035"));
assert(result.slots.every(slot => slot.sourceRetrievedAt === "2026-08-09T10:00:00.000Z"));
assert.deepEqual([...result.facilitiesSeen], ["komaoka:c12500"]);
assert.deepEqual([...result.roomsSeen].sort(), [
  "komaoka:c12500:41",
  "komaoka:c12500:42",
  "komaoka:c12500:43"
]);
```

Also add:

- a concurrency probe asserting active requests never exceed three;
- a 500-then-200 response asserting exactly one retry;
- a 404 response asserting no retry;
- one malformed room asserting two successful rooms remain and one error check is recorded;
- an all-failed case asserting empty Komaoka slots without throwing away the structured checks.

- [ ] **Step 2: Run the collector tests and confirm failure**

Run: `node scripts/komaoka-test.mjs`

Expected: FAIL because `collectKomaokaAvailability` is not exported.

- [ ] **Step 3: Implement bounded fetching and normalization**

Add to `scripts/komaoka.mjs`:

```js
export async function collectKomaokaAvailability({
  config,
  today,
  fetchImpl = fetch,
  sleepImpl = sleep,
  decodeImpl = decodeKomaokaHtml,
  now = () => new Date().toISOString()
}) { /* bounded task queue, per-request checks, normalize, merge */ }
```

Implementation requirements:

- build weeks with `weeklyStartDates(today, reservationEndDate(today, config.horizonMonths))`;
- create one request task per week/room and execute with `config.concurrency` workers, capped at three;
- construct URLs with `URL`/`searchParams`, retaining the exact `r`, `year`, `month`, and `day` parameters;
- use `AbortController` and `config.timeoutMs` (`15000`);
- retry only network/abort errors, 429, and 5xx once after `config.retryDelayMs`;
- decode `response.arrayBuffer()`, parse, filter to the inclusive horizon, and merge adjacent hours;
- record success/error per week and room without rejecting the overall collector;
- normalize facility code `c12500`, provider `komaoka`, status `KOMAOKA_AVAILABLE`, area `Yokohama`, purpose `Basketball`, source URL, source retrieval time, and required phone/manual-update metadata.

- [ ] **Step 4: Add exact Komaoka configuration**

Add a top-level `komaoka` object to `reservation.config.json`:

```json
"komaoka": {
  "baseUrl": "https://cgi.city.yokohama.lg.jp/shimin/chikucenter/display.php",
  "facilityCode": "c12500",
  "facilityName": "Komaoka Community Center",
  "sport": "basketball",
  "purpose": "Basketball",
  "phone": "045-571-0035",
  "horizonMonths": 2,
  "timeoutMs": 15000,
  "retryDelayMs": 500,
  "retries": 1,
  "concurrency": 3,
  "rooms": [
    { "id": "41", "label": "Court A" },
    { "id": "42", "label": "Court B" },
    { "id": "43", "label": "Court C" }
  ]
}
```

- [ ] **Step 5: Integrate the adapter into orchestration**

In `scripts/check-slots.mjs`:

- import `collectKomaokaAvailability`;
- call it after the Yokohama collector using `jstToday()`;
- append slots and checks;
- merge status counts;
- add returned facility/room keys;
- leave global deduplication and sorting unchanged;
- ensure a Komaoka failure produces checks but does not enter the top-level fatal fallback path.

- [ ] **Step 6: Run collector and full tests**

Run: `node scripts/komaoka-test.mjs && npm test`

Expected: all tests pass.

- [ ] **Step 7: Run one live, bounded smoke check**

Run with a temporary output override if supported by the script; otherwise run `npm run check` and inspect `public/data/availability.json` without committing it.

Verify with `rg` that output contains `"provider": "komaoka"`, `"bookingMethod": "phone"`, and only dates within the computed two-month horizon. If the live source has no blank cells, verify successful Komaoka check entries instead.

- [ ] **Step 8: Commit collector deliverable**

```bash
git add reservation.config.json scripts/check-slots.mjs scripts/komaoka.mjs scripts/komaoka-test.mjs
git commit -m "Collect Komaoka basketball availability"
```

### Task 3: Time-First Courts and Phone Booking UI

**Files:**

- Modify: `public/filters.js`
- Modify: `public/app.js`
- Modify: `public/styles.css`
- Modify: `scripts/dashboard-contract-test.mjs`

**Interfaces:**

- Produces: `toDisplaySlots(slots) -> DisplaySlot[]`
- `DisplaySlot` preserves the first normalized slot and adds `roomNames: string[]`.
- Komaoka display key: `provider + facilityCode + date + startTime + endTime`.
- Non-Komaoka input remains one display row per normalized slot.

- [ ] **Step 1: Write failing pure display-grouping tests**

Import `toDisplaySlots` in `scripts/dashboard-contract-test.mjs` and add:

```js
const grouped = toDisplaySlots([
  displaySlot("komaoka", "41", "Court A", "13:00", "17:00"),
  displaySlot("komaoka", "42", "Court B", "13:00", "17:00"),
  displaySlot("komaoka", "43", "Court C", "19:00", "21:00"),
  displaySlot("yokohama", "9", "Main Gym", "13:00", "17:00")
]);
assert.deepEqual(grouped.map(slot => slot.roomNames), [
  ["Court A", "Court B"],
  ["Court C"],
  ["Main Gym"]
]);
assert.equal(grouped.length, 3);
```

Add source-contract assertions for:

- basketball `facilityCount: 9`;
- `bookingMethod === "phone"` branch;
- `tel:` URL generation;
- `Phone booking` badge;
- exact manual-update warning;
- Komaoka source link;
- new Komaoka CSS selectors.

- [ ] **Step 2: Run dashboard test and confirm failure**

Run: `node scripts/dashboard-contract-test.mjs`

Expected: FAIL because `toDisplaySlots` is not exported.

- [ ] **Step 3: Implement stable display grouping**

In `public/filters.js`, export `toDisplaySlots`. Requirements:

- preserve input ordering by the first occurrence of each display key;
- combine only Komaoka slots with identical provider/facility/date/start/end;
- deduplicate and sort `roomNames` in A/B/C order;
- leave every non-Komaoka slot separate;
- never mutate input slots.

- [ ] **Step 4: Render Komaoka rows and actions**

In `public/app.js`:

- import and apply `toDisplaySlots(dateSlots)` inside each date group;
- keep date count based on normalized `dateSlots.length`, not grouped visual rows;
- render `roomNames.join(", ")` on the right of the prominent merged range;
- render `Phone booking` badge for `bookingMethod === "phone"`;
- build `tel:${bookingPhone.replace(/\D/g, "")}` only from normalized phone metadata;
- label CTA `Call Komaoka · 045-571-0035`;
- omit `target="_blank"` for telephone links;
- preserve existing external reservation links and labels for other providers;
- add a separate safe HTTP(S) `Source calendar` link from `sourceUrl`;
- show the exact manual-update warning from `linkNote`;
- update basketball metadata to nine tracked facilities and mention Komaoka phone booking.

- [ ] **Step 5: Add polished responsive styles**

In `public/styles.css`, add focused styles for:

- `.slot-card-komaoka` accent without changing the global palette;
- `.booking-badge-phone`;
- `.slot-card-courts` aligned opposite the time range on wide screens and stacked below it on small screens;
- `.reserve-btn-phone` with existing acid-lime hierarchy;
- `.slot-source-link` and `.slot-card-warning` secondary hierarchy;
- visible `:focus-visible` states and reduced-motion compliance.

Use existing spacing, radius, typography, `--acid`, `--cyan`, and dark-surface tokens. Do not add a second visual system.

- [ ] **Step 6: Run dashboard and full tests**

Run: `node scripts/dashboard-contract-test.mjs && npm test`

Expected: all tests pass.

- [ ] **Step 7: Verify responsive rendering locally**

Run: `npm start`

Inspect basketball tab at desktop and narrow/mobile widths using representative Komaoka fixture data. Verify date-first order, merged time-first rows, A/B/C labels, keyboard focus, phone CTA, source link, warning, and no regression in Yokohama cards. Stop the server after inspection.

- [ ] **Step 8: Commit UI deliverable**

```bash
git add public/filters.js public/app.js public/styles.css scripts/dashboard-contract-test.mjs
git commit -m "Show Komaoka phone-booking slots"
```

### Task 4: Documentation and Final Verification

**Files:**

- Modify: `README.md`
- Modify if contract coverage requires it: `scripts/dashboard-contract-test.mjs`

**Interfaces:** None; this task documents and verifies completed behavior.

- [ ] **Step 1: Write the failing documentation contracts**

Extend `scripts/dashboard-contract-test.mjs` to require README coverage of:

```js
assert.match(readme, /Komaoka Community Center/, "Komaoka documented");
assert.match(readme, /045-571-0035/, "Komaoka phone documented");
assert.match(readme, /manually updated/i, "manual freshness caveat documented");
assert.match(readme, /nine Yokohama venues/i, "basketball venue count documented");
```

- [ ] **Step 2: Run the documentation contract and confirm failure**

Run: `node scripts/dashboard-contract-test.mjs`

Expected: FAIL with `Komaoka documented`.

- [ ] **Step 3: Update README**

Document:

- nine basketball venues including Komaoka;
- Komaoka's separate manually updated city calendar source;
- blank-only availability interpretation;
- two-month collection horizon;
- phone/in-person booking and `045-571-0035`;
- requirement to call and confirm freshness.

- [ ] **Step 4: Run static validation**

Run:

```bash
node --check scripts/komaoka.mjs
node --check scripts/check-slots.mjs
node --check public/app.js
node --check public/filters.js
npm test
```

Expected: syntax checks exit 0; `Komaoka tests passed.` and `Dashboard contract passed.`

- [ ] **Step 5: Run final live data and UI smoke tests**

Run `npm run check`, then `npm start`. Confirm:

- all successful Komaoka dates are within today plus two calendar months;
- no booked/closed/individual-use fixture states appear as slots;
- basketball tab lists Komaoka under the correct dates;
- consecutive hours are merged;
- equal ranges show combined court labels;
- phone action opens `tel:0455710035`;
- source calendar opens separately;
- warning is visible;
- tennis and existing basketball cards remain functional.

- [ ] **Step 6: Inspect final diff and repository state**

Run:

```bash
git diff --check
git status --short
git diff --stat HEAD~3..HEAD
```

Confirm no generated `public/data/availability.json`, `.superpowers/`, or unrelated user files are staged.

- [ ] **Step 7: Commit documentation**

```bash
git add README.md scripts/dashboard-contract-test.mjs
git commit -m "Document Komaoka availability source"
```

- [ ] **Step 8: Request final code review**

Invoke `superpowers:requesting-code-review`, address findings, rerun the complete verification commands, then use `superpowers:verification-before-completion` before reporting success.
