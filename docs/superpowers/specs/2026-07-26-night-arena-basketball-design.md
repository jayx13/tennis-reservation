# Night Arena Basketball Expansion Design

## Goal

Expand Yokohama basketball coverage from three to eight facilities and refresh the static dashboard with the approved permanent-dark Night Arena direction.

## Scope

- Retain Nishi Sports Center, Hiranuma Memorial Gymnasium, and Kanagawa Sports Center.
- Add Tsurumi, Naka, Minami, Konan, and Hodogaya Sports Centers.
- Preserve tennis coverage, sport tabs, date/time/facility filters, grouped results, source health, empty/error states, and official reservation links.
- Keep the zero-dependency HTML/CSS/JavaScript architecture and existing scraper output schema.
- Remove the theme toggle and all light-theme behavior.

## Interface

Night Arena uses deep navy surfaces, electric lime primary actions, cyan metadata, condensed uppercase display typography, technical grid texture, and restrained glow. Header shows brand and freshness. Split hero combines sport-aware copy with live slot, facility, and refresh metrics. Sport tabs and a compact filter rail precede date-grouped result rows. Each row prioritizes time, facility, room, location metadata, and official booking action.

Desktop uses a wide asymmetric hero and horizontal result rows. At tablet/mobile widths, hero and filters stack; result metadata simplifies while time, facility, and booking remain visible. Tap targets remain at least 44px. Focus is visible, structure semantic, live regions preserved, and motion disabled under `prefers-reduced-motion`.

## Data Flow

`reservation.config.json` remains the facility source of truth. `scripts/check-slots.mjs` requests each configured Yokohama facility, emits unchanged slot objects, and records checks. `public/app.js` filters the cached payload by sport and controls, derives active-sport metrics, and renders grouped slots into semantic cards.

## Failure Handling

Existing partial-source semantics remain: available data renders when one provider fails; health copy communicates freshness/failure; no-result and load-error states remain distinct. Unknown distances are omitted, not fabricated. Official links retain safe external-link attributes.

## Verification

- Static contract test checks all eight basketball facilities, permanent-dark markup, required responsive/accessibility hooks, and removal of theme-switching code.
- JavaScript syntax checks cover browser and scraper modules.
- One-day Yokohama-only live scrape verifies configured facility codes and output compatibility.
- Browser screenshots at desktop and mobile widths verify visual layout, overflow, contrast, and interaction states.

