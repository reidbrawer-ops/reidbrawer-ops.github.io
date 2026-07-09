# Parallel audit: what can be removed or consolidated

Five prompts, each meant to run in its own Claude Code session (own terminal /
own working-directory checkout of this repo), scoped to a different concern
so they don't step on each other. Unlike `parallel-prompts-filters-and-legend.md`,
these are **read-only over source files** — each one only writes a single new
report file, so there is no file-ownership conflict even though several
prompts read overlapping parts of the codebase. Safe to run all five at once.

This is analysis only. None of these prompts should delete, rewrite, or
refactor anything — they produce a report with concrete, cited recommendations
(exact file/line references) so a human decides what to actually act on
afterward. Each ends by writing its findings to `audit/<name>.md` (create the
`audit/` directory if it doesn't exist).

## How the five fit together

| Prompt | Scope (reads) | Writes |
|---|---|---|
| 1. HTML & templating | `*.html`, `cities/*.html` | `audit/html-duplication.md` |
| 2. CSS | `assets/*.css` | `audit/css-duplication.md` |
| 3. JavaScript | `assets/*.js`, `scripts/*.mjs` | `audit/js-duplication.md` |
| 4. Data files | `assets/*.json` | `audit/data-duplication.md` |
| 5. Repo hygiene | root `*.md`, `Site Header/`, `firebase.json`, `firestore.rules`, `.firebaserc` | `audit/repo-hygiene.md` |

After all five land, a good follow-up (sequential, not parallel — do this
yourself or as a 6th prompt once the others are done) is to read all five
`audit/*.md` files and produce one prioritized action list, since some
findings will interact (e.g. a JS dead-code finding in Prompt 3 might explain
a data-file finding in Prompt 4).

---

## Prompt 1 — HTML boilerplate & templating

```
Work in /Users/reidbrawer/Developer/Money/pickleball-bay-area — a static
site (plain HTML/CSS/JS, no build step, no framework, no templating) for
Pickleball Bay Area, deployed via GitHub Pages / Firebase Hosting. It's a
git repo on branch main.

GOAL: Audit duplication across all HTML pages — 12 pages at the site root
(index, about, corrections, directory, gear, learn, map, paddle-quiz,
privacy, rankings, visiting, 404) plus cities/index.html and 18 individual
city pages under cities/*.html (31 files total). This is READ-ONLY: produce
a report, do not edit any file.

CONTEXT ALREADY CONFIRMED (verify it yourself, don't take it on faith, but
this is where to start): every page hand-repeats the same ~25-line <head>
boilerplate (charset, viewport, font preconnects/links, favicon set,
theme-color, og:/twitter: meta pattern, canonical, style.css link) and the
same <header class="site-header">...<nav class="main-nav">...</nav></header>
markup (brand link, 5 nav links, a "More" <details> dropdown), differing only
in title/description/canonical text and which nav link has aria-current.
assets/nav.js only adds *behavior* to this markup (dropdown open/close,
--header-h sync) — it does not inject or generate the header/footer HTML, so
the markup itself really is duplicated 31 times. The footer appears to be
duplicated similarly (grep confirmed <footer>/.site-footer across ~30 files).

WHAT TO PRODUCE — write audit/html-duplication.md covering:

1. Exact byte/line measure of the duplication: how many lines of the
   <head>...</head> block and the <header>...</header> block are byte-for-byte
   identical across pages (excluding title/meta text differences), multiplied
   across 31 files. Same for the footer. Give a real number, not a guess.
2. Where per-page differences actually are (title, meta description, og/
   twitter text, canonical URL, aria-current target, and — check this — is
   the <link rel="stylesheet"> set different per page, e.g. directory.html
   loads an extra directory.css? List every page that loads extra CSS/JS
   beyond the shared style.css, since any consolidation approach has to
   preserve that).
3. Concrete options for de-duplicating this, with an honest tradeoff for
   each given "no build step" is a real constraint someone chose deliberately
   (check DESIGN.md and any other root .md file for why, if stated):
   a) A tiny static-site-generator / build script (e.g. a Node script using
      template literals or a partial-include syntax) that runs before deploy
      and outputs the same flat HTML files — keeps runtime simple, adds a
      build step.
   b) Client-side JS injection (fetch a partials/header.html and
      partials/footer.html, or a <template>/custom-element) — zero build
      step, but adds a flash-of-unstyled-header risk and an extra network
      round trip per page; note whether that's acceptable given this is a
      content/SEO-driven directory site (check whether SSR/crawlability
      matters here — look at sitemap.xml and robots.txt for hints).
   c) Leaving it as-is and just documenting the copy-paste procedure so
      future edits stay in sync (i.e. conclude consolidation isn't worth it)
      — a legitimate answer if the tradeoffs above are worse than the
      current duplication.
   Recommend one, with reasoning specific to this codebase, not generic
   advice.
4. Separately from the head/nav/footer question: flag any HTML pages that
   are near-duplicates of EACH OTHER in body content (not just boilerplate) —
   e.g. compare the 18 city pages' structural patterns (venue-card markup,
   mini-venue-row markup) to see if they're now similar enough that they
   could be generated from cities-data + a single template rather than
   hand-authored, or if per-city content genuinely varies too much for that.
5. Any HTML page not linked from any nav menu, sitemap.xml, or another page
   (orphaned/dead page) — grep for every page's filename across all other
   HTML files and sitemap.xml to check.

Rank findings by estimated maintenance cost saved vs. effort, most valuable
first. Cite exact file names and line numbers for every claim.
```

---

## Prompt 2 — CSS duplication & dead rules

```
Work in /Users/reidbrawer/Developer/Money/pickleball-bay-area — a static
site (plain HTML/CSS/JS, no build step) for Pickleball Bay Area. It's a git
repo on branch main. This is READ-ONLY: produce a report, do not edit any
file.

SCOPE: all six files in assets/ ending in .css — style.css (~24KB, the base
stylesheet every page loads), directory.css, global-search.css, map.css,
paddle-quiz.css, rankings.css (each loaded only by its matching page, layered
on top of style.css).

WHAT TO PRODUCE — write audit/css-duplication.md covering:

1. Duplicate or near-duplicate rules: any selector/property block that
   appears in more than one of the five page-specific CSS files (e.g. if
   directory.css and rankings.css both hand-roll a similar table/card/badge
   style independently). For each duplicate found, quote both instances with
   file:line and propose whether it belongs in style.css as a shared class,
   or whether the two are subtly different for a real reason.
2. Truly dead CSS: selectors in any of the six files with NO matching class/
   id/element anywhere in *.html or cities/*.html. Grep every class name
   defined in CSS against actual usage in HTML (and check assets/*.js for
   classes added dynamically via classList/innerHTML/template strings before
   calling something dead — a class only ever set by JS is still alive).
   List each dead selector with file:line and how you confirmed zero usage.
3. CSS custom properties (variables) defined in style.css's :root — list any
   that are defined but never referenced (var(--x)) anywhere in any CSS file.
4. Whether any of the five page-specific CSS files is small/generic enough
   that it should just be folded into style.css (fewer HTTP requests, one
   less file to keep in sync) versus files that are large/specific enough to
   justify staying separate (loaded only where needed, keeps style.css from
   growing unbounded). Give file sizes and a specific recommendation per
   file, not a blanket rule.
5. Duplicate color/spacing literals that bypass the existing CSS variable
   system (e.g. a hardcoded hex color or px value that matches an existing
   --variable in style.css almost exactly) — these are consolidation
   candidates even if not byte-identical duplication.

Rank findings by estimated payload/maintenance savings, most valuable first.
Cite exact file names and line numbers for every claim — no unverified
claims of "probably unused."
```

---

## Prompt 3 — JavaScript logic duplication & dead code

```
Work in /Users/reidbrawer/Developer/Money/pickleball-bay-area — a static
site (plain HTML/CSS/JS, no build step, no bundler, no shared module system —
every file is a plain <script src="/assets/x.js"> tag) for Pickleball Bay
Area. It's a git repo on branch main. This is READ-ONLY: produce a report,
do not edit any file.

SCOPE: all 14 files in assets/ ending in .js — analytics.js, city-tags.js,
city-top-pick.js, court-ratings.js, directory.js, firebase-config.js,
global-search.js, google-ratings.js, map.js, nav.js, paddle-quiz.js,
rankings.js, rating-widgets.js, regions.js, top-picks.js — plus
scripts/fetch-google-ratings.mjs (a separate Node script, not shipped to
the browser).

WHAT TO PRODUCE — write audit/js-duplication.md covering:

1. Which HTML pages load which JS files (grep <script src for each of the
   14 files across all *.html and cities/*.html). Flag any .js file loaded
   by ZERO pages — that's dead weight regardless of what's inside it.
2. Repeated logic across files: several of these files independently fetch
   assets/venues.json and/or assets/courts-data.json and render venue
   information (directory.js, map.js, top-picks.js, city-top-pick.js,
   rankings.js, city-tags.js are the likely candidates — verify by reading
   each). For each pair/group doing similar work, quote the overlapping
   logic (e.g. duplicate fetch+error-handling boilerplate, duplicate
   "format a venue's price/skill/hours into a chip" formatting, duplicate
   filter/sort comparators) with file:line, and note whether it's similar
   enough to extract into one shared helper file (e.g. assets/venue-utils.js)
   loaded by all of them, or whether each file's version is genuinely
   different enough that it isn't real duplication.
3. Dead code within files that ARE used: functions/variables defined but
   never called/referenced anywhere in the same file or any other JS file
   (grep the function/var name across all of assets/ and all inline
   <script> blocks in HTML). List each with file:line.
4. rating-widgets.js and court-ratings.js — read both in full and determine
   whether these overlap in purpose (both look ratings-related from the
   name) or are genuinely distinct features; same check for
   google-ratings.js vs court-ratings.js vs rating-widgets.js — three
   ratings-adjacent files is worth a clear explanation of what each
   uniquely does, or a consolidation recommendation if two overlap.
5. scripts/fetch-google-ratings.mjs — confirm whether this is still run
   (check GOOGLE_RATINGS_SETUP.md and package.json/CI config if any) and
   whether its output (assets/google-ratings.json, currently just `{}`)
   is actually consumed anywhere live, or whether this is a half-built/
   abandoned feature that should be flagged for a product decision (finish
   it or remove google-ratings.js + the setup doc + the script together).

Rank findings by estimated maintenance/payload savings, most valuable first.
Cite exact file names and line numbers for every claim.
```

---

## Prompt 4 — Data file duplication (JSON)

```
Work in /Users/reidbrawer/Developer/Money/pickleball-bay-area — a static
site for Pickleball Bay Area. It's a git repo on branch main. This is
READ-ONLY: produce a report, do not edit any file.

SCOPE: assets/courts-data.json, assets/venues.json, assets/paddles.json,
assets/google-ratings.json, and every JS file that fetches any of them
(grep -rl "courts-data.json\|venues.json\|paddles.json\|google-ratings.json"
assets/*.js to find the full set — expect at least google-ratings.js,
rankings.js, directory.js, top-picks.js, map.js, global-search.js,
city-top-pick.js).

CONTEXT ALREADY CONFIRMED (verify it yourself, don't take it on faith):
courts-data.json and venues.json both contain exactly 83 records, and their
(name, city) key pairs match 1:1 with zero mismatches in either direction.
courts-data.json carries the richer directory-page fields (price, skill,
hours, courts, waitTime, weather, surface, indoorOutdoor, reservable,
confirmed, bookingUrl, neighborhood...); venues.json carries the map-specific
fields (lat, lon, id) plus a handful of the same fields (name, city, address,
url, confirmed). That's real field overlap across two files describing the
same 83 entities.

WHAT TO PRODUCE — write audit/data-duplication.md covering:

1. The exact field-by-field overlap between courts-data.json and
   venues.json — list every key present in both, and for a sample of ~10
   venues, confirm whether the overlapping fields (name, city, address,
   url, confirmed) actually agree between the two files or have drifted
   (spot real mismatches if any exist — don't assume they're consistent
   just because the audit above found matching keys).
2. A concrete recommendation: merge into one canonical JSON file (with
   every page fetching the single file and picking the fields it needs —
   note the tradeoff of every page then downloading the full ~53KB+24KB
   combined payload even where it only needs a few fields, e.g. map.js
   only needs lat/lon/name/id) vs. keep them separate but establish one as
   the generation source for the other (e.g. a small script derives
   venues.json's shared fields from courts-data.json at data-entry time,
   so there's one place a human edits a venue's name/address/url/confirmed
   status). Recommend one with reasoning grounded in how each file is
   actually used (cite which JS files read which fields from which file).
3. assets/google-ratings.json is currently `{}` (empty object). Trace
   whether google-ratings.js has any code path that behaves sensibly against
   an empty object (does it silently no-op, or would it break if the file
   had real data — read the parsing code) and report whether this is a
   stub for an unshipped feature or working-as-intended.
4. assets/paddles.json is ~358KB with 486 paddle records, each with ~26
   fields (id, name, brand, price, year, approvalBody, shape, paddleType,
   impactFeel, coreThicknessMm, gripLengthIn, gripSizeIn, weightOz,
   swingWeight, swingWeightPercentile, twistWeight, twistWeightPercentile,
   balancePointMm, spinRpm, spinRating, powerMph, powerPercentile, popMph,
   popPercentile, firepowerTier, vendorUrl, vendorSearchBase). Read
   assets/paddle-quiz.js in full and determine exactly which of these ~26
   fields are actually read/used by the quiz logic or rendered to the user,
   versus fields that are computed/stored but never consumed anywhere. List
   confirmed-unused fields by name with evidence (grep result showing zero
   references), since removing unused fields from all 486 records would
   meaningfully shrink this file. Don't guess — confirm via grep across
   paddle-quiz.js and any other file that touches paddles.json.

Cite exact file names, line numbers, and grep evidence for every claim.
```

---

## Prompt 5 — Repo hygiene: docs, unused folders, config

```
Work in /Users/reidbrawer/Developer/Money/pickleball-bay-area — a static
site for Pickleball Bay Area, deployed via GitHub Pages / Firebase Hosting.
It's a git repo on branch main. This is READ-ONLY: produce a report, do not
edit or delete any file.

SCOPE: root-level markdown docs (DESIGN.md, FIREBASE_SETUP.md,
GOOGLE_RATINGS_SETUP.md, SEARCH_CONSOLE_SETUP.md, improvement-plan.md,
nav-search-google-links-plan.md, parallel-prompts-filters-and-legend.md);
the "Site Header" folder; firebase.json, firestore.rules, .firebaserc,
assets/firebase-config.js; robots.txt, sitemap.xml; scripts/ folder.

CONTEXT ALREADY CONFIRMED (verify it yourself, don't take it on faith):
- The "Site Header" folder (note the space in its name — unusual for this
  repo's otherwise lowercase-hyphenated file naming) is fully git-tracked
  (8 files: README.md, header-snippet.html, several favicon/icon PNGs and
  SVGs) but a repo-wide grep for "Site Header" and "header-snippet" across
  every *.html/*.js/*.css file returns zero matches — nothing on the live
  site references it. Confirm this yourself (don't just trust the summary),
  read Site Header/README.md for what it claims to be, and figure out
  whether it's a superseded deliverable (the live favicons are already at
  assets/logo/) that's safe to remove, or something intentionally kept for
  another purpose (e.g. a designer handoff archive) — check its README's
  own text for a stated purpose before recommending removal.
- assets/firebase-config.js IS actively used (by court-ratings.js and
  paddle-quiz.js), so firebase.json/firestore.rules/.firebaserc are wired
  to live features, not dead weight — don't recommend removing those
  without verifying that claim is wrong first.

WHAT TO PRODUCE — write audit/repo-hygiene.md covering:

1. For each root .md doc: read it and classify as (a) still-accurate
   reference documentation someone would need to maintain the site
   (b) a one-time setup guide for something already done and unlikely to
   be redone (candidate to archive/delete once the setup is confirmed
   complete) (c) a planning/proposal doc whose plan has since been fully
   implemented (check git log / the live site to confirm — candidate for
   deletion or a one-line "implemented, see X" stub) (d) a planning doc for
   work NOT yet done (keep). Give a specific verdict per file, not a
   generic "docs should be reviewed."
2. The "Site Header" folder: verdict per the context above, with your own
   verification shown (grep commands run, results).
3. Whether firestore.rules' actual rules match what court-ratings.js and
   paddle-quiz.js need (read both JS files' Firestore calls and cross-check
   against the rules file) — flag anything the rules allow that nothing in
   the code uses (overly permissive/stale rule) as a separate, security-
   relevant finding.
4. scripts/ currently holds one file (fetch-google-ratings.mjs). Confirm
   whether it's runnable as-is (does it need a package.json/dependencies
   that don't exist in this repo?) and whether it's still part of any
   real workflow, or orphaned.
5. Any other top-level cruft you notice while doing this pass (e.g. .DS_Store
   files — check if they're gitignored, stray build artifacts, anything
   not covered above) — call it out even if not explicitly assigned, but
   keep this section short and clearly secondary to items 1-4.

Cite exact file names and line numbers/grep evidence for every claim. Do not
recommend deleting anything without first showing the verification you did.
```
