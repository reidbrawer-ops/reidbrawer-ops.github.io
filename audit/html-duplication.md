# HTML boilerplate & templating audit

Scope as requested: 12 root pages + `cities/index.html` + city pages under
`cities/*.html`. **Correction to the brief:** the actual count is **30 files,
not 31** — there are **17** individual city pages, not 18 (berkeley,
cupertino, fremont, menlo-park, mountain-view, novato, oakland, palo-alto,
pleasanton, redwood-city, san-francisco, san-jose, san-mateo, san-rafael,
santa-clara, sunnyvale, walnut-creek), plus `cities/index.html`. Verified via
`ls cities/*.html | wc -l` → 18 total files in that directory including
`index.html`, and cross-checked against `sitemap.xml`, which lists exactly
17 `cities/<slug>` URLs. All numbers below are computed over these 30 files.

Every finding below was produced by scripted extraction/diffing of the
actual file contents (not eyeballing), so the counts are exact, not
estimates.

---

## 1. Exact measure of the duplication

### `<head>…</head>`

Using `index.html`'s head as the reference, the lines that are **byte-for-byte
identical on every page that has them** (i.e. excluding title, meta
description, og:title/description/url, twitter:title/description, and
canonical, which are legitimately per-page):

```
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="icon" href="/assets/logo/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/assets/logo/favicon-32.png" sizes="32x32" type="image/png">
<link rel="icon" href="/assets/logo/favicon-16.png" sizes="16x16" type="image/png">
<link rel="apple-touch-icon" href="/assets/logo/apple-touch-icon-180.png">
<meta name="theme-color" content="#ffffff">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Pickleball Bay Area">
<meta name="twitter:card" content="summary">
<link rel="stylesheet" href="/assets/style.css">
```

That's **14 identical lines** (index.html head, lines 4–5, 8–17, 21, 25). 29
of the 30 files carry all 14 (`about.html:1-26`, `gear.html:1-26`, etc. —
verified by diff, not just eyeball). The 30th, `404.html:1-18`, is
intentionally shorter — it skips the entire og:/twitter: block and adds one
line (`<meta name="robots" content="noindex">`, `404.html:8`), so it only
carries **11** of the 14 (misses `og:type`, `og:site_name`, `twitter:card`).

**Total: 14×29 + 11×1 = 417 line-instances of byte-identical `<head>`
boilerplate across the site**, on top of which every page independently
retypes the same 4 favicon `<link>` tags, the same Google Fonts URL, and the
same theme-color meta.

By byte size: `index.html`'s full `<head>…</head>` block (a "standard" page,
`index.html:3-26`) is **1,979 bytes** / 26 lines, of which only 8 lines
(title, description, og:title/description/url, twitter:title/description,
canonical) are genuinely page-specific.

### `<header class="site-header">…</header>`

This one is even more uniform. Every one of the 30 files has a **23-line**
header block (e.g. `index.html:29-51`, `404.html:21-43`, all 17 city pages
at line 29-51) — confirmed identical line-length across every file, no
exceptions.

Position-by-position diff against `index.html`'s header: **630 of 690 total
header lines (91%) are byte-identical**; the other 60 differ *only* because
of where `aria-current="page"` is (or isn't) attached. Concretely:

- Pages that are a direct top-level nav item (Home, Cities, Map, Directory,
  Rankings, About) get `aria-current="page"` on exactly one `<a>`.
- Pages reached through the "More" `<details>` dropdown
  (corrections/gear/learn/paddle-quiz/visiting) get it on the nested `<a>`
  **and, inconsistently, sometimes also on `<summary>`** — see the bug in
  §3 below.
- `404.html` and `privacy.html` carry no `aria-current` at all (neither is a
  main-nav item; `privacy.html` is footer-only, see §5).

**Total: 690 header lines across the site, 22-23 of the 23 identical on any
given page** — i.e. essentially the entire header is a single canonical
block with one attribute that moves.

### `<footer class="site-footer">…</footer>`

Every file has a **45-line** footer block (`index.html:178-222`,
`cities/berkeley.html:218-262`, etc. — confirmed identical length across all
30). Position-by-position diff against `index.html`'s footer:
**1,337 of 1,350 total footer lines (99%) are byte-identical**. The only 13
differing lines, across 7 files:

- `gear.html:378`, `paddle-quiz.html:111`, `rankings.html:142` — the
  `.footer-note` tagline swaps to a page-relevant sentence (e.g.
  `paddle-quiz.html`: "486 paddles scored, July 2026." vs. the default
  "Court info verified against city rec department pages, July 2026.").
- `cities/oakland.html:~250`, `cities/palo-alto.html`,
  `cities/san-francisco.html`, `cities/san-jose.html` — the "Popular" list
  in the footer excludes whichever city is currently being viewed and swaps
  in a substitute (e.g. `cities/oakland.html` drops Oakland from its own
  footer's "Popular" list and adds Mountain View). The other 13 city pages
  aren't themselves in the default Popular-4 list, so their footers are
  100% identical to `index.html`'s.

**Total: 1,350 footer lines across the site, only 13 (<1%) are legitimately
page-specific.**

### Combined

`index.html`'s head+header+footer blocks together are **4,573 bytes**. Since
that boilerplate is >99% identical on every page, roughly **~137KB of the
site's total HTML weight is the same markup typed out 30 times** — before
counting per-page body content at all. If you also count the closing
`<script src="...">` include block (see §2 — the 8-line block loaded by all
17 city pages is byte-identical across all of them, e.g. `cities/berkeley.html:264-271`
vs. `cities/walnut-creek.html:220-227`), the truly page-type-generic portion
is larger still.

---

## 2. Where per-page differences actually are

Confirmed by direct extraction: every page's `<title>`, `<meta
name="description">`, `og:title`/`og:description`/`og:url`,
`twitter:title`/`twitter:description`, and `<link rel="canonical">` are
unique and correctly match the page's clean URL (e.g.
`cities/palo-alto.html` canonical is `https://pickleball-bay-area.com/cities/palo-alto`,
`index.html` canonical is the bare `https://pickleball-bay-area.com/`). No
copy-paste canonical mistakes found anywhere in the 30 files. `aria-current`
placement is the only per-page difference inside `<header>`.

**Pages loading CSS beyond the shared `assets/style.css`** (any
consolidation approach must preserve these):

| Page | Extra CSS | Line |
|---|---|---|
| `directory.html` | `<link rel="stylesheet" href="/assets/directory.css">` | `directory.html:27` |
| `map.html` | external Leaflet CSS (`unpkg.com/leaflet@1.9.4/dist/leaflet.css`) **and** `/assets/map.css` | `map.html:27-28` |
| `paddle-quiz.html` | `<link rel="stylesheet" href="/assets/paddle-quiz.css">` | `paddle-quiz.html:26` |
| `rankings.html` | `<link rel="stylesheet" href="/assets/rankings.css">` | `rankings.html:26` |
| `corrections.html` | a **121-line inline `<style>` block** (not a linked file) | `corrections.html:26-146` (the `<style>…</style>` element itself spans that range inside the head, pushing that file's head to 147 lines total) |

Note `corrections.html` breaks the pattern `DESIGN.md` documents for itself:
DESIGN.md's "File layout" convention (`DESIGN.md:141-148`) says page-specific
CSS gets its own `<page>.css` file layered on `style.css`, matching what
`directory.css`/`map.css`/`paddle-quiz.css`/`rankings.css` actually do. The
corrections form styles are the one exception — hand-inlined in the head
instead of extracted to `corrections.css`. Minor, but worth fixing
independent of the larger templating decision (low effort, restores
consistency with the site's own documented convention).

One more CSS file, `assets/global-search.css`, exists but is **linked by
zero pages** in `<head>` — it's injected at runtime by JS
(`assets/global-search.js:21-24`, `document.createElement('link')`), not
declared statically. Not a duplication problem, just worth knowing before
designing any partial/template system that assumes "all CSS is in
`<head>`."

**Pages loading JS beyond the shared `nav.js`/`global-search.js`/`analytics.js`
trio** (every page loads exactly those three — confirmed by grep across all
30 files):

| Page(s) | Extra JS |
|---|---|
| `index.html`, `cities/index.html` | `regions.js`, `city-tags.js` |
| `directory.html` | `court-ratings.js` (module), `rating-widgets.js`, `google-ratings.js`, `regions.js`, `top-picks.js`, `directory.js` |
| `rankings.html` | `court-ratings.js` (module), `rating-widgets.js`, `google-ratings.js`, `regions.js`, `rankings.js` |
| `map.html` | external Leaflet JS, `court-ratings.js` (module), `google-ratings.js`, `top-picks.js`, `map.js` |
| `paddle-quiz.html` | `paddle-quiz.js` (module) |
| `corrections.html` | one 5-line inline `<script>` (`corrections.html:334-339`) toggling a "thanks" message from a `?sent=1` query param — no dedicated `corrections.js` file |
| all 17 `cities/*.html` pages | identical 5-script block: `court-ratings.js` (module), `rating-widgets.js`, `google-ratings.js`, `top-picks.js`, `city-top-pick.js` — **byte-identical across all 17**, e.g. `cities/berkeley.html:264-271` vs. `cities/walnut-creek.html:220-227` |
| `about.html`, `gear.html`, `learn.html`, `privacy.html`, `visiting.html`, `404.html` | none — only the shared trio |

The 17 city pages also each carry one `<script type="application/ld+json">`
block (structured data) — that's legitimate per-page content, not
boilerplate, addressed in §4.

---

## 3. A real bug caused by this duplication (found, not hypothetical)

Comparing the "More"-dropdown pages line-by-line surfaced an actual
inconsistency, not just a theoretical maintenance risk:

- `corrections.html:160`: `<summary aria-current="page">More</summary>`
- `gear.html:39`: `<summary aria-current="page">More</summary>`
- `learn.html:39`: `<summary aria-current="page">More</summary>`
- `visiting.html:39`: `<summary aria-current="page">More</summary>`
- `paddle-quiz.html:40`: `<summary>More</summary>` — **missing `aria-current="page"`**,
  even though `paddle-quiz.html:44` correctly sets it on the nested
  `<a href="/paddle-quiz">`.

So on four of the five dropdown pages, a screen reader announces the "More"
trigger itself as the current page; on `paddle-quiz.html` it doesn't. This
is exactly the class of drift that hand-duplicated markup produces — 30
independent copies of the same block, one already out of sync. It's a
one-line fix regardless of which consolidation approach (or non-approach) is
chosen; flagging it here as a concrete example rather than recommending a
fix, since this audit is read-only.

---

## 4. Body-content near-duplication across the 17 city pages

Beyond head/header/footer, the city pages are near-duplicates of each other
in structure, and the evidence suggests they're close enough to the
underlying data (`assets/courts-data.json`) that a template could plausibly
generate most of them.

**What's identical in shape across every city page:**
- The `.page-hero` block: `eyebrow` (region link) → `h1` (city name) →
  `lede` paragraph → `.stat-strip` chips. Same 4-element skeleton in
  `cities/palo-alto.html:52-61` and `cities/san-jose.html:52-61` alike.
- The `<section class="section"><div class="container"><h2>Where to
  play</h2><div class="venue-list">` wrapper, identical across all 17
  (e.g. `cities/palo-alto.html:64-67`, `cities/san-jose.html:65-68`).
- Each `.venue-card` inside: `id`/`data-court-id`, `<h3>` name (sometimes
  wrapped in `.name-row` alongside a `.level-badge`), `.addr-row` with a
  Google Maps directions link, a `.facts` stat-chip row, an optional
  `.rating-row` (Surface/Level/Weather/Wait pills), a prose `<p>`, an
  optional `.book-btn` reservation link, and a `.vote-actions` block
  (rating summary + favorite button) — same skeleton in every file, only
  the presence/absence of the optional pieces and the text content differs.
- The closing 8-line script include block (§2) is byte-identical across
  all 17, and the JSON-LD block (single `SportsActivityLocation` object for
  single-venue cities like `cities/palo-alto.html:146-159`, or a
  `@graph` array with one entry per venue for multi-venue cities like
  `cities/san-francisco.html:365-…`) follows one of exactly two
  mechanical shapes.

**Evidence this is genuinely data-backed, not just visually similar:**
Cross-checking rendered venue-cards against `assets/courts-data.json` (83
records) shows the two agree field-for-field, and — more tellingly — the
*conditional* markup tracks the data's own "not specified" sentinel.
Example: `assets/courts-data.json`'s `mitchell-park` record has
`"skill": "Not specified"`, `"waitTime": "Not specified"`, `"weather": "Not
specified"` — and correspondingly, `cities/palo-alto.html`'s Mitchell Park
card has **no `.rating-row` block at all**. The `paul-moore-park` record
(`assets/courts-data.json`) has real values for all four rating fields, and
`cities/san-jose.html`'s Paul Moore Park card **does** render a
`.rating-row`. Same correlation holds for `.book-btn` (present only when
`bookingUrl` is non-null) and courts count / hours / price stat-chips
(direct 1:1 text match to the JSON). This isn't coincidence — the HTML was
clearly composed *from* this data, by hand, once each.

**What genuinely isn't in the data yet, and would block full
auto-generation:** the free-text description paragraph inside each
`.venue-card`, the "Sources:" citation line, the `.know-list` local-tips
bullets, and the JSON-LD `description` field are all hand-written prose
with no corresponding field in `courts-data.json`. The Google Maps
directions link is sometimes a long place-specific URL
(`cities/palo-alto.html:70`, with a Place ID) and sometimes a generic
`google.com/maps/search/?api=1&query=...` URL (`cities/san-jose.html:71`) —
also not derivable from the current JSON schema (`address` is there, but
not a canonical directions URL).

**Verdict:** the 17 city pages are structurally template-ready today (same
skeleton, optional blocks driven by real data-presence checks, not
arbitrary), but not *content*-ready — you'd need to extend
`courts-data.json` with a `description`, `sources`, `knowList`, and
`directionsUrl` field per venue before a generator could fully replace
hand-authoring. That's real migration work, not a rewrite of working
prose — the existing text could be copied into the new fields mechanically.
Given 17 pages × ~2-5 venues each, this is worth doing, but it's phase-2
work relative to the head/header/footer fix (§6), not a prerequisite for it.

---

## 5. Orphaned pages

None found. Checked every one of the 30 in-scope pages' clean-URL path
(`href="/about"`, `href="/cities/oakland"`, etc.) against every `.html`
file and `sitemap.xml`:

- All 11 non-404 root pages (`/`, `/about`, `/corrections`, `/directory`,
  `/gear`, `/learn`, `/map`, `/paddle-quiz`, `/privacy`, `/rankings`,
  `/visiting`) appear in both `sitemap.xml` and the site nav/footer, with
  30–103 inbound `href` occurrences each across the corpus.
- `/cities/` and all 17 `/cities/<slug>` URLs appear in `sitemap.xml`. Every
  slug has at least one inbound link from somewhere in the HTML (the
  low-traffic-looking cities — berkeley, cupertino, fremont, novato,
  pleasanton, redwood-city, santa-clara, sunnyvale, walnut-creek — each
  have exactly 1 inbound `href`, which is `cities/index.html`'s own city
  grid; that's expected, not orphaning).
- `privacy.html` has **no `aria-current` and no header-nav entry** (it's not
  one of the 5 main-nav links or the 5 dropdown links), but it *is* linked
  from every page's footer (`index.html:198`, the "Site" column) — so it's
  reachable, just footer-only, which is a normal and common pattern for a
  privacy policy. Not orphaned, just not top-nav-visible; not a defect.
- `404.html` is (correctly) absent from `sitemap.xml`, nav, and footer —
  by design it isn't meant to be linked. It's served by both GitHub Pages'
  and Firebase Hosting's built-in "serve `/404.html` for unmatched paths"
  convention; `firebase.json` needs no explicit rewrite entry for this to
  work (verified: `firebase.json` has no `404`/`rewrites` key at all, which
  is correct — the convention is automatic).

No dead/unreferenced HTML pages exist in the 30-file scope of this audit.
(The separately-flagged `Site Header/` folder outside this scope — see
`consolidation-audit-prompts.md:283-304` — is a different question, assigned
to the repo-hygiene audit, not this one.)

---

## 6. De-duplication options and recommendation

### Constraint check: is "no build step" actually deliberate here?

No root `.md` file states an explicit rationale for it. `DESIGN.md` documents
the CSS/component system in detail but says nothing about tooling or build
process. The "no build step, no framework, no templating" framing appears
only in the audit brief itself (`consolidation-audit-prompts.md:38`), not in
any of this repo's own documentation — so it reads as an *inherited default*
("it's a flat static site because that's how it started"), not a
considered, written-down constraint. That matters for the recommendation
below: there's no documented cost anyone is protecting by keeping it
build-free, but there is a real, load-bearing reason to keep the *output*
flat HTML — see the SEO point next.

Two facts do argue for keeping the **shipped artifact** flat static HTML
(not necessarily the *authoring* format):

1. **This site is actively fighting to get indexed.**
   `SEARCH_CONSOLE_SETUP.md:1-4` states outright: "This site currently isn't
   indexed anywhere... and has no traffic measurement." `sitemap.xml` gives
   `/cities/` a 0.9 priority and every city page 0.8 — this is a
   content/SEO-driven directory whose entire value proposition depends on
   being crawled and indexed correctly. Anything that makes header/footer
   nav links, or the page content itself, dependent on a client-side
   `fetch()` completing adds risk at exactly the wrong moment for a
   pre-launch site: modern Googlebot does execute JS, but non-JS crawlers
   (many social-preview scrapers, some AI/agent crawlers, Bing's non-JS
   pass) would see a page missing its nav entirely until a second render
   pass, if one happens at all.
2. **Node is already part of this project's toolchain**, just not for the
   website itself. `scripts/fetch-google-ratings.mjs:10` says outright
   "Requires Node 18+... **No npm install needed**." That's an existing,
   working precedent for exactly the shape of tool a static-site generator
   here would take: a dependency-free `.mjs` script run manually with plain
   `node`. There's no `package.json` in the repo today, and one isn't
   required to add a build script either.

### Option (a) — tiny Node build script (template literals, no partial-include syntax needed)

**Recommended.** A ~60-100 line `scripts/build.mjs` (dependency-free, same
pattern as the existing ratings script) that:
- Defines the canonical head/header/footer as JS template-literal functions
  taking `{ title, description, canonical, ogUrl, activeNav, extraHead,
  extraScripts }`.
- Has one small per-page manifest (title/description/canonical/active-nav —
  literally the 8 lines already identified in §1 as the genuine per-page
  head content) plus each page's existing `<main>`/body content pulled from
  its current file (or, if going further, from a `partials/<page>.body.html`
  fragment).
- Writes the assembled, fully flat HTML back out to the same 30 files (or
  to a `dist/` if the `firebase.json` `"public"` field
  (`firebase.json:6`, currently `"."`) is changed to point at it — either
  works; writing in place is simpler and keeps `git diff` showing exactly
  what changed on deploy, which matters for a solo maintainer eyeballing
  SEO-tag correctness).
- Runs manually before `firebase deploy` (there's no CI here to hook it
  into automatically — confirmed no `.github/workflows`, no CI config
  anywhere in the repo).

**Tradeoff, honestly stated:** this adds one more manual step to the deploy
checklist (forget to run it, and a head/header/footer edit silently doesn't
propagate — the flip side of today's problem, where forgetting to
propagate a copy-paste edit silently leaves pages out of sync, as already
happened with `paddle-quiz.html`'s `aria-current`, §3). It's a strictly
better failure mode though: a build script's staleness is visible (old
`git diff`, or a "did you rebuild?" habit), where hand-copy drift is
invisible until someone happens to compare two files. Given 690+1350+417 ≈
2,450 line-instances of currently-hand-synced boilerplate, and one already-
found real bug, this is worth the one added step.

### Option (b) — client-side JS injection (fetch partials / `<template>`)

**Not recommended for this site**, specifically because of point 1 above.
Zero build step, but: (1) it makes the header nav — the site's primary
internal-linking structure for/`sitemap.xml`-adjacent crawl discovery —
dependent on a JS fetch completing, which is a bad tradeoff for a directory
site that isn't indexed yet and is actively working on it
(`SEARCH_CONSOLE_SETUP.md`); (2) it introduces a real flash-of-unstyled-
header / layout-shift risk (header injected after first paint, unless
carefully pre-sized, which itself adds complexity back); (3) it adds a
render-blocking or CLS-inducing network round trip per page for content
that's currently free (already inlined, zero-latency). The one place this
pattern *is* already used on this site — `assets/global-search.css` injected
by `global-search.js` (§2) — is for a non-critical, below-the-fold-behavior
enhancement, not primary nav/content, which is the right place for that
tradeoff and the wrong precedent to extend to the header/footer.

### Option (c) — leave as-is, document the copy-paste procedure

Legitimate only if you conclude (a)'s added deploy step is worse than the
current cost — I don't think that holds here, given the real bug already
found in §3 and the sheer duplicated-line count in §1. If you do go this
route anyway, the SOP to document would be: whenever any of the 14 head
lines, 22 header lines (excluding `aria-current`), or 44 footer lines
(excluding the 2 known variable slots) changes, `grep -rl` the changed
string across all 30 files first to find every copy that needs the same
edit, and specifically re-check the "More" dropdown's 5 pages for the
`aria-current` pattern found broken in §3.

---

## Findings ranked by maintenance-cost-saved vs. effort

1. **Head/header/footer templating (§1, §6a)** — highest value. ~2,450
   line-instances of hand-synced boilerplate across 30 files; a ~30-minute
   build script (given the existing `.mjs` precedent) eliminates the whole
   class of drift bugs like the one in #2.
2. **Fix `paddle-quiz.html:40`'s missing `aria-current="page"` on
   `<summary>`** (§3) — trivial, one line, real accessibility bug, fixable
   independent of and before any larger templating decision.
3. **City-page body templating from `courts-data.json` (§4)** — high value
   but higher effort: requires adding `description`/`sources`/`knowList`/
   `directionsUrl` fields to the data file first. Worth doing as a phase 2
   once (1) lands and the team is comfortable with a build step existing at
   all.
4. **Extract `corrections.html`'s inline 121-line `<style>` block to
   `assets/corrections.css`** (§2) — low effort, restores consistency with
   `DESIGN.md`'s own documented file-layout convention (`DESIGN.md:141-148`).
5. **Orphan-page check (§5)** — no action needed; confirmed clean. Worth
   keeping as a regression check (e.g. a one-line assertion in the future
   build script that every page in the manifest has a sitemap entry) rather
   than a one-time fix.
