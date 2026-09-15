# Ranked Booking Feed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dark-mode-capable, schedule-aware booking feed that prioritizes weekends and weekday evenings while preserving one-tap access to all courts.

**Architecture:** Add deterministic schedule and ranking functions to the existing pure filter module, then replace nested availability markup and rendering with a flat card feed controlled by a view switch and HTML5 schedule/filter dialogs. Keep all provider collection and availability JSON contracts unchanged.

**Tech Stack:** Vanilla ES modules, semantic HTML5, CSS Grid/Flexbox, localStorage, HTML5 `<dialog>`/`<details>`/`<time>`, optional View Transitions API, Node.js assertion tests, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-09-15-ranked-booking-feed-design.md`

## Global Constraints

- Vanilla HTML, CSS, and JavaScript only.
- No external runtime libraries or build step.
- GitHub Pages deployment remains unchanged.
- Existing provider data and booking behavior remain compatible.
- Default schedule is Saturday and Sunday all day plus Monday–Friday slots starting at or after `19:00`.
- Best for me includes weekend-evening, weekend-daytime, and weekday-evening tiers; All courts includes every slot.
- Both dark and light themes must meet WCAG AA contrast.
- Booking buttons must retain at least a `44px` mobile tap target.

### Task 1: Schedule Preference and Ranking Domain

**Files:**

- Modify: `public/filters.js`
- Test: `scripts/dashboard-contract-test.mjs`

**Interfaces:**

- Produces: `DEFAULT_SCHEDULE`
- Produces: `normalizeSchedule(value) -> { saturday: boolean, sunday: boolean, weekdayEvenings: boolean, weekdayStart: string }`
- Produces: `preferenceTier(slot, schedule) -> 0 | 1 | 2 | 3`
- Produces: `rankSlots(slots, schedule, mode, sortMode) -> Slot[]`
- Consumes: existing slot fields `date`, `startTime`, `facilityName`, `provider`, `facilityCode`, and `distanceFromYokohamaStationKm`

- [ ] **Step 1: Write failing schedule normalization and default tests**

Add literal assertions for valid schedules, malformed storage values, invalid time strings, and defensive copy behavior.

- [ ] **Step 2: Run the targeted test and confirm RED**

Run: `node scripts/dashboard-contract-test.mjs`

Expected: FAIL because schedule exports do not exist.

- [ ] **Step 3: Implement schedule normalization**

Add immutable defaults and validation without reading browser globals.

- [ ] **Step 4: Run the targeted test and confirm GREEN**

Run: `node scripts/dashboard-contract-test.mjs`

- [ ] **Step 5: Write failing ranking behavior tests**

Use literal slots covering weekend evening, weekend daytime, weekday evening, weekday daytime, ties, distance ordering, and Best versus All inclusion.

- [ ] **Step 6: Run the targeted test and confirm RED**

Run: `node scripts/dashboard-contract-test.mjs`

Expected: FAIL because ranking exports do not exist.

- [ ] **Step 7: Implement deterministic ranking and sorting**

Implement tiers and stable tie breakers. Do not mutate caller arrays.

- [ ] **Step 8: Run the full suite and confirm GREEN**

Run: `npm test`

### Task 2: Semantic Booking Feed Shell

**Files:**

- Modify: `public/index.html`
- Modify: `public/styles.css`
- Test: `scripts/dashboard-contract-test.mjs`

**Interfaces:**

- Produces DOM IDs: `viewBest`, `viewAll`, `editSchedule`, `scheduleDialog`, `scheduleForm`, `sortFilter`, `filterDialog`, `filterDialogOpen`, `filterDialogClose`, `toast`, `bestMatchCount`, `allSlotCount`
- Preserves DOM IDs consumed by existing behavior: `themeSwitch`, `health`, `lastChecked`, `sportTabs`, `dateFilter`, `timeFilter`, `searchFilter`, `weekendFilter`, `favoritesFilter`, `clearFilters`, `dateStrip`, `slots`, `emptyState`, `resultCount`

- [ ] **Step 1: Write failing semantic shell assertions**

Assert primary view buttons, labeled dialogs/forms, sort control, toast live region, and preserved accessibility landmarks.

- [ ] **Step 2: Run the targeted test and confirm RED**

Run: `node scripts/dashboard-contract-test.mjs`

- [ ] **Step 3: Replace the page shell with approved feed hierarchy**

Use semantic header/main/section/nav/dialog/form markup. Keep scripts and provider shortcuts.

- [ ] **Step 4: Build dark-first responsive styles**

Implement tokens for both themes, segmented controls, flat result cards, sticky mobile actions, horizontal date rail, dialogs, loading skeletons, toast, focus states, and reduced-motion overrides.

- [ ] **Step 5: Run the targeted test and syntax checks**

Run: `node scripts/dashboard-contract-test.mjs && node --check public/app.js`

### Task 3: Interactive Feed State and Rendering

**Files:**

- Modify: `public/app.js`
- Test: `scripts/dashboard-contract-test.mjs`

**Interfaces:**

- Consumes: `normalizeSchedule`, `rankSlots`, and existing filter helpers from `public/filters.js`
- Consumes: Task 2 DOM IDs
- Produces: stored `court-finder-schedule` and extended `court-finder-preferences`

- [ ] **Step 1: Write failing browser-state contract assertions**

Cover schedule storage key, view mode, sort mode, dialog wiring, View Transitions fallback, live toast, and direct card booking behavior.

- [ ] **Step 2: Run the targeted test and confirm RED**

Run: `node scripts/dashboard-contract-test.mjs`

- [ ] **Step 3: Implement state restoration and normalization**

Restore schedule, view, sport, region, sort, and favorites with validated defaults.

- [ ] **Step 4: Implement controls and dialogs**

Wire view switch, schedule form, restore defaults, sort, mobile filter dialog, clear filters, date rail, theme, and sport/region controls.

- [ ] **Step 5: Replace hierarchy rendering with ranked cards**

Render visible date sections and flat cards with `<time>`, court pills, match badges, visible booking CTA, `<details>` metadata, source link, warning, and save action.

- [ ] **Step 6: Add progressive feedback**

Use optional View Transitions, loading skeletons, toast announcements, focus management, and reduced-motion-safe CSS hooks.

- [ ] **Step 7: Run targeted and full tests**

Run: `node scripts/dashboard-contract-test.mjs && npm test`

### Task 4: Browser QA and Deployment

**Files:**

- Modify if needed: `public/index.html`, `public/styles.css`, `public/app.js`, `public/filters.js`
- Test: `scripts/dashboard-contract-test.mjs`

**Interfaces:**

- Validates completed Tasks 1–3 as an integrated static app.

- [ ] **Step 1: Start local server and inspect dark desktop**

Run: `npm run dev`

Verify initial Best for me results, direct booking actions, hierarchy, and no console errors.

- [ ] **Step 2: Inspect light desktop and mobile widths**

Verify both themes, `375px` mobile layout, sticky switch, dialogs, 44px targets, horizontal date rail, and no overflow.

- [ ] **Step 3: Exercise interactive flows**

Test Best/All switching, schedule edit/save/reset, filter chips, sorting, favorites, `<details>`, booking URLs, Escape dialog close, and localStorage reload persistence.

- [ ] **Step 4: Run final verification**

Run: `npm test && node --check public/app.js && node --check public/filters.js && git diff --check`

- [ ] **Step 5: Commit and push**

Commit with message: `Rebuild dashboard around schedule-aware booking feed`

Push `main` or the approved integration branch, then monitor the `Check tennis reservations` workflow through successful Pages deployment.

- [ ] **Step 6: Verify deployed behavior**

Confirm the live page contains the new controls and the deployed availability JSON includes Komaoka slots without parser errors.
