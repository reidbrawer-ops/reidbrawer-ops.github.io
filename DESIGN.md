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

> "Editorial field guide" — v4 (see the header comment in `style.css`).

Part atlas, part almanac. Warm paper tones, a confident serif for headlines
**and venue names**, a monospace "data voice" for stats, addresses and
verification dates, and hand-drawn line icons. The page is warm paper, not
fog; sections alternate paper → paper-deep, and the page *ends* on ink.

This replaced v3 ("court colors, daylight") wholesale — the cool grey/white
ground, the condensed all-caps Bebas headline, and the "optic yellow means
#1 and nothing else" rule are all gone. In v4 optic is the **primary
accent** (buttons, active states, outdoor courts) and teal carries links and
focus.

The one deliberate signature device is the **Verified stamp** — a rotated,
single-ring circular mark. It appears in exactly three places (About, City
Detail, 404). Keep it literal and recurring; don't turn it into generic
decoration, and don't add a fourth variant without a reason.

## Tokens (`:root` in `style.css`)

Variable **names are deliberately stable across versions** and describe a
**role, not a hue**. That indirection is load-bearing: it's the only reason a
total repaint landed on 53 pages and six stylesheets without touching their
selectors. `--bay` is "primary accent" (now teal, was blue). `--poppy` is
"warm accent" (now clay). `--kitchen` is "secondary accent" (now optic
olive). **Don't rename them to match the current palette.**

### Color

| Token | Hex | Use |
|---|---|---|
| `--fog` | `#f7f2e7` | Paper — page background |
| `--fog-dim` | `#ede5cf` | Paper deep — alternating section bg, Google pill, spec chips |
| `--paper` | `#fdfbf4` | Card / panel surface |
| `--cream` | `#f3eedd` | Heading color **on dark** (footer, trust, methodology) |
| `--ink` | `#16211f` | Primary text, borders, **and dark section bg** |
| `--ink-soft` | `#55655f` | Secondary text, meta, mono labels |
| `--ink-faint` | `#8b9892` | Tertiary — placeholders, fact labels, "not yet rated" |
| `--body-ink` | `#3e4a45` | Paragraph copy (softer than `--ink` so long copy doesn't vibrate on warm paper) |
| `--bay` / `--bay-deep` | `#1e6e66` / `#154f49` | **Primary accent — teal.** Links, focus rings, indoor courts, secondary buttons |
| `--kitchen` / `--kitchen-deep` | `#56621a` | Optic olive — the **only** optic that passes as text |
| `--optic` | `#d6e14a` | Optic — primary buttons, active states, outdoor courts. **Fills, borders and star fills only** |
| `--optic-text` / `--optic-deep` | `#56621a` | The text-safe optic (~4.9:1). Any optic-colored text, numeral or icon stroke uses this |
| `--poppy` / `--poppy-deep` | `#c1552c` / `#9c4322` | Clay decorative (heart fill, "both" pin) / clay text-safe (rank #1, Top Pick ribbon) |
| `--bay-tint` / `--kitchen-tint` / `--poppy-tint` | `#dceeea` / `#f2f6d6` / `#f5e1d6` | Chip + callout backgrounds, paired with their `-deep`/olive text |
| `--footer-body` / `--footer-muted` | `#c9cfc0` / `#8fa39c` | Body / fine print on ink |
| `--star-empty` | `#c9bfa0` | Unfilled **community** star (an outline on paper) |
| `--star-empty-user` | `#f0ebda` | Unset **user** star (a filled-but-unset swatch). **Not interchangeable with the above** |
| `--pin-outdoor` / `--pin-indoor` / `--pin-both` | `#d6e14a` / `#1e6e66` / `#c1552c` | Map pins |

**The hairline is a ramp, not one value.** `--line` (`rgba(22,33,31,0.14)`) is
the default card border, but the design uses ten distinct alpha steps and
flattening them loses the depth cue between a card edge, a form control and a
dashed empty state. Use the ramp: `--rule-06` (nav hover) · `--rule-08`
(in-card divider) · `--rule-10` (menu divider) · `--rule-12` (header hairline)
· `--rule-16` (search/map panel border) · `--rule-25` (dashed empty state) ·
`--rule-30` (quiz Back button). `--line-strong` (`0.22`) is for **interactive
form-control borders only** (input/select/textarea) — WCAG 1.4.11 wants 3:1
for UI boundaries.

Badge/pill pairing convention: background = `*-tint`, text = `*-deep` (or
`--kitchen` for optic-pale chips). See `.level-badge`, `.badge-most-loved`.

**v4 pins convey type by SHAPE first** — circle (outdoor), rounded square
(indoor), diamond (both) — each with a 2px ink stroke, so the fills can safely
be brand accents. v3 needed a bespoke wide-hue blue/green pair only because
color was carrying the meaning alone at 16px. Shape carries it now.

### Type

| Token | Stack | Use |
|---|---|---|
| `--font-headline` | Source Serif 4 → Georgia, serif | **All** headings h1–h4, **including venue/city/paddle names** |
| `--font-display` | Manrope | UI: buttons, nav, labels, chips |
| `--font-body` | Manrope | Body copy |
| `--font-mono` | Space Mono | The **data voice** — stats, addresses, badges, prices, "Verified" dates |

The v3 rule ("`--font-headline` is h1/h2 only; venue names stay
`--font-display`") is **reversed**: in v4 the editorial serif *is* the
headline face, so every heading including a venue name gets it, and
`--font-display` is left as the UI face. That split is why per-page CSS
reaching for `--font-display` on a button still gets the right thing.

Mono is almost always uppercase with `letter-spacing: 0.04–0.16em`.
Fonts load from a Google Fonts `<link>` in each page's `<head>` (not an
`@import` — v3's Bebas `@import` was render-blocking inside the CSS).

### Spacing / radius / motion

- Spacing scale: `--space-2` (1rem) → `--space-5` (5rem).
- Radius: `--radius-s` (10px) buttons/inputs, `--radius-m` (16px) cards. Also
  in use: `999px` pills/chips, `20px` (quiz panel only), `14px` (filter bars,
  rank cards, quiz options), `12px` (city cards, hero search), `8px` (nav
  links, description strip).
- `--ease`: `cubic-bezier(0.16, 0.8, 0.3, 1)` — the one curve. Don't add a second.
- `--max`: 1120px, applied via `.container`.
- Two keyframes only: `pbaFadeUp` (fade + 16px rise) and `pbaPulse` (the
  selected map pin's expanding ring — a `box-shadow` animation, which is why
  it works on Leaflet's HTML markers).
- Hover lift ladder **in `style.css`**: **-4px** feature cards (`.home-lane`,
  which also get a shadow) → **-3px** region cards → **-2px** city cards.
  `.venue-card` has **no** lift; it transitions border-color/background only.
  Page stylesheets set their own and are not bound by that ladder — today
  `rankings.css` lifts rank cards -3px, `paddles.css` lifts `.pf-choice` -2px
  *with* a shadow, and `paddle-quiz.css` lifts `.pq-option` -1px. Match the
  nearest neighbour rather than "correcting" these to the list above.
- All motion is wrapped by the global `prefers-reduced-motion: reduce` block.

### Breakpoints

`900px` is the nav breakpoint (hamburger + stacked panel below it). A
`(min-width: 901px) and (max-width: 1040px)` band compresses the nav — the
real nav has six items plus a 240px search pill and needs ~983px to hold one
line, so without it 900–983px would render the two-line header the breakpoint
exists to prevent. Then `860px` / `640px` / `560px` for content reflow. Find
Courts drops to a single column at `1023px` (see `map.css`).

## Layout primitives

- `.container` — centers at `--max`, side padding `--space-3`.
- `.section` — vertical padding from `--section-y` (`clamp(2.75rem, 5vw,
  3.5rem)`, ~44px mobile → 56px desktop → ~88–112px between sections);
  consecutive sections get a top border. Tune the whole site's section rhythm
  from that one token. The home page's full-bleed colour bands set their own
  larger padding (`home.css`) and are deliberately off this token; directory
  pages (`.cities-region`, `.rent-region`) go tighter still at 24px.
- `.section--dark` — the ink-ground band: `--cream` headings, `--footer-body`
  copy, `--optic` mono labels. Used by the footer, the home trust section, the
  rankings methodology callout and the Learn CTA.
- `.hero` (home) / `.page-hero` (interior pages) — carry the `pbaFadeUp`
  entrance. **The entrance is on `.hero`/`.page-hero`, not `<main>`**: a
  transform on `<main>` would make it the containing block for every
  `position: fixed` descendant and silently break `map.css`'s mobile detail drawer.
- `.region-head` — flex header row (title + description + optional link).

## Components

Reuse these before adding new markup. Class names are stable across CSS
redesigns (only values change), so grep `style.css` before inventing.

**Header/nav** — `.site-header` (sticky, translucent paper + `backdrop-filter`)
→ `.brand` (the **two-line lockup**: `.brand-eyebrow` mono micro-label over
`.brand-word` italic serif) + `.main-nav` + `.nav-dropdown` (a `<details>` "More"
menu; `.nav-dropdown-rule` separates the legal links, which are smaller and
unweighted) + `.global-search` (240px paper pill).

**Stamp** — `.stamp` (+ `.stamp--m` / `.stamp--s`), with `.stamp-label`
(mono "VERIFIED"/"UNVERIFIED"), `.stamp-code` (the serif "404") and
`.stamp-note` ("METHOD, NOT MAGIC"). Circle, `--paper` ground, **single** 2px
ink ring, rotated. Three instances: About 104px/-7°, 404 96px/-8°, City Detail
64px/-6° (checkmark only, inside `.source-checked`).

**Buttons** — `.btn` (primary optic: `--optic` ground, 2px ink border, **inverts
to ink-on-optic** on hover) · `.clear-btn` / `.book-btn` (outlined pill) ·
`.favorite-btn` (heart, clay) · `.rating-form-toggle`.

**Cards** — `.city-card` · `.venue-card` (+ `.top-pick` → the clay-deep
`.top-pick-badge` ribbon pinned to the top-left corner) · `.region-card` ·
`.home-lane` · `.directory-card`.

**Badges/pills** — `.eyebrow-pill` (teal-pale hero pill) · `.stat-chip` ·
`.level-badge` (`.beginner`/`.competitive`/`.mixed`) · `.rank-badge` (`.top`) ·
`.badge-top-rated` / `.badge-most-loved` · `.city-tag` / `.city-jump-tag`.

**Callouts** — `.callout` · `.source-checked` (teal-pale, hosts the 64px stamp
on city pages).

**Legal shell** — `.legal-col` (720px) + `.legal-hero` (no bottom rule; these
pages open straight into prose) + `.legal-body` + `.legal-prose` (the single
flex measure; `> p` and `h2` are styled by it). Shared by `/privacy` and
`/affiliate-disclosure`. Rules unique to one of them — privacy's `.dns-optout`,
the disclosure's `.legal-lead` — stay in that page's own inline `<style>`.

**Ratings/voting** — `.star-rating` (read-only; CSS-only partial fill via the
`--fill` custom property) · `.star-picker` (interactive; `row-reverse` + `~`
sibling combinators give a working right-to-left picker with no JS re-render —
**the reverse 5→1 DOM order and flat sibling structure are load-bearing**) ·
`.rating-form` (`rf-` prefix) · `.google-rating-badge` (always shown
**separately** from the community rating, never blended into one number).

**Icons** — the shared sprite at `assets/icons.svg`, via
`<use href="/assets/icons.svg#ic-…">`. Symbols carry no `fill`/`stroke` so they
inherit via `currentColor` — never hardcode a color in the sprite.

**Map** — `.venue-map` + `.pba-pin` (`--outdoor`/`--indoor`/`--both`/`--unknown`,
`.top-pick` adds a dashed clay ring). Shape comes from `--pin-radius` /
`--pin-spin` custom properties; the diamond is a rotated square rather than a
`clip-path` polygon, because `clip-path` would shave the 2px stroke off its own
diagonals. `.map-legend`'s `.legend-dot` **reuses the same `.pba-pin--*`
classes** — recolor in one place or legend and pins desync.

## Conventions

- **File layout**: `assets/style.css` is the global system (anything on 2+
  pages). Each page that needs more gets a same-named stylesheet layered on
  top — `home.css`, `cities.css`, `map.css`, `paddles.css`, `paddle-quiz.css`,
  `rankings.css`, `corrections.css` — each opening with
  `/* <Page> — scoped styles layered on top of style.css */`.
  **Don't add page-specific rules to `style.css`, and don't duplicate a global
  rule in a page file** (a page file legitimately *drops* a rule that the
  global sheet already covers).
  A page with only a handful of rules of its own keeps them in an inline
  `<style>` instead of paying a request for a near-empty file — `404.html`,
  `about.html`, `learn.html`, `privacy.html` and `affiliate-disclosure.html`
  all do this, and it's fine. What is *not* fine is the same block appearing
  inline on two pages: the moment a rule is shared, it belongs in `style.css`.
  (That's exactly how the `.legal-*` shell went wrong — it was pasted verbatim
  into both legal pages and drifted in its comments before it was promoted.)
- **Sub-element naming**: short prefixes, not full BEM — `mv-`, `rf-`, `p-`,
  `gsr-`, `fr-`, `fd-`, `pq-`. Match the existing prefix when extending.
- **Shared JS lives in its own module, imported — never copied.** Three exist,
  each because two surfaces needed the same answer and a second copy would drift
  invisibly: `assets/affiliate-links.js` (`vendorLinkFor` + `trackVendorClicks`
  — the Amazon allowlist, ASINs and the `isAffiliate` flag that drives both
  `rel="sponsored"` and the disclosure), `assets/paddle-ratings.js` (the four
  0-1 trait ratings, so "the most powerful paddle" is one claim site-wide), and
  `assets/dom-utils.js` (`escapeHtml`/`citySlug`). Import them; don't re-roll.
- **Paddles & Gear is three pages**, one per lane: `/paddles` (the quiz —
  keeps the `#quiz` anchor that 43 pages target via the lane-router),
  `/paddles/browse` (the 486-paddle catalog) and `/paddles/rent`. They share a
  section nav built from `.pf-choose`/`.pf-choice`, inlined on each of the three
  and marked with `aria-current="page"`. `sync-header.js` maps `paddles/*` to
  the `/paddles` nav tab, so the tab lights on all three.
- **Chrome is generated, not hand-copied**: the header comes from
  `partials/site-header.html` → `node scripts/sync-header.js`; the "Before you
  head out" block from `partials/lane-router.html` → `node
  scripts/sync-lane-router.js`. Never hand-edit the marked regions in the 53
  pages. **`scripts/build.mjs` is stale and fails extraction on every page —
  don't run it** (see RUNBOOK).
- **Two markup rules the build scripts enforce by throwing**: nav links in the
  partial must be exactly `<a href="/x">` with **no other attributes**
  (sync-header string-matches them to inject `aria-current`), and every page
  must keep the literal `<footer class="site-footer">` opening tag
  (sync-lane-router uses it as its insertion anchor). Style nav links via
  `.main-nav a`.
- **The footer is not synced** — 6 pages carry deliberate variation (the
  "Popular" column drops the current city; paddles/rankings have tailored
  `.footer-note` text). Edit it per-page or script it, and preserve that.
- **Accessibility**: every control needs a visible `:focus-visible` (the global
  3px `--bay` outline covers most); nav uses `aria-current="page"`, not a hardcoded
  class; don't rely on color alone; **optic-colored text/graphics use
  `--optic-text`, never bare `--optic`** (it fails contrast at ~2.6:1).
  (`--optic-deep` is an alias of `--optic-text` in v4 and is equally safe — it
  was the failing `#9aa81e` in v3, which is why older habits avoid it.)
  Every page is a `.skip-link` → `<main id="main" tabindex="-1">` pair.
- **Don't introduce**: a second easing curve, a fourth font family, pure `#fff`
  or black-tinted shadows (use `--paper`/`--cream` and `rgba(var(--ink-rgb), …)`
  — warm paper has no true white in it), or saturated colors outside the palette.

## Checklist for a new page or component

1. Can this be built from existing classes (`.btn`, `.*-card`, `.*-badge`,
   `.stat-chip`, `.section`/`.container`/`.page-hero`, `.stamp`,
   `.section--dark`) with no new CSS? Prefer that.
2. If new CSS is needed, does it belong in `style.css` (2+ pages) or a
   `<page>.css` (single page)?
3. Colors, spacing, radius and easing come from the tokens above — no new hex
   or magic numbers unless the token set genuinely can't express it (and if so,
   add the token to `:root` and document it here).
4. Headings get the serif automatically from the global `h1,h2,h3,h4` rule —
   don't override per-page without a real reason.
5. New badge/pill color follows the `tint` bg + `deep`/olive text pattern.
6. Test at 900px (nav), 640px and 560px.
7. **Before shipping**, re-read the JS hooks your markup carries. `npm run
   validate` is data-only and asserts *nothing* about HTML, so it cannot catch
   a redesign that deletes an id. `npm run check` must still report **169
   venue-cards across 43 city pages** — if it says "Checked 0", you broke
   `CARD_RE` in `scripts/check-venue-cards.mjs` and the guard is now a silent
   no-op.
