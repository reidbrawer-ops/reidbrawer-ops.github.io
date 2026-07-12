# Search-first, persona-driven, affiliate-ready — phased work plan

Analysis date: 2026-07-12. Verified against the live code (file reads + grep
counts), not guesses. Repo: `github.com/reidbrawer-ops/reidbrawer-ops.github.io`,
branch `main`, clean working tree. This document is both the **analysis** the
work is based on and the **execution plan**. Each numbered Phase is a
self-contained session: start one by telling an agent *"Do Phase N from
`search-personas-affiliate-plan.md`."*

---

## 0. How to use this document

- **Each Phase = one parallel session.** The seven work phases are scoped to
  disjoint files/regions so they can run at the same time in separate git
  worktrees without racing. A final **Integration** step merges them and
  regenerates shared chrome.
- **Ground rules (same convention this repo already uses — see
  `nav-search-google-links-plan.md`):**
  1. Give each phase its own branch/worktree:
     `git worktree add ../pba-p3 -b p3-find-courts`.
  2. **`assets/style.css` is shared.** A phase either edits *only its own
     component's existing section*, or *appends a new clearly-commented
     section* (`/* ---------- <Phase>: <thing> ---------- */`). Never edit
     another phase's section. This is the same additive-section rule Groups D
     and F used safely before.
  3. **`scripts/build.mjs` is a chokepoint** — it regenerates the `<head>`,
     `<header>`, and `<footer>` of *every* page. Only **Phase 1** edits it.
     After all branches merge, the Integration step runs
     `node scripts/build.mjs` once to normalize chrome across everything.
     Because the build only rewrites the head/header/footer *regions* and
     preserves each page's body verbatim, a body-editing phase and Phase 1
     touching the same file still auto-merge cleanly.
  4. Don't hand-edit nav/header/footer markup in individual pages — change the
     templates in `build.mjs` (Phase 1) instead.
- **The persona model in §2 is the North Star.** Every phase cites which
  persona/workflow it serves. If a step doesn't serve one, cut it.

---

## 1. Current state (what we're working with)

**Content & data**
- 203 venues across 42 cities, five regions. Canonical data:
  `assets/courts-data.json` (full records: name/city/neighborhood/price/skill/
  hours/courts/wait/weather/surface/indoorOutdoor/reservable/`id`/
  `googleMapsUrl`) and `assets/venues.json` (geocoded lat/lon + `id`).
- 486 paddles in `assets/paddles.json`, each with `brand`, `price`, specs,
  `skillLevel`, `paddleType`, and a `vendorUrl`/`vendorSearchBase` — **the raw
  material for affiliate links already exists.**
- `assets/google-ratings.json` is currently `{}` (empty) — the Google-rating
  badge feature is wired but unpopulated (needs a manual Places API run per
  `GOOGLE_RATINGS_SETUP.md`).

**Three overlapping "find a court" surfaces**
- `/map` — Leaflet map, all pins, click → popup with a link to the city page.
- `/directory` — the same 203 venues as a filter/sort table (12 filters).
- `/cities/` — the same venues browsed as per-region city cards.
- Plus 43 SEO-oriented per-city pages (`/cities/berkeley`, etc.) with rich
  hand-written venue cards. **These city pages are the organic-traffic engine
  and must stay.**

**Search today**
- `assets/global-search.js` self-mounts a small search input into `.main-nav`
  on every page, indexes `courts-data.json` + city names, and jumps to a city
  page or venue card. It works, but it's a **112px nav input** — easy to miss,
  never the focal point of any page.

**Site chrome is generated**
- `scripts/build.mjs` owns the `<head>` boilerplate, the `.main-nav` (incl. the
  "More" dropdown), and the `<footer>` (regions list, site list, the hardcoded
  "An independent, unaffiliated directory. No ads, no sponsored listings."
  tagline, and the "All 42 cities" link). Edit once, run the script, all 55
  pages update.

**Two facts that shape the whole plan**
- **The affiliate contradiction.** The site currently states "no affiliate
  links" in at least three high-visibility places — `about.html:71` ("No ads,
  no sponsored placements, no pay-to-list, no affiliate links"),
  `index.html:126` ("no affiliate links on paddles or gear"), and the footer
  tagline on all 55 pages. `privacy.html:77` already softens this ("Some
  outbound links may in the future be affiliate links… it'll be disclosed").
  You cannot apply for affiliate programs while the site promises the
  opposite. Resolving this is a **prerequisite**, not a nice-to-have.
- **The count/trust concern (yours).** Aggregate totals — "203 venues", "486
  paddles", "42 cities", "80+ venues", "15+ verified options", "20+ locations"
  — read as a *golden-source completeness claim*. Because the data is
  hand-maintained and admittedly incomplete ("this is hand-maintained, not a
  database"), those totals *undercut* trust rather than build it. See the
  removal rule in §3.4.

---

## 2. Who is actually looking for a court here? (personas → workflows)

Five real intents bring someone to a Bay Area pickleball site. For each:
what they want, where they hurt today, and the workflow that has to be
effortless. **The last column is the revenue relevance** — the whole point of
production-readiness is to serve these well enough that the paddle-buyers
convert.

### P1 — The Local Regular ("where can I play near me, today?")
- **Who:** Lives in the Bay, plays weekly+. Knows the game.
- **Wants:** Nearest courts *right now*, wait level, indoor option when it's
  foggy/hot, walk-up vs. reservable, directions, is it busy.
- **Pain today:** Has to guess which of Map/Directory/Cities to use; the map
  popup is thin (address + a link); no "search my city and see its courts."
- **Ideal workflow:** Type "Berkeley pickleball" → map recenters on Berkeley,
  its courts listed beside the map, click one → detail card with hours, wait,
  surface, directions, book link. **This is the Google-Maps mental model in
  your brief.** → *Phase 3, Phase 2.*
- **Revenue:** Indirect (traffic/SEO/retention), but the largest audience.

### P2 — The Curious Beginner ("I want to try pickleball")
- **Who:** Never played, or 1–2 times. Often no paddle.
- **Wants:** How the game works, a *beginner-friendly* nearby court, and the
  cheapest no-commitment way to get a paddle (rental first, then a first buy).
- **Pain today:** "Learn," "Gear," and "Find your paddle" are three separate
  dropdown items; the beginner has to assemble the journey themselves.
- **Ideal workflow:** Learn the basics → find a beginner court (skill filter) →
  rent or buy a first paddle in one consolidated place. → *Phase 5, Phase 4.*
- **Revenue:** **Direct.** First-paddle purchase = affiliate conversion.

### P3 — The Upgrader ("I need a better paddle") — the money persona
- **Who:** Plays regularly, has a paddle, wants the right *next* one for their
  style and budget. 486 paddles = paralysis.
- **Wants:** A trustworthy, unbiased recommendation matched to their game, at
  their budget, with a clear place to buy.
- **Pain today:** The quiz exists and is good, but its output links to a
  vendor *homepage/search*, not a specific buyable product; and "Gear" (where
  to buy) is a different page from the quiz (what to buy).
- **Ideal workflow:** Quiz → top 3 matches → buy each with one click
  (affiliate), with an honest disclosure. → *Phase 5.*
- **Revenue:** **Primary.** This is where affiliate income concentrates.

### P4 — The Visitor / Traveler ("I'm in town for a few days")
- **Who:** Business traveler, tournament visitor, relocating.
- **Wants:** Courts near a hotel/neighborhood, and a paddle rental.
- **Pain today:** Served by the standalone `/visiting` page — **which you're
  removing.** Its actual value (find courts near *a place*, and rent a paddle)
  must be **absorbed by search + the gear/rentals hub**, not lost. Search
  already matches neighborhoods; the Find-courts hub answers "near X." →
  *Phase 3 (search-by-place), Phase 5 (rentals), Phase 1 (remove the page).*
- **Revenue:** Direct (rental → sometimes a buy).

### P5 — The Organizer ("where do we take the group / league")
- **Who:** Planning play for a group, meetup, or league.
- **Wants:** Court *count*, reservability, amenities, indoor capacity — the
  power-filter view.
- **Pain today:** Directory does this well but is buried as a peer of Map with
  no obvious "this is the filter view" framing.
- **Ideal workflow:** Filter by courts/reservable/indoor → shortlist → city
  page for detail. → *Phase 6 (directory as the explicit power-filter view).*
- **Revenue:** Indirect.

### Workflow → feature map (the core journeys we must make effortless)
| Journey | Entry | Must-haves | Owner phase |
|---|---|---|---|
| Find a court near a place | Search / map | Recenter map on city, list its courts, detail card | P3, P2 |
| Play as a beginner | Learn → court → paddle | Skill filter + one gear/paddle path | P5, P4, P6 |
| Buy the right paddle | Quiz | Specific buyable (affiliate) picks + disclosure | P5 |
| Rent a paddle (visitor/beginner) | Gear hub | Rentals by region, reachable from search | P5 |
| Plan for a group | Directory | Power filters, framed as "filter view" | P6 |

---

## 3. Strategic decisions (answers to your direct questions)

### 3.1 Make search the primary way to find a court (P1, P4)
Adopt the Google-Maps interaction as the site's spine:
- **Prominent search** in the hero of Home, the Cities index, and the
  Find-courts hub — not just the nav pill. The nav pill stays on every page as
  the always-available fallback (see §3.5 for where big search belongs).
- **Search recenters the map.** Searching "Berkeley" (or "Berkeley
  pickleball") focuses the map on Berkeley and shows *only/first* its courts,
  with a results list beside the map.
- **Desktop detail side-card.** Clicking a court (pin or list row) opens a side
  card: name, address, hours, surface, wait, indoor/outdoor, community +
  Google rating, directions, and book link — the "reviews, hours, directions"
  stack from your brief. On mobile this becomes a bottom sheet / full-width
  card. → *Phase 3, consuming the search component from Phase 2.*

### 3.2 Should Cities and Maps be consolidated? — **Yes, partially.**
Three surfaces show the same 203 venues; that's the redundancy to fix — but
they are *not* equally valuable:
- **Keep the 43 per-city pages** (`/cities/berkeley` …). They rank for
  "pickleball in <city>," pull the organic traffic that feeds paddle affiliate
  revenue, and hold the hand-written depth. Untouched by consolidation.
- **Merge Map + search into one "Find courts" hub** (evolve `/map`). This is
  the primary P1/P4 surface: search + map + results list + detail card.
- **Demote Directory to the explicit "filter / list view"** of that same data
  (P5 organizer view), cross-linked from the hub via a view toggle — not a
  co-equal nav destination competing with the map.
- **Slim the Cities *index*** (`/cities/`) to a lightweight browse-by-region
  index of links to city pages; stop it from being a third venue-listing UI.

Net: **one** primary find-a-court experience (map + search + list), city pages
for depth/SEO, directory as its power-filter mode. → *Phases 3 + 6.*
*(Confirm the nav shape in §6 before Phase 1 finalizes the menu.)*

### 3.3 Consolidate Gear + Paddle Quiz into one revenue funnel (P2, P3)
Today "Find your paddle" (what to buy) and "Gear & rentals" (where to
buy/rent) are separate dropdown items that already cross-link. Merge them into
a single **Paddles & Gear** hub with a clear funnel:
**Rent (try it) → Quiz (what fits) → Buy (affiliate picks).**
This co-locates the entire monetizable journey and is where affiliate links
live. → *Phase 5.*

### 3.4 Count-removal rule (trust)
Apply this rule everywhere, per owning phase:
- **REMOVE** aggregate totals that imply completeness/authority: site-wide
  venue/city/region counts ("203 venues", "42 cities", "5 regions" stat
  strips), total paddle counts ("486 paddles", "out of 486"), "80+ venues",
  "15+ verified options", "20+ locations", "All 42 cities" (→ "All cities"),
  "203 courts to rate", "42 city leaderboards", and any "all N" phrasing.
- **KEEP** specific, checkable, per-venue facts: a named court's court count
  ("4 dedicated courts at Cedar Rose Park"), a park's hours, a shop's price
  range. These are evidence, not completeness claims.
- **Rephrase, don't blank:** replace a count chip with a qualitative descriptor
  ("Dedicated + shared courts," "Every region," "Updated Jul 2026") so heroes
  don't collapse.

### 3.5 Where prominent search belongs (and where the nav pill is enough)
- **Big hero search:** Home, Cities index, Find-courts hub. (P1/P4 entry points.)
- **Nav pill only (no hero search):** Learn, About, Privacy, Corrections,
  Rankings, Paddle-quiz results, per-city pages, Gear. A giant search box on a
  "how to play" article or a checkout-like quiz result is noise.
- Every page keeps the nav search as the constant fallback.

### 3.6 Affiliate readiness = a trust *repositioning*, not just links (P3)
This is the crux of "production-ready for affiliate paddle links." Adding links
while the site says "no affiliate links" would be both self-contradictory and,
post-launch, false. The repositioning that *preserves* trust:
- **Firewall the court data.** Courts, cities, rankings, and directory stay
  independent and unmonetized — no affiliate links, no sponsored ordering.
  That independence is what makes the site credible; protect it explicitly.
- **Monetize only paddles/gear, with disclosure.** Paddle picks and gear links
  may earn a commission; say so plainly at the point of each link (FTC-style),
  and on a dedicated disclosure page.
- **Rewrite the three "no affiliate" claims** (`about.html:71`,
  `index.html:126`, the `build.mjs` footer tagline) to the new stance: e.g.
  "No ads, no pay-to-list, and no sponsorship influences our court data. Some
  paddle & gear links are affiliate links — details." Keep "no ads / no
  pay-to-list / independent court data"; drop the blanket "no affiliate links."
- **Mechanics:** every affiliate link `rel="sponsored nofollow"
  target="_blank"`; update `privacy.html` (cookies/affiliate; the groundwork is
  already at `:77`); add `/affiliate-disclosure`. → *Phases 5 + 7.*

---

## 4. The phases

Each phase lists **Serves / Owns / Do / Don't-touch / Done-when.** "Owns" =
files it may write. "Don't touch" prevents cross-phase collisions.

### Phase 1 — Remove "Visiting the Bay" + nav / footer / trust chrome
- **Serves:** All personas (site-wide chrome); unblocks §3.6 and the Visiting
  removal.
- **Owns:** `scripts/build.mjs`; deletes `visiting.html`; is the **only** phase
  that edits `build.mjs`.
- **Do:**
  1. In `build.mjs`, remove the `/visiting` entry from `DROPDOWN_ITEMS` (line
     ~59) and the `<li><a href="/visiting">` from the footer template (line
     ~159). Remove `'visiting.html'` from `ROOT_PAGES` (line ~29).
  2. Change the footer "All 42 cities" link text (line ~152) → "All cities".
  3. Rewrite the hardcoded footer trust tagline (line ~172) to the affiliate-
     honest version agreed in §3.6 (coordinate exact wording with Phase 7 so
     footer + About + disclosure page all say the same thing).
  4. Apply the **confirmed nav** (§6): `NAV_ITEMS` = Find courts (`/map`,
     labeled "Find courts") · Cities · Directory · Rankings · Paddles & Gear
     (`/paddles`); `DROPDOWN_ITEMS` (More) = Learn to play · Report a
     correction; About stays as the trailing link. Remove the separate
     `/gear` and `/paddle-quiz` dropdown entries (folded into `/paddles`).
  5. Add `'paddles.html'` to `ROOT_PAGES` and add the `/gear`→`/paddles` and
     `/paddle-quiz`→`/paddles` **301 redirects** to `firebase.json`
     (coordinate the new page's existence with Phase 5).
  6. `rm visiting.html`. Leave `sitemap.xml`/`robots.txt` edits to Phase 7.
  7. Run `node scripts/build.mjs` in this branch to verify it regenerates
     cleanly; the authoritative final run happens at Integration.
- **Don't touch:** page *bodies* (heroes, cards, prose), `style.css`, any
  `assets/*.js`. Only templates in `build.mjs` + the file deletion.
- **Done-when:** `--check` passes; no page renders a Visiting link in nav or
  footer; footer says "All cities" and the new trust tagline.

### Phase 2 — Search component: prominence + map-focus behavior
- **Serves:** P1, P4 (and everyone via the nav).
- **Owns:** `assets/global-search.js`; the existing
  `/* Sitewide global search */` section of `style.css` **plus a new
  `/* Phase 2: hero search */` section**.
- **Do:**
  1. Upgrade `global-search.js` into a reusable component that can mount both
     as the compact **nav pill** (current behavior) and as a large **hero
     search** on an element like `<div class="hero-search"
     data-search-scope="courts">`. Keep the self-mounting nav behavior intact.
  2. Add a **"focus the map" integration contract** the Find-courts hub (Phase
     3) consumes: on selecting a city result, either navigate to
     `/map?city=<slug>` (or dispatch a `pbsearch:select` event carrying
     `{type, city, id}`) so Phase 3 can recenter. Define this event/URL param
     once here; Phase 3 implements the listener. **Publish the contract at the
     top of `global-search.js` as a comment** so Phase 3 can build against it.
  3. Improve results: show city results *and* their top courts; keyboard nav
     already exists — keep it.
  4. Style the hero search (new CSS section) at ~2–3× the nav pill; responsive
     at 640/560px.
- **Don't touch:** page bodies (Phases 3/4/6 add the mount points),
  `build.mjs`, `map.js`. Provide the mount-point markup as a snippet in this
  phase's notes for the page phases to paste.
- **Done-when:** the same component renders compact-in-nav and large-in-hero;
  selecting a city emits the documented event / navigates with `?city=`;
  nothing regresses on pages that only have the nav pill.

### Phase 3 — "Find courts" hub: search + map + results list + detail card
- **Serves:** P1, P4. **This is the headline feature.**
- **Owns:** `map.html` (body), `assets/map.js`, `assets/map.css`.
- **Do:**
  1. Restructure `map.html` into the hub layout: prominent hero search
     (mount from Phase 2) → a two-pane body: **results list** (left/aside) +
     **map** (right), with a **desktop detail side-card** and a mobile bottom
     sheet.
  2. In `map.js`, read `?city=<slug>` (and the `pbsearch:select` event from
     Phase 2). On a city selection: `fitBounds` to that city's courts, filter
     the results list to that city, and surface a "showing courts in <City> ·
     clear" affordance.
  3. Build the **detail side-card**: name, address, hours, surface, wait,
     indoor/outdoor, community rating (reuse `court-ratings.js`/rating widgets)
     + Google badge (`google-ratings.js`), **Directions** (reuse the verified
     `googleMapsUrl` in `courts-data.json`), and Book link where present. Join
     `venues.json` (coords) with `courts-data.json` (rich fields) by `id`.
  4. Add a **view toggle** to the Directory (list/filter) — coordinate the link
     target with Phase 6.
  5. Apply the §3.4 count rule to this page ("203 venues / 42 cities / 5
     regions" stat strip and "All 203 venues…" caveat prose).
- **Don't touch:** `global-search.js` (consume it), `directory.*`, `build.mjs`,
  `style.css` global sections (use `map.css`).
- **Done-when:** searching a city recenters the map to that city's courts,
  the list shows them, and clicking one opens a detail card with hours/
  directions/ratings on desktop and a bottom sheet on mobile; no aggregate
  counts remain.

### Phase 4 — Home page: persona-first, search-first, de-counted
- **Serves:** P1, P2, P3 (routing them to the right journey fast).
- **Owns:** `index.html` (body only); may append a
  `/* Phase 4: home lanes */` section to `style.css` if needed.
- **Do:**
  1. Add a **prominent hero search** (Phase 2 mount) as the primary action —
     "Find a court" is the #1 job.
  2. Reframe the page around the three persona lanes: **Find a court** (search/
     map) · **New to pickleball** (Learn → beginner court → rent) · **Find your
     paddle** (quiz → buy). Replace the current mixed "More ways to use this
     guide" grid accordingly.
  3. **Remove the "Just visiting the Bay?" region-card** (`index.html:165-169`)
     and its `/visiting` link.
  4. **Rewrite `index.html:126`** ("no affiliate links on paddles or gear") to
     the §3.6 stance (coordinate wording with Phase 7).
  5. Apply §3.4: remove the hero stat-strip counts ("42 cities / 80+ venues /
     5 regions"), the "See all 42 cities →" count, and "All 203 venues" in the
     map card.
- **Don't touch:** nav/footer (Phase 1), `global-search.js` (Phase 2),
  other pages.
- **Done-when:** home leads with search, presents the three persona lanes, has
  no Visiting card, no "no affiliate links" claim, and no aggregate counts.

### Phase 5 — Paddles & Gear hub + affiliate wiring (revenue engine)
- **Serves:** P2, P3, P4 (rentals). **Primary monetization.**
- **Owns:** `gear.html`, `paddle-quiz.html`, `assets/paddle-quiz.js`,
  `assets/paddle-quiz.css`, `assets/paddles.json`, `scripts/paddle-vendor-map.json`;
  may add `paddles-hub.html`/`gear.css` and a
  `/* Phase 5: affiliate */` CSS section.
- **Do:**
  1. **Consolidate** Gear + Quiz into one funnel (§3.3) at the confirmed
     **`/paddles`** route (§6): Rent → Quiz → Buy. Build `paddles.html`;
     migrate the quiz app + gear/rentals content into it; Phase 1 adds the
     page to `build.mjs` and the `/gear`+`/paddle-quiz`→`/paddles` redirects.
  2. **Brand/DTC affiliate links in quiz results (§6):** in `paddle-quiz.js`
     (`vendorLinkFor`, ~line 205, and the results render ~line 607), output
     specific buy links with `rel="sponsored nofollow" target="_blank"`. Build
     a **pluggable per-vendor affiliate model** in `paddle-vendor-map.json`
     (brand → affiliate base / deep-link template / tracking param), threaded
     through `paddles.json`→`vendorLinkFor`, structured so an Amazon-Associates
     fallback can slot in later without a rewrite. Where no affiliate link
     exists yet, keep the honest plain vendor link.
  3. **Inline disclosure** at each set of buy links ("We may earn a commission
     — [details](/affiliate-disclosure)"), reusing a small shared component/
     class defined with Phase 7.
  4. Keep the **rentals** content (Sports Basement etc.) as the P4/P2 "try it"
     path, reachable from search results too.
  5. Apply §3.4: remove "486 paddles / out of 486 / 15+ verified options /
     5 regions" counts (quiz meta, `gear.html` hero, footer note "486 paddles
     scored").
  6. Preserve the existing Firestore lead-capture behavior; don't regress it.
- **Don't touch:** court/city/map/directory files, `build.mjs`,
  `global-search.js`.
- **Done-when:** one consolidated Paddles & Gear funnel exists; quiz top-picks
  render buyable affiliate links with `rel="sponsored nofollow"` + visible
  disclosure; rentals still present; no paddle counts remain.

### Phase 6 — Cities index + Directory: consolidation & de-counting
- **Serves:** P5 (organizer), P1 (browse), SEO.
- **Owns:** `cities/index.html` (body), `directory.html` (body),
  `assets/directory.js`/`directory.css` as needed; may append a
  `/* Phase 6: cities index */` CSS section.
- **Do:**
  1. **Slim Cities index** to a browse-by-region link index (§3.2): keep the
     per-city cards as navigation, but strip the aggregate framing. Remove the
     hero "42 cities / 203 venues / 5 regions" strip and the per-card count
     chips ("20+ locations", "15+ venues", "31 courts" *as summary chips* — but
     keep genuinely specific ones per §3.4; when in doubt, replace with a
     qualitative descriptor).
  2. **Reframe Directory as the explicit "filter / list view"** of the Find-
     courts data, with a view toggle back to the map hub (coordinate anchor
     with Phase 3). Keep all 12 filters.
  3. Apply §3.4 to `directory.html` hero counts ("203 venues / 42 cities / 5
     regions") and the "all 203 courts" lede.
  4. Do **not** restructure the 43 per-city pages here; their hero chips are
     mostly venue-specific facts (keep). If a per-city hero shows an aggregate
     ("20+ locations"), fix just that chip — but that's optional polish, not
     core.
- **Don't touch:** `map.*` (Phase 3 owns the hub), `build.mjs`,
  `global-search.js`.
- **Done-when:** Cities index reads as a clean browse index without completeness
  counts; Directory is clearly the filter view and links to the map hub; no
  aggregate counts in either hero.

### Phase 7 — Trust copy, disclosure, privacy, SEO & production polish
- **Serves:** P3 (enables affiliate approval) + all (production-readiness).
- **Owns:** `about.html` (body), `privacy.html` (body), new
  `affiliate-disclosure.html`, `sitemap.xml`, `robots.txt`; may append a
  `/* Phase 7: disclosure */` CSS section.
- **Do:**
  1. **Rewrite the About ethos** (`about.html:71`) to the §3.6 stance and
     remove the "Visiting the Bay" card in "Also on this site"
     (`about.html:143`). Own the **canonical wording** of the trust/affiliate
     statement and share it with Phases 1, 4, 5 so footer + home + about +
     disclosure match verbatim.
  2. **Create `/affiliate-disclosure`** (FTC-style, plain-English): court data
     is independent/unmonetized; paddle & gear links may earn a commission;
     how it works; no effect on court rankings. Add it to `build.mjs`'s page
     list *(hand to Phase 1 — the one edit Phase 7 requests in build.mjs, or
     add the new page to `ROOT_PAGES` during Integration)*.
  3. **Update `privacy.html`** from the "may in the future" language
     (`:77`) to the now-live affiliate reality + analytics/cookies.
  4. **SEO/production:** remove `/visiting` from `sitemap.xml:44`, add the new
     disclosure page, verify canonicals/OG on new/changed pages, confirm
     `robots.txt` + 404 are correct, and sanity-check structured data on city
     pages still validates.
  5. Apply §3.4 to `rankings.html` hero ("203 courts to rate / 42 city
     leaderboards") and any residual counts in `about.html`, `learn.html`,
     `404.html`.
- **Don't touch:** `map.*`, `directory.*`, `gear/paddle-quiz`, `index.html`
  body, `global-search.js`. (Phase 7 edits `build.mjs` only if Phase 1 hasn't
  added the disclosure page — coordinate; default is Phase 1/Integration adds
  it.)
- **Done-when:** no page claims "no affiliate links"; a disclosure page exists
  and is linked from paddle/gear links + footer; privacy reflects affiliate +
  analytics; sitemap has no `/visiting` and includes the disclosure page.

---

## 5. File-ownership matrix & run order

| Phase | Primary files (owns) | Shared-file rule | Parallel-safe with |
|---|---|---|---|
| 1 Chrome/Visiting | `scripts/build.mjs`, delete `visiting.html` | only editor of `build.mjs`; regen at Integration | all (regen touches chrome only) |
| 2 Search component | `assets/global-search.js`, search CSS + new hero-search CSS | own CSS sections only | all |
| 3 Find-courts hub | `map.html`, `assets/map.js`, `assets/map.css` | uses `map.css`, consumes P2 contract | all |
| 4 Home | `index.html` (body), optional home CSS section | append-only CSS | all |
| 5 Paddles/Gear/affiliate | `gear.html`, `paddle-quiz.*`, `paddles.json`, `paddle-vendor-map.json`, optional `gear.css` | own CSS/section | all |
| 6 Cities/Directory | `cities/index.html`, `directory.*` | own CSS section | all |
| 7 Trust/SEO/disclosure | `about.html`, `privacy.html`, `affiliate-disclosure.html`, `sitemap.xml`, `robots.txt` | own CSS section | all |

**Cross-phase contracts (nav/route/affiliate now locked in §6):**
- **Nav shape** — settled (§6): Find courts · Cities · Directory · Rankings ·
  Paddles & Gear · More(Learn, Corrections) · About. Phase 1 encodes it;
  Phases 3/5/6 link to `/map` (Find courts) and `/paddles`.
- **Trust/affiliate wording** (§3.6): Phase 7 authors the canonical sentence;
  Phases 1, 4, 5 paste it. Agree it before those phases finalize copy.
- **Search→map contract** (§3.1): Phase 2 defines the `?city=`/event API;
  Phase 3 implements the listener.
- **Disclosure component**: Phase 7 defines the markup/class; Phase 5 reuses it.

**Suggested run order**
1. Kick off **Phases 2, 3, 4, 5, 6, 7 in parallel** worktrees immediately —
   they own disjoint files.
2. Run **Phase 1** in parallel too, but treat it as the **integrator's** branch:
   merge it *last*.
3. **Integration step (one session, after all merges):**
   - Merge all branches.
   - Add the new `affiliate-disclosure.html` (and confirm nav) into
     `build.mjs`'s page lists.
   - Run `node scripts/build.mjs` to normalize head/header/footer everywhere;
     then `node scripts/build.mjs --check` must exit clean.
   - Run `node scripts/check-venue-cards.mjs` if venue markup changed.
   - Preview (`preview_start` → the dev server in `.claude/launch.json`), smoke
     test each persona journey (P1 search→map→card, P3 quiz→affiliate buy,
     P4 home lanes), check console/network for errors.
   - Grep for stragglers: `visiting`, `no affiliate links`, `203`, `486`,
     `42 cities`, `All 42 cities`.
   - Deploy (Firebase Hosting).

---

## 6. Confirmed decisions (locked 2026-07-12)

These were the nav-shaping forks; all three are now decided, so Phases 1 and 5
build to them directly:

1. **Nav shape — CONFIRMED.** Top nav becomes **Find courts** (the map hub,
   renamed from "Map") · **Cities** · **Directory** · **Rankings** ·
   **Paddles & Gear** · **More**(▾: Learn to play, Report a correction) ·
   **About**. "Find your paddle" (quiz) and "Gear & rentals" merge into the
   single **Paddles & Gear** hub; Learn stays under More. → Phase 1 encodes
   this in `NAV_ITEMS`/`DROPDOWN_ITEMS`.
2. **Paddle hub route — CONFIRMED: new `/paddles`.** The merged
   Rent → Quiz → Buy funnel lives at `/paddles`; add `paddles.html` to
   `build.mjs`'s `ROOT_PAGES`; **redirect `/gear` and `/paddle-quiz` → `/paddles`**
   (Firebase Hosting `redirects` in `firebase.json`, 301) and update every
   internal link. → Phase 5 owns the hub; Phase 1 owns the page list + nav.
3. **Affiliate model — CONFIRMED: brand/DTC programs first** (Selkirk, JOOLA,
   etc. — higher commission, per-brand signup, per-vendor deep links). Phase 5
   builds a **pluggable per-vendor affiliate model** in
   `scripts/paddle-vendor-map.json` (brand → affiliate base URL / deep-link
   template / tracking param) and threads it through
   `paddles.json`→`vendorLinkFor`. Design it so an Amazon-Associates fallback
   can be dropped in later for paddles without a brand program, without a
   rewrite. Actual program signups/tags are yours to fill into the vendor map
   before launch.

---

## 7. Explicitly out of scope

- **Populating Google ratings** (`google-ratings.json` is empty) — needs your
  manual Places API run per `GOOGLE_RATINGS_SETUP.md`; the detail card (Phase
  3) degrades gracefully without it, same as today.
- **Fuzzy/typo-tolerant search** — substring match over ~200 venues is enough;
  revisit only if the dataset grows a lot.
- **Restructuring the 43 per-city pages** beyond optional count-chip fixes —
  their depth is the SEO asset; leave the prose alone.
- **A full mobile hamburger nav rebuild** — the existing wrap behavior stays
  unless you opt in separately.
