# Collapsible Availability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make date and time navigation collapsible with native nested disclosures.

**Architecture:** Keep the existing hierarchy data model. Change date/time render containers to semantic `<details>/<summary>` elements and add disclosure styling; no JavaScript state.

## Global Constraints

- All dates and exact time ranges start collapsed.
- Opening order is date → time → facility/courts.
- Preserve all normalized counts, filters, metadata, actions, accessibility, and responsive behavior.
- Add no new test files.

### Task 1: Semantic Disclosure Rendering

**Files:** `public/app.js`

- [ ] Render each date as `<details>` with a `<summary>`; do not set `open`.
- [ ] Render each time group as nested `<details>` with a `<summary>`; do not set `open`.
- [ ] Keep existing facility rows and booking actions inside the time details.
- [ ] Preserve `aria-label` and count text.
- [ ] Run `node --check public/app.js && npm test`.
- [ ] Commit `Add collapsible availability sections`.

### Task 2: Disclosure Styling and Verification

**Files:** `public/styles.css`

- [ ] Style marker/chevron, summaries, open states, focus, spacing, and mobile targets using existing tokens.
- [ ] Keep details content readable at desktop and mobile.
- [ ] Preserve reduced-motion behavior.
- [ ] Run syntax checks, `npm test`, and `git diff --check`.
- [ ] Commit `Style collapsible availability sections`.
