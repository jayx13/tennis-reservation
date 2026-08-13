# Compact Availability Schedule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine collapsed availability into a compact, easily scanned schedule with date-level park chips and restrained time-level park labels.

**Architecture:** Keep the existing availability hierarchy and native nested `details` elements. Add a small park-name list formatter for structured rendering, update summary markup in `public/app.js`, then restyle only the disclosure rows in `public/styles.css`.

**Tech Stack:** Vanilla JavaScript, semantic HTML generated in JavaScript, CSS, Node.js syntax checks and existing repository tests.

## Global Constraints

- Dates and time ranges start collapsed.
- Every available park appears once; court names remain inside expanded time details.
- Tennis and basketball use identical summary behavior.
- Existing filters, scraping, reservation links, and expanded cards remain unchanged.
- Mobile labels wrap without overlapping park counts.
- Do not add a new unit-test suite in this iteration.

### Task 1: Structured park summary data

**Files:**
- Modify: `public/filters.js`

**Interfaces:**
- Consumes: hierarchy facility objects with `facilityKey` and `facilityName`.
- Produces: `availableParkNames(facilities): string[]`, unique and naturally sorted.

- [ ] **Step 1: Replace the joined overview formatter with a structured park-name helper.**
- [ ] **Step 2: Run `node --check public/filters.js`.**
- [ ] **Step 3: Confirm duplicate facilities collapse to one park name using a focused Node command.**

### Task 2: Compact date and time summaries

**Files:**
- Modify: `public/app.js`

**Interfaces:**
- Consumes: `availableParkNames(facilities): string[]` from Task 1.
- Produces: date-summary park chips and time-summary secondary park text.

- [ ] **Step 1: Format date headings as compact weekday/date labels.**
- [ ] **Step 2: Render escaped park-name chips beneath each date heading.**
- [ ] **Step 3: Render escaped park-name text beneath each time range.**
- [ ] **Step 4: Preserve right-aligned park counts and all expanded facility/court cards.**
- [ ] **Step 5: Run `node --check public/app.js`.**

### Task 3: Visual refinement and verification

**Files:**
- Modify: `public/styles.css`

**Interfaces:**
- Consumes: `.date-park-list`, `.park-chip`, and existing summary classes from Task 2.
- Produces: compact responsive schedule rows.

- [ ] **Step 1: Tighten disclosure row spacing, borders, typography, and indicator size.**
- [ ] **Step 2: Style date park names as subtle wrapping chips and time park names as secondary text.**
- [ ] **Step 3: Add narrow-screen rules that protect labels, counts, and touch targets from overlap.**
- [ ] **Step 4: Run `npm test`, JavaScript syntax checks, and `git diff --check`.**
- [ ] **Step 5: Inspect desktop and mobile rendering, correcting overflow or hierarchy issues.**
- [ ] **Step 6: Commit the finished interface change.**
