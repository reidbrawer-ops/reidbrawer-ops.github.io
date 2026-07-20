# Handoff: PBA Paddle Finder — catalog, paddle pages, compare

## Overview
A paddle-recommendation experience for pickleball-bay-area.com: the browse page becomes a filterable database of all 486 paddles; clicking any paddle opens a detail page with lab analytics (percentile bars), a single buy CTA, a **Top Pick** and **Value Pick** recommendation (same play style — one steps up performance, one costs less), and a similar-paddles row; any two paddles can be compared head-to-head via a persistent tray.

## About the Design Files
The files in this bundle are **design references created in HTML** — a working prototype showing intended look and behavior, not production code to copy directly. The task is to **recreate this design inside the live site's existing environment and stack**, using its established patterns, components, and build system. `Paddle Finder.dc.html` contains the full template (inline styles) and a plain-JS logic class with all algorithms; treat the logic as a reference implementation to port, not to import.

## Fidelity
**High-fidelity.** Colors, type, spacing, and interactions are final intent. Recreate closely — except where the production site already has an equivalent (see next section), in which case production wins.

## Merge strategy — keep the best of what exists
The live site already does several things well. Do NOT rebuild these; integrate with them:

**Keep from production (authoritative):**
- Global header/nav, footer, and the "independent, ad-free" boilerplate. The prototype mocks them only so the design reads in context — its header nav links are non-functional placeholders by design.
- The paddle quiz at `/paddles` (10 questions → top 3). Cross-link it: the catalog hero should keep the existing three-tab strip (Find your paddle / Browse all paddles / Rent & try) exactly as production renders it.
- The existing affiliate-disclosure pattern ("disclosed at each one"). Reuse the production disclosure component next to the buy CTA; the prototype's microcopy ("Affiliate link, disclosed as always…") can replace or merge with it, editorial call.
- Production's existing catalog data source/API. The prototype's `data/paddles.json` was extracted from the same catalog (via the owner's Numbers export) — reconcile field names rather than introducing a second dataset.
- Existing brand fonts if they differ from the prototype's Google-font stand-ins (see Design Tokens).
- The `?preset=` URL concept on `/paddles/browse` (e.g. `?preset=spin`). Map presets onto this design's collection chips so old links keep working (preset=spin → "Spin machines" = sort by spinRpm desc, etc.).

**Adopt from this design (replaces the current browse UI):**
1. Faceted filter rail with live counts (Price, Play style, Shape, Core thickness, Impact feel, Brand) + search + 8 sorts + pagination (30/page).
2. Paddle detail pages with percentile-bar analytics, spec table, single CTA, Top/Value picks, similar row.
3. Compare tray + head-to-head page.
4. Schematic paddle silhouettes. **The owner will not have product photos — silhouettes are the permanent art direction**, not placeholders.

## Screens / Views

### 1. Catalog (home of the paddle section — replaces `/paddles/browse` list UI)
**Purpose:** browse/filter/sort all 486 paddles; entry point to detail and compare.
**Layout:** max-width 1280px, horizontal padding clamp(16px,3vw,32px). Hero band (bottom hairline `1px solid rgba(35,42,31,.14)`, background `linear-gradient(180deg,#f7f2e7,#f3ecdc)`) → content grid `264px minmax(0,1fr)` gap 28px (single column below 940px viewport; rail becomes a "Filters (n)" button opening a fixed bottom sheet, max-height 78vh).
**Hero:** eyebrow `Paddles & Gear · The catalog` (12px, letter-spacing .14em, uppercase, 600, #8a6d1f) → H1 `Browse all paddles.` (Source Serif 4 600, clamp(30px,4.6vw,46px), line-height 1.05, letter-spacing -.01em) → one-paragraph description (15px/1.55, #55604b, max 62ch) → search input (height 46px, bg #fffdf8, border rgba(35,42,31,.2), radius 8px, magnifier icon, clear button when non-empty) + collection chips.
**Collection chips** (pill buttons, radius 999px, 12.5px 600, bg #fffdf8, border rgba(35,42,31,.25); hover: green border + soft shadow): Best overall · Under $100 · Spin machines · Control & touch · Big power · Beginner friendly. Each sets filters+sort (see Interactions).
**Filter rail:** sticky top 76px. Section heads 12.5px 700; option rows = 15px checkbox (radius 4px; checked: bg #2c4f27, white check) + 13px label + mono count (10.5px #8b937f). Zero-count options grey to #a9b09d. "Reset all" appears (terracotta #a3502a) when any filter/search active. Brand facet shows top 10 by count + "Show all N brands" expander (expanded list max-height 300px, scroll). Footer note: "Lab metrics (spin, power, pop) cover 353 of 486 paddles…" (11.5px #8b937f).
**Results toolbar:** count (`486 paddles`, count in mono bold) + active-filter chips (green tint pills with ×, desktop only) + sort `<select>` right-aligned.
**Card grid:** `repeat(auto-fill,minmax(236px,1fr))` gap 14px. Card: bg #fffdf8, border rgba(35,42,31,.14), radius 10px, padding 14px; hover: translateY(-2px), shadow `0 4px 14px rgba(35,42,31,.12)`, green-tinted border. Contents top→bottom:
- `+ Compare` toggle, absolute top-right (10.5px 700; toggled: solid #2c4f27/white, label `✓ Comparing`).
- Silhouette well: height 118px, bg `linear-gradient(160deg,#f3ecdc,#ece3cd)`, radius 8px; shape label bottom-left (9.5px uppercase, rgba(35,42,31,.45)). Silhouette spec below.
- Brand (11.5px 600 #8a6d1f) → name (14.5px 600 #232a1f) → play-style chip + `16mm · 8 oz` (11px #8b937f).
- 3 mini metric bars (Spin/Power/Pop): 38px label (10px uppercase #8b937f), 5px track rgba(35,42,31,.1), fill width = percentile, mono raw value right. Colors: spin #2c4f27, power #a3502a, pop #8a6d1f. No-lab paddles instead show italic 11px "Not lab-tested yet — specs only".
- Price row above 1px hairline: mono 15px 600 price left, `Details →` (11.5px 600 #2c4f27) right.
**Pagination:** centered under grid — `← Prev` / numbered pages (mono, min-width 36px; current: solid #2c4f27 white; windowed as `1 … p-1 p p+1 … last` when >7 pages) / `Next →`; summary line `Page 2 of 17 · showing 31–60 of 486` (11.5px #8b937f). Page change scrolls to top.
**Empty state:** dashed border card, serif "Nothing matches that combination.", sub "Loosen a filter or two — the catalog is deep.", solid green "Reset all filters" button.

### 2. Paddle detail
**Purpose:** analytics + buy decision + where to go next.
**Layout:** max-width 1280px; `← All paddles` back link; grid `minmax(260px,340px) minmax(0,1fr)` gap clamp(20px,3vw,40px) (1-col below 940px). Left column sticky (top 84px).
**Left:** silhouette hero card (height clamp(240px,30vw,320px), same well gradient, corner label `SCHEMATIC — ELONGATED` 10px uppercase) + "At a glance" card (2-col grid: Play style, Shape, Core, Weight, Swing wt, Spin — 10.5px keys #8b937f, mono 13px 600 values).
**Right, in order:**
1. Title block: brand (13px 700 #8a6d1f) + play-style chip + outlined `USAP` and year chips (10.5px, border rgba(35,42,31,.2)) → serif H1 clamp(26px,3.4vw,36px) → auto-generated one-line blurb (14.5px #55604b), e.g. "2026 elongated power paddle from 11SIX24 — 16mm Gen 4 build with a stiff, hollow impact feel, benched at 2092 RPM of spin."
2. Price/CTA card: mono 26px price + "street price, tracked Jul 2026" caption; right-aligned **single CTA** — if the paddle has a link: solid green `Buy this paddle ↗` (bg #2c4f27, radius 9px, padding 12px 20px, hover #1c3618); if not (3 of 486): same solid style, `Search {brand} site ↗` (Google search URL for brand+model). **Never both.** Full-width disclosure caption below (11px #8b937f).
3. "Measured performance." (serif 21px) + Firepower badge when present (`Firepower 75/100 · High`, pill bg rgba(138,109,31,.12) #8a6d1f) + caption "Bars show where this paddle lands across all 486 paddles we track. The tick is the catalog median." Card with up to 5 rows — Spin (raw RPM), Power (mph), Pop (mph), Swing weight (raw; note "lower means faster hands"), Stability (twist weight): 13px 600 label + mono raw + right-aligned `91st percentile` (11.5px 600); 9px track radius 5px bg rgba(35,42,31,.09), fill width = percentile, median tick at 50% (1.5px rgba(35,42,31,.35)); 11px note under each. Fill/percentile color by tercile: ≥66th #2c4f27, ≥33rd #8a6d1f, else #a3502a; swing weight always neutral #55604b (heavy ≠ bad). No-lab paddles: dashed card "This paddle hasn't been through our lab bench yet…".
4. "Full specifications." — 15-row striped table (rows: 12.5px key #55604b / mono 12.5px value; alt-row bg rgba(243,236,220,.5)): Brand, Released, Approval, Shape, Build generation, Surface, Impact feel, Core thickness, Static weight, Swing weight, Twist weight, Balance point, Grip length, Grip circumference, Spin durability.
5. "Where to go from here." + caption "Same play style, different trade-off — one steps up the performance, one protects your wallet." Two cards side-by-side (1-col below 620px): floating badge top-left (-9px, 10px 800 uppercase white; **TOP PICK** bg #2c4f27, frame border rgba(44,79,39,.5); **VALUE PICK** bg #8a6d1f, frame rgba(138,109,31,.5)); 44×58 mini silhouette + brand/name/price with delta (`−$70 vs this` green #2c4f27 if cheaper, `+$40 vs this` #a3502a if pricier); reason sentence built from real deltas (see Algorithms); `See this paddle →`.
6. "Similar paddles." — horizontal scroll row, 172px cards (mini silhouette well 72px, brand, name, mono price, type label), 6 items.

### 3. Head-to-head compare
**Purpose:** decide between two shortlisted paddles.
**Layout:** max-width 1080px; serif H1 `Head to head.`; two summary cards (brand, name, chips, mono 17px price, `Details →`); one metrics card: for each row (Price, Spin, Power, Pop, Stability, Swing weight, Static weight, Core) a centered uppercase label and two mirrored bars growing outward from center (8px tracks; winner's bar #2c4f27 and value bold, loser rgba(35,42,31,.3); values mono 12.5px). Lower wins for price, swing weight, static weight; higher wins otherwise. Missing value renders `—` with minimal bar. Footer caption explains bold = winner.

### 4. Compare tray (global)
Fixed bottom bar once ≥1 paddle is selected (hidden on the compare page itself): bg #232a1f, text #f7f2e7; `COMPARE` label in #cbd52b (pickleball-yellow); selected paddles as removable chips (bg rgba(247,242,231,.12)); "pick one more…" hint at 1 selection; `Clear` ghost button; `Compare →` (bg #cbd52b, dark text) enabled at exactly 2. Selecting a 3rd paddle drops the oldest (FIFO, max 2).

## Interactions & Behavior
- **Routing** (prototype uses hash; use real routes in production): catalog `/paddles/browse`, detail `/paddles/browse/p/<slug>`, compare `/paddles/browse/compare/<slugA>/<slugB>`. Slug = `brand-name` lowercased, non-alphanumerics → `-`, dedup with numeric suffix. Route change scrolls to top and resets to page 1. Back/forward must work; detail pages should be SSR/indexable if the stack allows.
- **Search:** case-insensitive substring over `name + brand`; resets page to 1.
- **Filters:** all facets are multi-select checkboxes, OR within a facet, AND across facets. Counts are computed against results filtered by *all other* facets (so a facet never zeroes itself out). Any change resets pagination.
- **Buckets:** Price = Under $100 / $100–150 / $150–220 / $220 and up. Core = ≤13mm ("thin & poppy") / 14 / 15 / 16 / 17mm+ ("extra plush"). Play style includes `Unrated` for the 9 null-type paddles; Impact feel includes `Unlisted` for nulls.
- **Sorts:** Best overall (composite score desc, nulls last, price asc tiebreak), Price asc/desc, Spin (spinRpm desc), Power (powerMph desc), Pop (popMph desc), Newest (year desc), Name A–Z. Null metric values always sort last.
- **Collections → presets:** Best overall = clear+sort best · Under $100 = price bucket · Spin machines = sort spin · Control & touch = type Control · Big power = type Power + sort power · Beginner friendly = core 16mm + feel Soft/Dense + price Under $100 & $100–150. Applying a collection clears previous filters and search.
- **Hovers:** cards lift 2px w/ shadow; buttons get green border/text; transitions ~150ms ease.
- **Loading:** stream/skeleton the grid; the shell (hero, rail scaffold) renders before data.
- **Responsive breakpoints:** 940px (rail → bottom sheet; detail 1-col; left column unsticks), 620px (nav links hide; reco picks stack). Hit targets ≥44px on mobile.

## Algorithms (port these exactly)
Derived fields computed once after load: treat `popMph === 0` as null; `spinPct` = fraction of non-null spinRpm values ≤ this paddle's (rounded to 2dp); `score` = mean of available `[spinPct, powerPct, popPct, twistWeightPct]`, requiring ≥2, else null; `hasLab` = any of spinRpm/powerMph/popMph present.
- **Top Pick:** pool = same `type`, has price, has score, excluding self. First paddle with `score > base + 0.02` sorted by score desc then price asc (base = current paddle's score, 0.5 if null); fallback = highest score in pool.
- **Value Pick:** from pool minus Top Pick: `price ≤ current − $25` and `score ≥ base − 0.07`, maximizing `score − price/1000`; fallback = best-scoring cheaper paddle; fallback = cheapest in pool. Skip if it equals Top Pick.
- **Reason copy:** list real deltas — power when |Δ| ≥ 0.3 mph (`+1.2 mph power`), spin when |Δ| ≥ 40 RPM, stability when |ΔtwistWeightPct| ≥ 0.12 (`more stable`); if none, "near-identical bench numbers". Top: `The step up in this play style: {deltas}. Same {shape} shape, {core}mm core.` Value: `Keeps the {type} character for less: {deltas}. {Same shape|Shape}, {core}mm core.`
- **Similar (6):** distance = 2.2·(type≠) + 1.1·(shape≠) + 0.32·|Δcore| + |ΔswingWeight|/9 + |ΔspinRpm|/130 (both present) + |Δprice|/130 (both present); ascending.
- **Compare normalization ranges** (bar width = clamp((v−min)/(max−min), .04, 1)): price 60–340, spin 1800–2180, power 50–58.5, pop 33–38.3, twist 4.9–7.9, swing 91–136 (inverted winner), weight 7.2–9 (inverted), core 10–20.
- **Silhouettes** (pure CSS, portrait): width by shape — card (84px tall): Widebody 66px / Hybrid 57px / Elongated 50px / Extra-elongated 46px; border-radius `48% 48% 26% 26%` (elongated), `46%/32%` hybrid, `42%/34%` widebody; fill gradient by type — Power `linear-gradient(165deg,#e8d9c4,#dcc9a8)`, Control `#dfe3d2→#ccd3bb`, All-Court `#e3e0c9→#d3cfae`, default `#e6e0d0→#d6ceb6`; centered brand initials (Source Serif 4 700, rgba(35,42,31,.55)); small handle tab centered below (bg #d8cdb2).

## State Management
`data` (enriched rows) · `route` · `q` · `sort` · `filters {type[], shape[], brand[], core[], feel[], price[]}` · `page` (30/page) · `compare` (≤2 slugs, FIFO) · `brandExpanded` · `railOpen` (mobile) · viewport width flag. URL should encode route (+ ideally filters/sort as query params — an upgrade over the prototype). Compare selection may persist in sessionStorage.

## Data contract (`data/paddles.json`, 486 rows — extracted from the production catalog)
`name, brand, price($69–333, 1 null), link(483 affiliate URLs), year(2021–26), approval(USAP|USAP/UPA-A|UPA-A|Unapproved), shape(Elongated|Hybrid|Widebody|Extra-elongated), gritType, buildType(Gen 1–4, Edgeless variants, No Gen), type(All-Court|Power|Control|null×9), feel(Soft/Dense|Soft/Hollow|Neutral|Stiff/Dense|Stiff/Hollow|null), coreMm(10–20), gripLenIn, gripSizeIn, weightOz(7.25–8.9), swingWeight(92–135), swingWeightPct, twistWeight(4.96–7.87), twistWeightPct, balanceMm(203–256), spinRpm(1813–2176; 348 rows), spinRating, spinDurability(Tier 1–4), powerMph(50.3–58.4; 357), powerPct, popMph(0=missing), popPct, firepowerPct, firepowerZ(0–100), firepowerTier`. Percentile fields are 0–1. ~133 paddles have no lab metrics — every view must degrade gracefully (cards say "specs only", detail shows the dashed not-tested card, they sort last in metric sorts).

## Design Tokens
Colors — cream page `#f7f2e7`; hero/footer wash `#f3ecdc`; paper cards `#fffdf8`; ink `#232a1f`; ink-soft `#55604b`; muted `#8b937f`; disabled `#a9b09d`; hairline `rgba(35,42,31,.14)`; **primary green `#2c4f27`** (hover `#1c3618`); gold `#8a6d1f`; terracotta `#a3502a`; control-blue `#3e576e` (chip bg `rgba(82,112,140,.15)`); pickleball yellow `#cbd52b` (tray accents only). Play-style chips: Power `rgba(163,80,42,.13)`/`#8a3f1d`, All-Court `rgba(44,79,39,.12)`/`#2c4f27`, Control as above, Unrated `rgba(35,42,31,.08)`/`#55604b`.
Type — display: Source Serif 4 (600; headlines end with a period); UI: Archivo 400–700; data/numbers: IBM Plex Mono 400–600. **If production already loads its own brand fonts, keep production's** and map display/UI/mono roles onto them.
Radii — cards 10–12px, wells 7–8px, buttons 7–9px, chips 5px, pills 999px. Shadows — hover `0 4px 14px rgba(35,42,31,.12)`; tray `0 -6px 24px rgba(35,42,31,.3)`. Spacing — card padding 14–18px, grid gaps 12–14px, section gap 26px, page gutter clamp(16px,3vw,32px).

## Assets
None required. No product photos (permanent decision — schematic silhouettes are CSS-only). Icons are tiny inline SVGs (magnifier, filter lines, checkmark). Fonts via Google Fonts unless production supplies its own.

## Files
- `Paddle Finder.dc.html` — full prototype: template (inline styles, all four views) + logic class (all algorithms above) + tweakable props (`defaultSort`, `showCollections`).
- `data/paddles.json` — the 486-paddle dataset the prototype runs on.
- `data/README.md` — dataset field notes and distributions.
