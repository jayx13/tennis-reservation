# Collapsed Court Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add compact facility/court overviews to collapsed dates and exact time summaries.

**Architecture:** Extend the existing immutable hierarchy with a reusable summary formatter. Render date aggregate text and time-specific text inside native disclosure summaries; expanded facility rows stay unchanged.

## Global Constraints

- Date overview aggregates all time groups; time overview uses only that exact range.
- Format is `Facility: courts · Facility: courts`.
- Group by provider plus facility code; deduplicate court labels.
- Show first few groups plus `+N more` for long summaries.
- Tennis and basketball share behavior; no new unit tests.

### Task: Overview Data, Rendering, and Styling

**Files:** `public/filters.js`, `public/app.js`, `public/styles.css`

- [ ] Add immutable `formatCourtOverview(facilities, maxGroups)` helper with natural court ordering and overflow count.
- [ ] Render date overview beside date count using all date time-group facilities.
- [ ] Render time overview beside time count using that time group's facilities.
- [ ] Keep overview text escaped, muted, compact, and readable on mobile.
- [ ] Run `node --check public/filters.js`, `node --check public/app.js`, `npm test`, and `git diff --check`.
- [ ] Commit `Add collapsed court overviews`.
