## Overview

This is a full visual redesign of **Pickleball Bay Area**, an independent, ad-free directory of public pickleball courts across the SF Bay Area. It covers all 12 pages of the site (Home, Find Courts, Cities, City Detail, Rankings, Paddles & Gear, Learn to Play, About, Report a Correction, Affiliate Disclosure, Privacy, 404), a shared header/footer, and the reusable components that appear across them (venue cards, the map, badges, star ratings, filters, the paddle quiz).

**Design concept:** an editorial field guide to Bay Area pickleball — part atlas, part almanac. Warm paper tones, a confident serif for headlines, a monospace "data voice" for stats/addresses/verification dates, and a hand-illustrated Bay Area map. The signature device is a rotating "VERIFIED" stamp that doubles as brand mark and real data (it always shows the actual last-verified date).

## About the Design Files

The files in this bundle are **design references built in HTML**, produced in a prototyping tool with its own proprietary template syntax and runtime. They show the intended look, content, and interaction behavior — **they are not production code to copy in directly.** Your task is to **recreate this design in your existing codebase** (React, Vue, native, or whatever the project already uses) using its established components, patterns, and libraries. If no frontend exists yet, choose the framework that best fits the project and implement the design there.

## Fidelity

**High-fidelity.** Every screen below has final colors, typography, spacing, copy, and interaction states. Recreate the UI pixel-close using your codebase's own styling system (CSS-in-JS, Tailwind, SCSS, whatever it already uses) rather than inline styles — the prototype uses inline styles only because that's a constraint of the tool it was built in, not a recommendation.

## ⚠️ Systems to preserve — read this first

You said it's important not to lose the map, the affiliate links, or the quiz. Here's the nuance: this prototype had to be a **self-contained, dependency-free HTML file**, so all three of those are built as simplified, hardcoded stand-ins. If your production app already has real versions of these, **do not replace their logic/data with the prototype's** — only apply this design's visuals and interaction patterns to your real implementation:

1. **The map (Find Courts page).** The prototype draws a hand-illustrated inline SVG map (no Google Maps/Mapbox/tile service) with 16 hardcoded sample pins, specifically so it always renders with zero external dependencies. If your app has real map integration with live venue geocoding, **keep your real map** and re-skin it to match: pin shapes/colors by court type (circle/square/diamond), the dashed top-pick ring, the pulsing selected-pin state, pins dimming when filtered out, the legend, and the rounded map panel framing. Only adopt the hand-illustrated *style* (e.g., as a custom map theme or a static overview graphic) if that's a deliberate product decision — don't assume it should replace a real interactive map provider.
2. **Affiliate links (Paddles & Gear page + quiz results).** Every "Check price" button here points to a generic search-engine URL and shows a static "Affiliate link" label, because there's no real affiliate program wired into a prototype. **Preserve your real affiliate URLs, tracking parameters, and disclosure logic** — only reuse this design's button styling/placement and the inline disclosure microcopy pattern (the label sits directly next to the link, never buried in a footnote).
3. **The paddle quiz.** The matching logic is a simple client-side point-scoring function over a 24-paddle sample array (see `data.json`), built only to demonstrate the flow. If you have a real paddle catalog or recommendation backend, **keep it** — reuse this design's 4-question flow, option-button styling, progress dots, disabled/enabled Next button behavior, and the 3-card results layout with a one-line "why this fits" summary, not the scoring algorithm or sample data itself.

## Design Tokens

**Color**
| Token | Hex | Use |
|---|---|---|
| Paper (page bg) | `#F7F2E7` | Default page background |
| Paper deep | `#EDE5CF` | Alternating section bg (Three ways in, quiz panel) |
| Card | `#FDFBF4` | Card/panel surfaces |
| Ink | `#16211F` | Primary text, borders, dark section bg (footer, trust section) |
| Ink soft | `#55655F` | Secondary/meta text |
| Ink faint | `#8B9892` | Tertiary/placeholder text |
| Body copy | `#3E4A45` | Paragraph text |
| Optic (primary accent) | `#D6E14A` | Primary buttons, outdoor court indicator, active states — **always paired with dark ink text/border on top of it, never used as small text or icon strokes on the light background (fails contrast)** |
| Optic pale | `#F2F6D6` | Outdoor/beginner-friendly chip background |
| Optic olive (text-safe) | `#56621A` | Text/icon color on optic-pale chips |
| Teal (secondary accent) | `#1E6E66` | Indoor court indicator, links, secondary buttons, focus rings |
| Teal deep | `#154F49` | Link hover, dark-on-light emphasis |
| Teal pale | `#DCEEEA` | Indoor chip bg, map water, "source-checked" callouts |
| Clay (decorative accent) | `#C1552C` | Decorative fills/borders only (fails AA as small text on paper) |
| Clay deep (text-safe) | `#9C4322` | Rank #1, Top Pick ribbon, competitive-chip text |
| Clay pale | `#F5E1D6` | Competitive/both chip background |
| Star empty | `#C9BFA0` | Unfilled star outline |
| Hairline border | `rgba(22,33,31,0.14)` | Default card borders |
| Divider | `rgba(22,33,31,0.08)` | In-card row dividers |
| Footer bg | `#16211F` | Footer, trust section, quiz "how ranking/how to use it" callouts |
| Footer body text | `#C9CFC0` | Footer paragraph text |
| Footer muted text | `#8FA39C` | Footer fine print |

**Typography** — 3-tier system, all from Google Fonts:
- **Display/editorial** — `Source Serif 4` (weights 400/500/600/700, italic available). All H1/H2 headlines, venue/paddle names, the logo wordmark. Hero H1 is `clamp(40px, 6vw, 72px)` / weight 600 / line-height 1.02 / letter-spacing -0.01em. Section H2s run `clamp(28px,3.5vw,40px)`–`clamp(30px,4vw,44px)` depending on page. Card titles 17–22px, weight 600.
- **UI/body** — `Manrope` (weights 400/500/600/700/800). Body copy (14–19px, line-height 1.5–1.7), nav links, buttons, form labels.
- **Data voice** — `Space Mono` (weights 400/700). Stats, city/region meta lines, prices, badges/chips, "last verified" dates — almost always uppercase with `letter-spacing: 0.04–0.16em` for labels.

**Spacing & shape**
- Content max-width varies by page density: 1320px (Home/Cities/City Detail), 1360px (Find Courts), 1200px (Paddles), 1100px (Rankings), 900px (Learn), 820px (About), 720px (legal pages), 640px (Report).
- Section vertical padding 80–96px; horizontal `clamp(20px, 5vw, 40–64px)`.
- Border radius: 16px (cards), 12–14px (small cards/panels), 999px (pills/chips/buttons).
- Default card border: 1px solid hairline; emphasis/selected state: 2px solid ink.

**Motion**
- Page-level entrance: fade + 16px rise, 0.5s `cubic-bezier(.16,.8,.3,1)`, replayed on every view change; hero children stagger in at +0/0.05/0.1/0.15/0.2s.
- Card hover: `translateY(-3px to -4px)` + border-color change, 0.15–0.18s ease.
- Buttons: background/text color invert on hover, 0.15s.
- Selected map pin: pulsing ring (`box-shadow` 0→12px fade, 1.6s ease-out infinite).
- All motion respects `prefers-reduced-motion: reduce` (forces ~0 duration on everything) — see also the `reduceMotion` tweak below.

## Global components

**Header/Nav** — Sticky, translucent+blurred paper background, bottom hairline. Two-line logo lockup ("PICKLEBALL" mono micro-label over italic serif "Bay Area"), links home. Desktop (≥900px): Find Courts / Cities / Rankings / Paddles & Gear / About as inline text links, plus a "More ▾" dropdown (Learn to Play, Report a Correction, divider, Affiliate Disclosure, Privacy), plus a right-aligned pill search input. Below 900px: nav collapses to a hamburger icon that opens a full-width stacked panel with the same links + search. Active nav item gets `aria-current="page"`.

**Footer** — Ink-dark background, cream text. Four columns: logo/blurb, Regions (links to Find Courts pre-filtered by region), Site (all main pages), Popular cities (5 city-detail deep links). Bottom row: copyright + affiliate note + Affiliate/Privacy links.

**Venue card** (the core reusable component — full version on Find Courts, a simplified variant on City Detail): name (serif) + city/region meta line + favorite-heart toggle top-right; a type badge (Outdoor/Indoor/Both, color-coded) and a skill badge (Beginner-friendly / Competitive); a 2-column facts grid (Price, Access, Hours, Typical wait, each with a small line icon); a description strip (surface + skill note); up to 4 circular amenity letter-badges (L/R/W/P for Lights/Restroom/Water/Parking, only shown when true); a ratings row — a 5-star **partial-fill** graphic for the community rating + count, a separate non-blended Google rating pill, or an italic "Not yet rated — be the first" empty state; a separate interactive 5-star "Your rating" row (in-memory, distinct from the read-only community aggregate); a footer row with a dashed-ring checkmark "Verified {month year}" mark and a real "Directions →" link (Google Maps search query, opens in a new tab). A "Top Pick" variant adds a small ribbon badge (clay-deep bg, cream text) pinned to the top-left corner and a heavier ink border.

**Map** (Find Courts) — Hand-illustrated inline SVG, not a tile-service embed (see preservation note above). Gradient water background; 5 landmasses as smooth organic closed shapes (one per region) with faint internal contour lines and small monospace region labels; 3 dashed lines standing in for the Golden Gate, Bay, and San Mateo bridges; a compass rose. Pins: circle=outdoor (optic fill), rounded square=indoor (teal fill), diamond=both (clay fill), always with an ink stroke so shape (not just color) conveys meaning. Top-pick venues get an extra dashed ring; the selected venue gets a pulsing ring. Pins dim to ~25% opacity and stop being interactive when filtered out. A small legend explains the pin language.

**Badges/chips** — Pill-shaped, monospace, bold, uppercase, small. Variants: skill level, Top Pick, Top Rated, Most Loved, and 2-state filter-toggle chips (unselected = cream bg/ink border; selected = solid teal bg/cream text).

**Verified stamp** — Circular, rotated -6 to -8°, double ring, "VERIFIED" + teal checkmark + the actual date. Large (~110px) on the Home hero and About page footer; compact (~64–100px) on City Detail. This is the site's one deliberate signature device — keep it literal and recurring, not a one-off decoration.

**Star rating graphic** — Community rating: two layered SVG stars per position (grey outline + width-clipped optic-filled overlay) for accurate partial fills (e.g. 4.8 = 4 full + 1 at 80%). User's own rating: simple whole-star click targets, entirely separate state.

## Screens

### 1. Home
Hero: eyebrow pill ("SAN FRANCISCO BAY AREA · PUBLIC COURT DIRECTORY"), H1 "Every court, actually verified.", subhead — the exact positioning line: *"A working directory of public pickleball courts across the San Francisco Bay Area, verified against each city's own recreation department listing."* — a search bar (city/court, submits into Find Courts), a 4-up headline stat row (**~200** Verified venues / **973** Courts / **42** Cities / **5** Regions), and a decorative mini bay graphic + large Verified stamp alongside.
"Three ways in" section (paper-deep bg): 3 equal cards routing the three visitor lanes — *Locals & visitors → Find a court near you* (→ Find Courts), *New to pickleball → Never played before?* (→ Learn to Play), *Ready to buy → Find your paddle* (→ Paddles & Gear) — each with a short line of body copy and an arrow link, hover-lifts with a theme-colored border (optic/teal/clay respectively).
"Browse by region" section: 5 region cards (name, city count, description from the content pack) → Find Courts pre-filtered to that region.
"How this stays honest" trust section (dark bg): three columns — **What we check** / **What we don't do** / **How to use it** — exact copy in the content pack below.

### 2. Find Courts
The core utility. Header + filter bar (Region / Indoor-Outdoor / Free-Paid / Walk-up-Reservable selects, plus Beginner-friendly + 4 amenity toggle chips, plus a Reset link). Below: the Map (sticky, left) synced to a scrollable venue-card list (right) — filters affect both simultaneously (list rows hide entirely; non-matching pins dim). Clicking a pin or a card sets a shared "selected" state that highlights the matching card. Empty state (dashed panel + Reset button) when a filter combination matches nothing.

### 3. Cities
An index of all regions and cities. Repeated per region, in order (San Francisco, Peninsula, South Bay, East Bay, North Bay): region name + city count + description, then a card grid of every city in that region — each shows a venue/court count when we have sample data, or a plain "Not yet verified" state when we don't (never fake data to fill a gap).

### 4. City Detail
Data-driven — works for any of the 16 cities that have a sample venue, with an honest empty state for the rest (e.g. Cupertino: *"Cupertino is on the list — not yet verified."* + a "Suggest a court here" CTA to Report a Correction). Found state: breadcrumb (Cities / Region / City), H1, meta line (region · venue count · total courts), an intro paragraph (bespoke copy for Palo Alto, San Francisco, Oakland, Berkeley, Campbell, and San Rafael — see content pack; other cities get a short generated sentence from their data), a "Source-checked" callout, a featured "Top pick in {city}" card, then a grid of that city's remaining verified courts.

### 5. Rankings
Header + an honest methodology callout: ranked by community star rating (never blended with Google's), weighted so a single 5-star review can't dominate, nothing paid. A horizontally-scrolling "Top 10" strip of rank cards, then a "Full list" of dense rows for every rated venue (rank, name/city, badges, community stars+count, Google pill), then a "Not yet rated" section for venues with zero ratings. Rank #1 is styled in clay-deep; "Most Loved" = highest rating count; "Top Rated" = top 3 by score.

### 6. Paddles & Gear
Two parts. **The quiz**: a linear 4-question wizard (progress dots) — skill level → power/control/all-court preference → budget band → weight preference — each question is 3 equal option buttons; Back/Next nav, Next disabled until answered, last step reads "See my matches". On completion: a 3-card results grid (brand/model/price, a templated one-line "why this fits" sentence, an affiliate-disclosed Check-price button) + Retake. **The browsable grid**: 4 filters (Type/Shape/Price/Skill) + Reset + a transparency line ("showing N of 486"), a "rent before you buy" callout linking to Learn, then a responsive paddle-card grid (brand/model/price, 3 spec chips, a 2×2 spec mini-grid, approval note + Check-price button).

### 7. Learn to Play
Header, then a 2×2 grid of 4 numbered basics cards — **01 Scoring**, **02 The Kitchen**, **03 The Serve**, **04 Court Etiquette** (exact copy below) — then two CTA cards: a dark one ("Find a beginner-friendly court" → Find Courts pre-filtered to beginner-friendly) and a paper one ("Rent before you buy" → Paddles & Gear).

### 8. About
Header "A directory, not a marketplace.", then four stacked sections with exact copy: **Who runs this**, **How verification works**, **Independence** (links to Affiliate Disclosure), **Corrections** (links to Report a Correction) — ending with a rotated Verified-stamp graphic labeled "METHOD, NOT MAGIC".

### 9. Report a Correction
A form: Venue select (every known venue + "Other/not listed"), Issue select (Hours wrong / Price wrong / Court closed or removed / Court count or surface wrong / A court is missing entirely / Something else), Details textarea, optional Email. Submit is disabled until Venue + Issue are chosen. On submit, swaps to a teal confirmation card with a checkmark and thank-you copy.

### 10. Affiliate Disclosure
Light legal page, 4 short paragraphs — see content pack.

### 11. Privacy
Light legal page, 4 short paragraphs — see content pack.

### 12. 404
Centered rotated stamp-style badge reading "UNVERIFIED / 404", "This court isn't on the map." message, "Back to home" button.

## Content pack (exact copy)

**Trust section**
- *What we check* — "Every venue is cross-referenced against its city's own recreation department page or facility directory — not pulled from an app and left unverified."
- *What we don't do* — "No ads. No pay-to-list. Nothing sponsors or influences the court data. Some paddle & gear links are affiliate — always disclosed at the link. If a city's scene is thin or contested, we say so."
- *How to use it* — "Court counts, hours, and fees move with city budgets and construction. Treat this as a starting point, then check the source link on each city's page. Data verified July 2026."

**Learn to Play basics**
- *Scoring* — "Games go to 11, win by 2. Only the serving side can score a point. In doubles, the score is called as three numbers: your score, their score, then your server number — 1 or 2."
- *The Kitchen* — "The 7-foot no-volley zone. You can't hit the ball out of the air while standing inside the kitchen. Step in only to play a ball that has already bounced, then step back out."
- *The Serve* — "Underhand, below the waist. Serve diagonally, clearing the kitchen. Both the serve and the return must bounce once before anyone can volley — the 'two-bounce rule.'"
- *Court Etiquette* — "Call your own lines, share the court. Line calls are on the honor system — call your own out balls. On a busy court, rotate off after 15–20 minutes if others are waiting."

**About page**
- *Who runs this* — "Pickleball Bay Area is built and kept up by a small group of Bay Area players who got tired of stale listings and app data that hadn't been checked in years. No investors, no ad sales team — just people who wanted a directory they'd trust with their own Saturday morning plans."
- *How verification works* — "Every venue on this site is checked against its city's own parks & recreation department page or facility directory — not scraped from a crowdsourced app and left to rot. When a city's own listing is vague, thin, or contradicts itself, we note that instead of papering over it."
- *Independence* — "No court, city, or club can pay for placement, a higher rank, or a better badge. The only paid links on this site are paddle and gear links, and every one is labeled as affiliate at the point of the link."
- *Corrections* — "Courts change — a city adds lights, a fee goes up, a shared tennis court gets dedicated lines. If something here is wrong, tell us and we'll check it against the source and fix it."

**Rankings methodology** — "We show Google's rating alongside for reference but never blend the two into one score. No court can pay to rank higher — there's nothing to buy. Venues with zero ratings sit outside the list until someone rates them."

**Affiliate Disclosure** — "Court data on this site is never for sale — no venue, city, or club can pay for placement, rank, or a badge." / "Some links on the Paddles & Gear page and in paddle quiz results are affiliate links. If you buy through one, we may earn a small commission at no extra cost to you. Every affiliate link is labeled 'Affiliate link' at the point of the link." / "Affiliate relationships never influence which paddles appear, how they're described, or how the quiz scores them." / "Questions about a specific link? Let us know."

**Privacy** — "This site doesn't run ads, doesn't sell data, and doesn't track you across other sites. There's no account to create and nothing to sign up for." / "If you submit a correction with an email address, we use it only to follow up on that report, and only if we have a question." / "Favorites and ratings you set while browsing stay in this browser session — we don't attach them to an identity or store them on a server." / "Paddle links may be operated by third-party retailers with their own privacy practices once you leave this site."

**Positioning line** (used verbatim in the Home hero) — "A working directory of public pickleball courts across the San Francisco Bay Area, verified against each city's own recreation department listing."

Full region/city/venue/paddle data used throughout is in **`data.json`** in this bundle.

## Interactions & behavior

- Navigation is client-side view-switching in the prototype (no real URLs) — wire this to real routes in your app, e.g. `/find-courts`, `/cities/:slug`, `/rankings`.
- Global + hero search: case-insensitive substring match against venue/city/region name; hero search also navigates to Find Courts.
- Find Courts filters are AND-combined; a venue whose type/access is "both"/"mixed" satisfies either specific filter value. Filters affect the list (hide) and the map (dim) at the same time.
- Favorites are a simple per-venue boolean toggle (heart fill), in-memory.
- Two independent rating systems on every venue: the static community aggregate (read-only sample data) and a separate per-user 1–5 star rating (interactive, in-memory) — never combine them into one number.
- Paddle quiz is strictly linear; Next is disabled until the current question has an answer. Scoring (for reference only — replace with your real logic per the preservation note): +3 for an exact type match (+1.5 partial credit if the paddle is "All-court"), +2 for skill-level match ("All levels" always matches), +2 for budget-band match, +1 for weight-band match; top 3 scores are shown.
- Report form Submit is disabled until Venue + Issue are both chosen; submission is local-only (flips a boolean, no network call in the prototype — wire this to your real submission endpoint).
- Mobile nav swap was done via a JS-tracked window-width breakpoint (<900px) in the prototype because it has no CSS media queries (a constraint of the build tool, not a recommendation) — use standard responsive CSS in your implementation instead.

## State management (prototype shape — for reference only)

- `currentView`, `selectedCitySlug`, `mobileMenuOpen`, `moreMenuOpen`
- `heroQuery`, `globalQuery`
- `findFilters { region, type, price, access, beginnerOnly, amenities: { lights, restroom, water, parking } }`
- `selectedVenueId`, `hoveredVenueId`, `favorites: { [id]: bool }`, `userRatings: { [id]: 1-5 }`
- `quiz { step, answers: { skill, pref, budget, weight } }`
- `paddleFilters { type, shape, price, skill }`
- `reportForm { venue, issue, details, email }`, `reportSubmitted`

## Tweakable props on the prototype

The prototype exposes these as configurable props (a "Tweaks" panel in the design tool) — consider whether your app wants equivalent settings:
- `defaultLandingView` (enum) — which page mounts first.
- `courtCardDensity` (`comfortable` | `compact`) — venue-card padding and whether the description/amenities rows render.
- `reduceMotion` (boolean) — force-disables all animation/transitions regardless of OS setting.
- `showGoogleRating` (boolean) — show/hide the Google rating pill everywhere it appears.
- `showAffiliateNote` (boolean) — show/hide the small "Affiliate link" microcopy near buy buttons.

## Assets

No photos or raster images anywhere. Every icon, map, pin, and stamp is hand-drawn inline SVG — stroke-based line icons (~16–22px, 1.3–1.8px stroke). Fonts are loaded from Google Fonts: Source Serif 4, Manrope, Space Mono (see the `<head>` of the source file for the exact CDN URL). No map SDK or tile service is used or required — see the preservation note if your app already has one.

## Files in this bundle

- **`README.md`** — this document. Self-sufficient; you shouldn't need the other files to implement the design, but they're useful for double-checking exact values.
- **`Pickleball Bay Area - design reference.html`** — a self-contained, click-through version of the full design. Open it directly in any browser to explore all 12 pages, the working filters, the map, and the paddle quiz.
  **Not tracked in git** (see `.gitignore`): this repo is public and also serves
  itself via GitHub Pages, and the file is 1.6MB of base64 font blobs whose
  content is identical to the prototype source below — that's the one the
  implementation actually cites. Ask for the bundle again if you need to click
  through it.
- **`data.json`** — the full sample content pack (regions/cities, 16 venues, 24 paddles) in plain JSON, extracted from the prototype's source data.
- **`Pickleball Bay Area (prototype source).dc.html`** — the original prototype source. It uses a proprietary template syntax and runtime (`{{ }}` bindings, `<sc-if>`/`<sc-for>` control flow, `<x-dc>`) specific to the design tool it was built in. **It will not render outside that tool and should not be ported literally** — there's no equivalent of `sc-for`/`{{ }}` in a real framework. Only open it to cross-reference an exact string, color, or structural detail if the rendered reference file is ambiguous.
