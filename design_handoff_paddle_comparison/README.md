# Handoff: Paddle Comparison Visualizations — Pickleball Bay Area

## Overview
Three interactive data visualizations for pickleball-bay-area.com that compare paddles, plus a "Your Top 3" summary strip. They serve **two contexts**:

1. **Quiz results page** — compare the user's top 3 recommended paddles (with the rest of the catalog as background context, filtered/highlighted by the quiz result).
2. **General paddle browsing / research** — the same three components as a standalone comparison/research view for the whole catalog, where highlighted paddles come from user selection (compare tray, checkboxes, etc.) instead of quiz output.

Components:
- **Top 3 strip** — ranked summary bar of the recommended paddles with match %.
- **2a. Catalog explorer (axis-adjustable scatter)** — every scored paddle as a dot; user picks any two factors for X/Y; the featured paddles are highlighted.
- **2b. Price vs. overall score (value chart)** — scatter of price against a self-explaining "overall score" (average of the six ratings), with a value-frontier line and per-paddle score-breakdown cards.
- **2c. Match stress-test (weighted ranking bars)** — stacked contribution bars showing *why* each paddle scored what it did, with priority presets that re-weight and re-sort ranks live.

## About the Design Files
The files in this bundle are **design references created in HTML** — a prototype showing intended look and behavior, not production code to copy directly. Recreate these designs in the live site's existing environment and stack (whatever pickleball-bay-area.com is built with — e.g. Next.js/React, Astro, or server-rendered templates), using its established components, utilities, and data layer. If the site has no charting infrastructure, implement as plain SVG + a small amount of state — the prototype needs no chart library and none should be required.

`Paddle Comparison Charts.dc.html` is a design-exploration canvas containing two iteration rounds. **Implement only: the "Your Top 3" strip (top of Turn 1 section) and options 2a, 2b, 2c (Turn 2 section, top of the page).** Options 1a–1f are earlier explorations — reference only. The prototype's proprietary template syntax (`sc-for`, `{{ }}`, logic class) is an artifact of the design tool; ignore the mechanism, recreate the rendered result and behaviors described below.

## Fidelity
**High-fidelity for layout, typography, spacing, and interaction behavior; medium-fidelity for brand.** The live site's CSS was not accessible when this was designed — colors and fonts below approximate the site's editorial tone. **Map colors/fonts to the site's real tokens where they exist** (e.g. its actual link blue, background, text colors); keep the exact values below only where the site has no equivalent. All chart geometry, label placement, and interaction specs should be followed precisely.

**IMPORTANT — data is illustrative.** All ratings, match %s, catalog-cloud points, reference paddles, and prices in the prototype are placeholders normalized from public lab reviews (Matt's Pickleball, Pickleball Effect, Pickleheads). Production must read from the site's real paddle database and quiz-scoring engine. The 460-dot "catalog cloud" in the prototype is procedurally generated — in production it is simply every scored paddle in the DB.

## Data Model (what the components need)
Each paddle:
```ts
interface Paddle {
  id: string
  name: string           // "Vapor Power 2"
  brand: string          // "11SIX24"
  price: number          // 209.99
  ratings: {             // all normalized 0–100
    power: number
    pop: number
    spin: number         // (display RPM separately if available)
    control: number
    forgiveness: number
    handSpeed: number
  }
  legality?: string      // "UPA-A only", "USAP + UPA-A"
}
```
Derived values:
- `overallScore` = mean of the six ratings, shown to 1 decimal (e.g. 87.8). This is the y-axis of 2b and the "overall" figure in the breakdown cards. Do not invent a different weighting for 2b — its whole point is that the score is a transparent average.
- `dollarsPerPoint` = price / overallScore, formatted `$2.39/pt`.
- Match % (quiz context only) comes from the quiz engine as a 0–100 total decomposed into named factor contributions (see 2c).

Featured paddles (the highlighted 3): from quiz results on the results page; from user selection in browse mode. All three components take the same inputs: `paddles: Paddle[]` (whole catalog), `featured: Paddle[]` (≤3, ordered), and for 2c a `weights` source.

The prototype's example featured paddles:
- 11SIX24 Vapor Power 2 — $209.99 — ratings [power 88, pop 92, spin 96, control 76, forgiveness 80, handSpeed 95] — overall 87.8 — brand color court blue `#31699e`
- Six Zero Coral Pro Hybrid — $219.99 — [80, 78, 92, 91, 87, 86] — overall 85.7 — coral `#d55b41`
- Friday Aura Pro Hybrid — $159 — [85, 84, 87, 84, 90, 80] — overall 85.0 — green `#5e8c3f`

Series colors: assign each featured paddle a stable accent color. The prototype keys them to brand (blue/coral/green above). In production, use a fixed 3-color palette assigned by rank, or brand colors if the DB has them.

## Design Tokens (map to site equivalents first)
Colors:
- Page background `#f2f0ea` (warm off-white)
- Card surface `#ffffff`, border `rgba(0,0,0,.08)`, shadow `0 1px 3px rgba(0,0,0,.06)`, radius `8px`
- Ink `#23282e`; secondary text `#5c636b`; tertiary/labels `#8a8477`; faint `#b3ada0`
- Gridlines `#f0ede6`; structural lines `#e7e3da`; catalog-cloud dots `#d9d4c8`; reference dots `#cfcabd`
- Link blue `#31699e` (hover `#24537f`)
- Dark control fill (active pill, tooltips) `#26323a` / `#23282e` with white text
- Series: blue `#31699e`, coral `#d55b41`, green `#5e8c3f`; 18%-alpha fills for halo rings (`{color}2e`)
Typography:
- Display serif: **Newsreader** (titles, big numbers) — weights 600–700, italic for annotations
- UI sans: **Libre Franklin** — 400/500/600/700
- Card title: 22px/600 Newsreader, letter-spacing -0.01em
- Eyebrow: 10px/500 Libre Franklin, letter-spacing .12em, uppercase, color `#8a8477`
- Body/explainer: 12.5px/1.5 Libre Franklin, `#5c636b`
- Footnotes: 11px/1.5, `#8a8477`
- Axis tick labels: 10.5px/400, `#b3ada0`; axis titles 11.5px/600 `#4c5258`; data labels 12px/600 in series color
Controls:
- Segmented pill group: container `#f2f0ea`, radius 999px, padding 3px; buttons 11–11.5px/600, padding 5–6px 11–14px; active = `#26323a` bg + white text; transition background/color .2s
Spacing: cards padded 24px 26px; 12px gaps between sibling cards; 28px between chart blocks.

## Component Specs

### Top 3 strip (quiz results header)
A white card row placed above the charts on the results page.
- Left block (fixed, right-separated by 1px border `rgba(0,0,0,.08)`): site wordmark treatment — "Pickleball" 17px/700 Newsreader + "Bay Area" 17px italic Newsreader `#5c636b` — over eyebrow "YOUR TOP 3" (9.5px/500, letter-spacing .1em, `#8a8477`). In production replace with the site's real wordmark/heading pattern.
- Then one flex row per paddle (equal `flex:1`, 20px gaps): rank roundel (22px circle, `#23282e` bg, white 11px/600 number) · 3×34px rounded color bar in series color · name (12.5px/600) over "Brand · $Price" (11px `#8a8477`) · right-aligned match % (16px/700 Newsreader, series color).
- Browse mode: hide match % (no quiz score exists) or replace with overallScore.

### 2a — Catalog explorer (axis-adjustable scatter)
Purpose: let users see the whole catalog on any two factors, with featured paddles highlighted. Serves both results page ("why these three") and the research/browse view.
Card: 920px wide in the prototype; in production, responsive with the chart preserving a 860:520 aspect box.
Header row: eyebrow "EXPLORE ANY TRADEOFF", title "Pick your axes", explainer "The whole catalog, on whichever tradeoff you care about. Your three matches stay highlighted." (adjust copy in browse mode: "Your selected paddles stay highlighted.")
Axis pickers (top right, two rows right-aligned): label "X" / "Y" (10px/600 `#8a8477`) + segmented pill group with options: **Power, Spin, Control, Forgiveness, Hand speed, Price**.
- Behavior: selecting a factor sets that axis. **Selecting the factor already on the other axis swaps the axes** (never allow X == Y).
- Scales: rating factors fixed 40–100 domain, ticks every 10. Price domain $40–$340, ticks at $50–$300 every $50, tick labels prefixed `$`.
Chart (SVG viewBox 860×520; plot area x 60→800, y 40→470):
- Gridlines at every tick, 1px `#f0ede6`.
- Tick labels: X below plot (y≈487, centered); Y left of plot (x≈48, right-aligned).
- Axis titles: bottom-right "«Factor» →"; top-left "«Factor» ↑" (11.5px/600 `#4c5258`). These update with the pickers.
- Catalog cloud: one 2.3px-radius dot per scored paddle, fill `#d9d4c8`, no stroke, non-interactive (prototype); production may add hover/click-through to paddle pages in browse mode.
- Featured paddles: 15px-radius halo ring (2.5px stroke in series color, fill series color at ~18% alpha) + 4px solid center dot. Name label (12px/600, series color) offset per paddle to avoid collisions — prototype uses per-paddle offsets (right of dot for #1; left-above and left-below for #2/#3); production should do simple collision-aware placement.
- Axis-change transition: dots animate to new positions ~400ms ease (the prototype transitions cx/cy; in production animate however the stack allows — this motion is the component's key delight moment).
- Hover on a featured dot: dark tooltip (bg `#23282e`, white, radius 6px, padding 8px 12px, shadow `0 4px 14px rgba(0,0,0,.25)`) positioned above the dot: line 1 = "Brand Name" 12px/600; line 2 = current X and Y values ("Spin 96 · $209.99" style), 11px `#c8cdd2`.
Footer note (11px `#8a8477`): dynamic insight line, e.g. "Best power: Vapor Power 2 · Best control: Coral Pro Hybrid" — computed as: for rating axes, featured paddle with the max value; for price, "Lowest price: «name»". Follow with static text "— grey dots are the rest of the scored catalog."

### 2b — Price vs. overall score (value chart)
Purpose: value-for-money view where the y-axis metric explains itself.
Card: 900px. Eyebrow "WHAT DOES EACH DOLLAR BUY?", title "Price against overall score", explainer: "Up and left is better. The **overall score** is just the average of the six ratings you've seen on every chart — the cards below show how each one is built."
Chart (SVG viewBox 860×430; plot x 60→800, y 40→380):
- X = price, domain $80–$360 in the prototype (ticks $100–$350 every $50); production: fit the catalog's real price range. Y = overallScore, domain 74–92 (ticks 76/80/84/88/92); production: fit real score range with ~2pt padding.
- Gridlines `#f0ede6`; tick labels as in 2a; axis titles "Price →" (bottom right) and "Overall score ↑" (top left).
- **Value frontier**: dashed polyline (1.5px, `#8a8477`, dash 5 5) through the pareto-optimal points (no paddle is both cheaper and higher-scoring). Compute from real data. Annotation in italic Newsreader 12px `#8a8477` near the line's mid/upper area: **"best score for the money"** (this phrasing replaced "value frontier" for average users).
- Reference paddles (context, optional but recommended): 6px grey `#cfcabd` dots for well-known market paddles with small grey labels (prototype: Neon $99, Loco $199, Perseus IV $280, Boomstik $333 — labels above the dot except the two rightmost, which sit below to avoid the frontier line). Use real catalog entries in production.
- Featured paddles: 11px halo ring + 4px center dot + name label in series color, collision-adjusted.
Score-breakdown cards (the clarity feature — one per featured paddle, equal-width row, 12px gap, border `rgba(0,0,0,.09)` radius 7px, padding 12px 14px):
- Header: series color swatch (10px, radius 3) + paddle name (12px/600) + price right-aligned (10.5px `#8a8477`).
- Body: six mini bar gauges — 11px wide × 30px tall track `#f2f0ea` radius 2, filled from bottom in series color, fill height = (rating − 40)/60 of track. Under each bar a 7.5px/500 label: **PWR POP SPN CTL FGV HND**. Then "→ avg" (13px `#b3ada0`), then right-aligned: overall score (19px/700 Newsreader) over "overall · $X.XX/pt" (9.5px `#8a8477`).
- Bars should have accessible tooltips/titles with the full rating name and value.

### 2c — Match stress-test (weighted ranking bars)
Purpose: show what the ranking rewards and how stable it is when priorities change. On the results page, "As answered" reflects the user's actual quiz weighting; in browse mode it's a neutral default weighting.
Card: 700px. Eyebrow "HOW SOLID IS YOUR #1?", title "Stress-test your match".
Preset segmented pills (one group, wraps if needed): **As answered · Spin first · Control & feel · Power first · Budget first**.
- Each preset = a weight vector over five factors: **Power & drive, Forgiveness & feel, Spin & shaping, Budget fit, Durability**. Production: compute `contribution_i = weight_i × factorScore_i` from the quiz engine's real factor scores; total = Σ contributions (0–100 scale shown as %). "As answered" uses the user's real quiz weights.
- Prototype's illustrative contribution sets (per preset, per paddle, in factor order above) if needed for a stub: ans: vapor [32,12,24,6,12], coral [30,13,23,6,13], aura [27,14,22,9,12]; spin: [14,12,43,6,12] / [13,13,42,6,12] / [12,14,39,9,11]; ctrl: [14,31,14,6,16] / [13,35,14,6,17] / [12,37,13,9,16]; pow: [41,12,14,6,12] / [38,13,14,6,12] / [35,14,13,9,11]; bud: [14,12,14,28,8] / [13,13,14,26,9] / [12,14,13,40,8].
Explainer line under pills (12.5px `#5c636b`): one sentence per preset, e.g. As answered: "Weighted exactly how you answered — spin and power heaviest. Your podium holds." / Control & feel: "Prioritize touch and sweet spot and the podium flips — Aura Pro and Coral Pro jump ahead."
Rows (one per featured paddle, 56px tall on a 70px rhythm, absolutely positioned by rank):
- rank roundel (20px circle, 1.5px `#23282e` border, transparent bg) · name (12.5px/600 series color) over brand (10.5px `#8a8477`), 150px column · stacked bar (34px tall track `#f2f0ea` radius 6): one segment per factor, width = contribution in % of track, fills = ink at stepped alphas `rgba(35,45,52,.92/.72/.54/.38/.24)` (factor order), 1.5px white separators, `title` tooltip "«Factor»: N pts" · total right-aligned (17px/700 Newsreader) with "%".
- **On preset change: rows re-sort by total, animating `top` 500ms cubic-bezier(.4,0,.2,1); segments animate width 500ms.** This re-sorting motion is the core of the component.
Legend (below, 1px top border `rgba(0,0,0,.07)`): swatch + factor name for the five alphas.
Footnote: "If the podium barely moves across presets, the recommendation is robust — a reassurance moment right before the buy links."

## Interactions & Behavior summary
- 2a axis pills: set axis; same-factor selection swaps axes; dots transition ~400ms; insight footer and axis titles update.
- 2a featured-dot hover: tooltip with current-axis values.
- 2b: static apart from breakdown-card tooltips (production may add hover on dots → same card content as popover).
- 2c preset pills: re-weight, re-total, re-sort with 500ms animations.
- All controls are real `<button>`s; keep keyboard focus states per the site's conventions. Tooltips via `title` in the prototype — use the site's tooltip component in production, and ensure the stacked-bar factor values are reachable without hover on touch (e.g. tap-to-toggle).
- Responsive: prototype is desktop-fixed (700–920px cards). SVGs scale to container width preserving aspect. Below ~720px: axis pickers wrap under the title (2a), breakdown cards stack vertically (2b), and the 150px name column in 2c may shrink with truncation.

## State Management
- 2a: `{ xAxis: FactorKey, yAxis: FactorKey }` (default power × control), `hoveredPaddleId`.
- 2b: none (derived data only).
- 2c: `{ preset: PresetKey }` (default "As answered").
- Shared inputs from page context: catalog list, featured list, quiz weights/factor scores (results page) or selection (browse).
- No persistence required; nice-to-have: sync 2a axes + 2c preset to URL query params so a shared results link reproduces the view.

## Placement
- **Quiz results page**: Top 3 strip directly under the results heading → 2c (why these ranks + robustness) → 2a (see them in the field) → 2b (value) → buy links. Order flexible; keep 2c adjacent to the strip since both speak in match %.
- **Browse/research view**: 2a as the primary explorer (full catalog, selectable highlights) with 2b beneath it; 2c appears once ≥2 paddles are selected, using a neutral "As answered"→"Balanced" relabel.

## Assets
No images or icon assets. Fonts: Newsreader + Libre Franklin (Google Fonts) — substitute the site's real typefaces if they differ. All chart graphics are inline SVG.

## Files
- `Paddle Comparison Charts.dc.html` — the full design-exploration canvas. Turn 2 section at top contains 2a/2b/2c (wrappers `id="2a"`, `id="2b"`, `id="2c"`); the Top 3 strip is at the top of the Turn 1 section. Options 1a–1f below it are earlier explorations kept for reference — do not implement.
- Rendered geometry, exact inline styles, and interaction logic are all in that file; the `<script data-dc-script>` block at the bottom holds the data tables and math used to lay out every chart (coordinate transforms, domains, frontier points, preset weights).
