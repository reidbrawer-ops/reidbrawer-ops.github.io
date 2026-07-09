# JS duplication & dead-code audit

Scope: all 14 files in `assets/*.js` + `scripts/fetch-google-ratings.mjs`. Read-only — no files edited. All claims below are backed by grep evidence, shown inline.

Total: 2,449 lines across the 14 browser-side files (`wc -l assets/*.js`), 184 in the Node script.

---

## 1. Every JS file is loaded by at least one page — no dead files

Ran `grep -rl "assets/<file>.js" *.html cities/*.html` (30 HTML files: 12 root + 18 city pages) for all 14 files. Results:

| File | Pages | Notes |
|---|---|---|
| analytics.js | 30/30 | every page |
| nav.js | 30/30 | every page |
| global-search.js | 30/30 | every page |
| regions.js | 4 | directory.html, index.html, rankings.html, cities/index.html |
| city-tags.js | 2 | index.html, cities/index.html |
| directory.js | 1 | directory.html |
| map.js | 1 | map.html |
| rankings.js | 1 | rankings.html |
| paddle-quiz.js | 1 | paddle-quiz.html |
| court-ratings.js | 20 | directory.html, map.html, rankings.html, all 17 city pages |
| google-ratings.js | 20 | **identical set to court-ratings.js** (verified with `diff`, exit 0) |
| rating-widgets.js | 19 | same 20 minus map.html |
| top-picks.js | 19 | same 20 minus rankings.html |
| firebase-config.js | 0 script tags | **not dead** — it's an ES module, only ever reached via `import` (see §4), never a `<script src>` |

No file returned zero matches. `firebase-config.js` shows 0 because it's imported, not tag-loaded — confirmed both `court-ratings.js:14` and `paddle-quiz.js:10` `import { firebaseConfig, isFirebaseConfigured } from "/assets/firebase-config.js"`.

Worth noting since it explains the 19-vs-20 gaps: `map.js` never touches `window.PBWidgets` (no favorite buttons/rating forms in map popups), so `rating-widgets.js` correctly isn't loaded on map.html. `rankings.js` never references `window.PBTopPicks` (its sort is favorites-then-average, not the top-pick score — see §2), so `top-picks.js` correctly isn't loaded on rankings.html. Both are intentional, not oversights.

---

## 2. Repeated logic

**Correction to the prompt's working assumption first:** the "likely candidates" list for repeated venues.json/courts-data.json fetch+render logic was `directory.js, map.js, top-picks.js, city-top-pick.js, rankings.js, city-tags.js`. Verified by reading all six and grepping `fetch(` (`grep -n "fetch(" assets/*.js`) — only **three** files actually fetch venue data themselves:

- `directory.js:434` — `fetch("/assets/courts-data.json")`
- `rankings.js:227` — `fetch("/assets/courts-data.json")`
- `map.js:64` — `fetch("/assets/venues.json")`
- (`global-search.js:43` also fetches `courts-data.json`, not in the prompt's candidate list but is a fourth real fetcher)

`top-picks.js`, `city-top-pick.js`, and `city-tags.js` do **not** fetch anything — they operate on data already fetched by others, exposed via `window.PBRatings`/`window.PBGoogleRatings` (top-picks.js), on `.venue-card` elements already in the page's static HTML (city-top-pick.js:10), or on the static `window.PB_CITY_REGION` object from regions.js (city-tags.js:13-14). So there's no fetch-boilerplate duplication to fix in those three — the real overlap is narrower than assumed.

### 2a. `escapeHtml` — byte-identical in 3 files, near-identical in a 4th

```
assets/directory.js:23-27
assets/map.js:43-47
assets/rankings.js:7-11
```
All three are byte-for-byte identical (`diff` exit 0 on each pair):
```js
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
```
`assets/global-search.js:12-16` implements the same table with a `function` expression instead of an arrow function — functionally identical, syntactically drifted:
```js
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}
```
That drift is itself the argument for consolidating: four copies of "the" HTML-escape function already disagree syntactically after presumably starting identical. 15 lines → 5 if centralized (net ~10-14 lines removed depending on how global-search.js's copy is folded in).

### 2b. `citySlug` — byte-identical in 3 files

```
assets/city-tags.js:8-10
assets/global-search.js:8-10
assets/rankings.js:13-15
```
`diff` confirms all three identical:
```js
function citySlug(city) {
  return city.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-+|-+$)/g, "");
}
```
9 lines → 3 if centralized (saves 6).

### 2c. `setStatus(text, isError)` — byte-identical in 2 files

```
assets/directory.js:428-432
assets/map.js:6-10
```
```js
function setStatus(text, isError) {
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.classList.toggle("is-error", !!isError);
}
```
`diff` confirms identical. `rankings.js` does the *same job* but inline rather than via a named helper (`rankings.js:238-241`, uses `.classList.add` instead of `.toggle`) — a fourth near-duplicate that a shared helper would also absorb. 10 lines → 5 if centralized (saves 5, plus normalizes rankings.js's inline version).

### 2d. Fetch + `res.ok` check + `.catch` → status-message boilerplate

Structurally identical (not byte-identical — different URLs, variable names, error copy) across the three real fetchers:
```
directory.js:434-445   fetch courts-data.json → init(venues) → catch → setStatus(...)
rankings.js:227-242    fetch courts-data.json → tryRender()   → catch → statusEl update
map.js:64-141          fetch venues.json      → build map    → catch → setStatus(...)
```
Each independently re-implements "check `res.ok`, throw with a `${res.status}`-templated message, `.catch` → log + show a user-facing status string." A shared `fetchJson(url, { onError })` (or similar) in a new `assets/fetch-utils.js` would remove ~4-6 lines of near-identical boilerplate per call site. Lower priority than §2a-2c since it isn't byte-identical and the differences (what happens on success) are real, not accidental.

### 2e. Things that looked like duplication but verified as NOT duplicated

- **Chip/bucket formatting** (`priceBucket`, `skillBucket`, `courtsBucket`, `weatherBucket`, `surfaceBucket`, `.stat-chip` rendering): `grep -rn "priceBucket\|skillBucket\|courtsBucket\|weatherBucket\|surfaceBucket\|stat-chip" assets/*.js` shows all of it confined to `directory.js` (one incidental `stat-chip` class reuse in `paddle-quiz.js:433`, which is markup convention reuse, not logic duplication). These bucket functions exist only to drive directory.html's filter dropdowns; city pages hand-author their venue cards directly from raw fields, so there's no second copy to merge.
- **Sort/comparator logic**: `rankings.js`'s `sortCourts` (favorites first, then average — `rankings.js:72-79`) and `top-picks.js`'s `compareForTopPick` (average + 0.5×favorites, favorites only a tiebreak nudge — `top-picks.js:31-54`) look similar in shape but are deliberately different formulas. `top-picks.js:6-9`'s own comment explains why: "favorites nudge the result but don't dominate it the way they do on /rankings, which sorts favorites first." This is documented intentional divergence, not accidental duplication — no action needed.
- **`.venue-card` HTML templates** in `directory.js` and `paddle-quiz.js`: same CSS class reused for visual consistency, but the two card-building template literals render entirely different fields (venue facts vs. paddle specs) — markup convention reuse, not logic duplication, and out of this audit's JS-logic scope (see the HTML audit for markup-level findings).

---

## 3. Dead code within used files

Extracted every named `function foo(...)` declaration across `assets/*.js` (73 names, via `grep -no '  *function [A-Za-z0-9_]*(' assets/*.js`), then counted total occurrences of each identifier (`\b<name>\b`) across `assets/*.js`, every `*.html`/`cities/*.html`, and `scripts/*.mjs`.

**Result: every one of the 73 named functions has ≥2 occurrences** (its own definition plus at least one call site). None came back at count 1, which is what a defined-but-never-called function would show. No dead top-level functions found.

One smaller, non-functional finding: `court-ratings.js:16` (`export const FACTORS`), `paddle-quiz.js:274` (`export function computeMatches`) and `paddle-quiz.js:325` (`export async function submitLead`) are all marked `export`, but grepping for `import ... from "/assets/court-ratings.js"` or `.../paddle-quiz.js"` anywhere in the codebase returns nothing — no other file ever imports these modules. `FACTORS` is actually consumed cross-file, just via `window.PBRatings.FACTORS` at runtime (`rating-widgets.js:56`), not via ES `import`. `computeMatches`/`submitLead` are only called from within `paddle-quiz.js` itself. The `export` keyword on all three is inert — harmless, but not doing anything, since each file is only ever loaded as a page's `<script type="module">` entry point (confirmed: `directory.html:217` and `paddle-quiz.html:118` are the only two `type="module"` tags in the codebase, and neither is imported by another script). Not worth a separate cleanup pass on its own, but worth folding in if `court-ratings.js`/`paddle-quiz.js` are touched for another reason.

---

## 4. rating-widgets.js vs. court-ratings.js vs. google-ratings.js

Read all three in full. They are three genuinely distinct layers, not overlapping duplicates:

- **`court-ratings.js`** (318 lines) — the data/backend layer. Owns the Firestore-or-localStorage backend selection (`LocalDemoBackend`/`FirebaseBackend` classes, `court-ratings.js:86-182`), the vote/rating math (`computeStats`, `court-ratings.js:61-84`), and exposes it all as `window.PBRatings` with `getStats`, `toggleFavorite`, `rateFactor`, etc. It renders **no HTML**.
- **`rating-widgets.js`** (184 lines) — the DOM rendering/interaction layer. Generates the star-rating markup, favorite button, and 6-factor rating form HTML (`overallRatingHtml`, `favoriteButtonHtml`, `ratingFormHtml`), wires up click handling for them, and re-renders on `pbratings:ready`/`pbratings:update`. It never talks to Firestore or localStorage directly — everything routes through `window.PBRatings` from court-ratings.js. Exposed as `window.PBWidgets`.
- **`google-ratings.js`** (110 lines) — a separate, optional read-only overlay. Fetches a static `google-ratings.json`, and instead of requiring markup changes, it *finds* every element `rating-widgets.js` already rendered (`[data-role="overall-rating"][data-court-id]`, see `google-ratings.js:68`) and injects a Google-rating badge next to it. It patches `window.PBWidgets.refreshAll` (`google-ratings.js:85-93`) to piggyback its own re-injection on every future re-render, rather than being called explicitly by every page script. It never touches `window.PBRatings`'s data or the community-rating math.

The dependency direction is one-way and clean: `court-ratings.js` → `rating-widgets.js` → `google-ratings.js` (each consumes the previous layer's public surface, none reach back). This is a legitimate separation of concerns (data / rendering / optional overlay), not three files doing the same thing under different names. No consolidation recommended.

---

## 5. `scripts/fetch-google-ratings.mjs` — recent, not abandoned, just not yet run

- **Runnable as-is**: uses only `node:fs`, `node:url`, `node:path`, and global `fetch` (script's own header comment: "Requires Node 18+... No npm install needed" — confirmed accurate, no `package.json` exists in the repo and none is needed since there are zero third-party imports).
- **Still wired to a real workflow**: `GOOGLE_RATINGS_SETUP.md` (3,346 bytes, present at repo root) documents exactly this script's usage.
- **Not yet actually run with a real key**: `assets/google-ratings.json` is currently `{}` (confirmed via `cat`). `git log -p -- assets/google-ratings.json` shows exactly one commit touching this file — `c3cee8d`, dated 2026-07-08 (the day before this audit), which *created* it as `{}` alongside adding `google-ratings.js` and this script in the same commit ("Remove fabricated seed ratings; add Google Maps ratings shown alongside community votes"). There's no second commit updating it with real data — this is a brand-new feature, one day old, not a stale/abandoned one.
- **The empty-object case is handled correctly, not a bug**: read `google-ratings.js` in full. `ensureLoaded()` (`google-ratings.js:18-27`) defaults `data = {}` and silently swallows fetch failures; `get(courtId)` (`google-ratings.js:29-31`) returns `data[courtId] || null`, which is `null` for every id against `{}`; `badgeHtml()` (`google-ratings.js:39-50`) returns `""` when `get()` is null. Net effect against today's `{}`: the feature no-ops everywhere, exactly as the file's own header comment states it should ("badges just won't show"). No fix needed here.

**Recommendation**: no code change. This is a product/ops task, not a cleanup item — run `GOOGLE_PLACES_API_KEY=... node scripts/fetch-google-ratings.mjs` once a key is available to populate real data. Nothing here should be flagged for removal.

---

## Summary, ranked by value

1. **Extract `escapeHtml`, `citySlug`, `setStatus` into a shared file** (§2a-2c) — highest-confidence finding: three functions independently byte-identical across 2-3 files each, with `escapeHtml` already caught mid-drift (global-search.js's copy differs syntactically). Low effort, removes ~20-25 duplicated lines, and — more valuable than the line count — closes off a real "one copy gets fixed, the other three don't" bug class the codebase has already started to exhibit.
2. **Optionally extract a shared `fetchJson` helper** (§2d) — real but lower-value; the three call sites aren't byte-identical and the differences are meaningful, so this is a nice-to-have, not a drift risk like #1.
3. **No dead code found** (§3) — a genuine (if unglamorous) result: all 73 named functions are referenced elsewhere. The only nit is three inert `export` keywords with no importer, not worth a standalone pass.
4. **rating-widgets.js / court-ratings.js / google-ratings.js are correctly separated** (§4) — confirms no consolidation needed; documenting this closes off a plausible-looking but incorrect simplification someone might otherwise attempt.
5. **google-ratings.mjs is a one-day-old, correctly-guarded stub, not abandoned code** (§5) — no cleanup action; flag for the maintainer to run when a Places API key is available.
