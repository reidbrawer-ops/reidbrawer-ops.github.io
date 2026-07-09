# CSS duplication & dead-rule audit

Scope: the six files in `assets/` ending in `.css` — `style.css` (base
stylesheet every page loads), `directory.css`, `global-search.css`,
`map.css`, `paddle-quiz.css`, `rankings.css` (each loaded only by its
matching page, layered on top of `style.css`). Read-only — no files were
edited. All line numbers below were current as of this audit and were
verified with a line-preserving comment-stripped parse of each file (not
eyeballed), cross-checked against a manual read of every file in full.

File sizes (`ls -la assets/*.css`):

| File | Bytes | Lines |
|---|---|---|
| [style.css](../assets/style.css) | 24,586 | 1,261 |
| [directory.css](../assets/directory.css) | 6,533 | 357 |
| [rankings.css](../assets/rankings.css) | 4,586 | 247 |
| [paddle-quiz.css](../assets/paddle-quiz.css) | 4,185 | 233 |
| [map.css](../assets/map.css) | 3,491 | 187 |
| [global-search.css](../assets/global-search.css) | 2,289 | 122 |

---

## 1. Duplicate / near-duplicate rules

I diffed every rule body (declaration set, order-independent) across all six
files pairwise. Below are the matches that represent a real, reusable
component being hand-rolled more than once — not the many low-signal
coincidental matches (e.g. two unrelated rules both happening to set
`display: flex; gap: 0.5rem`, which show up dozens of times and aren't
meaningful duplication — a two-declaration overlap on generic layout
properties isn't evidence of a shared component, it's evidence that flexbox
is common).

### 1a. `.book-btn` (style.css) vs `.clear-btn` (directory.css) — same outline-pill-button component

[style.css:696-716](../assets/style.css:696):
```css
.book-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  font-family: var(--font-mono);
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--bay);
  background: transparent;
  border: 1.5px solid var(--bay);
  border-radius: 999px;
  padding: 0.4em 0.95em;
  text-decoration: none;
  margin-top: 0.7rem;
  transition: background 0.15s var(--ease), color 0.15s var(--ease);
}
.book-btn:hover {
  background: var(--bay);
  color: #fff;
}
```

[directory.css:154-170](../assets/directory.css:154):
```css
.clear-btn {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--bay);
  background: transparent;
  border: 1.5px solid var(--bay);
  border-radius: 999px;
  padding: 0.5em 1em;
  cursor: pointer;
  transition: background 0.15s var(--ease), color 0.15s var(--ease);
}
.clear-btn:hover {
  background: var(--bay);
  color: #fff;
}
```

9 of 11 base declarations match verbatim (font, color, background, border,
border-radius, transition); the `:hover` blocks are byte-identical. The only
real difference is `.book-btn` is a link (`text-decoration: none`,
`margin-top`) and `.clear-btn` is a `<button>` (`cursor: pointer`, no
`display: inline-flex` since it's already a block-level `<button>`) — a
difference driven by element type, not by the visual design being
different. **This is the same "outline pill, fills solid on hover" button
duplicated once in the base stylesheet and once in a page-specific file.**
Belongs in `style.css` as a single class (e.g. keep `.book-btn` as the
canonical name and change `directory.html`'s clear-filter button markup to
use it, or extract a shared `.pill-btn` base that both `.book-btn` and a
`.clear-btn` modifier compose from — `.book-btn` already covers the
`padding`/`cursor` delta once `text-decoration` is scoped to link contexts).

### 1b. `.city-tag` family (style.css) vs `.city-jump-tag` family (rankings.css) — same city-pill-list component, copy-pasted and renamed

Four selector pairs, same component, different class prefix:

| style.css | rankings.css | Match |
|---|---|---|
| [`.city-tag`](../assets/style.css:1242) (1242-1253) | [`.city-jump-tag`](../assets/rankings.css:43) (43-55) | 10 of 10 base declarations identical (`display`, `font-family`, `font-size`, `background`, `border`, `border-radius`, `padding`, `color`, `text-decoration`, `white-space`) — only the `transition` property-order differs (same 3 values, different order, functionally identical) |
| [`.city-tag:hover, .city-tag:focus-visible`](../assets/style.css:1256) | [`.city-jump-tag:hover`](../assets/rankings.css:57) | Byte-identical (`background: var(--bay-tint); border-color: var(--bay); color: var(--bay-deep)`) — except rankings.css's version has no `:focus-visible`, so keyboard users get the hover-only affordance on the rankings page's city pills but not on the home page's |
| [`.city-tag-group`](../assets/style.css:1227) (1227-1232) | [`.city-jump-group`](../assets/rankings.css:27) (27-32) | Identical except `gap: 0.4rem` vs `0.5rem` |
| [`.city-tag-region`](../assets/style.css:1234) (1234-1240) | [`.city-jump-region`](../assets/rankings.css:34) (34-41) | Diverged further: rankings.css version has a different `font-size` (0.72rem vs 0.68rem), different `letter-spacing` (0.12em vs 0.1em), different `color` (`--kitchen-deep` vs `--ink-soft`), and an added `min-width: 6.5em` |

This reads as: someone copy-pasted the home page's `.city-quick-jump` /
`.city-tag*` block (style.css:1220-1261, used on the home page — grep
confirms `city-tag` markup lives in `index.html`) into `rankings.css` under
a new `city-jump-*` prefix for the rankings page's city-jump nav
(`.city-jump`, `rankings.css:10-41`), then tweaked it slightly for a
different visual weight, and the tag itself (`.city-jump-tag`) drifted back
to being near-identical. **Recommend collapsing to one canonical component
in style.css** — either reuse `.city-tag` directly on the rankings page
(if the two are supposed to look the same, which the tag/tag:hover
being identical suggests they were meant to), or, if the rankings page's
group/region variant is intentionally a distinct visual weight, express
that as an explicit modifier class in style.css (e.g. `.city-tag-group.is-compact`)
instead of a fully independent copy in a page file — so the base tag styling
only exists once and can't drift further.

### 1c. Small "mono action link" component, independently rolled in 4 places

Four different class names, same visual pattern (font-mono, ~0.7-0.78rem,
font-weight 600, `color: var(--bay)`, no underline until hover):

- [style.css:600-614](../assets/style.css:600) `.directions-link, .mini-venue-row .mv-directions`
- [directory.css:317-328](../assets/directory.css:317) `.row-action` (+ `.row-action-book` modifier at [directory.css:330-332](../assets/directory.css:330) recoloring to `--kitchen-deep`, which is also byte-identical to [style.css:132-134](../assets/style.css:132) `a:hover { color: var(--kitchen-deep) }` and [rankings.css:232-234](../assets/rankings.css:232) `.review-link:hover` — same accent color reused for the same "secondary/booking-flavored link" meaning in 3 places)
- [map.css:170-176](../assets/map.css:170) `.pba-popup .p-link`
- [rankings.css:221-230](../assets/rankings.css:221) `.review-link`

Declaration overlap (`color: var(--bay); font-family: var(--font-mono);
font-weight: 600; text-decoration: none` or equivalent, `:hover` →
underline or `--kitchen-deep`) is 4-5 out of ~6 properties on every pair.
None of these four is byte-identical to another (font-size ranges
0.7rem–0.78rem, `white-space: nowrap` present on some, absent on others),
so this is a genuine "same idea, four independent hand-rolled variants"
case rather than literal copy-paste. Worth a single shared `.text-link`
(or similarly named) base class in style.css with the font/weight/color
fixed, letting each page override only font-size where it's genuinely
different — right now a future color-scheme change (e.g. re-theming links)
requires editing four files instead of one.

### 1d. Status-line component, independently rolled in 3 page files

- [directory.css:3-12](../assets/directory.css:3) `.directory-status` / `.directory-status.is-error`
- [map.css:3-12](../assets/map.css:3) `.map-status` / `.map-status.is-error`
- [rankings.css:63-72](../assets/rankings.css:63) `.rankings-status` / `.rankings-status.is-error`

All three: `font-family: var(--font-mono); color: var(--ink-soft)` plus a
`font-size` in the same narrow band (0.82rem, 0.82rem, 0.85rem) for the base
state, and an `.is-error` modifier that recolors to the poppy family
(`--poppy`, `--poppy`, `--poppy-deep` respectively — two of three use the
lighter `--poppy`, rankings uses the deeper `--poppy-deep`, likely just
inconsistency rather than an intentional distinction). This is a
"data still loading / fetch failed" status line pattern that all three data-
driven pages (directory, map, rankings — each of which fetches JSON on
load, see [data-duplication.md](data-duplication.md)) need identically.
Belongs in style.css as one `.status-line` / `.status-line.is-error` pair;
would also fix the `--poppy` vs `--poppy-deep` inconsistency for free by
forcing one canonical error color.

### 1e. Identical `:focus-visible` outline override, duplicated verbatim in two page files

- [directory.css:54-57](../assets/directory.css:54) `.filter-field select:focus-visible { outline: 3px solid var(--bay); outline-offset: 1px; }`
- [global-search.css:50-53](../assets/global-search.css:50) `.global-search-input:focus-visible { outline: 3px solid var(--bay); outline-offset: 1px; }`

Byte-identical bodies. The sitewide default is already
[style.css:136-139](../assets/style.css:136) `:focus-visible { outline: 3px
solid var(--bay); outline-offset: 2px; }` — these two rules exist only to
shrink `outline-offset` from 2px to 1px for form controls (presumably so
the ring doesn't get clipped by a parent's `overflow`/border on tight
inputs). Since the override is identical in both files, it should be a
single sitewide rule in style.css, e.g. `select:focus-visible, input:focus-visible
{ outline-offset: 1px; }`, rather than two page-scoped copies that will
inevitably need to become three, four, etc. as more form controls are added
per page. (Not flagging [directory.css:143-146](../assets/directory.css:143)
`.hours-thumb:focus-visible::-webkit-slider-thumb` here even though its body
is also identical to the sitewide default — `:focus-visible` styling does
not automatically cascade onto a `::-webkit-slider-thumb` pseudo-element in
any browser, so that one is a necessary, non-redundant override, not
duplication.)

---

## 2. Truly dead CSS

Extracted all 196 distinct class-name tokens referenced across the six
files' selectors, then grepped every `class="..."` attribute in all 30 HTML
files (`*.html` + `cities/*.html` — 12 root pages + 18 files under `cities/`,
confirmed via `ls *.html | wc -l` / `ls cities/*.html | wc -l`; this repo has
30 HTML pages total, not the 31 the sibling prompts' shared framing assumes)
and every `.js` file in `assets/` (to
catch classes only ever added via `classList`/`innerHTML`/template strings
before calling something dead, per the brief). 9 candidates had zero direct
hits; 6 of those are false positives (explained below), leaving **3
confirmed-dead selectors**:

### Confirmed dead

- **`.star-rating.size-sm`** — [style.css:1005-1007](../assets/style.css:1005)
- **`.star-rating.size-lg`** — [style.css:1009-1011](../assets/style.css:1009)

  The only place either class could be emitted is
  [assets/rating-widgets.js:19](../assets/rating-widgets.js:19)
  `function starHtml(value, sizeClass) { ... return `<span class="star-rating
  ${sizeClass || ""}">...`; }` — `sizeClass` is a parameter, never a
  hardcoded literal, so a plain grep for `size-sm`/`size-lg` correctly finds
  nothing (there's no literal string to find). But `starHtml` has exactly
  one call site in the entire codebase —
  [assets/rating-widgets.js:83](../assets/rating-widgets.js:83)
  `starHtml(stats.overallAvg)` — which never passes a second argument, so
  `sizeClass` is always `undefined` and the size modifier is never emitted.
  `starHtml` is also exported on `window.PBWidgets` but grepping every
  `PBWidgets.*` call site across `directory.js`, `rankings.js`, and
  `google-ratings.js` shows none of them call `starHtml` directly either —
  they only call `overallRatingHtml`, `favoriteButtonHtml`, `badgesHtml`,
  `ratingFormHtml`, `refreshAll`. Confirmed dead, not just currently-unused:
  there is no live code path that can ever add `size-sm`/`size-lg` to a
  `.star-rating` element today.

- **`.top10-note`** — [rankings.css:189-193](../assets/rankings.css:189)

  No HTML file and no JS file contains the string `top10-note`.
  [rankings.html:75-84](../rankings.html:75) builds the "Bay Area Top 10"
  section (`<div id="top10-list" class="leaderboard">`), and
  [assets/rankings.js:138-140](../assets/rankings.js:138) populates
  `#top10-list` via `rowHtml(...)`, but nothing in `rowHtml` or anywhere
  else ever constructs an element with class `top10-note`. Confirmed dead.

### False positives (not actually dead — third-party library classes)

The other 6 zero-hit candidates are all in
[map.css:58-128](../assets/map.css:62) (`.leaflet-container`,
`.leaflet-control-attribution`, `.leaflet-control-zoom`,
`.leaflet-popup-content`, `.leaflet-popup-content-wrapper`,
`.leaflet-popup-tip`). These aren't in any of this repo's HTML or JS because
they're injected into the DOM at runtime by the Leaflet.js library itself
(loaded from a CDN — [map.html:25](../map.html:25) and
[map.html:129](../map.html:129) — `leaflet@1.9.4`), which this file exists
specifically to re-skin to match the site's light theme (see the file's own
comment at [map.css:60](../assets/map.css:60): "Leaflet overrides to match
the site's light theme"). These are live and load-bearing; a grep-only
check without reading the surrounding file would have wrongly flagged all
six as dead.

---

## 3. Unused CSS custom properties in `:root`

32 custom properties are defined in `style.css`'s `:root`
([style.css:19-61](../assets/style.css:19)). Counted every `var(--x)`
reference across all six CSS files for each:

**`--space-1`** ([style.css:48](../assets/style.css:48), value `0.5rem`) —
**zero `var(--space-1)` references anywhere** in any of the six CSS files.
Also checked (beyond the brief's ask) every HTML and JS file for a literal
`space-1` string in case it's set via an inline `style` attribute — none
found either. Every other spacing step (`--space-2` through `--space-5`)
is used at least once (6, 11, 5, and 1 times respectively); `--space-1` is
the one gap in an otherwise-complete, otherwise-used spacing scale. Safe to
delete, or intentionally reserve it and use it — right now several rules
hardcode `0.5rem` directly instead (e.g.
[style.css:372](../assets/style.css:372),
[style.css:484](../assets/style.css:484)) where `var(--space-1)` would have
been the "correct" token had anyone reached for it.

All other 31 variables are referenced at least once (usage counts range
from 1, e.g. `--font-headline`, `--max`, `--space-5`, to 83 for `--ink`) —
no other dead variables.

---

## 4. Fold into `style.css` vs. keep separate

| File | Size | Loaded by | Verdict |
|---|---|---|---|
| **global-search.css** | 2,289B / 122 lines | **All 30 pages** (see below — not visible from a static `<link>` grep) | **Fold into style.css.** |
| map.css | 3,491B / 187 lines | 1 page (map.html) | Keep separate |
| paddle-quiz.css | 4,185B / 233 lines | 1 page (paddle-quiz.html) | Keep separate |
| rankings.css | 4,586B / 247 lines | 1 page (rankings.html) | Keep separate |
| directory.css | 6,533B / 357 lines | 1 page (directory.html) | Keep separate |

**`global-search.css` is the one real candidate**, and the reasoning is
specific to how it's loaded, not just its size. A static-HTML grep for
`global-search.css` across all 30 pages returns **zero** `<link>` tags —
but the search widget itself visibly renders on every page (it's in the
header). The reason: [assets/global-search.js:21-26](../assets/global-search.js:21)
injects the stylesheet at runtime —
```js
if (!document.querySelector('link[href="/assets/global-search.css"]')) {
  var link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/assets/global-search.css";
  document.head.appendChild(link);
}
```
and `global-search.js` itself is loaded via `<script defer>` on all 30
pages (confirmed: `grep -c "global-search" *.html cities/*.html` returns
1 for every file). So this file is not "loaded only where needed" the way
the other four are — it's loaded on literally every page, just later and
through an extra JS-inserted `<link>` instead of a static one in `<head>`.
That costs every page an extra render-blocking-adjacent request that fires
only after the deferred script executes (post-parse), which is a real
flash-of-unstyled-search-box risk (a plain `<input>` with no `.global-search-input`
styling for one frame) that a page-specific stylesheet loaded from `<head>`
wouldn't have. At 122 lines it's also the smallest of the five and has no
component-specific bulk (no table styles, no slider thumbs, no third-party
overrides) that would bloat `style.css` for the 30 pages that already load
it unconditionally. Folding it in removes the runtime `<link>`-injection
code from `global-search.js` entirely and removes the FOUC window.

**The other four should stay separate.** Each loads on exactly one page,
and each carries real page-specific bulk that the other 30 pages have no
use for: `directory.css` has the custom range-slider thumb styling
(`.hours-thumb::-webkit-slider-thumb` etc., ~30 lines of cross-browser
slider CSS) and the full data-table styling; `map.css` has ~70 lines of
Leaflet third-party overrides that are meaningless off the map page;
`rankings.css` and `paddle-quiz.css` are each moderately sized
leaderboard/quiz-specific layout that doesn't reduce to a couple of
utility classes. Folding any of these into `style.css` would grow the base
stylesheet — downloaded by every page, including the 18 city pages that
never touch tables, sliders, maps, or quizzes — for no benefit to those
pages.

---

## 5. Hardcoded literals that bypass the CSS variable system

### 5a. `rgba()` shadow/overlay colors — the real finding here

Every custom property in `:root` is defined as a hex color, with no
alpha-capable RGB-triplet counterpart (e.g. no `--ink-rgb: 23, 35, 43`).
Because of that, every `box-shadow`/translucent-overlay color in the
codebase has to hardcode the RGB triplet directly instead of using
`rgba(var(--x-rgb), alpha)`. I converted each `:root` hex value to its RGB
triplet and grepped all six files for exact matches:

| Variable | Hex | RGB triplet | Occurrences | Files |
|---|---|---|---|---|
| `--ink` | `#17232b` | `23, 35, 43` | **9** | style.css:306,476; directory.css:117,129; global-search.css:72; map.css:43,95,115,123 |
| `--bay` | `#1d6b85` | `29, 107, 133` | 2 | style.css:400,644 |
| `--bay-deep` | `#123240` | `18, 50, 64` | 2 | style.css:408,838 |
| `--poppy` | `#b54b2c` | `181, 75, 44` | 2 | style.css:638,1105 |
| `--optic` | `#d7e94b` | `215, 233, 75` | 1 | style.css:552 |
| `--kitchen` | `#2f7a57` | `47, 122, 87` | 1 | style.css:632 |
| `--fog` | `#f5f7f6` | `245, 247, 246` | 1 | style.css:852 |

`rgba(23, 35, 43, …)` (i.e. `--ink` at some alpha) alone appears **9 times
across 5 of the 6 files** — it's the most repeated "literal that bypasses
the variable system" pattern in the whole codebase, and unlike the
component duplication above, this one is a single, mechanical fix: add
`--ink-rgb: 23, 35, 43;` (and the 5 others above) to `style.css`'s `:root`,
then replace each `rgba(R, G, B, alpha)` with `rgba(var(--x-rgb), alpha)`.
That's an 18-site edit, zero visual change, and it means a future palette
change (e.g. retuning `--ink`) can't silently desync the 18 shadow/overlay
colors that currently have to be updated by hand alongside it.

### 5b. `#fff` vs `--paper` — flagged, but likely intentional, not drift

`--paper: #ffffff` ([style.css:22](../assets/style.css:22)) is numerically
identical to the literal `#fff` used 5 times for button/badge text color:
[style.css:397](../assets/style.css:397), [style.css:405](../assets/style.css:405),
[style.css:715](../assets/style.css:715), [style.css:1074](../assets/style.css:1074),
[directory.css:169](../assets/directory.css:169). I'm flagging this per the
brief's instruction to surface near-miss literals even when not
byte-identical (`#fff` vs `#ffffff` is the 3-digit/6-digit shorthand of the
same color, not a byte-identical string match, which is why it didn't show
up in the exact-string dead-color scan). But I'd caution against
mechanically replacing these with `var(--paper)`: `--paper` is used
elsewhere as a **surface/background** token (card backgrounds, popup
backgrounds — 23 occurrences, e.g. [style.css:461](../assets/style.css:461)
`.city-card { background: var(--paper); }`), while every `#fff` occurrence
here is **foreground text-on-a-colored-button** color. They're equal today
by coincidence, not by design — coupling them to the same variable would
make a future "make surfaces off-white but keep button text pure white"
change (a plausible design tweak) silently break both at once. If this is
worth tokenizing, it should be a new `--on-accent: #fff;` (semantically
"foreground color on a saturated background"), not a reuse of `--paper`.

### 5c. Spacing/radius literals — checked, no meaningful findings

I also checked every hardcoded `rem`/`px` value against the `--space-*`
and `--radius-*` scale. This produced ~30 matches, but nearly all of them
are `1rem` or `0.5rem` used for incidental `gap`/`margin` values — `1rem`
is the CSS default relative unit and using `var(--space-2)` for every
instance of it (font-sizes, unrelated gaps, etc.) would be over-tokenizing
generic values rather than fixing real duplication. The one geometrically-
matching case, [map.css:90-91](../assets/map.css:90) `.pba-pin { width:
16px; height: 16px; }` matching `--radius-m: 16px`, is coincidental — that's
a pin icon's diameter, not a border radius, and tying an icon's size to the
design system's corner-radius token would be a correctness bug waiting to
happen the day `--radius-m` changes for unrelated reasons. No action
recommended for this category.

---

## Summary, ranked by estimated payload/maintenance value

1. **§5a — hardcode `--*-rgb` triplet variables for the 18 `rgba()`
   literals.** Highest value-to-effort ratio: mechanical, zero visual
   diff, prevents future palette drift across 5 files.
2. **§4 — fold `global-search.css` into `style.css`.** Removes a
   real FOUC risk on every single page load and deletes the runtime
   `<link>`-injection code, for a net simplification.
3. **§1d — extract a shared `.status-line`/`.is-error` component.**
   Removes 3-way duplication and fixes an existing `--poppy` vs
   `--poppy-deep` inconsistency as a side effect.
4. **§1a/§1b — consolidate `.book-btn`/`.clear-btn` and
   `.city-tag`/`.city-jump-tag`.** Real duplicated components; medium
   effort because it requires deciding whether the small visual deltas
   (padding, gap, region label color) are intentional before merging.
5. **§2 — delete `.size-sm`/`.size-lg`/`.top10-note`.** Trivial, low-risk
   cleanup (3 rules, confirmed unreachable).
6. **§3 — delete `--space-1`.** Trivial, one line.
7. **§1c/§1e — consolidate the mono-action-link and focus-visible
   overrides.** Real but lower-value; mostly a maintainability win for
   future edits rather than a payload win today.
8. **§5b — leave `#fff` as-is** (or introduce a distinct `--on-accent`
   token rather than reusing `--paper`) — not drift, don't force it.
9. **§5c — no action.** Checked and ruled out.
