# Design library — Pickleball Bay Area

Reference for anyone (human or Claude) building or editing a page on this
site. It documents the design system **as it actually exists** in
[`assets/style.css`](assets/style.css) and the per-page stylesheets — it is
not aspirational. If you change a token or add a component, update this file
in the same commit so it never drifts from the CSS.

**Before styling anything on this site, read this file first.** Reuse an
existing token or component class before inventing a new color, spacing
value, or pattern.

## Direction

> "Court colors, daylight" (see the header comment in `style.css`).

Light, plain, legible — a reference you'd trust, not a moody SaaS landing
page. No blur, no glow, no glassmorphism, no ambient gradients, no pulsing
animation. The accent palette is drawn from the court itself in its daylight
register: the blue of the outer court, the green of the kitchen, the
terracotta of the perimeter apron, and optic yellow reserved for exactly
**one thing** — marking the top pick. Don't reach for optic yellow as a
generic accent; it means "#1."

## Tokens (`:root` in `style.css`)

### Color

| Token | Hex | Use |
|---|---|---|
| `--fog` | `#f5f7f6` | Page background |
| `--fog-dim` | `#eaeeec` | Footer bg, empty states |
| `--paper` | `#ffffff` | Card / surface background |
| `--ink` | `#17232b` | Primary text |
| `--ink-soft` | `#5b6b70` | Secondary text, meta, labels |
| `--line` | `#dfe5e2` | Borders, dividers |
| `--bay` / `--bay-deep` | `#1d6b85` / `#123240` | Primary brand blue — links, primary buttons, focus rings |
| `--kitchen` / `--kitchen-deep` | `#2f7a57` / `#1f5a40` | Secondary green — eyebrows, "beginner" badges, bullet marks |
| `--optic` / `--optic-deep` | `#d7e94b` / `#9aa81e` | **#1 / top-pick marker only** — rank badges, star fill, selection highlight |
| `--poppy` / `--poppy-deep` | `#b54b2c` / `#8f3a20` | Warm accent — callouts, "competitive" badges, favorite/heart, errors |
| `--bay-tint` / `--kitchen-tint` / `--poppy-tint` | pale washes | Badge/pill backgrounds paired with their `-deep` text color |
| `--pin-outdoor` / `--pin-indoor` | `#2166a8` / `#3a8a4a` | **Map pins only** — deliberately ~80° apart in hue so they're distinguishable at 9–16px; don't reuse `--bay`/`--kitchen` for pins (they're only ~40° apart and look identical at that size) |

Badge/pill color pairing convention: background = `*-tint`, text = `*-deep`,
border = `rgba(<accent>, 0.3)`. See `.level-badge`, `.badge-most-loved`.

### Type

| Token | Stack | Use |
|---|---|---|
| `--font-display` | Space Grotesk, Arial Narrow, sans-serif | h3/h4, brand, buttons, UI labels, venue/city names |
| `--font-headline` | Bebas Neue → `--font-display` fallback | h1/h2 **only** — condensed all-caps poster headlines |
| `--font-body` | Inter, system sans | Body copy |
| `--font-mono` | IBM Plex Mono, ui-monospace | Eyebrows, meta/stat text, addresses, badges, mono labels — the site's "data" voice |

Rule: `--font-headline` is for hero/section headlines (h1, h2) only. Never
apply it to a venue name, city name, or UI control — those stay on
`--font-display` so they don't read as shouty.

### Spacing / radius / motion

- Spacing scale: `--space-1` (0.5rem) → `--space-5` (5rem). Use these instead
  of arbitrary rem values for section/hero padding and vertical rhythm.
- Radius: `--radius-s` (10px) for buttons/inputs/small panels,
  `--radius-m` (16px) for cards and larger surfaces.
- `--ease`: `cubic-bezier(0.16, 1, 0.3, 1)` — the one easing curve used
  everywhere (hovers, dropdown chevrons, hero rise-in). Reuse it; don't
  introduce a second curve.
- `--max`: 1120px page content width, applied via `.container`.
- All motion is wrapped by the global `prefers-reduced-motion: reduce` block
  at the top of `style.css` — you don't need to hand-write reduced-motion
  overrides for new animations, but keep any hover transform ≤ 2px and any
  transition ≤ ~0.2s so it stays consistent with the rest of the site.

## Layout primitives

- `.container` — centers content at `--max`, side padding `--space-3`. Every
  section wraps its content in one.
- `.section` — vertical padding `--space-4`; consecutive `.section`s get a
  top border automatically (`.section + .section`).
- `.hero` — homepage hero only, with the `rise` keyframe stagger on
  `h1` → `.lede` → `.stat-strip`.
- `.page-hero` — the interior-page equivalent (about, gear, cities, etc.):
  smaller heading scale, bottom border, no rise animation.
- `.region-head` — flex header row (title + description + optional link)
  used above a grid/list section. Bare `<h2>` sections (e.g. a city page's
  "Where to play") skip `.region-head` but are sized to match via
  `.section > .container > h2`.

## Components

Reuse these before adding new markup patterns. Class names are stable across
CSS redesigns (only values change), so grep `style.css` for the class before
assuming something needs inventing.

**Header/nav** — `.site-header` (sticky) → `.brand` (logo dot + wordmark) +
`.main-nav` (flat links, `aria-current="page"` on the active one) +
`.nav-dropdown` (a `<details>/<summary>` "More" menu, no JS needed for
open/close) + `.global-search` (icon + input + results dropdown, driven by
`assets/global-search.js`).

**Buttons** — `.btn` (solid bay, primary CTA) · `.clear-btn` /
`.book-btn` (outlined pill, mono font, fills solid on hover) ·
`.favorite-btn` (heart toggle, poppy) · `.rating-form-toggle` (text-only,
underlined).

**Cards** — `.city-card` (grid tile, arrow nudges right on hover) ·
`.venue-card` (left-border accent, `.top-pick` modifier switches the
left-border + wash to optic) · `.region-card` (dark bay-deep panel, home page
only) · `.directory-card` (compact venue card for narrow viewports).

**Badges/pills** — `.stat-chip` (neutral mono pill with a bold value) ·
`.level-badge` (`.beginner` / `.competitive` / `.mixed`) · `.rank-badge`
(`.top` modifier = optic) · `.badge-top-rated` / `.badge-most-loved` ·
`.city-tag` / `.city-jump-tag` (quick-jump link pills).

**Lists** — `.mini-venue-list` / `.mini-venue-row` (compact bordered rows,
`mv-` prefixed sub-elements) · `.know-list` (square-bullet info list) ·
`.leaderboard` / `.leaderboard-row` (rankings; `.is-compact` for the Top 10
strip, `rank-1/2/3` color the rank number).

**Ratings/voting** — `.star-rating` (read-only, CSS-only fill via `--fill`
custom property) · `.star-picker` (interactive, `row-reverse` + `~` sibling
hover trick for a working right-to-left star picker with no JS star
re-render) · `.rating-form` / `.rating-form-row` (`rf-` prefix) ·
`.google-rating-badge` (always shown **separately** from the community
rating, never blended into one number).

**Forms/filters** — `.directory-filters` / `.filter-field` (labeled selects)
· `.hours-slider` (dual-thumb range, `-thumb`/`-track`/`-range` layered divs).

**Callouts** — `.callout` (poppy left-border block for warnings/notices).

**Map** — `.venue-map` container + `.pba-pin` (`--outdoor`/`--indoor`/`--both`
gradient split/`--unknown` modifiers, `.top-pick` adds an optic ring) +
Leaflet control/popup overrides scoped under `.leaflet-*` selectors so the
plugin's default theme never leaks through.

## Conventions

- **File layout**: `assets/style.css` is the global system (tokens, type,
  header/footer, buttons, cards, badges — anything used on 2+ pages). Each
  page that needs more gets a same-named stylesheet layered on top
  (`directory.css`, `map.css`, `rankings.css`, `global-search.css`) — every
  one of those files opens with the comment `/* <Page> — scoped styles
  layered on top of style.css */`. Follow that pattern for new pages: don't
  add page-specific rules to `style.css`, and don't duplicate a global rule
  in a page file.
- **Sub-element naming**: components prefix their internal parts with a
  short tag instead of full BEM — `mv-` (mini-venue-row), `rf-`
  (rating-form-row), `p-` (map popup), `gsr-` (global-search-result). Match
  the existing prefix when extending a component; pick a new short prefix
  when adding one.
- **Accessibility**: every interactive control needs a visible
  `:focus-visible` state (the global 3px `--bay` outline covers most cases
  automatically); nav links use `aria-current="page"` rather than a
  hardcoded "active" class; don't rely on color alone (see the `--pin-`
  hue-spread reasoning above) — pair color with a label, icon, or position.
- **Don't introduce**: a second font family, a second easing curve, drop
  shadows heavier than the existing `rgba(23, 35, 43, …)` ink-tinted ones,
  saturated/neon colors outside the defined palette, or blur/backdrop-filter
  (explicitly removed in the v3 redesign — see the `style.css` header
  comment).

## Checklist for a new page or component

1. Can this be built from existing classes (`.btn`, `.*-card`, `.*-badge`,
   `.stat-chip`, `.section`/`.container`/`.page-hero`) with no new CSS? Prefer
   that.
2. If new CSS is needed, does it belong in `style.css` (used on 2+ pages) or
   a new `<page>.css` (single page)?
3. Colors, spacing, radius, and easing come from the tokens above — no new
   hex values or magic numbers unless the token set genuinely can't express
   it (and if so, add the token to `:root` and document it here).
4. Headlines: `h1`/`h2` get the condensed `--font-headline` treatment
   automatically from the global `h1, h2` rule — don't override per-page
   unless there's a real reason (see `.hero h1` / `.page-hero h1` for the
   size-only precedent).
5. New badge/pill/status color follows the `tint` bg + `deep` text +
   `rgba(accent, 0.3)` border pattern.
6. Test at 640px and 560px breakpoints — those are the site's two standard
   mobile breakpoints (table→card swaps, nav wrapping, form stacking).
