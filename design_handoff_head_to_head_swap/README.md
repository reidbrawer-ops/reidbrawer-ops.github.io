# Handoff: Head-to-Head Paddle Comparison (design "3a", desktop + mobile)

## Overview
A head-to-head paddle comparison module for a pickleball review site. Verdict-first editorial layout: explicit verdict headline, "Get X if…" recommendation cards, a percentile-scaled radar "fingerprint", a differences table (raw score + percentile per rating, per-row winners, **Total score** and **Value score** rows), and an "Other options" section whose paddles can be **swapped into the comparison — the reader picks which side gets replaced**. Exactly two paddles are compared at all times. Copy nowhere assumes the pair shares a brand or shell — kicker, verdict, cards, and the shared-specs strip are all computed from the active pair.

## About the Design Files
The files in this bundle are **design references created in HTML** — a prototype showing intended look and behavior, not production code to copy directly. Recreate this design in the production site's existing environment (its framework, templating, and component patterns). Do not ship the prototype runtime (`support.js`) or the `{{ … }}` template syntax.

The reference file `Head to Head Explorations.dc.html` contains several exploration iterations. **Implement only option `3a`** (section badged "3", wrapper `id="3a"`): it contains the approved **desktop card (940px)** and, beside it, the approved **mobile card (375px)**. Ignore turns 1 and 2 (`1a–1d`, `2a`, `2b`) — rejected explorations.

## Fidelity
**High-fidelity.** Colors, typography, spacing, copy and interactions are final intent; recreate pixel-perfectly with the codebase's stack. **Placeholders to replace with real data:** all ratings/percentiles/weights/prices for Vatic Pro Prism Flash 16 and Friday Original 16, the Control rating and all percentile values (prototype assumes an 87-paddle test base), and Amazon links (`href="#3a"`) → real affiliate URLs.

## Data Model
Paddle record (4 in prototype; support any roster):
```
{ id, name ("Coral Pro Hybrid"), short ("Hybrid"), brand, price (220),
  badge ("" | "TOP PICK" | "VALUE"),
  ratings:     { spin, power, forgiveness, handSpeed, control },   // 0–10, one decimal (raw)
  percentiles: { spin, power, forgiveness, handSpeed, control },   // integer 0–100 vs. full test DB
  weightOz (8.2),
  attrs: ["16mm core", "raw carbon face", "UPA-A approved"],       // for shared-specs strip
  desc (one-line card blurb),
  bullets: [3 strings for "Get the X if…" card] }
```
Placeholder values (ratings / percentiles):
- Hybrid: 9.2/88, 8.6/79, 9.0/76, 8.2/58, 8.8/71 · 8.2 oz · $220
- Widebody: 9.4/93, 8.1/62, 9.5/95, 9.1/89, 9.2/90 · 8.16 oz · $220
- Prism Flash 16 (TOP PICK): 9.6/97, 8.8/85, 9.1/81, 8.9/82, 9.0/83 · 8.0 oz · $140
- Friday Original 16 (VALUE): 9.0/74, 7.9/48, 9.3/88, 9.0/86, 8.9/78 · 7.9 oz · $99

Derived values:
- **Total score** = sum of the five raw ratings (1 decimal; "out of 50").
- **Value score** = total ÷ price × 100 (points per $100, 1 decimal).
- Per-row winner: higher raw wins ratings; **lower** wins weight and price; equal = "Even".
- Overall verdict = higher Total score (slot A wins ties).
- Percentile display: ordinal + "pctl" (`93rd pctl`). Percentiles are **display context only** — winners, totals and the verdict use raw values.
- Shared strip = intersection of both paddles' `attrs`, uppercased, `BOTH HAVE: 16MM CORE · RAW CARBON FACE · UPA-A APPROVED`; if empty: `FEW SHARED SPECS — SEE EACH REVIEW`.
- Kicker = `{A name} (${A price}) vs {B name} (${B price})`.

## State Management
- `duo: [paddleIdA, paddleIdB]`. Slot A = deep green `#17594A`, slot B = olive `#8C9A2B`, by position.
- `swapIn(otherId, slot)` replaces `duo[slot]`; the displaced paddle returns to "Other options" (with badge hidden if it has none).
- Everything recomputes from `duo`: kicker, verdict name/blurb, recommendation cards (titles, bullets, OUR PICK badge + lime border on total-score winner, winner listed first), radar polygons, table values/percentiles/bolding/edge, Total/Value rows, shared strip, swap-button labels.
- Persist `duo` in URL query (e.g. `?vs=coral-pro-hybrid,prism-flash-16`) so comparisons are shareable; default = the article's two subject paddles.
- One shared state drives both desktop and mobile renderings.

## Desktop Layout (content column 940px; card padding 40px 44px 32px)
Card `#F6F2E7`, border `1px solid rgba(34,50,43,.14)`, radius 10px, on page bg `#E9E5D8`.

1. **Header (centered, max 640px)** — Kicker: Martian Mono 10.5px, ls .18em, uppercase, `#77762F`. Headline: Source Serif 4 bold 42px, -.015em, lh 1.1, `#22322B`: `The verdict: get the {winner short}.` with winner word highlighted `box-shadow: inset 0 -12px 0 #D9E353`. Blurb 14px/1.6 `#5C594C`: `Total score {hi}–{lo}, and the better value at {v} points per $100.`; if total winner ≠ value winner: `Total score {hi}–{lo}; but the {value-winner short} is the better value — {v} vs {v2} points per $100.`
2. **Recommendation cards** — 2-col grid, gap 16px, mt 26px. Card `#FDFCF6`, radius 12px, padding 20px 22px. Winner first: `border: 2px solid #A3B02F` + floating badge (absolute, top -9px, left 20px, `#D9E353` on `#3A3F14`, Martian Mono 8.5px ls .12em) `OUR PICK — HIGHER TOTAL`. Loser: `border: 1px solid rgba(34,50,43,.15)`. Title Source Serif 4 bold 20px `Get the {short} if…`; 3 bullets 13px/1.7 `#3F4430`; CTAs: winner filled `#D9E353` (border `rgba(34,50,43,.4)`, radius 8, padding 9px 16px, 13px bold), loser outlined `rgba(34,50,43,.35)`; beside each `UPA-A approved · affiliate` 11px `#8B887C`.
3. **Fingerprint + table** — grid `300px 1fr`, gap 36px, mt 30px, center-aligned.
   - **Radar** (percentile-scaled): SVG viewBox `0 0 260 230`; 3 concentric pentagons + 5 spokes `#DDD8C6` 1px; center (130,118), max radius 84. Vertex radius `r = percentile / 100 × 84`; angles −90°, −18°, 54°, 126°, 198° for SPIN, POWER, FORGIVE, HANDS, CONTROL (Martian Mono bold 9px `#77762F`; CONTROL anchored end at x=48, ls .02em to avoid clipping). Polygon A `rgba(23,89,74,.13)` / stroke `#17594A` 2px; B `rgba(163,176,47,.2)` / `#8C9A2B` 2px. Legend beneath: centered flex, 8px dots + short names, Martian Mono 9.5px `#8B887C`.
   - **Table** label `WHERE THEY ACTUALLY DIFFER` (Martian Mono 10px ls .18em `#77762F`). Rows grid `1fr 92px 92px 118px`, gap 12px, padding 8px 0, dashed separators `rgba(34,50,43,.1)` (header `.12`). Header Martian Mono 9px ls .1em: METRIC/EDGE `#8B887C`, col A short-name `#17594A`, col B `#8C9A2B`, right-aligned.
   - Metric rows (order): Hand speed, Forgiveness, Spin, Power, Control, Static weight, Price. Label 12.5px w500 + tooltip. **Rating cells are two-line, right-aligned**: raw value Martian Mono 11.5px (row winner bold 700 `#22322B`, loser 400 `#8B887C`) over percentile Martian Mono 8px `#B8B4A4` (`88th pctl`). Weight/Price cells single-line (no percentile). Edge column 11.5px: winner short name, `#17594A` if A, `#4A4E1B` if B, `Even` `#8B887C`.
   - **Total / Value rows**: `border-top: 1px solid rgba(34,50,43,.2)`; labels bold 700 w/ tooltips ("Sum of the five playtest ratings — spin, power, forgiveness, hand speed, control. Out of 50." / "Rating points per $100 — total score ÷ price × 100. Higher = more paddle for the money."); values Martian Mono 12px, same bolding + edge.
   - Below: shared strip (`#EFEBDD`, radius 8, padding 10px 14px, Martian Mono 10px `#77764F`) then caption 10.5px `#8B887C`: "Small gray figures are percentiles vs. the 87 paddles we've tested — 93rd = better than 93% of them. The fingerprint is percentile-scaled." (Make the count dynamic.)
4. **Other options** — top border `rgba(34,50,43,.14)`, pt 20px, label `OTHER OPTIONS`. 2-col grid, gap 16px. Card `#FDFCF6`, radius 10px, padding 14px 16px: badge chip (TOP PICK lime fill / VALUE outlined `rgba(34,50,43,.3)` text `#4A4E1B` / hidden if none), bold name 12.5px + Martian Mono price 10.5px `#8B887C`, one-line desc `#5C594C`, `Details →` link. Swap row: `SWAP IN:` micro-label (Martian Mono 8.5px ls .12em `#8B887C`) + two buttons `⇄ Swap in for {A short}` (text `#17594A`) / `⇄ Swap in for {B short}` (text `#8C9A2B`), 11.5px bold, border `rgba(34,50,43,.4)`, radius 7px, padding 6px 11px.
5. **Disclosure** 11.5px/1.6 `#8B887C`, verbatim: "One or more links are affiliate links — we may earn a commission at no extra cost to you. It never changes which paddle wins or how either is described. As an Amazon Associate I earn from qualifying purchases. How this works." ("How this works" → disclosure page.)

## Mobile Layout (375px reference; apply ≤ ~640px; card padding 22px 18px)
Same state, single column, order:
1. Kicker centered (Martian Mono 8.5px ls .14em uppercase `#77762F`); headline centered Source Serif 4 bold 26px lh 1.15 with lime highlight (`inset 0 -9px 0 #D9E353`); blurb 12px/1.55 `#5C594C` centered.
2. Recommendation cards stacked (winner first, same badge/border): title 17px, bullets 12px/1.65, **full-width block CTAs** (padding 11px, 13.5px, winner lime / loser outlined); then centered micro-line `UPA-A approved · affiliate links` 10.5px.
3. Fingerprint: label centered, same SVG full-width, legend centered (7px dots, 9px).
4. Table `WHERE THEY DIFFER`: grid `1fr 62px 62px`, gap 8px — **EDGE column dropped** (winner still bolded). Rating cells two-line (raw 11px + percentile 8px `#B8B4A4`); Weight/Price single-line; Total/Value rows (labels bold 12px, values 11.5px) after `border-top: 1px solid rgba(34,50,43,.2)`.
5. Shared strip (Martian Mono 9px) + caption 10px: "Gray figures are percentiles vs. our 87-paddle test base. Total = five ratings, out of 50; value = points per $100."
6. Other options stacked: same card content; swap buttons padding 8px 10px, 11px bold — **hit targets ≥ 44px**.
7. Short disclosure 10.5px: "Affiliate links — we may earn a commission at no extra cost to you. How this works."

## Interactions & Behavior
- **Swap**: instant recompute of all derived regions (a ~150ms fade is acceptable). Displaced paddle drops into "Other options".
- **Tooltips** (desktop hover, `cursor: help`, dotted underline `1px dotted rgba(34,50,43,.45)`; touch = tap to open, outside-tap to dismiss): dark box `#22322B` / `#F6F2E7`, 11.5px/1.5 DM Sans, padding 9px 11px, radius 8px, width 230px, fade .15s. Copy verbatim — Hand speed: "How quickly the paddle moves in fast kitchen exchanges — driven by swing weight."; Forgiveness: "Sweet-spot size and stability on off-center hits."; Spin: "How much RPM the surface generates on serves and rolls."; Power: "Pop on drives and serves — how fast the ball leaves the face."; Control: "Touch on resets, drops and dinks — how predictably the ball comes off the face."; Static weight: "Weight on a scale, unmodified. Lighter is easier on the arm."; Price: "Street price at time of writing."
- Links: `#17594A`, hover `#0E3F34`.

## Design Tokens
- Bg: page `#E9E5D8`, card `#F6F2E7`, inner card `#FDFCF6`, strip `#EFEBDD`
- Ink `#22322B`; secondary `#5C594C`; muted `#8B887C`; percentile gray `#B8B4A4`; label olive `#77762F` / `#77764F`; bullets `#3F4430`; badge text `#3A3F14` / `#4A4E1B`
- Slot A `#17594A`; slot B `#8C9A2B` (border variant `#A3B02F`); lime `#D9E353`; radar grid `#DDD8C6`
- Borders `rgba(34,50,43,.4/.35/.3/.2/.15/.14/.13)`; dashed dividers `rgba(34,50,43,.1–.12)`
- Type: Source Serif 4 (headlines/card titles), DM Sans (body/UI), Martian Mono (labels/numerals) — Google Fonts, 400/500/700
- Radii: 12 (rec cards), 10 (cards), 8 (CTAs/strips), 7 (swap buttons), 4 (badges)

## Assets
No images. Radar is inline SVG (spec above). Fonts via Google Fonts.

## Files
- `Head to Head Explorations.dc.html` — design reference; implement section `3a` only (desktop card + 375px mobile card side by side). Logic reference: `turn3Vals()`, `pentagon()`, `ord()` in the inline script (data, scoring, percentile formatting, swap handlers, radar math).
- `support.js` — prototype runtime only, so the HTML opens in a browser. **Do not port.**
