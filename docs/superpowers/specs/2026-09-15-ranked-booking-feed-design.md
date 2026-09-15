# Ranked Booking Feed UI Design

## Goal

Replace the current nested availability browser with a fast, schedule-aware booking feed. Default results should favor Saturday, Sunday, and weekday slots beginning at or after 19:00, while a one-tap **All courts** mode keeps every available slot accessible.

## Product Direction

The approved direction is **Ranked booking feed**. The page opens with useful results rather than a large filter panel. Each result keeps its date, time, venue, available courts, source context, save control, and booking action in one scan path.

The visual direction is dark-first sports editorial: deep green-black surfaces, warm white text, restrained lime emphasis, large readable time numerals, compact metadata, and clear hierarchy. Light mode remains fully supported through the existing persistent theme control.

## Default Schedule and Ranking

Default schedule:

- Saturday: all times preferred.
- Sunday: all times preferred.
- Monday through Friday: slots starting at or after `19:00` preferred.

Every slot receives a deterministic preference tier:

1. Weekend at or after `19:00`.
2. Weekend before `19:00`.
3. Weekday at or after `19:00`.
4. Other weekday times.

Within a tier, sort by date, start time, facility name, then provider and facility code for stable output. **Best for me** includes tiers 1–3. **All courts** includes all tiers. If Best for me has no matches, show a useful empty state with a direct **View all courts** action.

## Information Architecture

### Header

- Court Finder brand.
- Data-health status and last-updated time.
- Persistent light/dark theme switch.

### Hero Summary

- Short outcome-oriented heading.
- Count of schedule matches.
- Count of all available court slots.
- Count of represented venues.

### Primary Controls

- Segmented **Best for me / All courts** switch.
- Tennis and basketball sport switch.
- Compact region, date, search, favorites, and sort controls.
- **Edit schedule** action.
- Active filters rendered as removable chips.

### Results

- Flat ranked booking cards; no nested date/time accordions.
- Date and large start time at left.
- Venue and court pills in center.
- Best-match badge where applicable.
- Direct **Book now** or **Call to book** action at right.
- Secondary details in native `<details>`: provider, area, source calendar, warning note, and indoor status.
- Day section separators remain available for orientation without hiding cards.

### Supporting Links

- Kawasaki basketball and barbecue shortcuts remain available in a compact secondary panel.

## Interactions

### View Switching

Best for me is the initial view unless the user previously selected All courts. Switching views updates counts, results, date rail, and empty state without navigation or reload. Use `document.startViewTransition` when supported, with an immediate render fallback.

### Schedule Editor

Use an HTML5 `<dialog>` containing:

- Saturday preference checkbox.
- Sunday preference checkbox.
- Weekday-evening preference checkbox.
- Native `<input type="time">` for weekday start, default `19:00`.
- Restore-defaults, cancel, and save controls.

Save validated schedule values to `localStorage`. Invalid or inaccessible saved values fall back to defaults.

### Filters and Sorting

- Sport and view switches behave as single-select controls with `aria-pressed`.
- Region, date, time, search, weekend, and favorites filters remain available.
- Sort options: Recommended, Soonest, Start time, and Distance.
- All controls update the URL-independent in-memory state and persistent preferences where appropriate.
- Clear removes query filters while keeping schedule, chosen view, sport, and theme.

### Cards

- Save control updates all cards for the same venue.
- Booking action remains visible at every breakpoint.
- External booking links open official sources with `noopener noreferrer`.
- Komaoka uses telephone booking and displays its freshness warning.
- Clicking the details summary expands metadata without navigating.

### Feedback and Motion

- Loading skeletons appear while availability JSON is fetched.
- Result count uses `aria-live="polite"`.
- A small toast confirms schedule saves, saved venues, and mode changes.
- Cards animate on first reveal and mode/filter changes.
- Motion is disabled under `prefers-reduced-motion: reduce`.

## Responsive Behavior

- At desktop widths, controls and cards use horizontal layouts with aligned booking actions.
- Below `760px`, primary switches become sticky below the header, filters collapse into an HTML5 dialog, and cards become single-column.
- Booking buttons span the card width on mobile and retain at least a `44px` tap target.
- Date navigation scrolls horizontally with snap points.
- No interaction depends on hover.

## State and Data Flow

`public/filters.js` owns pure schedule normalization, preference tiers, filtering helpers, and stable sorting. `public/app.js` owns browser state, DOM rendering, event handlers, storage, dialogs, view transitions, and toast feedback. Availability continues to come from `public/data/availability.json`; collectors and output schema remain unchanged.

Persistent keys:

- `court-finder-theme`: `"dark"` or `"light"`.
- `court-finder-preferences`: sport, region, view mode, and sort mode.
- `court-finder-schedule`: validated schedule object.
- `court-finder-venues`: saved venue keys.

## Error Handling

- Data fetch failure shows a visible dashboard warning and useful empty state.
- Incomplete or stale checks remain visible through health status.
- Unsafe or missing booking URLs remain non-navigable.
- Invalid saved preferences are normalized rather than trusted.
- Unsupported `<dialog>` or View Transitions behavior falls back to ordinary rendering and dialog attributes/classes.

## Accessibility

- One `<h1>`, logical headings, semantic landmarks, `<time>` elements, native buttons, and native form controls.
- Segmented controls expose `aria-pressed`; dialogs have labels and initial focus.
- Visible keyboard focus, Escape-to-close dialogs, screen-reader result announcements, and text labels paired with every status color.
- WCAG AA contrast in both themes.

## Testing

- Unit tests for schedule normalization, preference tiers, Best for me inclusion, stable ranking, and alternate sort modes.
- Dashboard contract checks for required semantic controls, dialog, live regions, direct booking actions, and retained source links.
- Existing collector/parser tests remain unchanged and green.
- Browser QA at desktop and mobile widths in light and dark modes.
- Manual interaction checks for view switching, schedule persistence, filter reset, favorites, booking URLs, dialog keyboard behavior, and reduced motion.

## Constraints

- Vanilla HTML, CSS, and JavaScript only.
- No external runtime libraries or build step.
- GitHub Pages deployment remains unchanged.
- Existing provider data and booking behavior remain compatible.
