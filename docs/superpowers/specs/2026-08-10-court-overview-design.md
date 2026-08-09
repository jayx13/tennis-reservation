# Collapsed Court Overview Design

## Goal

Make closed date and time summaries useful at a glance by showing small facility/court overviews without opening them.

## Behavior

- Date summary shows an aggregate overview across all time groups, for example: `Komaoka: A, B · Mitsuzawa: Court 2`.
- Time summary shows only facilities/courts available during that exact time range.
- Facility identity uses provider plus facility code; repeated court labels deduplicate within that identity.
- Overview text is secondary, small, muted, and visually subordinate to date/time labels and counts.
- Long summaries show the first few facility groups followed by `+N more`.
- Expanded content remains unchanged: facility rows, court pills, metadata, and booking actions.
- Tennis and basketball use the same behavior.

## Accessibility and Verification

- Overview is part of each native `<summary>` label, so it is announced with the disclosure control.
- Preserve focus, 44px targets, and reduced-motion behavior.
- Run existing syntax checks, `npm test`, and `git diff --check`. Add no new unit tests.
