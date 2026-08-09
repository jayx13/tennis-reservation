# Komaoka Basketball Availability Design

## Goal

Add Komaoka Community Center (`駒岡地区センター`) availability to the dashboard's basketball tab. Present each date first, then merged available time ranges and the A/B/C court sections available during each range. Because Komaoka does not accept online reservations, direct users to call the center.

## Source Characteristics

- Source: Yokohama City's public community-center availability calendar.
- Facility: Komaoka Community Center.
- Rooms: `r=41` (A section), `r=42` (B section), and `r=43` (C section).
- Encoding: CP932/Shift-JIS HTML.
- Layout: one weekly table per room, with hourly rows and seven date columns.
- Availability semantics:
  - blank cell: reservable;
  - red cell, `×`, or booking name: booked;
  - green cell: unavailable or closed;
  - gray cell: individual use.
- Cells can use `rowspan`, so parsing must reconstruct the logical hour-by-date grid.
- Staff update the source manually. Displayed availability can lag actual bookings.
- Reservations are made by telephone or in person, not online.

## Scope

### Included

- Komaoka A, B, and C sections on the basketball tab.
- All source weeks intersecting the rolling reservation horizon, from today through the same calendar date two months ahead, inclusive.
- Hourly availability parsing and consecutive-hour merging.
- Date-first, time-first dashboard presentation.
- Telephone booking action using `045-571-0035`.
- Source freshness and manual-update warning.
- Partial-source failure reporting.

### Excluded

- Automated reservation submission.
- Komaoka rooms other than A, B, and C.
- Treating individual-use periods as reservable basketball slots.
- Historical dates.
- Refactoring unrelated source adapters or dashboard components.

## Architecture

Create a dedicated Komaoka source adapter beside the existing Kanagawa and Yokohama collectors. Keep Komaoka-specific URL traversal, decoding, grid parsing, status interpretation, and time merging isolated behind a normalized slot interface.

Central configuration holds:

- facility identity and display name;
- basketball sport classification;
- room IDs and display labels (`Court A`, `Court B`, `Court C`);
- source URL template;
- telephone number and `phone` booking method;
- rolling two-month horizon.

The existing orchestration layer invokes the adapter, combines its normalized output with other sources, and applies the existing global sorting, deduplication, summary, and JSON publication flow.

## Collection and Parsing Flow

1. Compute today's local date in the application's configured timezone.
2. Compute an inclusive final date two calendar months after today. Clamp invalid month-end dates to that target month's final day.
3. Generate weekly start dates sufficient to cover every day in the inclusive range.
4. Request each weekly page for room IDs 41, 42, and 43.
5. Decode response bytes from CP932 to Unicode before parsing HTML.
6. Confirm the expected room heading, seven date headers, hourly labels, and availability table exist.
7. Expand each table's `rowspan` cells into a logical grid of date/hour states.
8. Emit availability only for cells that are structurally present and blank. Never infer availability from an unrecognized or missing cell.
9. Discard dates before today or after the final date.
10. Deduplicate overlapping weekly results by facility, room, date, start time, and end time.
11. Merge adjacent one-hour cells only when facility, room, date, and availability status match.
12. Normalize and return slots plus per-request checks.

The adapter must use a bounded, generated list of week dates rather than recursively following an unbounded `next week` link.

Requests use a maximum concurrency of three, a 15-second timeout, and one delayed retry for timeouts, connection failures, and HTTP 429/5xx responses. Other HTTP failures are recorded without retry. Decoding uses the platform `TextDecoder` with `shift_jis`; the adapter adds no runtime package dependency.

## Normalized Slot Data

Each Komaoka slot supplies the fields expected by the current dashboard contract and enough metadata to support phone booking:

- `sport`: basketball;
- facility ID and `Komaoka Community Center` display name;
- room ID and `Court A`, `Court B`, or `Court C` label;
- ISO local date;
- merged start and end times;
- available status and label;
- source calendar URL;
- `bookingMethod`: phone;
- `bookingPhone`: `045-571-0035`;
- source retrieval timestamp;
- manual-update/staleness notice.

Exact property names should follow existing slot conventions where equivalents already exist. New booking metadata must remain optional so other source records need no migration.

## Dashboard Experience

Komaoka appears only on the basketball tab and participates in existing date, facility, and time filters.

Within each date group:

- show weekday and full date first;
- show a Komaoka facility card with opening count;
- sort rows by start time;
- render each merged time range prominently on the left;
- render available court labels on the right;
- combine courts with identical date/start/end ranges into one visual row, for example `13:00–17:00 · Courts B, C`;
- show a clear `Phone booking` badge;
- show `Call Komaoka · 045-571-0035` as a `tel:0455710035` link;
- show `Availability is manually updated by the facility. Call to confirm.` near the action.

Combining identical time ranges is a presentation transformation only. Published source records remain one normalized slot per court so filtering, counting, and deduplication stay predictable.

Existing venues retain their current presentation and reservation actions.

## Failure Handling

- Record request and parse outcomes in the existing checks structure.
- A failed week or room must not discard successful Komaoka results.
- Unexpected headings, date columns, row shapes, or cell states fail closed: publish no inferred slots from the affected table and record a descriptive parse error.
- If every Komaoka request fails, publish the other reservation sources normally and expose Komaoka as temporarily unavailable through source/check status.
- Apply the bounded concurrency, timeout, and transient-retry policy defined above so the public source is not flooded or allowed to stall an update indefinitely.
- The dashboard must not imply that a displayed blank remains guaranteed; the manual-update warning and call-to-confirm action are always visible for Komaoka.

## Testing

### Parser fixtures

- Decode representative CP932 markup.
- Parse A/B/C room headings and weekly date headers.
- Expand `rowspan` cells across hours correctly.
- Distinguish blank, booked, named booking, unavailable/closed, and individual-use cells.
- Reject malformed or unfamiliar table structures without false availability.

### Collection behavior

- Cover week, month, and year transitions.
- Clamp month-end horizon calculation correctly.
- Exclude historical and post-horizon dates.
- Deduplicate overlap between generated weekly pages.
- Enforce request concurrency, timeout, and transient-only retry behavior.
- Preserve successful results when one room or week fails.
- Report total failure without suppressing other sources.

### Slot transformation

- Merge adjacent hours for the same room and date.
- Do not merge across gaps, dates, rooms, or differing states.
- Preserve separate normalized records for each court.

### Dashboard contract

- Komaoka appears only for basketball.
- Date-first and time-first order is stable.
- Identical ranges combine their court labels visually.
- Opening counts reflect normalized available court slots consistently with the existing dashboard convention.
- Phone badge, `tel:` link, source link, and manual-update warning render.
- Existing tennis and basketball facilities remain unchanged.

Run the full existing test suite after focused adapter and dashboard tests.

## Acceptance Criteria

- A user can open the basketball tab, choose a date, and immediately see Komaoka's available merged times and corresponding A/B/C courts.
- Only blank source-calendar cells become available slots.
- Every reservable date in the rolling two-month horizon is checked.
- Adjacent hours merge correctly without merging different courts in stored data.
- Matching visual time ranges list all available courts once.
- Calling Komaoka is one tap on supported devices.
- Partial or total Komaoka failures never create false openings or prevent other facilities from publishing.
- The UI clearly states that users must call to confirm manually updated availability.
