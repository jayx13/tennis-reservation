# Unified Availability Hierarchy Design

## Goal

Show tennis and basketball availability in one consistent hierarchy:

`Day → exact time frame → facility → available courts → booking action`

Users should identify a day, choose a time, then see every facility and court available during that exact period.

## Scope

### Included

- Tennis and basketball tabs.
- Existing filters, counts, source metadata, links, and phone booking.
- Responsive date, time, facility, court, and action presentation.
- Existing syntax and regression-suite verification.

### Deferred

- New unit tests for hierarchy edge cases, per explicit user request.
- Source scraping or normalized slot-schema changes.
- Weekly timetable/grid presentation.

## Data Transformation

Apply one pure display transformation after sport and filter selection:

1. Group slots by ISO date.
2. Within each date, group only identical `startTime` and `endTime` values.
3. Within each exact time frame, group by provider plus facility code.
4. Within each facility, deduplicate court display labels.
5. Sort dates ascending, time frames chronologically, facilities stably by display name, and courts naturally (`Court 2` before `Court 10`).

Do not merge overlapping or merely adjacent ranges. Do not modify normalized slot records.

Court label fallback order:

1. `courtName` when meaningful;
2. `roomName`;
3. `Available space`.

Existing Komaoka display grouping remains compatible: equal A/B/C time ranges become court labels under one Komaoka facility row.

## Identity and Metadata Isolation

Facility grouping uses provider and facility code, not display name alone. Each facility group retains its own:

- reservation URL;
- phone booking method and number;
- source URL;
- source warning/note;
- distance/area metadata;
- availability status.

No facility may inherit metadata from another facility in the same time group.

## UI Structure

Each date section contains:

- weekday and full date;
- normalized available-slot count;
- chronological time bands.

Each time band contains:

- prominent merged start/end label;
- number of normalized available courts for that exact frame;
- compact facility rows.

Each facility row contains:

- facility name;
- available court names or pills;
- facility metadata/status;
- one booking action for the facility/time group.

Komaoka retains:

- `Phone booking` badge;
- `Call Komaoka · 045-571-0035` action;
- separate source-calendar link;
- exact manual-update warning.

Other providers retain their existing external booking actions and notes.

## Responsive and Accessibility Behavior

- Desktop: time band leads visually; facility rows align beneath it.
- Mobile: strict vertical order—date, time, facility, courts, metadata, action.
- Actions retain at least 44px target size and visible keyboard focus.
- Existing reduced-motion behavior remains unchanged.
- Semantic sections and accessible labels describe each date and time frame.

## Verification

Per user request, add no new unit tests in this implementation. Verify with:

- existing `npm test` suite;
- `node --check` for changed JavaScript;
- `git diff --check`;
- representative local data/manual structure inspection when available.

New focused hierarchy tests remain explicitly deferred.

## Acceptance Criteria

- Both sports render as day → exact time → facility → courts.
- Matching exact ranges share a time band; differing ranges remain separate.
- Facility and booking metadata never cross grouping boundaries.
- Counts continue to represent normalized availability.
- Komaoka phone/source/warning behavior remains intact.
- Existing filters and other providers continue working.
- Mobile layout follows the hierarchy without horizontal dependence.
