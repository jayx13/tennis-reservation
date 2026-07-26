# Weekend-Only Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users restrict tennis or basketball availability to Saturday and Sunday.

**Architecture:** Add one pure date predicate module, wire a checkbox into the existing vanilla JavaScript filter pipeline, and style it within the Night Arena toolbar. No data or scraper changes.

**Tech Stack:** Vanilla JavaScript ES modules, semantic HTML, CSS, Node.js assertions.

## Global Constraints

- Weekend means Saturday and Sunday in Japan.
- Weekend filtering composes with sport, date, time, and search filters.
- Clear resets the weekend checkbox.
- Preserve permanent-dark Night Arena styling and accessibility.

### Task 1: Weekend Predicate

**Files:**
- Create: `public/filters.js`
- Modify: `scripts/dashboard-contract-test.mjs`

**Interfaces:**
- Produces: `isWeekendDate(value: string): boolean`

- [ ] Add failing Saturday, Sunday, and weekday assertions.
- [ ] Implement timezone-stable predicate.
- [ ] Run `npm test`.

### Task 2: Filter UI and Wiring

**Files:**
- Modify: `public/index.html`
- Modify: `public/app.js`
- Modify: `public/styles.css`
- Modify: `scripts/dashboard-contract-test.mjs`

**Interfaces:**
- Consumes: `isWeekendDate`
- Produces: composable `#weekendFilter` checkbox behavior

- [ ] Add failing markup, event, Clear-reset, and styling assertions.
- [ ] Add checkbox and responsive Night Arena styling.
- [ ] Apply predicate in `filteredSlots()` and reset in Clear.
- [ ] Run contract and syntax checks.

