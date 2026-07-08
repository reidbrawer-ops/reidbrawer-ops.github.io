# Navigation, Google-links & jump-to-city audit — findings + parallel work plan

Analysis date: 2026-07-08. Everything below was verified against the live code
(grep counts, file reads, and a running local preview — not guesses). Repo is
a real git repo (`origin` = `github.com/reidbrawer-ops/reidbrawer-ops.github.io`,
branch `main`) with **uncommitted local changes already present** (`index.html`,
`assets/rankings.js`, `assets/rankings.css`, `assets/style.css`,
`assets/firebase-config.js`, `.gitignore`, `FIREBASE_SETUP.md`, plus untracked
`.firebaserc`/`firebase.json`). See Ground rules before starting any group.

---

## Findings

### 1. Main nav — organization & "dropdown from hover"

- The "More" menu (`Learn to play` / `Gear & rentals` / `Visiting the Bay` /
  `Report a correction`) is a native `<details>/<summary>` element
  (`assets/style.css:227-296`, wired by `assets/nav.js`). **It opens on
  click/tap only — confirmed live** by dispatching `mouseenter`/`mouseover`
  on the summary in a running preview and checking `.open` stayed `false`.
  If the intent (or a mouse user's expectation) is a hover-triggered
  flyout on desktop, that doesn't happen today — you have to click.
  Click-to-open is actually the more accessible base behavior (keyboard +
  touch both work, confirmed via `nav.js`'s Escape/outside-click handlers),
  so the fix is to *add* hover as a desktop-only enhancement, not replace
  the click behavior.
- Nav markup is hand-duplicated across **29 files**
  (`grep -l 'class="main-nav"' *.html cities/*.html`). Spot-checked two
  files' nav blocks byte-for-byte — the only difference was each page
  correctly marking its own `aria-current="page"`, which is correct
  behavior, not a bug. A full 29-file audit hasn't been done though, and
  every one of Directory/Rankings link presence *was* verified present in
  all 29 (no page is missing a nav item).
- Mobile (≤560px): no hamburger/collapse. All 7 items (Home / Cities / Map
  / Directory / Rankings / More / About) shrink font and **wrap to two
  lines** in the header (confirmed via a 375px screenshot). Not broken,
  but cramped, and eats vertical space above the fold on every page.

### 2. "Links to the right places" — a real broken deep-link, both directions

- `assets/rankings.js:44` links every ranked venue name to
  `${court.url}#${court.id}`, e.g. `/cities/san-jose.html#paul-moore-park`.
- But `cities/*.html` venue cards only carry `data-court-id="paul-moore-park"`
  — **there is no element with a plain `id="paul-moore-park"` attribute**
  anywhere on the page (verified by grep on `cities/san-jose.html`).
  `data-*` attributes are not valid scroll-anchor targets, so **every
  Rankings → city-page venue link silently fails to scroll to the actual
  card** — the page just loads at the top. This affects all 84 venues.
- The reverse direction (city page → `/rankings.html#paul-moore-park`,
  `cities/san-jose.html:87`) does work, because `rankings.js`'s `render()`
  gives by-city leaderboard rows a real `id={court.id}` (`rankings.js:95`).
- This is a one-attribute fix (`id="<data-court-id-value>"` on every
  `.venue-card` and `.mini-venue-row`) but it touches all 17 city files, so
  it's bundled into Group A below rather than run alone.

### 3. Google "Directions" links — mostly address search, not verified places

- 117+ Directions-style links across `cities/*.html` + `visiting.html`, in
  **at least four different URL formats**:
  - 107 × `google.com/maps/search/?api=1&query=<free-text address>` — a
    text search, not a link to a specific place. This can (and per
    `GOOGLE_RATINGS_SETUP.md`'s own admission of "text search occasionally
    matches a nearby but wrong place") resolve to the wrong pin — a park's
    main entrance, a school office, a tennis club next door — instead of
    the actual pickleball courts.
  - 10 × `google.com/maps/place/?q=place_id:<id>` — a verified place link
    (San Mateo, Fremont).
  - 3 × `maps.google.com/?cid=<id>` — also a verified-place format, but a
    third distinct style (Pleasanton, San Jose).
  - 7 × a full `google.com/maps/place/<Name>/@lat,lon,...` URL with a data
    blob (Palo Alto) — verified but heavyweight/fragile to hand-maintain.
- **The infrastructure to fix this already exists and is unused for this
  purpose.** `scripts/fetch-google-ratings.mjs` already resolves a verified
  Google Places `placeId` for every one of the 84 venues (via
  `places:searchText`) — but today that `placeId` is written *only* to
  `assets/google-ratings.json` (for the ratings badge link) and is never
  used to fix the Directions links. Zero of the 84 entries in
  `assets/venues.json` / `assets/courts-data.json` currently store a
  `placeId` field.
- Every full `.venue-card` already carries `data-court-id="<id>"` — the
  same id key `google-ratings.json` is keyed by — so once ratings data
  exists, rewriting Directions links to verified place URLs is a small
  client-side DOM pass, **not** a 17-file hand-edit. `.mini-venue-row`
  entries (43 of the 84 venues) don't currently carry `data-court-id` at
  all, so that needs adding for this to cover every venue (see Group A).

### 4. Google ratings — fully wired, but the data file is empty

- `assets/google-ratings.json` is **literally `{}`** right now. The badge
  feature (`assets/google-ratings.js`) is correctly included on
  `rankings.html`, `directory.html`, and all 17 city pages (verified by
  grep) — but because the data file is empty, **no Google rating badge
  renders anywhere on the live site today**, despite `rankings.html`'s own
  copy promising "each court also shows its public Google rating."
- Fixing this requires running `scripts/fetch-google-ratings.mjs` with a
  real `GOOGLE_PLACES_API_KEY` (billing-enabled Google Cloud project) — a
  manual step only you can do (per `GOOGLE_RATINGS_SETUP.md`), not
  something an agent session can complete standalone. See Group B.

### 5. "Jump to your city" — jumps to a section, not a city

- `rankings.html:63`: `<a class="btn" href="#city-leaderboards">Jump to
  your city →</a>` — this is a static link to the *top of the entire
  17-city stacked list*, not the visitor's city. Confirmed in
  `rankings.js`.
- The individual per-city anchor targets **already exist** —
  `rankings.js`'s `render()` gives every city section a real
  `id="${citySlug(city)}"` (`rankings.js:88`) — so this is purely a
  missing entry-point problem, not a missing-target problem.

### 6. Home page — no way to jump to a city, confirmed live

- Checked the live DOM on `index.html`: **zero** search inputs, selects,
  or per-city links exist. The only city-related navigation is 5 region
  cards → `/cities/index.html#<region>` (San Francisco / Peninsula / South
  Bay / East Bay / North Bay).
- `cities/index.html` itself only defines **5 region-level `id`s**, no
  per-city `id`. So even after clicking into a region, there's no anchor
  to jump further — you scan/scroll the region's city-grid by eye. This
  matches your description exactly: home page requires scrolling to find
  your city.
- No sitewide search exists anywhere on the site (grep confirms no search
  input in any file).

### 7. Reusable data already in place for the fixes below

- `assets/regions.js` already exposes `window.PB_REGION_ORDER` (5 regions,
  ordered) and `window.PB_CITY_REGION` (city → region map, all 17 cities)
  synchronously, no fetch needed. `rankings.html`/`directory.html` already
  load it; `index.html`/`cities/index.html` currently do not.
- `assets/courts-data.json` (84 records, `id`/`name`/`city`/`url` per
  venue) is the natural search index for a sitewide search — already
  fetched by `rankings.js` and `directory.js` the same way.

---

## Ground rules for running groups in parallel

- **The repo already has uncommitted changes** (see top of this doc).
  Before spinning up multiple sessions, either commit/stash that work
  yourself, or make sure every session pulls the current working tree as
  its starting point — don't let a session's diff silently clobber your
  in-progress Firebase/ratings work.
- Give each session its own branch or worktree
  (`git worktree add ../pba-<group> -b <group>`) so concurrent edits can't
  race on the same file, same as the existing plans in this repo
  (`improvement-plan.md`, `parallel-prompts-filters-and-legend.md`).
- Every group below lists exactly which files it touches and which region
  of a shared file it's scoped to. Two groups touching the *same file* is
  fine as long as they stay in their stated region (same convention this
  repo already uses for `map.html`'s nav-vs-map-section split).

---

## Group A — Venue anchor IDs + verified Google Directions links

**Goal:** Fix the two most concrete bugs found above in one pass, since
they touch the same elements in the same 17 files: (1) give every venue
card a real `id` so Rankings → city-page deep links actually scroll to the
right card, and (2) make "Directions" links point at the verified Google
Place once one is known, instead of a free-text address search.

**Steps:**
1. In every `cities/*.html`, add `id="<data-court-id value>"` to each
   `.venue-card` div, and add both `id="..."` and `data-court-id="..."` to
   each `.mini-venue-row` div (currently has neither) — match ids to the
   `id` field already assigned in `assets/courts-data.json` for that
   venue (matched by name + city).
2. Build a small client-side script (new `assets/directions-links.js`, or
   a new function inside `assets/google-ratings.js` alongside its existing
   `mapsUrl()` helper) that, once `assets/google-ratings.json` has real
   data, walks the DOM for `.directions-link` / `.mv-directions` anchors
   inside an element carrying `data-court-id`, looks up that court's entry
   via `window.PBGoogleRatings.get(courtId)`, and — only when a `placeId`
   exists — rewrites the anchor's `href` to
   `https://www.google.com/maps/place/?q=place_id:<placeId>`. Leave the
   existing address-search link untouched when no verified match exists
   (matches this site's "say so if it's thin" ethos — don't silently
   guess). Include this new script on the same 17 city pages that already
   load `google-ratings.js`.
3. Optional/stretch, same session: standardize the 10+3+7 already-verified
   links (`place_id:`, `cid=`, and Palo Alto's heavyweight data-blob URL)
   to the single `place/?q=place_id:` format for consistency, and note in
   a comment that they were verified by hand originally (don't silently
   overwrite Palo Alto's link with a script — it wasn't sourced from this
   pipeline).
4. `visiting.html`'s ~17 Directions links reference the same addresses as
   city-page venues but aren't tied to `data-court-id` DOM structure — as
   a stretch goal, hand-match each to its `courts-data.json` id and give
   its `<a>` element `data-court-id` too so it's covered by the same
   script; otherwise leave it out of scope for this pass and note it as
   remaining.

**Files touched:** `cities/*.html` (17 files — venue-card/mini-venue-row
`id`/`data-court-id` attributes only, not their `href` text), new
`assets/directions-links.js` (or an addition inside
`assets/google-ratings.js`), one new `<script>` include line per city
page (same location as the existing `google-ratings.js` include).
Optionally `visiting.html`.

**Depends on nothing to *build*.** The `href`-rewriting only takes visible
effect once Group B populates real ratings data — that's fine, ship it as
a no-op-until-data-exists progressive enhancement, same pattern this repo
already uses for the ratings badges themselves.

**Conflict risk:** Low. Doesn't touch nav, hero, or any content prose in
the 17 city files — only the `id`/`data-court-id` attributes on
venue-card/mini-venue-row wrapper divs. Safe to run alongside Groups C, D,
E, F, which touch different files/regions.

**Done when:** clicking a venue name on `/rankings.html`'s Top 10 or
by-city list scrolls straight to that card on its city page; and (once
Group B's data exists) at least a handful of Directions links resolve to
`maps/place/?q=place_id:...` instead of a text search.

---

## Group B — Populate real Google ratings data (mostly a manual step)

**Goal:** Actually generate the Google ratings/placeId data that Groups A
and the existing (already-shipped) ratings badges depend on. This step
needs your own Google Cloud API key and can't be completed by an agent
session alone — but the QA/spot-check tooling around it can be built now.

**Steps for you (not an agent):**
1. Follow `GOOGLE_RATINGS_SETUP.md` (already written, ~10 minutes):
   create/enable a Places API (New) project, create a restricted API key.
2. `export GOOGLE_PLACES_API_KEY=... && node scripts/fetch-google-ratings.mjs`
3. Spot-check the printed `matchedName` values against real venue names
   (the script's own README already warns text search can match a nearby
   wrong place) — hand-edit or delete any bad match in
   `assets/google-ratings.json`.
4. Commit the populated `assets/google-ratings.json` and deploy.

**What an agent session *can* do in parallel, right now, without a key:**
- Add a small `npm run` / shell wrapper (or extend
  `scripts/fetch-google-ratings.mjs`) that, after a run, prints a short
  diff-style summary (which court ids gained/lost a rating, which
  `matchedName` differs meaningfully from the real venue name by some
  simple heuristic) to make your spot-check pass faster.
- Add a visible "as of <fetchedAt date>" note to the rating badge markup
  in `assets/google-ratings.js`'s `badgeHtml()` (the data already carries
  `fetchedAt` per entry, per `fetch-google-ratings.mjs:84`, but it's
  currently unused in the rendered badge).

**Files touched:** `scripts/fetch-google-ratings.mjs` (small additions),
`assets/google-ratings.js` (badge markup only). `assets/google-ratings.json`
itself is only ever written by you running the script.

**Conflict risk:** Low — `google-ratings.js`'s badge-markup region is
separate from Group A's new Directions-link-rewrite function, as long as
each session adds its own new function rather than editing the same
lines.

**Done when:** `assets/google-ratings.json` has real data for the
majority of 84 venues, ratings badges visibly render on `/rankings.html`,
`/directory.html`, and city pages, and each badge shows a "checked as of"
date.

---

## Group C — Rankings page: real per-city jump + city tags

**Goal:** Replace the generic "Jump to your city →" button
(`rankings.html:63`) with an actual per-city quick-jump, and add the city
tags you asked for — both in one UI element.

**Steps:**
1. In the `.rankings-cta` block of `rankings.html`'s hero, replace the
   single "Jump to your city →" link with a row of city tags grouped by
   region (or a `<select>` if you prefer a compact control — a tag row
   reads better with 17 items and doubles as a visual "which cities exist"
   overview).
2. Build this from `window.PB_REGION_ORDER` / `window.PB_CITY_REGION`
   (`assets/regions.js`, already loaded on this page) — no need to wait on
   the async `courts-data.json` fetch, since the city list itself is
   static. Each tag links to `#${citySlug(city)}` using the exact same
   `citySlug()` slugging function already defined in `rankings.js:13-15`
   (reuse it, don't reinvent it — the by-city section ids it targets are
   generated by that same function).
3. Style new tags in `assets/rankings.css` to match the existing
   `.stat-chip`/`.btn` visual language (pill shape, `--kitchen`/`--bay`
   palette) — don't invent a new visual style.
4. Verify the existing `jumpToHashTarget()` smooth-scroll behavior in
   `rankings.js:113-131` still works when landing via one of these new
   tag links (it should — it already listens for any `location.hash`).

**Files touched:** `rankings.html` (hero `.rankings-cta` block only),
`assets/rankings.js` (small addition — render the tag row, reuse
`citySlug`), `assets/rankings.css`.

**Conflict risk:** None with other groups — doesn't touch nav, `index.html`,
`cities/index.html`, or any city page.

**Done when:** clicking any city tag on `/rankings.html` scrolls straight
to that city's leaderboard section, and all 17 cities are represented.

---

## Group D — Home + Cities index: city tags so you don't have to scroll

**Goal:** Kill the "on the home page you must scroll to your city"
problem directly — add real per-city anchors to `cities/index.html` (which
currently only has 5 region-level ids) and a city-tag quick-jump on both
`index.html` and `cities/index.html`.

**Steps:**
1. `cities/index.html`: add `id="<citySlug>"` to each `.city-card` `<a>`
   (currently none exist — only the 5 wrapping `<section id="...">` region
   anchors do). Use the same slugging convention as `rankings.js`'s
   `citySlug()` (lowercase, non-alphanumeric → `-`) so ids are consistent
   sitewide (e.g. `#san-jose`, `#walnut-creek`).
2. `cities/index.html`: add a city-tag quick-jump row near the top of the
   `.page-hero` (all 17 cities, grouped by region using
   `PB_REGION_ORDER`/`PB_CITY_REGION` from `assets/regions.js` — add the
   `<script src="/assets/regions.js">` include to this page since it
   doesn't currently load it), each tag linking to `#<citySlug>`.
3. `index.html`: add a compact version of the same city-tag row — either
   in the hero or directly below the "Explore by region" section — linking
   to `/cities/index.html#<citySlug>` so a visitor can go straight to
   their city in one click from the home page, no scrolling on either
   page. Add the `regions.js` include here too.
4. Match existing visual language (`.stat-chip`/tag styling already used
   elsewhere) rather than inventing new CSS; add any new rules to
   `assets/style.css` under a clearly-named new section (e.g.
   `/* ---------- City quick-jump tags ---------- */`) rather than scattering
   inline styles.

**Files touched:** `index.html`, `cities/index.html`, `assets/style.css`
(new rules only, additive), one `<script src="/assets/regions.js">` line
added to each of those two files.

**Conflict risk:** Low. `assets/style.css` is also touched by Group F
(nav-dropdown hover rules) — both are purely additive to different,
clearly-separated sections of that file, so simultaneous edits are safe as
long as neither group touches the other's new CSS block. Doesn't touch
nav markup, so no conflict with Group F's nav edits either.

**Done when:** from `index.html`, a visitor can reach their specific city
page in one click via a visible tag (not a scroll); `cities/index.html`
has a working per-city anchor for all 17 cities.

---

## Group E — Sitewide global search (header, all pages)

**Goal:** The global search you asked for — type a city or venue name from
anywhere on the site, jump straight to the right city page (and, combined
with Group A's venue-card `id` fix, straight to the right venue card).

**Steps:**
1. Build this as a **self-mounting JS widget**, not 29 files of hand-authored
   markup: new `assets/global-search.js` + `assets/global-search.css` that,
   on `DOMContentLoaded`, injects a search icon + input into `.main-nav`
   (append as the last child, don't restructure existing nav items).
2. Data source: fetch `/assets/courts-data.json` once (same fetch pattern
   `rankings.js`/`directory.js` already use), build a simple client-side
   index over `name` + `city` + `neighborhood`. Also match against the 17
   city names directly (from `assets/regions.js`'s `PB_CITY_REGION` keys)
   so typing just a city name works even before venue data loads.
3. Results: a small dropdown under the input, keyboard-navigable (arrow
   keys + Enter, Escape to close — mirror the existing `nav.js` Escape
   pattern), each result linking to `court.url + "#" + court.id}` for a
   venue match (this now resolves correctly once Group A's `id` fix lands)
   or `/cities/index.html#<citySlug>` for a bare city match.
4. Debounce input, cap results (~8), show a "no matches" state, and don't
   block on the fetch — render the input immediately, only the dropdown
   waits on data.
5. Wire it in by adding **one `<script src="/assets/global-search.js" defer>`
   line** to all 29 html files, placed immediately after the existing
   `<script src="/assets/nav.js" defer>` line in each file — the same
   append-only anchor point already used for cross-cutting scripts in this
   codebase.

**Files touched:** new `assets/global-search.js`, `assets/global-search.css`;
one new script-tag line appended near the bottom of all 29 `.html` files
(root + `cities/`).

**Conflict risk:** Touches all 29 files, but only a single appended line
at a fixed, already-established anchor point (right after the `nav.js`
include) — no other group in this plan touches that region of any file.
Still, of everything in this plan, this is the one most likely to see
merge friction if run without a branch — **give this its own branch even
if you skip branches for the others.**

**Done when:** typing a city or venue name from any page's search box and
pressing Enter (or clicking a result) lands on the right city page,
scrolled to the right venue where applicable; Escape closes it; it works
identically from the home page, a city page, and `/rankings.html`.

---

## Group F — Nav dropdown hover fix + full 29-file nav audit

**Goal:** Add the hover-opens-flyout behavior a desktop mouse user expects
from "More," without breaking the existing (better-for-accessibility)
click/keyboard behavior — and actually verify, file by file, that all 29
navs are correct (not just spot-checked).

**Steps:**
1. In `assets/style.css`, add a `@media (hover: hover) and (pointer: fine)`
   block that opens `.nav-dropdown-menu` on `:hover`/`:focus-within` of
   `.nav-dropdown`, purely additively — don't remove or alter the existing
   `<details>`/click/Escape/outside-click behavior in `assets/nav.js`,
   which should remain the base behavior for touch and keyboard users.
   Watch for the obvious failure mode: don't let CSS-hover-open and the
   native `[open]` attribute get out of sync in a way that makes the menu
   flash or double-toggle on click right after a hover.
2. Audit all 29 files' `<nav class="main-nav">` blocks for: exactly one
   correct `aria-current="page"` matching that page, identical link
   ordering, identical set of links (Home/Cities/Map/Directory/Rankings/
   More-dropdown/About). Fix any drift found.
3. Address the mobile wrap-to-two-lines issue (≤560px, confirmed via
   screenshot) — either accept it as intentional (cheap, no JS, matches
   site's plain style) or convert `.nav-dropdown`-style disclosure to a
   proper hamburger menu at that breakpoint. Recommend the former unless
   it visibly bothers you — flag your preference before this session does
   the heavier hamburger rebuild, since that's a bigger, more visible
   change than everything else in this plan.

**Files touched:** `assets/style.css` (new nav-dropdown hover block, and
mobile-nav rules only if you opt into the hamburger rebuild), all 29
`.html` files (only if the audit finds real drift to fix — likely a small
number, since the spot-check found none).

**Conflict risk:** Low. `style.css` edits are additive and in the
clearly-scoped nav-dropdown section (`assets/style.css:225-296` and
`:899-918`) — distinct from Group D's new city-tag CSS section. If the
audit does need to touch nav markup in specific files, coordinate with
whichever other group is also mid-edit on that file (Group A only touches
venue-card regions, not the nav, so no real overlap expected).

**Done when:** hovering "More" with a mouse opens the flyout without a
click; tapping it on mobile still works exactly as before; all 29 navs
verified identical apart from their own `aria-current`.

---

## Conflict / file-ownership summary

| Group | New files | Existing files touched | Region touched |
|---|---|---|---|
| A | `assets/directions-links.js` (or addition to `google-ratings.js`) | `cities/*.html` (17) | venue-card/mini-venue-row `id`/`data-court-id` attrs only |
| B | — | `scripts/fetch-google-ratings.mjs`, `assets/google-ratings.js` | script internals; badge markup |
| C | — | `rankings.html`, `assets/rankings.js`, `assets/rankings.css` | hero `.rankings-cta` block only |
| D | — | `index.html`, `cities/index.html`, `assets/style.css` | hero/city-grid regions; new additive CSS section |
| E | `assets/global-search.js`, `assets/global-search.css` | all 29 `.html` files | one appended `<script>` line, fixed anchor point |
| F | — | `assets/style.css`, possibly all 29 `.html` files | nav-dropdown CSS section; nav markup only if audit finds drift |

No two groups write to overlapping regions of the same file. The only
files touched by more than one group are `assets/style.css` (D + F, two
disjoint new sections) and the 17 `cities/*.html` files (A + E, disjoint
regions: venue-card attributes vs. bottom script includes) and the 29
`.html` files broadly (E + F, same disjointness).

## Suggested run order

1. Kick off **A, C, D, F** in four parallel sessions immediately — zero
   coordination needed between them.
2. Run **E** in its own branch, any time (parallel-safe by file region,
   but merge it carefully given it touches all 29 files).
3. You run **B**'s manual API-key step yourself, whenever convenient —
   it's not gated on A/C/D/E/F finishing, and A's Directions-link rewrite
   just silently does nothing until B's data exists.
4. After A + B both land, spot-check that Directions links on a few venues
   (e.g. Paul Moore Park in San Jose) now point at a verified Google Place
   and that clicking that venue from Rankings scrolls to the right card.

## Explicitly out of scope for this plan

- Rebuilding the "More" dropdown as anything other than progressive
  hover-on-desktop — a full mega-menu or mobile hamburger redesign is a
  bigger, more visible UI change than this plan's scope; flagged in Group
  F as a decision point, not pre-decided here.
- Server-side/fuzzy search (typo-tolerant, ranked relevance) — Group E's
  search is a simple client-side substring match over a small (84-item)
  dataset, which is enough for this site's size; revisit only if the
  venue count grows substantially.
