# Unified Availability Hierarchy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render tennis and basketball availability as day → exact time frame → facility → courts.

**Architecture:** Replace per-date flat display rows with one pure nested display transformation. Render semantic time bands containing facility rows while preserving original slot counts, filters, and provider-specific actions.

**Tech Stack:** Vanilla ES modules, HTML/CSS, existing Node contract suite.

## Global Constraints

- Apply to tennis and basketball.
- Group only identical start/end times.
- Group facilities by provider plus facility code.
- Do not mutate normalized slots or cross facility metadata.
- Preserve Komaoka phone/source/warning behavior and other booking links.
- Add no new unit tests; user explicitly deferred them.
- Run existing tests and syntax/diff checks.

### Task 1: Nested Display Model and Rendering

**Files:**
- Modify: `public/filters.js`
- Modify: `public/app.js`

**Interfaces:**
- Produce `buildAvailabilityHierarchy(slots) -> Array<{ date, slotCount, timeGroups }>`.
- Each time group contains `{ startTime, endTime, slotCount, facilities }`.
- Each facility contains representative metadata plus deduplicated, naturally sorted `courtNames`.

- [ ] Replace the Komaoka-only display grouping with a general immutable hierarchy transformation.
- [ ] Use fallback labels: meaningful `courtName`, then `roomName`, then `Available space`.
- [ ] Sort dates/times/facilities/courts per design.
- [ ] Render date sections containing time bands and facility rows.
- [ ] Preserve normalized date/result counts and every provider-specific action/notice.
- [ ] Run `node --check public/filters.js && node --check public/app.js && npm test`.
- [ ] Commit with `git commit -m "Group availability by day and time"`.

### Task 2: Responsive Hierarchy Styling and Verification

**Files:**
- Modify: `public/styles.css`

- [ ] Style prominent time bands, compact facility rows, court pills, counts, metadata, and actions using existing Night Arena tokens.
- [ ] Stack date → time → facility → courts → action below the existing mobile breakpoint.
- [ ] Preserve 44px actions, focus visibility, and reduced-motion behavior.
- [ ] Run JavaScript syntax checks, `npm test`, and `git diff --check`.
- [ ] Inspect representative hierarchy output in current data when locally available.
- [ ] Commit with `git commit -m "Style unified availability hierarchy"`.
