# Data file duplication audit (JSON)

Scope: `assets/courts-data.json`, `assets/venues.json`, `assets/paddles.json`,
`assets/google-ratings.json`, and every JS file that fetches them. Read-only —
no files were edited. All line numbers below were current as of this audit.

## Which files actually fetch which JSON (correction to the assumed list)

```
grep -n "courts-data.json\|venues.json\|paddles.json\|google-ratings.json" assets/*.js
```

| Fetcher | File | Line |
|---|---|---|
| `courts-data.json` | [assets/directory.js:434](../assets/directory.js:434) | `fetch("/assets/courts-data.json")` |
| `courts-data.json` | [assets/global-search.js:43](../assets/global-search.js:43) | `fetch("/assets/courts-data.json")` |
| `courts-data.json` | [assets/rankings.js:227](../assets/rankings.js:227) | `fetch("/assets/courts-data.json")` |
| `venues.json` | [assets/map.js:64](../assets/map.js:64) | `fetch("/assets/venues.json")` |
| `paddles.json` | [assets/paddle-quiz.js:515](../assets/paddle-quiz.js:515) | `fetch("/assets/paddles.json")` |
| `google-ratings.json` | [assets/google-ratings.js:21](../assets/google-ratings.js:21) | `fetch("/assets/google-ratings.json")` |

**`top-picks.js` and `city-top-pick.js` do not fetch anything themselves** —
worth correcting since the brief's "expect at least" list included them.
Both were read in full:
- [assets/city-top-pick.js:1-7](../assets/city-top-pick.js:1) explicitly explains why it *doesn't* fetch
  `courts-data.json`: it only needs the `confirmed` split, which is already
  expressed in the DOM (`.venue-card` vs `.mini-venue-row`), so it derives
  the same fact from markup instead of data.
- [assets/top-picks.js:60-74](../assets/top-picks.js:60) (`computeTopPickIds`) is a pure function that takes
  whatever venue array its caller already fetched — `directory.js` passes it
  `rows` (from `courts-data.json`), `map.js` passes it `venues` (from
  `venues.json`). It reads `.id`, `.city`, `.confirmed` off either shape
  generically. So `courts-data.json`'s `confirmed` field *is* consumed — just
  indirectly, through this shared helper, not by a fetch of its own.

---

## 1. Field-by-field overlap: `courts-data.json` vs `venues.json`

Both files have exactly 83 records, keyed by the same `id` values (set
equality confirmed: `set(courts ids) == set(venues ids)` → `True`).

Full key union per file (verified programmatically, not by eyeballing a
sample):

- **courts-data.json** (17 keys): `address, bookingUrl, city, confirmed, courts, hours, id, indoorOutdoor, name, neighborhood, price, reservable, skill, surface, url, waitTime, weather`
- **venues.json** (10 keys): `address, approx, city, confirmed, id, indoor, lat, lon, name, url`

**Shared keys (6):** `address, city, confirmed, id, name, url`
**courts-data.json-only (11):** `bookingUrl, courts, hours, indoorOutdoor, neighborhood, price, reservable, skill, surface, waitTime, weather`
**venues.json-only (4):** `approx, indoor, lat, lon`

### Do the shared fields actually agree?

Checked **all 83 records** (not just a sample) for `address`, `city`,
`confirmed`, `name`, `url`: **zero mismatches** across every field, every
record. Sample of 10 shown below (id | name | field-match booleans):

```
albert-park                  | Albert Park                  | address:True city:True confirmed:True url:True
almaden-valley-athletic-club | Almaden Valley Athletic Club  | address:True city:True confirmed:True url:True
bascom-community-center      | Bascom Community Center       | address:True city:True confirmed:True url:True
bay-club-pleasanton          | Bay Club Pleasanton           | address:True city:True confirmed:True url:True
bay-club-santa-clara         | Bay Club Santa Clara          | address:True city:True confirmed:True url:True
beresford-park               | Beresford Park                | address:True city:True confirmed:True url:True
branham-park                 | Branham Park                  | address:True city:True confirmed:True url:True
buena-vista-park              | Buena Vista Park              | address:True city:True confirmed:True url:True
bushrod-park                  | Bushrod Park                  | address:True city:True confirmed:True url:True
calabazas-park                | Calabazas Park                | address:True city:True confirmed:True url:True
```

So today, the two files are perfectly in sync. That's good hygiene, but it's
also the state you'd expect right before drift starts — there is no script or
check enforcing it; it's two hand-maintained JSON files that happen to agree
because whoever last edited them updated both. **Finding: not-yet-drifted,
but zero automated guarantee against future drift.** (See recommendation
in §2.)

### A field that looks shared but isn't: `indoorOutdoor` vs `indoor`

Not in the "shared keys" list above because the property names differ, but
they encode the **same underlying fact** independently, with different
vocabularies:

- `courts-data.json`'s `indoorOutdoor`: `{"Indoor", "Outdoor", "Both", "Not specified"}` (Title Case)
- `venues.json`'s `indoor`: `{"indoor", "outdoor", "both", "unknown"}` (lowercase, and `"unknown"` instead of `"Not specified"`)

This is a real duplication risk that's easy to miss precisely because the
key names don't match: a human updating a venue's indoor/outdoor status in
one file has no structural link telling them to update the other, and no
shared vocabulary to copy-paste from (they'd have to remember to translate
casing and the "not specified"/"unknown" spelling). Recommend either (a)
folding this into the same generation step recommended in §2, or (b) at
minimum renaming/aligning the vocab so a future editor notices the parallel.

---

## 2. Recommendation: keep the files separate, make `courts-data.json` canonical, derive `venues.json`

**Usage matrix (from reading every consuming file in full):**

| File | Reads from | Fields actually used | Fraction of file's fields |
|---|---|---|---|
| [directory.js](../assets/directory.js) | `courts-data.json` | `id, name, city, neighborhood, price, skill, hours, courts, waitTime, weather, indoorOutdoor, surface, reservable, url, bookingUrl, address` (+`confirmed` indirectly via top-picks.js) | ~16 of 17 — nearly everything |
| [rankings.js:227](../assets/rankings.js:227) | `courts-data.json` | `id, name, city, url` only ([assets/rankings.js:92-93](../assets/rankings.js:92), [assets/rankings.js:145](../assets/rankings.js:145)) | 4 of 17 |
| [global-search.js:43](../assets/global-search.js:43) | `courts-data.json` | `name, city, neighborhood, url, id` only ([assets/global-search.js:93-105](../assets/global-search.js:93)) | 5 of 17 — **and this script self-mounts into `.main-nav` on every page**, so this 53KB fetch already happens site-wide for a 5-field lookup |
| [map.js:64](../assets/map.js:64) | `venues.json` | `lat, lon, name, address, indoor, url, city, id, approx` (+`confirmed` indirectly via top-picks.js) | ~9 of 10 — nearly everything |

**Recommendation: do NOT merge into one canonical file. Keep them separate,
but make `courts-data.json` the single hand-edited source and generate
`venues.json`'s shared fields from it.**

Reasoning, grounded in the usage matrix above:

- Merging would make the *worst* consumer worse, not better. `global-search.js`
  already fetches the entire 53KB `courts-data.json` on **every single page
  of the site** to read 5 fields. A merged file adds `venues.json`'s
  `lat/lon/approx/indoor` on top — bytes global-search.js would download and
  never touch, on every pageview, sitewide. `map.js` has the same problem in
  reverse: it only loads on `/map`, but a merged file means it now also
  downloads `bookingUrl/courts/hours/neighborhood/price/reservable/skill/
  surface/waitTime/weather` — 11 fields it never reads (confirmed in
  [assets/map.js](../assets/map.js): no reference to any of them) — every
  time someone opens the map.
- There is **no build step in this repo** (no `package.json`, no bundler;
  `scripts/fetch-google-ratings.mjs` is a plain, manually-run Node script per
  its own header comment — see [scripts/fetch-google-ratings.mjs:1-13](../scripts/fetch-google-ratings.mjs:1)).
  Without a build step, "every page fetches one file and picks the fields it
  needs" isn't actually cheaper — there's no per-page trimming, so "picks
  the fields it needs" is purely a JS-side no-op; the *network payload* is
  what every page pays for, and that payload only grows under a merge.
- The drift risk a merge would solve (two files, one entity) is real but
  currently at **zero measured incidents** (see §1) and is cheap to close
  without merging: a small script — same pattern as
  `scripts/fetch-google-ratings.mjs`, run manually before a data-entry commit
  — reads `courts-data.json` and regenerates `venues.json`'s shared fields
  (`address, city, confirmed, name, url`, plus resolving the `indoorOutdoor`
  → `indoor` vocabulary translation flagged above) plus whatever
  `venues.json`-only fields (`lat, lon, approx`) are tracked in a small
  side table or left as manually-maintained geocode data. This gets the
  "one place a human edits identity fields" property the brief asks about,
  at effectively zero cost, without touching what any page downloads.

If `global-search.js`'s sitewide 53KB-per-pageview cost (for a 5-field
lookup) is something you want to fix, the fix isn't a merge — it's the
opposite: split a small `search-index.json` (`id, name, city, neighborhood,
url` only, ~83 records × 5 short fields) out of `courts-data.json` for
`global-search.js` to fetch instead of the full file. That's a separate,
optional finding, not required by the merge/no-merge question, but it's the
actual highest-leverage payload win in this data set precisely because it's
loaded on every page, unconditionally.

---

## 3. `assets/google-ratings.json` — stub, not broken

Current content: literally `{}` (confirmed: `cat assets/google-ratings.json`
→ `{}`, 3 bytes).

Traced the full read path in [assets/google-ratings.js](../assets/google-ratings.js):

- [assets/google-ratings.js:29-31](../assets/google-ratings.js:29): `get(courtId)` → `data[courtId] || null`. Against `{}`,
  every lookup returns `null`. No exception.
- [assets/google-ratings.js:39-41](../assets/google-ratings.js:39): `badgeHtml()` returns `""` when `get()` is null — no badge
  markup is produced.
- [assets/google-ratings.js:67-79](../assets/google-ratings.js:67): `injectAll()` only creates a DOM slot `if (!html) return;` is
  false, i.e. it explicitly skips creating anything when `badgeHtml` is empty.
- [assets/google-ratings.js:57-65](../assets/google-ratings.js:57): `rewriteDirectionsLinks()` only rewrites a link `if (url)`,
  and `url` derives from `get()`, so with no data it's a no-op too.

So this is a **fully graceful no-op**, not a half-built feature that breaks —
every code path that touches the empty object degrades to "don't show a
badge" rather than throwing or rendering broken markup. This matches the
stated intent in [GOOGLE_RATINGS_SETUP.md:7-8](../GOOGLE_RATINGS_SETUP.md:7):
"Until you complete this setup, that badge just doesn't appear anywhere.
Nothing else on the site depends on it." **Verdict: working-as-intended
stub, not a bug or dead feature** — it's a manual, occasionally-run step
([scripts/fetch-google-ratings.mjs](../scripts/fetch-google-ratings.mjs))
the site owner hasn't run yet (or runs periodically), by design, precisely
so no API key/traffic touches the Places API from visitors' browsers.

---

## 4. `assets/paddles.json` — confirmed-unused fields (486 records × 27 fields)

Read [assets/paddle-quiz.js](../assets/paddle-quiz.js) in full — the only file anywhere in the repo that
touches `paddles.json` (confirmed via the fetcher grep in the intro table).
Cross-checked every one of the 27 keys actually present in the data
(`python3 -c "..." ` union over all 486 records) against usage in
`paddle-quiz.js`, then re-verified the zero-hit fields with a second,
broader grep (not just `.field` dot-access, in case of bracket/destructure
access) across `assets/*.js`, all `*.html`, `cities/*.html`, and
`scripts/*.mjs`.

**Used (16 of 27):** `id, name, brand, price, approvalBody, shape, paddleType,
impactFeel, coreThicknessMm, weightOz, twistWeightPercentile, balancePointMm,
spinRating, powerPercentile, vendorUrl, vendorSearchBase` — with concrete
call sites:

- `paddleType`, `powerPercentile`: [assets/paddle-quiz.js:73-91](../assets/paddle-quiz.js:73) (`styleScore`)
- `impactFeel`: [assets/paddle-quiz.js:81-82](../assets/paddle-quiz.js:81) (control-score adjustment), [assets/paddle-quiz.js:177](../assets/paddle-quiz.js:177) (`factsFor` → `FEEL_COPY`)
- `spinRating`: [assets/paddle-quiz.js:86-87](../assets/paddle-quiz.js:86), [assets/paddle-quiz.js:199](../assets/paddle-quiz.js:199)
- `twistWeightPercentile`: [assets/paddle-quiz.js:94-97](../assets/paddle-quiz.js:94) (`forgivenessScore`), [assets/paddle-quiz.js:191-192](../assets/paddle-quiz.js:191)
- `weightOz`: [assets/paddle-quiz.js:101-105](../assets/paddle-quiz.js:101) (`weightPrefScore`), [assets/paddle-quiz.js:186](../assets/paddle-quiz.js:186), [assets/paddle-quiz.js:216](../assets/paddle-quiz.js:216) (`weightRel`)
- `approvalBody`: [assets/paddle-quiz.js:111](../assets/paddle-quiz.js:111) (`isTournamentLegal`)
- `vendorSearchBase`, `vendorUrl`, `brand`: [assets/paddle-quiz.js:118-126](../assets/paddle-quiz.js:118) (`vendorLinkFor`)
- `price`: [assets/paddle-quiz.js:130-134](../assets/paddle-quiz.js:130) (`PRICE_BUCKETS`), [assets/paddle-quiz.js:215](../assets/paddle-quiz.js:215), [assets/paddle-quiz.js:276](../assets/paddle-quiz.js:276) (pool filter), [assets/paddle-quiz.js:432](../assets/paddle-quiz.js:432) (rendered)
- `shape`: [assets/paddle-quiz.js:177](../assets/paddle-quiz.js:177) (`SHAPE_COPY` fallback when `impactFeel` doesn't map)
- `coreThicknessMm`: [assets/paddle-quiz.js:180-183](../assets/paddle-quiz.js:180) (`factsFor` thickness)
- `balancePointMm`: [assets/paddle-quiz.js:219](../assets/paddle-quiz.js:219) (`RELATIVE_FIELDS` balance)
- `name`, `id`: rendered / collected throughout ([assets/paddle-quiz.js:429](../assets/paddle-quiz.js:429), [assets/paddle-quiz.js:502](../assets/paddle-quiz.js:502))

**Confirmed unused (11 of 27) — zero references anywhere in the repo, not
just `paddle-quiz.js`:**

```
firepowerTier, gripLengthIn, gripSizeIn, popMph, popPercentile,
powerMph, spinRpm, swingWeight, swingWeightPercentile, twistWeight, year
```

Evidence: for each name, `grep -rn "<field>" assets/*.js *.html cities/*.html
scripts/*.mjs` returned zero matches (checked both a strict `.field`
dot-access pattern and a looser bare-substring pattern to rule out
bracket/destructure access or accidental match — e.g. `twistWeight` needed
the looser check to make sure it wasn't hiding inside `twistWeightPercentile`,
and it came back clean; `year` needed the same check against prose
containing the word "year", also clean).

These are **not sparse/placeholder fields** — most have real data on most
records (`gripSizeIn`, `swingWeight`, `swingWeightPercentile`, `twistWeight`,
`year`: 486/486 non-null; `gripLengthIn`: 483/486; `powerMph`: 357/486;
`popMph`: 354/486; `popPercentile`/`firepowerTier`/`spinRpm`: ~348-353/486).
So this is populated data the quiz simply never reads — not fields quietly
waiting on incomplete source data.

**Size impact of removing them**, measured directly (`json.dumps` minified,
before/after, all 486 records):

- Current file on disk: 358,706 bytes (pretty-printed)
- Current minified: 304,421 bytes
- With the 11 unused fields stripped, minified: 199,807 bytes
- **Savings: 104,614 bytes, ≈34% of the minified payload**

Two independent, stackable wins here: (1) drop the 11 unused fields — 34%
smaller — and (2), separately, the file is currently served pretty-printed;
minifying alone saves another ~54KB (15%) with zero logic change. Doing both
takes the payload from 358,706 bytes down to roughly 199,807 bytes minified
— a **44% reduction** — for a file that's fetched by every visitor who opens
`/paddle-quiz`.

---

## Summary, ranked by estimated payload/maintenance savings

1. **`paddles.json`: strip 11 confirmed-unused fields + minify** — ~159KB
   (44%) off a 358KB file fetched by every paddle-quiz visitor. Highest
   confidence (exhaustive grep, cross-checked twice), highest payoff.
2. **`courts-data.json`/`venues.json`: don't merge; add a small
   generation script making `courts-data.json` canonical** — closes the
   only real drift risk found (currently 0 mismatches, but 0 enforcement),
   without regressing the two lightest consumers (`global-search.js`,
   `rankings.js`) or `map.js`, all of which a merge would make worse under
   this repo's no-build-step constraint.
3. **(Bonus, outside the merge/no-merge question) `global-search.js`'s
   sitewide full-`courts-data.json` fetch for a 5-field lookup** is the
   actual biggest per-pageview waste in this data set — worth a follow-up
   look at splitting a small dedicated search index, independent of what
   happens with `venues.json`.
4. **`google-ratings.json`**: confirmed working-as-intended stub, not a
   bug — no action needed.
