# Pickleheads court research — parallel, one city per session

Turns [pickleheads.com](https://www.pickleheads.com/search?mode=courts&lat=37.8095&lng=-122.2953&z=10.1)
into a second, independent source for `assets/courts-data.json` /
`assets/venues.json`. Right now **42 of 83 venues (51%) are `confirmed:
false`** — unverified guesses — and spot-checking Berkeley/Oakland/SF against
Pickleheads during research for this doc turned up real gaps in both
directions (see the worked example below). This is a genuine data-quality
pass, not busywork.

## Why this is safe to run as many parallel sessions as you want

Every other parallel-prompt doc in this repo (`nav-search-google-links-plan.md`,
`consolidation-audit-prompts.md`) needs git worktrees because its sessions
edit shared HTML/CSS/JS files. **This one doesn't**, because no city session
ever touches `assets/courts-data.json`, `assets/venues.json`, or any other
existing file — each session's only write is one brand-new file,
`pickleheads-research/<city-slug>.json`, that no other session will ever
touch. You can run every session in the same checkout, same branch, at the
same time, with zero coordination.

The **claim mechanism is the filesystem, not a doc edit**: a session checks
whether its output file already exists before starting, and stops if it
does. (Don't try to "claim" a city by editing the table below — two sessions
editing the same markdown file to add a checkmark is exactly the race
condition this design avoids elsewhere.)

Merging the per-city files into the live data files is a **separate,
sequential step** (last section of this doc) — run once, by itself, after
the city sessions you want are done.

## Confirmed facts about Pickleheads before you start (don't rediscover these)

- **`WebFetch` is blocked outright** — every `pickleheads.com` URL tested
  (`/search?...`, `/courts/us/california/berkeley`, and an individual venue
  page) returned **HTTP 403**. Don't waste a session rediscovering this.
  Use the `WebSearch` tool instead — `site:pickleheads.com/courts/us/california/<slug>`
  reliably returns the full venue list *and* a synthesized summary (court
  counts, surface, indoor/outdoor, fees, hours) pulled from each page's
  actual content, not just a title/snippet. Follow up with a per-venue query
  for fields the city-level search didn't surface.
- **URL pattern**: city index =
  `pickleheads.com/courts/us/california/<slug>`; venue detail =
  `pickleheads.com/courts/us/california/<slug>/<venue-slug>`. Confirmed
  identical slug convention (lowercase, hyphenated city name) for Berkeley,
  Oakland, and San Francisco.
- **State-collision gotcha, confirmed real**: a plain search for "Oakland"
  pickleheads pulled in an `/us/new-jersey/oakland/...` result mixed with
  the California ones. Always confirm `/california/` is in the URL before
  trusting a result.
- **Pickleheads doesn't report everything the existing schema has fields
  for** — it has no "wait time" data. Never invent a value for a field
  Pickleheads doesn't state; leave it `"Not specified"` (matching this
  repo's existing convention for that exact situation) rather than guessing.

### Worked example (Berkeley) — why this is worth doing

Pickleheads lists 5 Berkeley venues: Cedar Rose Park, Ocean View Park, James
Kenney Park, Neighborhood Pickleball – Rooftop – Level 6, and Claremont Club
and Spa. `assets/courts-data.json` currently has 4 Berkeley entries: Cedar
Rose Park, James Kenney Park, Grove Park, San Pablo Park — **both directions
of gap are real**: Ocean View Park and the rooftop/Claremont venues are
missing from the site, while Grove Park and San Pablo Park (both already
`confirmed: false`) don't turn up on Pickleheads at all and are worth a
second look. This is exactly the kind of thing a city session should surface
via its `notOnPickleheads` list (see schema below) — not silently delete,
just flag.

## Output schema — one `pickleheads-research/<slug>.json` per city

```json
{
  "city": "Berkeley",
  "pickleheadsSlug": "berkeley",
  "pickleheadsStatedTotal": { "locations": 5, "courts": 16 },
  "researchedAt": "2026-07-10",
  "venues": [ /* venue objects, schema below */ ],
  "notOnPickleheads": [ { "id": "grove-park", "name": "Grove Park" } ]
}
```

Venue object — field rules, not just types:

| Field | Rule |
|---|---|
| `id` | kebab-case of `name`. Check uniqueness against **every** id in `assets/courts-data.json` across **all cities**, not just this one — ids are used as sitewide anchor targets. |
| `name`, `city` | Exact venue name as Pickleheads lists it; `city` in Title Case matching `assets/regions.js`'s `PB_CITY_REGION` keys. |
| `neighborhood` | Only if a source states one; else `"Not specified"`. |
| `address` | Full street address, "City, CA ZIP". |
| `lat`, `lon` | From the Pickleheads map or a geocode of the address; `null` + `"approxLocation": true` if only a city-level location is known (matches `venues.json`'s existing `approx` flag). |
| `courts` | Pickleheads' stated count — treat as authoritative over an existing guess. |
| `indoorOutdoor` | `"Indoor"` \| `"Outdoor"` \| `"Both"` — capitalized, matching `courts-data.json` (NOT `venues.json`'s lowercase `indoor` field — that's derived at merge time, see below). |
| `surface` | As Pickleheads states it (e.g. "Outdoor asphalt", "dedicated pickleball lines"). |
| `lights` | boolean, only if amenities explicitly say so; else `"Not specified"`. |
| `netType` | e.g. "dedicated pickleball nets" vs "portable nets on tennis courts". |
| `price` | Literal as stated ("Free", "$7/hour reservation", "Membership required"). |
| `reservable` | `"Reservable"` \| `"Walk-up"` \| `"Mixed"` \| `"Not specified"` (all four values already appear in `courts-data.json`). |
| `bookingUrl` | `null` if none. |
| `hours` | As stated. |
| `amenities` | Array of strings, only ones explicitly listed (restrooms, water, parking, lights, lessons, etc). |
| `skill` | As stated. |
| `waitTime` | Always `"Not specified"` — Pickleheads has no data for this field, never infer it. |
| `weather` | Copy the **exact string** other existing venues in this city already use in `courts-data.json` (it's a city-level climate blurb, not venue-specific — don't rephrase). `"Not specified"` if the city has zero existing entries. |
| `pickleheadsUrl` | The canonical detail-page URL. |
| `pickleheadsRating` | number or `null`. |
| `googleMapsUrl` | **Only** the `https://maps.google.com/?cid=<decimal>` form (this repo's established convention). Never `place_id:` or `/maps/place/...data=...!1s<id>`. Leave `null` if you can't confirm a numeric cid — don't fall back to a worse format. |
| `confirmed` | `true` only if Pickleheads corroborates this venue's core facts (existence + at least court count or indoor/outdoor) with no unresolved conflict. |
| `matchStatus` | `"new"` \| `"existing-update"` \| `"existing-no-change"` \| `"existing-conflict"` — see step 4 below. |
| `existingId` | The matching id in `courts-data.json`, or `null` if `matchStatus: "new"`. |
| `conflicts` | Only when `matchStatus: "existing-conflict"` — array of `{ "field", "existing", "pickleheads", "source" }`. |
| `sources` | Every URL you actually used for this record. Required for every field you didn't leave `"Not specified"`. |
| `notes` | Free-text caveats. |

## City list

Current 17 — repo slug (= `cities/<slug>.html` filename) matches the
Pickleheads slug in every case checked (Berkeley, Oakland, San Francisco
live-tested; the rest follow the same lowercase-hyphenated pattern but
weren't individually confirmed — worth a quick `site:pickleheads.com/courts/us/california/<slug>`
sanity check before you assume):

| City | Pickleheads slug | Existing entries | Unconfirmed |
|---|---|---|---|
| San Francisco | `san-francisco` | 20 | check yourself — Pickleheads lists 29 locations, so expect several `"new"` |
| San Jose | `san-jose` | 13 | |
| Oakland | `oakland` | 6 | Pickleheads lists 8 locations |
| San Mateo | `san-mateo` | 6 | |
| San Rafael | `san-rafael` | 6 | |
| Pleasanton | `pleasanton` | 5 | |
| Berkeley | `berkeley` | 4 | see worked example above |
| Fremont | `fremont` | 4 | |
| Cupertino | `cupertino` | 3 | |
| Redwood City | `redwood-city` | 3 | |
| Menlo Park | `menlo-park` | 2 | |
| Mountain View | `mountain-view` | 2 | |
| Novato | `novato` | 2 | |
| Santa Clara | `santa-clara` | 2 | |
| Sunnyvale | `sunnyvale` | 2 | |
| Walnut Creek | `walnut-creek` | 2 | |
| Palo Alto | `palo-alto` | 1 | |

(83 total, 42 already `confirmed: false` — run `python3 -c "import json,collections; d=json.load(open('assets/courts-data.json')); print(collections.Counter(x['city'] for x in d))"` yourself for a fresh count before picking a city, in case earlier sessions already landed.)

**Phase 2, optional/secondary** — Bay Area cities with no `cities/<slug>.html`
page yet, so researching them still produces a useful
`pickleheads-research/<slug>.json` but doesn't have a live page to merge
into (a new page is a separate content task, out of scope here): Alameda,
Albany, Belmont, Burlingame, Campbell, Concord, Daly City, Danville, Dublin,
El Cerrito, Emeryville, Hayward, Livermore, Los Altos, Los Gatos, Milpitas,
Richmond, San Bruno, San Carlos, San Leandro, San Ramon, Saratoga, South San
Francisco, Union City, Vallejo. Confirm each one's Pickleheads slug the same
way (`site:pickleheads.com/courts/us/california/<guess>`) before assuming it
matches the city name.

## The prompt — copy into a new session, fill in the two blanks

```
Work in /Users/reidbrawer/Developer/Money/pickleball-bay-area — a static
directory site for Pickleball Bay Area. It's a git repo on branch main.

YOUR CITY: <CITY NAME>   (Pickleheads slug: <slug>)

GOAL: Research every pickleball venue Pickleheads lists for <CITY NAME>, CA
and produce exactly one new file: pickleheads-research/<slug>.json. Do not
edit any other file — this is what keeps you conflict-free with every other
city session that might be running right now.

CLAIM CHECK — do this first: if pickleheads-research/<slug>.json already
exists, STOP. Another session already claimed this city; pick a different
one from pickleheads-court-research-prompts.md.

CONTEXT ALREADY CONFIRMED (verify specifics yourself, this just saves you
rediscovering it):
- pickleheads.com blocks the WebFetch tool outright (HTTP 403 on every URL
  tested). Use WebSearch instead:
  `site:pickleheads.com/courts/us/california/<slug>` returns the full venue
  list plus a synthesized summary (court counts, surface, indoor/outdoor,
  fees, hours) from each page's real content. Follow up with a per-venue
  query — `"<venue name>" <CITY NAME> pickleball pickleheads courts hours
  fees amenities` — for fields the city-level query didn't cover.
- URL pattern: city index = pickleheads.com/courts/us/california/<slug>;
  venue detail = pickleheads.com/courts/us/california/<slug>/<venue-slug>.
  Some city names collide with cities in other states (a plain "Oakland"
  search pulled in a New Jersey result) — always confirm /california/ is in
  the URL before trusting a result.
- Pickleheads has no "wait time" data — never invent one; leave that field
  "Not specified" always.

STEPS:
1. Read assets/courts-data.json and assets/venues.json, filter to
   "city": "<CITY NAME>", and note every existing venue's id, name, address,
   and current field values — this is your comparison baseline.
2. WebSearch site:pickleheads.com/courts/us/california/<slug> to get
   Pickleheads' full venue list for <CITY NAME> and its stated totals
   ("N locations with M courts").
3. For each venue Pickleheads lists, pull its detail fields (court count,
   indoor/outdoor, surface, net type, lights, fee, reservation requirement +
   booking link, hours, amenities, skill-level info, rating) via a targeted
   WebSearch as above. Only record a field if a source explicitly states
   it — "Not specified" beats a guess. Record every URL you used for that
   venue in "sources".
4. Match each Pickleheads venue against your Step 1 baseline by name AND
   address (a park can have more than one same-named amenity). Set
   matchStatus:
   - "new" — no matching existing entry
   - "existing-update" — matches, and Pickleheads fills in at least one
     field the existing record had as "Not specified"/null
   - "existing-no-change" — matches, nothing new
   - "existing-conflict" — matches, but Pickleheads contradicts an existing
     non-null field (e.g. court count 4 vs existing 2). Don't pick a side —
     record both values in "conflicts" with a source, and leave
     confirmed: false so a human decides.
5. id: kebab-case the venue name, then check it's unique against every id
   in the FULL courts-data.json (all cities), not just <CITY NAME>'s.
6. weather: copy the exact string other <CITY NAME> venues already use in
   courts-data.json — it's a city-level climate blurb, don't rephrase it.
   "Not specified" if <CITY NAME> has zero existing entries.
7. googleMapsUrl: only the https://maps.google.com/?cid=<decimal> form.
   Never place_id: or /maps/place/...data=...!1s<id>. null if you can't
   confirm a numeric cid.
8. After covering every Pickleheads venue, go back to your Step 1 baseline
   and list any existing <CITY NAME> entry you found NO Pickleheads page
   for at all, as { "id", "name" } pairs in a top-level "notOnPickleheads"
   array. This is a flag for human review, not a deletion — you're not
   editing courts-data.json.
9. Write pickleheads-research/<slug>.json using the schema in
   pickleheads-court-research-prompts.md's "Output schema" section.

Cite a source URL for every field you didn't leave "Not specified". Do not
fabricate court counts, hours, fees, or amenities — if no source states it,
leave it unspecified.
```

## Merge step — run once, sequentially, after the city sessions you want are done

Not parallel-safe — this is the one step that touches the shared files, so
run it by itself (or as the last of your sessions, after the others have
finished and you've reviewed their output).

```
Work in /Users/reidbrawer/Developer/Money/pickleball-bay-area. Run this only
after the city research sessions you want have finished, and not
concurrently with anything else editing assets/courts-data.json or
assets/venues.json.

GOAL: Merge every pickleheads-research/<slug>.json file into
assets/courts-data.json and assets/venues.json.

STEPS:
1. Read every pickleheads-research/*.json file present.
2. matchStatus "existing-update": patch ONLY the fields that were
   "Not specified"/null in the existing record. Never overwrite a field
   that already had a real value — that's a conflict, handled in step 3.
   Set confirmed: true only if this venue has zero unresolved conflicts.
3. matchStatus "existing-conflict": do not patch the record. Append a row
   to a new pickleheads-research/conflicts.md: venue id, field, existing
   value, Pickleheads value, source URL. A human resolves these by hand.
4. matchStatus "new": append a full new entry to courts-data.json (id
   checked unique sitewide) AND a matching entry to venues.json (name,
   city, address, lat, lon, url, indoor, id, confirmed). Note the casing
   difference between the two files: courts-data.json uses capitalized
   "Outdoor"/"Indoor"/"Both" for indoorOutdoor, venues.json uses lowercase
   "outdoor"/"indoor"/"both" for indoor — keep each file's own convention,
   don't introduce a third variant. If the new venue's city has no
   cities/<slug>.html page yet, don't create one — list it in the merge
   report under "new city, needs a page" instead; that's a separate content
   task.
5. Compile every file's notOnPickleheads entries into one merge-report
   section ("existing entries Pickleheads doesn't list — re-verify or
   consider removing") rather than acting on them.
6. Write pickleheads-research/merge-report.md: counts of venues added,
   updated, left as conflicts, and notOnPickleheads flags; confirm
   courts-data.json and venues.json have equal total entry counts after
   the merge (they should stay in lockstep, same as today's 83/83).
7. Do not delete or rewrite the pickleheads-research/*.json inputs — they're
   the audit trail for how each merged field was sourced.
```

## Explicitly out of scope

- Building `cities/<slug>.html` pages for any newly-researched city — that's
  a design/content task (see `hone-new-screen`-style scaffolding elsewhere
  in this user's other repos for the general pattern; here it's a manual
  page-authoring job against `DESIGN.md`'s component library), not part of
  this data-collection pass.
- Auto-resolving `existing-conflict` entries — always a human call, never
  silently overwritten by the merge step.
- Re-running `scripts/build.mjs` — that regenerates head/header/footer
  boilerplate, unrelated to this data merge; only run it if you also add a
  new city page.
