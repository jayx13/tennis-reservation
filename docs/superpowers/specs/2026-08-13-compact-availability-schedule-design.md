# Compact Availability Schedule Design

## Goal

Make collapsed availability easier to scan without changing reservation data, filters, or expanded court details.

## Date rows

- Keep each date collapsed initially.
- Show the weekday and date as the dominant label, formatted compactly (for example, `Wed · Aug 19`).
- Show every available park once as a small, wrapping chip below the date.
- Keep the number of parks aligned at the right edge.
- Use a smaller, quieter disclosure indicator and tighter vertical spacing.

## Time rows

- Keep each time range collapsed initially.
- Show the time range first and park names as secondary text beneath it.
- Show every park once, with no court names in the overview.
- Keep the number of parks aligned at the right edge.
- Preserve the existing facility and court cards after expansion.

## Responsive behavior

- Park chips wrap naturally on narrow screens.
- Date/time labels and park counts never overlap.
- Park counts remain visible while secondary park text may wrap.
- Touch targets and keyboard focus remain accessible.

## Scope

- Update only availability summary markup and styling.
- Preserve sport tabs, filters, live data collection, reservation links, and expanded details.
- Apply the same presentation to tennis and basketball.

## Verification

- Run JavaScript syntax checks.
- Run the existing Komaoka and dashboard contract tests.
- Check whitespace and inspect desktop/mobile layouts before deployment.
