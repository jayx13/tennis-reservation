# Collapsible Availability Design

## Goal

Make availability easier to scan with native nested disclosures:

`closed date → closed time range → facility and courts`

All dates and time ranges start closed on each fresh render.

## Behavior

- Each date is a `<details>` section with a `<summary>` containing weekday, full date, and normalized slot count.
- Each date contains one closed `<details>` per exact start/end range.
- Each time summary contains the range and available-court count.
- Opening a time reveals facility rows, court pills, metadata, and booking actions.
- Tennis and basketball share the same behavior.
- Komaoka phone booking, source link, freshness warning, and other providers' booking links remain unchanged.
- Native disclosure controls provide keyboard and screen-reader behavior; no custom collapse state or JavaScript event handlers.

## Styling

- Preserve Night Arena tokens and existing responsive layout.
- Add clear summary chevrons and open-state accents.
- Maintain visible focus, 44px summary targets, and reduced-motion behavior.
- Keep nested summaries visually distinct: date is the primary rail; time is the secondary rail.

## Verification

Run existing syntax checks, `npm test`, and `git diff --check`. No new unit tests per user's earlier instruction.
