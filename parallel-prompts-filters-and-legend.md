# Parallel work plan: filterable database view + map legend

Three prompts, each meant to run in its own Claude Code session (own terminal /
own working-directory checkout), scoped so they touch **non-overlapping files**
and won't step on each other if run at the same time.

**Before starting:** consider giving each session its own git branch
(`git checkout -b directory-data`, `git checkout -b directory-ui`,
`git checkout -b map-legend`) so each is independently reviewable and you can
merge them one at a time instead of hoping three concurrent edits to the
working tree never race. Not required — the file ownership below is designed
to make plain concurrent edits safe too — but it's a free safety net given
this repo has a live GitHub Pages remote.

## How the three fit together

| Prompt | Creates / owns | Reads (never writes) | Can start |
|---|---|---|---|
| 1. Data extraction | `assets/courts-data.json` (new) | `cities/*.html`, `assets/venues.json` | immediately |
| 2. Filterable view | `directory.html`, `assets/directory.css`, `assets/directory.js` (new); one-line nav addition in every existing HTML page | `assets/courts-data.json` | immediately (builds against a fixture until Prompt 1's file lands) |
| 3. Map legend | `assets/venues.json` (adds one field), `assets/map.js`, `assets/map.css`, `map.html` (map section only, not its nav) | `cities/*.html` | immediately, fully independent |

Prompts 1 and 3 each independently work out indoor/outdoor per venue from the
city pages. That's small duplicated effort, done on purpose so neither has to
wait on the other — they write to different files.

Prompt 2 needs Prompt 1's data file to show real content, but it doesn't need
to wait to *start*: it builds the whole page and filter logic against the
schema below plus a small fixture it creates itself, then does a final check
against the real file once it exists.

The only shared file is `map.html`, touched by both Prompt 2 (nav link) and
Prompt 3 (legend). Each prompt is scoped to a different region of that file
(header nav vs. the map section), so the two edits shouldn't collide even if
run at the exact same time — this is called out explicitly in both prompts
below.

---

## Prompt 1 — Extract structured court data

```
Work in /Users/reidbrawer/Developer/Money/pickleball-bay-area — a static
site (plain HTML/CSS/JS, no build step, no framework) for Pickleball Bay
Area, deployed via GitHub Pages. It's a git repo on branch main.

GOAL: Produce a new file, assets/courts-data.json, containing one structured
record per venue for all 84 venues currently described across cities/*.html
(17 city pages). Don't modify any existing file — this is a pure data
extraction task that creates one new file.

SOURCE OF TRUTH: Read every file in cities/*.html (skip cities/index.html).
Each city page lists venues in two forms:
- Full ".venue-card" blocks (richest data: name, address, a ".facts" row of
  stat-chips, a ".rating-row" of ".rating-pill" items for Surface/Level/
  Weather/Wait, a prose paragraph, sometimes a ".book-btn" link, sometimes
  ".level-badge" badges, sometimes a ".rank-badge top" marking it the city's
  top pick).
- Lighter ".mini-venue-row" entries (community-reported spots the city
  doesn't officially list for pickleball — much less structured data, lots
  of "call ahead to confirm" caveats).

Also read assets/venues.json — it's the flat list this site's map already
uses (name, city, address, lat, lon, url, topPick, approx per venue) and is
your join key: your output must have exactly one record per venues.json
entry, matched by name + city.

CRITICAL — this site's whole premise (see about.html) is being more honest
than crowdsourced apps: real sources, and "where sources disagreed, we said
so rather than picking a number." Match that standard here:
- Extract fields from the actual page text. Do not invent, estimate, or
  guess a specific number/fact that isn't stated or clearly implied.
- Where a city page's text is genuinely ambiguous or silent on a field
  (common for mini-venue-row entries), set that field to "Not specified" (or
  null for numeric fields) rather than making something up.
- For the "neighborhood" field, use the real neighborhood/area name that's
  identifiable from the address or the page's own text (e.g. "Downtown
  Berkeley", "Rockridge"). Do NOT invent specific "things to do nearby"
  recommendations (restaurant names, business claims) you can't ground in
  the page — a bare neighborhood/area name is enough; if you can find real,
  clearly-stated nearby-context text on the page (some pages mention it),
  you may include it, but never fabricate one.

OUTPUT SCHEMA — produce assets/courts-data.json as a JSON array, each object
with exactly these keys (use this schema verbatim; another workstream is
building a UI against this exact shape):

{
  "name": string,              // must match the venues.json "name" for this venue exactly
  "city": string,
  "neighborhood": string,      // real area/neighborhood name, or "Not specified"
  "address": string,
  "url": string,                // same city-page url as in venues.json
  "price": string,              // e.g. "$7-8/hr", "Free", "Not specified"
  "skill": string,               // e.g. "2.5-5.0, beginner-friendly", "Not specified"
  "hours": string,               // e.g. "Tue-Fri 10am-8pm, Sat-Sun 10am-6pm, Mon closed", "Not specified"
  "courts": number | null,       // count of dedicated pickleball courts; null if not clear
  "waitTime": "Low" | "Medium" | "High" | "Not specified",
  "weather": string,             // short phrase describing typical local weather, or "Not specified"
  "surface": string,             // e.g. "Dedicated hard court", "Converted tennis lines", "Not specified"
  "indoorOutdoor": "Indoor" | "Outdoor" | "Both" | "Not specified",
  "reservable": "Reservable" | "Walk-up" | "Mixed" | "Not specified",
  "topPick": boolean,            // copy from venues.json
  "confirmed": boolean           // true for a full .venue-card entry, false for a .mini-venue-row entry
}

Notes on mapping specific fields from the markup you'll see:
- courts / reservable: the ".facts" stat-chips usually spell this out, e.g.
  "4 dedicated outdoor courts" + "3 reservable + 1 free walk-up" -> courts:
  4, reservable: "Mixed". A chip like "2 reservable + 4 walk-up" with no
  pickleball confirmed (mini-venue-row, tennis-only per the city) should
  still be recorded, but confirmed: false.
- waitTime: derive from the ".rating-pill" whose label is "Wait" and its
  rvalue class (good/neutral/caution roughly map to Low/Medium/High) plus
  the pill's text.
- surface: from the "Surface" rating-pill text.
- weather: from the "Weather" rating-pill text.
- skill / hours: from the "Level" rating-pill and the "Hours:" stat-chip.
- indoorOutdoor: most venues on this site are outdoor parks; look for
  explicit "indoor" language (indoor facility, gym, community center court)
  in the card text to mark Indoor or Both; default to Outdoor only when the
  text clearly says so (dedicated outdoor courts, park courts), otherwise
  "Not specified".
- price: from the page's top-of-page ".stat-strip" chip (e.g. "$7-8/hr") if
  it's for this specific venue, or from prose mentioning cost for that venue;
  if the city only gives one price for its flagship court, don't apply it to
  other venues on the same page unless the text says it applies broadly.

When done, validate the output is valid JSON, has exactly 84 entries, and
that every "name"+"city" pair matches one in assets/venues.json (flag any
mismatch in your final summary rather than silently dropping it). Report
which fields ended up "Not specified" most often, so a human can spot-check
coverage.
```

---

## Prompt 2 — Build the filterable database view

```
Work in /Users/reidbrawer/Developer/Money/pickleball-bay-area — a static
site (plain HTML/CSS/JS, no build step, no framework, no bundler — pages
just include <link>/<script> tags directly) for Pickleball Bay Area,
deployed via GitHub Pages. It's a git repo on branch main.

GOAL: Add a new page, directory.html, at the site root: a filterable,
sortable database view over all ~84 pickleball venues, letting a visitor
filter by location (city/region), price, skill level, hours, number of
courts, wait time, typical weather, indoor/outdoor, neighborhood, court
surface, and reservable status.

DATA SOURCE: fetch("/assets/courts-data.json") at runtime (same pattern as
assets/map.js, which fetches /assets/venues.json — read that file for the
fetch/error-handling idiom to mirror). Each record has this exact shape (a
separate workstream is producing this file to this schema; it may not exist
yet when you start):

{
  "name": string,
  "city": string,
  "neighborhood": string,
  "address": string,
  "url": string,
  "price": string,
  "skill": string,
  "hours": string,
  "courts": number | null,
  "waitTime": "Low" | "Medium" | "High" | "Not specified",
  "weather": string,
  "surface": string,
  "indoorOutdoor": "Indoor" | "Outdoor" | "Both" | "Not specified",
  "reservable": "Reservable" | "Walk-up" | "Mixed" | "Not specified",
  "topPick": boolean,
  "confirmed": boolean
}

If assets/courts-data.json doesn't exist yet (or is still an empty/partial
placeholder) when you start, create a throwaway local fixture — e.g.
assets/courts-data.sample.json with ~6 realistic rows in this exact shape —
and develop against that so you're not blocked. Point the real page's fetch
at /assets/courts-data.json regardless (that's the contract). Before you
finish, check whether assets/courts-data.json now exists for real; if it
does, do a final smoke test against it and delete your sample fixture file
if you added one. If it still doesn't exist, leave a one-line TODO at the
top of directory.js noting the page is schema-complete and will render real
data as soon as that file lands — do not block your own completion on it.

DESIGN — match the existing site exactly, don't invent a new visual style:
- Reuse assets/style.css as-is (link it, same as every other page). Use its
  CSS variables (--fog, --paper, --ink, --ink-soft, --line, --bay,
  --kitchen, --optic, --poppy and their -deep/-tint variants, --radius-*,
  --space-*, --font-display "Space Grotesk", --font-body "Inter",
  --font-mono "IBM Plex Mono") rather than hardcoding colors/fonts.
- Copy the exact <head> boilerplate pattern from map.html (fonts preconnect,
  favicon, theme-color, og:/twitter: meta, canonical) and the exact
  <header class="site-header">...</header> / <footer class="site-footer">
  markup from map.html, updating the title/description/canonical for this
  page and marking this page's own nav link aria-current="page".
- Add a page-hero section in the same style as map.html's (".page-hero"
  with an ".eyebrow", <h1>, lede paragraph, optional ".stat-strip").
- For the actual data view: a filter panel (checkboxes/selects for city,
  indoor/outdoor, surface, reservable, skill; the rest can be simple
  dropdown buckets) above a results view. Render results as a real <table>
  on wider viewports and stacked cards below ~640px (this codebase already
  has a mobile breakpoint pattern at 640px in assets/map.css — follow it).
  Show a live result count ("Showing 23 of 84 venues") and a plain empty
  state when filters match nothing, with a "clear filters" action. Every
  row's name should link to its venues.json/courts-data "url" (the city
  page). Do all filtering client-side in assets/directory.js after the
  fetch resolves — no backend.
- Put page-specific styles in a new assets/directory.css (mirror how
  assets/map.css layers on top of assets/style.css) and all JS in a new
  assets/directory.js. Don't add inline <style> or <script> blocks.

NAV WIRING — every existing page shares an identical header:
  <nav class="main-nav">
    <a href="/index.html">Home</a>
    <a href="/cities/index.html">Cities</a>
    <a href="/map.html">Map</a>
    <details class="nav-dropdown">...
  Add a new link, e.g. <a href="/directory.html">Directory</a>, right after
  the "Map" link, in the main-nav block of EVERY existing .html file at the
  site root and in cities/ (index.html, about.html, corrections.html,
  gear.html, learn.html, visiting.html, map.html, 404.html, cities/*.html —
  grep -l 'class="main-nav"' *.html cities/*.html to enumerate them, expect
  ~26 files). IMPORTANT: touch ONLY the <nav class="main-nav"> block in each
  file — make a small, precisely-anchored edit (match on the exact "Map"
  link line and insert after it), and do not touch anything else in
  map.html specifically. Another workstream may be concurrently editing
  map.html's map section (a legend feature) at the same time as you're
  editing its nav — as long as you don't touch outside the nav block there,
  the two edits won't conflict.

Also add directory.html to sitemap.xml (follow the existing <url> entry
pattern in that file).

When done, open the page in a browser (or however you verify static pages
in this environment) and confirm: fetch succeeds against whichever data
file exists, at least one filter actually narrows the result count, mobile
layout at ~375px width doesn't overflow horizontally, and the nav link
appears and works from at least 3 different existing pages.
```

---

## Prompt 3 — Indoor/outdoor legend on the map

```
Work in /Users/reidbrawer/Developer/Money/pickleball-bay-area — a static
site (plain HTML/CSS/JS, no build step) for Pickleball Bay Area, deployed
via GitHub Pages. It's a git repo on branch main.

GOAL: The venue map at map.html (rendered by assets/map.js using Leaflet,
pin data from assets/venues.json) currently shows every venue as one of two
pin colors: var(--poppy) for a normal venue, var(--optic-deep) for a
topPick venue (see assets/map.css, classes .pba-pin / .pba-pin.top-pick).
Add a legend to this map distinguishing indoor vs. outdoor courts, and make
the pins themselves actually encode that distinction.

STEP 1 — add the data. assets/venues.json is a flat JSON array of 84 venue
objects (name, city, address, lat, lon, url, topPick, approx). Add one new
field to every entry: "indoor", one of "indoor" | "outdoor" | "both" |
"unknown". Determine this by reading the matching venue's entry in
cities/*.html (match by name + city) — most venues on this site are
described as outdoor park courts; look for explicit "indoor" language
(indoor facility, gym, community/rec center court, climate-controlled) to
mark "indoor" or "both". Where the page's text doesn't say either way,
use "unknown" rather than guessing — this site's whole ethos (see
about.html) is not inventing facts sources don't support.

STEP 2 — encode it visually without losing the existing top-pick signal.
Right now pin *color* alone encodes top-pick. Don't just repurpose that
channel for indoor/outdoor and lose top-pick, and don't make pins so busy
they're unreadable at map scale. A clean approach: use fill color for
indoor/outdoor/both/unknown (suggest var(--bay) for outdoor, var(--kitchen)
for indoor, a split/striped or dual-tone treatment for both, var(--ink-soft)
or the current var(--poppy) for unknown), and keep top-pick as a distinct
small overlay (e.g. a thin var(--optic) ring/border around the pin, or a
tiny star badge) layered on top of whichever color the venue's indoor/
outdoor status gives it. Implement in assets/map.js's pinIcon() function and
assets/map.css's .pba-pin rules. Update the popup (popupHtml() in map.js) to
also show the venue's indoor/outdoor status as a small line, consistent
with how it already shows the "approximate location" note.

STEP 3 — add the legend itself to map.html. Place it near the existing
#map-status line / above or beside the #venue-map div (your call on the
cleanest placement — a small horizontal row of color-dot + label pairs
fits this site's plain, light design language best; avoid anything with
blur/glow/animation, this codebase explicitly dropped that visual style).
Cover: Outdoor, Indoor, Both, Unknown, and Top pick, matching whatever
colors/markers you actually used in Step 2. Style it in assets/map.css.

IMPORTANT — scope your edit to map.html narrowly: only add markup inside
the <section class="page-hero"> or <section class="section"> area around
the map (wherever you decide the legend belongs). Do NOT touch the
<header class="site-header"> / <nav class="main-nav"> block in this file.
Another workstream may be concurrently adding a new nav link to every
page's header, including map.html's, at the same time you're working — as
long as you stay out of the nav block, the two edits won't conflict.

When done, open map.html and confirm: the legend renders, its colors
visibly match actual pins on the map, clicking a pin still shows a working
popup with the new indoor/outdoor line, and the map still fits bounds
correctly on load (don't touch the existing fit()/resize logic beyond
whatever pinIcon() changes require).
```
