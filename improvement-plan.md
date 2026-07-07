# Pickleball Bay Area — improvement roadmap & parallel work plan

Analysis date: 2026-07-07. Site as of this writing: 17 city pages, 84 venue entries, 5 regions, static HTML/CSS, no backend, no git repo initialized yet.

## Why these, why now

The site's actual edge over Pickleheads/Places2Play/Google Maps is **editorial honesty** — real research, a real ranking methodology, and a willingness to say "this city is thin" instead of padding the page. That's worth protecting and is not what's being expanded here. What's missing is everything *around* the facts: nobody can find the site (no distribution), and the facts don't map to what each segment is actually trying to do in the next hour (get on a court, not embarrassed, with a partner or paddle if needed).

Top 3 bets if you do nothing else:
1. **Real interactive map** — plot all 84 real venues on an actual map (the site already has real traced bay geometry from this session; venues are the natural next layer).
2. **Structured data / SEO** — the site is currently near-invisible to search. This matters more than any single feature.
3. **Per-region polish pass** — directions links + beginner-friendly badges, using data already on the page. Cheap, no new research, pure upside.

## Segment insights (the "why" behind the chunks below)

- **Travelers**: don't think in city names, think in neighborhoods/proximity. Blocking question is "can I play today without a membership" and "do I need my own paddle," not "which court ranks highest."
- **Locals**: need a reason to come back and a way to find people. Zero social surface area right now. A changelog/"what's new" beats another data field.
- **Beginners**: the fear is social (getting stared down), not logistical. A clinic/no-experience-necessary flag is a promise; "beginner-focused" is a vibe.
- **Advanced players**: thinnest segment currently. Care about DUPR/tournament history, sandbagging reputation, paddle demo/stringing access, wind *character* — none of which is captured today.

---

## Ground rules for running chunks in parallel

**There is no git repo in this project yet.** Two sessions writing to the same file at the same time will silently clobber each other — last write wins, no merge, no warning. Two options:

- **Recommended**: `cd pickleball-bay-area && git init && git add -A && git commit -m "baseline before parallel work"`, then give each session its own worktree (`git worktree add ../pba-chunk-a1 -b chunk-a1`) so they physically can't collide, and merge branches back when done.
- **Minimum viable**: if you skip git, only ever run chunks concurrently if their "Files touched" lists below don't overlap. Never run two chunks that both touch the same file at the same time, even from different tracks.

Every chunk below lists exactly which files it creates or modifies so you can check this at a glance.

---

## Track A — Net-new pages (fully parallel, zero conflict with each other or with anything else)

These create new files only. Safe to run all five at once, in any order, in five different sessions.

### A1. Real interactive map
- **Goal**: Replace the abstract 5-pin hero graphic's job (on a *new* page, don't touch the hero) with a real Leaflet + OpenStreetMap-tiles map plotting all 84 venues at their real coordinates, clickable through to each city page.
- **Steps**: geocode every venue address via the free Nominatim API (`https://nominatim.openstreetmap.org/search?format=json&q=<address>`, max 1 request/sec, set a real User-Agent) → build `assets/venues.json` (name, city, address, lat, lon, url) → build `map.html` using Leaflet (CDN, no API key needed) rendering pins from that JSON.
- **Files touched (new only)**: `map.html`, `assets/venues.json`, `assets/map.js`. Optionally `assets/map.css` (or add scoped styles inside `map.html`).
- **Conflict risk**: none. Does not touch `style.css` or any existing page.
- **Done when**: opening `/map.html` shows all 84 venues as real pins over a real map, each popup links to its city page.

### A2. Beginner's guide / etiquette primer
- **Goal**: A single page answering "I've never played, what do I need to know" in under 2 minutes — scoring basics, paddle-stacking etiquette, what to bring, what "the kitchen" means.
- **Files touched (new only)**: `learn.html`.
- **Conflict risk**: none.
- **Done when**: a total newcomer could read this page and show up to any court on the site without feeling lost.

### A3. Gear & paddle rental directory
- **Goal**: For travelers and beginners without their own equipment — paddle shops, demo/rental programs, stringing services, organized by region.
- **Requires new research** (not yet gathered anywhere in this project) — this chunk needs WebSearch, not just a rewrite of existing data.
- **Files touched (new only)**: `gear.html`.
- **Conflict risk**: none.
- **Done when**: at least one real, verified gear/rental option is listed per region, sourced honestly (matching the site's existing "say so if it's thin" voice).

### A4. Traveler neighborhoods / itinerary page
- **Goal**: Reframe the site's data for people who think in neighborhoods and hotel proximity, not city names — "staying near Union Square," "layover at SFO," "conference in downtown San Jose."
- **Files touched (new only)**: `visiting.html`.
- **Conflict risk**: none.
- **Done when**: at least 4-5 traveler-relevant neighborhood/airport scenarios each point to the 2-3 real closest venues already documented on the site.

### A5. Corrections / submit-an-update form
- **Goal**: Turn "this is hand-maintained, not a database" from a limitation into a flywheel — let locals report stale hours/closures.
- **Blocker you need to resolve, not me**: this needs either a Formspree/Netlify Forms endpoint or a real email address to receive submissions. I can't invent one — stub the form with a clearly marked placeholder (`YOUR_FORM_ENDPOINT_HERE`) if you want this built before you've picked a service.
- **Files touched (new only)**: `corrections.html`.
- **Conflict risk**: none.

---

## Track B — Per-region polish (parallel *across* regions, never *within* one)

Each chunk bundles three small, mechanical, no-new-research enhancements for one region's existing city pages. Bundling them avoids three separate chunks all touching the same files. Run B1–B5 in five different sessions at once — each owns a disjoint set of city files.

For each city page in the region, add:
1. **"Get directions" link** next to the address — a Google Maps query URL built directly from the venue's own printed address (`https://www.google.com/maps/search/?api=1&query=<url-encoded address>`), not a fabricated place ID.
2. **Beginner-friendly / Competitive quick badge** — derived from the existing Level rating-pill text already on the page (no new research, just surfacing what's already there more visibly).
3. **schema.org structured data** (`SportsActivityLocation` or `Place` JSON-LD) per venue, using the name/address/description already on the page — this is the single highest-leverage SEO move available and needs no new facts.

| Chunk | Region | Files touched |
|---|---|---|
| B1 | San Francisco | `cities/san-francisco.html` |
| B2 | Peninsula | `cities/palo-alto.html`, `cities/menlo-park.html`, `cities/redwood-city.html`, `cities/san-mateo.html` |
| B3 | South Bay | `cities/san-jose.html`, `cities/santa-clara.html`, `cities/sunnyvale.html`, `cities/cupertino.html`, `cities/mountain-view.html` |
| B4 | East Bay | `cities/oakland.html`, `cities/berkeley.html`, `cities/walnut-creek.html`, `cities/fremont.html`, `cities/pleasanton.html` |
| B5 | North Bay | `cities/san-rafael.html`, `cities/novato.html` |

- **Conflict risk**: none between B1–B5 (disjoint files). Do NOT run any of these at the same time as a hypothetical future chunk that also touches these same city files (e.g., a full content refresh).
- **Done when**: every venue in the region has a working directions link, a visible beginner/competitive badge, and valid JSON-LD (test with Google's Rich Results Test).

---

## Track C — Shared-file integration (run alone, sequentially, AFTER Track A finishes)

This is the one part of the plan that is NOT parallel-safe, because it touches files every other chunk also touches indirectly (navigation).

### C1. Wire new pages into navigation + sitemap
- **Goal**: Add the new Track A pages (Map / Learn / Gear / Visiting) somewhere findable — doesn't have to be the primary nav (which is duplicated across all 20 files and expensive to touch); a new "Resources" mention in `about.html` and the home page is enough to start.
- **Depends on**: A1–A5 existing (or at least their final filenames being fixed).
- **Files touched**: `index.html`, `about.html`, `sitemap.xml`, `robots.txt` (only if changed). Optionally the footer's "Site" column across all pages if you want full nav integration — but treat that as a separate, explicitly single-threaded follow-up chunk (C2) since it touches all 20 files.
- **Conflict risk**: high with anything else touching these files — run this alone, nothing else in flight.

---

## Suggested run order

1. Kick off **A1–A5** in five parallel sessions (or worktrees). Zero coordination needed.
2. Kick off **B1–B5** in five more parallel sessions at the same time as A1-A5 — still zero conflict, since Track A and Track B touch entirely disjoint files.
3. Once A1–A5 land, run **C1** alone.
4. Decide separately whether the full-nav follow-up (C2) is worth an all-20-files pass, given it's the one genuinely expensive, conflict-prone piece of this whole plan.

## Explicitly set aside for now

- Live/real-time crowd data — would require a backend and ongoing data collection; not a static-site fit.
- User reviews/comments — same backend problem, plus moderation burden.
- Any monetization (ads/affiliate) — the About page currently commits to "no ads, no affiliate links." Worth a deliberate decision (not a default) if the income goal ever needs this site to carry weight; not addressed by this plan either way.
