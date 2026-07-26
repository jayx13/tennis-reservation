# Night Arena Basketball Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add five Yokohama basketball facilities and deliver the approved permanent-dark Night Arena dashboard.

**Architecture:** Preserve the existing zero-dependency scraper and static frontend. Extend facility configuration, reshape semantic markup, update rendering metrics/copy, and replace the visual system without changing availability JSON contracts.

**Tech Stack:** Node.js ES modules, JSON, semantic HTML, vanilla JavaScript, CSS Grid/Flexbox.

## Global Constraints

- Basketball must cover Nishi, Hiranuma, Kanagawa, Tsurumi, Naka, Minami, Konan, and Hodogaya.
- Theme is permanently dark; no theme toggle or light palette remains.
- Existing scraper output schema and reservation workflow remain compatible.
- No runtime dependencies or frontend framework.
- Responsive, keyboard-accessible, reduced-motion-safe UI.

### Task 1: Lock Facility and UI Contracts

**Files:**
- Create: `scripts/dashboard-contract-test.mjs`
- Test: `scripts/dashboard-contract-test.mjs`

**Interfaces:**
- Consumes: `reservation.config.json`, `public/index.html`, `public/app.js`, `public/styles.css`
- Produces: executable static contract assertions

- [ ] Write assertions for eight basketball facilities, five exact additions, dark-only markup, accessibility hooks, responsive CSS, and removed theme code.
- [ ] Run `node scripts/dashboard-contract-test.mjs`; verify it fails against current implementation.

### Task 2: Expand Basketball Facility Coverage

**Files:**
- Modify: `reservation.config.json`
- Test: `scripts/dashboard-contract-test.mjs`

**Interfaces:**
- Consumes: Yokohama facility codes and basketball purpose code `9`
- Produces: eight `sport: "basketball"` facility records for `scripts/check-slots.mjs`

- [ ] Add Tsurumi (`1`), Naka (`4`), Minami (`5`), Konan (`6`), and Hodogaya (`7`) records.
- [ ] Run contract test; verify facility assertions pass while UI assertions remain red.
- [ ] Run a one-day Yokohama-only scrape to verify live facility selection and schema compatibility.

### Task 3: Build Semantic Night Arena Structure

**Files:**
- Modify: `public/index.html`
- Modify: `public/app.js`
- Test: `scripts/dashboard-contract-test.mjs`

**Interfaces:**
- Consumes: unchanged availability JSON payload and existing filter state
- Produces: sport-aware hero metrics and accessible grouped result markup

- [ ] Remove theme controls and theme persistence.
- [ ] Add skip link, brand/freshness header, asymmetric hero, facility metric, compact filter rail, and footer note.
- [ ] Update sport-aware copy, facility counting, result metadata, and safe booking action rendering.
- [ ] Run syntax and contract tests; verify JavaScript/HTML contracts pass.

### Task 4: Implement Night Arena Visual System

**Files:**
- Modify: `public/styles.css`
- Test: `scripts/dashboard-contract-test.mjs`

**Interfaces:**
- Consumes: semantic classes from `public/index.html` and rendered classes from `public/app.js`
- Produces: permanent-dark responsive Night Arena presentation

- [ ] Define navy/lime/cyan tokens, grid texture, condensed display system, restrained glow, and clear focus states.
- [ ] Style hero, metrics, tabs, filters, day groups, slot rows, loading/empty/error states, and footer.
- [ ] Add tablet/mobile breakpoints and `prefers-reduced-motion` guard.
- [ ] Run contract test and syntax checks; verify green.

### Task 5: Visual and End-to-End Verification

**Files:**
- Modify only if verification reveals defects: `public/index.html`, `public/app.js`, `public/styles.css`

**Interfaces:**
- Consumes: completed static dashboard
- Produces: verified desktop/mobile result

- [ ] Serve `public/`, inspect desktop and mobile screenshots, and test tabs/filters/booking links.
- [ ] Run one-day live scraper check, contract test, and syntax checks again.
- [ ] Review git diff for unrelated changes and document results.

