# Refreshing the paddle database (Find your paddle)

The [Find your paddle](/paddle-quiz) quiz is powered entirely by
`assets/paddles.json` — a cleaned, tagged, minified export built from a
"Paddle Database.numbers" download from pickleballeffect.com. This doc
covers what to do the next time you download a fresh export and want to
refresh the site's data: what the automated script handles, what still
needs a human, and how to verify the result before shipping it.

**Read this before you touch anything if you haven't already: see the
"Data licensing" section below.** The underlying performance data
(spin/power/twist-weight percentiles, the "Firepower" tier) is
PickleballEffect's own lab-tested proprietary content — their terms
prohibit commercial reproduction of it. The site works around this by
using those numbers only internally (to rank paddles) and never
displaying PickleballEffect's own labels, percentiles, or attribution
anywhere public. Keep it that way when you refresh the data — see that
section for the full reasoning before you re-add anything that looks like
a raw stat or a credit line.

## What you need

- Python 3 with `numbers-parser` installed: `pip install numbers-parser`
  (this is the only library that reliably reads Apple Numbers'
  Snappy-compressed-protobuf format; there's no good JS equivalent, which
  is why this one script is Python in an otherwise all-JS repo)
- The new `Paddle Database.numbers` file downloaded from
  pickleballeffect.com

## Running it

```
python3 scripts/rebuild_paddle_data.py "/path/to/Paddle Database.numbers"
```

This overwrites `assets/paddles.json` directly. It will print a summary
(paddle count, skill-level distribution, how many paddles got a verified
on-site search link) and — importantly — **a warning if it finds any
brand it doesn't recognize**. If you see that warning, stop and do the
vendor research in step 5 below before deploying; an unmapped brand just
means that brand's paddles get no vendor link at all (safe, but a worse
experience) — it's the one thing this script can't do for you
automatically.

After it runs, follow the verification steps at the bottom of this doc
before you commit/deploy — they take under a minute and would have caught
real bugs found during this script's own development and review (see
"Known gotchas").

## What the script does, step by step

### 1. Parse the .numbers export

`doc.sheets[0].tables[0]` grabs the sheet/table **positionally** — it is
NOT a name-based lookup, even though every export so far has had the
paddle data in "Sheet 1" / "Grid view". If PickleballEffect ever reorders
or adds a sheet/table ahead of the data one, this will not raise a clean
"not found" error — it will silently hand back the wrong table, and
you'll most likely get a confusing `KeyError` (see the column-validation
note just below) or, worse, a run that completes but writes garbage. If a
refresh ever produces obviously-wrong output (paddle count far from
~486, mostly-empty fields), check this first.

`load_rows()` does validate that the table it finds has every column the
rest of the script expects (`REQUIRED_COLUMNS` in `rebuild_paddle_data.py`
— currently 13 exact column names: Paddle Name, Brand, Price, Approval
Body, Shape, Paddle Type, Impact Feel, Core Thickness (mm), Weight (oz),
Twist Weight Percentile, Balance Point (mm), Spin Rating, Power
Percentile) and exits with a clear message listing exactly which columns
are missing if not — so a renamed *column* fails loudly, even though a
reordered *sheet/table* does not.

### 2. Clean paddle names

A handful of rows have a colorway or a "no weights" kit variant baked
directly into the name, e.g. `Metalbone EVA 16mm (red no weights)`. The
script strips exactly two patterns — a trailing `(<color>)` and any
`(...no weights...)` — and leaves everything else alone. This matters
because thickness/version/shape markers like `(14mm)`, `(Lite)`, or
`(2024 version)` distinguish genuinely different products, not just a
colorway of the same one; a blanket "strip all parentheses" rule would
have mangled those too. In the July 2026 export this removed a color/
no-weights annotation from exactly 4 names, all from the same
"Metalbone" line; the same regex pass also normalizes incidental
double-spaces/trailing whitespace on every name (not just those 4), so
don't be surprised if a diff shows a few more names with only whitespace
changes.

### 3. Fix known brand-name typos

The source spreadsheet has had inconsistent brand spellings before —
`Element 6` vs `Element6`, `Enhnace` vs `Enhance`, `GRUVN` vs `Gruvn`. The
script normalizes these to whichever spelling was more common in the July
2026 export, via a hardcoded `BRAND_FIXES` dict. **If a new export
introduces new inconsistent spellings, you'll need to spot and add them
here** — compare `sorted(set(row["Brand"] for row in raw_rows))` before
and after a refresh and look for near-duplicates.

### 4. Assign a stable-ish id

Slugified from `brand + name` (lowercased, non-alphanumerics collapsed to
`-`). Ids aren't guaranteed to stay byte-identical across a full refresh —
see "Known gotchas" below — but that's fine, since nothing outside this
file depends on a specific paddle keeping the same id release to release
(it's just used for `recommendedPaddleIds` in a submitted quiz lead,
which is a point-in-time record, not a live reference).

Duplicate slugs (two rows that produce the same brand+name — usually
colorway variants of the same paddle that step 2 intentionally collapses
to one name) get a `--dupN` suffix, not `-N`. This is deliberate: a
single dash is exactly what `slugify()` already produces between words,
so a real product whose name happens to end in a number (e.g. Friday's
"Fever 2" → id `friday-fever-2`) could otherwise collide with an
auto-generated `-2` suffix on an unrelated duplicate row of a
differently-named product (Friday's "Fever" → id `friday-fever`, whose
*second* occurrence would become `friday-fever-2` too under a naive
`-N` scheme). `slugify()` collapses every run of non-alphanumeric
characters to a single dash, so it can never itself produce a double
dash — making `--dupN` a suffix no real product name can ever coincide
with.

### 5. Attach vendor links — the one step that needs a human

The source spreadsheet's own "Link to Paddle" column is **never** carried
forward — those are PickleballEffect's own `short.gy` affiliate links, and
using them would route any click (and any resulting commission) to them,
not you. Instead, every paddle is linked through
`scripts/paddle-vendor-map.json`, a brand → vendor-site mapping with two
tiers:

- **`vendorUrl`** — the brand's own homepage or shop page. Safe to link to
  for any brand, always used as the fallback.
- **`searchVerified: true`** — set only for brands where
  `{origin of vendorUrl}/search?q=<query>` was *actually fetched* and
  confirmed to return real, relevant product results — not a 404, not a
  bot-block, not the wrong department. When set, paddles from that brand
  get a "Search {brand} →" link straight to results for that exact paddle
  name instead of just the brand's homepage.

As of the July 2026 export, 48 of 56 brands have `searchVerified: true`.
The 8 that don't, and why:

| Brand | Why unverified |
|---|---|
| Callaway, Element6 | `/search?q=` returned a real HTTP 404 — confirmed broken, not just blocked |
| Adidas, Franklin, Head, Vulcan, Wilson | Blocked automated fetching (403) at verification time — inconclusive either way |
| Versix | Had an expired TLS certificate at verification time |

**If this script warns about an unmapped brand** (one that doesn't appear
in `paddle-vendor-map.json` at all — i.e. a brand new to this export),
research it the same way before adding an entry:
1. Find the brand's real official site (not a retailer/marketplace like
   Amazon, not a review aggregator).
2. Try fetching `{that site's origin}/search?q=<a real paddle name from
   that brand>` and check it returns actual matching products.
3. Add an entry to `paddle-vendor-map.json`: `{"vendorUrl": "...", "searchVerified": true}` if it worked, or just `{"vendorUrl": "..."}` if you
   couldn't confirm search but found the real site, or omit the brand
   entirely if you can't even confirm a real site (the script will then
   link nothing for that brand, which is the safe default).

**Do not guess at a search URL pattern without verifying it fetches real
results.** Two brands in the current map (Callaway, Element6) looked like
they should support the same `/search?q=` pattern every similar Shopify
store did, and both actually 404'd — verify, don't assume.

### 6. Tag skill level (Beginner / Intermediate / Advanced)

There's no skill-level column in the source data — this is derived from
three specs that actually correlate with who a paddle suits:

- **Forgiveness** (twist weight percentile) — a bigger sweet spot is
  easier to learn on. `>= 0.6` nudges toward Beginner, `<= 0.35` nudges
  toward Advanced.
- **Core thickness** — very thick (`>= 17mm`) reads as quieter/more
  forgiving; very thin (`<= 13mm`) reads as more specialized/poppy. The
  14–16mm range (~85% of the market) is deliberately treated as neutral —
  it's too common to mean anything on its own.
- **Paddle type** — `Control` paddles reward learning placement before
  power (nudges Beginner); `Power` paddles reward players who already
  make consistent, precise contact (nudges Advanced).

Each factor contributes `+1`/`0`/`-1`; a net score `>= 1` is tagged
Beginner, `<= -1` is tagged Advanced, otherwise Intermediate. Calibrated
against the July 2026 export to a 130 Beginner / 159 Intermediate / 197
Advanced split — the lean toward Advanced reflects the real market (lots
of today's paddle designs chase raw power), not a bug in the thresholds.
If you change these thresholds, re-run the verification in this doc
afterward to sanity-check the new distribution isn't wildly lopsided.

This tag is shown directly in the quiz results (a "Best for" badge) and
counts for real in the ranking — see `skillMatchScore` in
`assets/paddle-quiz.js` for how much it's worth and why.

### 7. Write compact JSON

`assets/paddles.json` is written as a single minified line (no
indentation, no extra whitespace) — this is a real payload-size choice,
not an accident, since every quiz page-load fetches this file. **If you
ever hand-edit this file, re-minify it before committing** — pretty-
printing it inflates the file from ~210KB to ~1MB+ for no benefit, and a
future `git diff` on it becomes unreadable either way since it's one line.

## Manually-added paddles (brands the export doesn't carry)

The PickleballEffect export isn't a complete market — it's missing several
prominent brands (Onix, Yonex, Legacy, Electrum, Recess, Prince, Nettie, Master
Athletics, …). Those paddles were researched from the manufacturers' own sites
and live in **`scripts/manual-paddles.json`**. `rebuild_paddle_data.py` merges
them back in on every run (`load_manual_paddles` → `build_manual_records` →
`merge_manual_into_catalog`), so **a refresh no longer silently drops them** —
which is exactly what would happen if they only existed in the built
`assets/paddles.json`.

Rules of the road:

- **`manual-paddles.json` holds only raw manufacturer facts** — name, brand,
  price, shape, paddle type, core thickness, weight, grip length/size, year,
  and USA-Pickleball approval. It carries **none** of PickleballEffect's
  lab-tested fields (twist/power/spin/swing percentiles, balance point, impact
  feel), because these paddles genuinely haven't been through that bench. The
  site already renders such rows as **"specs only"** and degrades every view
  rather than drawing an empty chart (see `hasLab()` in
  `assets/paddle-model.js`). So there's no licensing question here — nothing
  proprietary is reproduced. Don't add a percentile/lab field to this file.
- **Shape/type/approval must match the same enums the rest of the file uses:**
  `shape` ∈ {Elongated, Widebody, Hybrid, Extra-elongated}; `paddleType` ∈
  {Power, Control, All-Court}; `approvalBody` ∈ {USAP, USAP/UPA-A, UPA-A,
  Unapproved} — or omit/null it if the paddle isn't on the USA Pickleball list
  (Nettie, e.g., is manufacturer-claimed but not on the list, so its approval is
  left null rather than asserted). Any missing spec is left null and dropped,
  exactly like the export path.
- **Every manual brand still needs a `paddle-vendor-map.json` entry** (step 5) —
  the rebuild warns about an unmapped manual brand the same way it does an
  export one.
- **The export always wins a collision.** If PickleballEffect later tests one of
  these paddles, its row (with real lab data) is produced from the export and
  the manual copy with the same id is skipped automatically — no edit needed.
- To add another paddle: append it to `manual-paddles.json`, add the brand to
  `paddle-vendor-map.json` if new, then run the rebuild (or, if you're editing
  `assets/paddles.json` directly without a fresh `.numbers` file, run
  `npm run generate-paddles && npm run hash && npm run check`).

## Data licensing — read this before changing what's stored or shown

PickleballEffect's terms say the data on their site is proprietary,
personal-research-use-only, and that commercial use/reproduction is
prohibited. This site is a commercial lead-gen tool (the quiz captures
emails), so the working compromise, established when this pipeline was
built, is:

- The proprietary lab-tested numbers (spin RPM, power/pop MPH, swing/
  twist weight, the "Firepower" tier) are used **internally only** — to
  rank and categorize paddles — and are **never displayed** anywhere on
  the site, not even as a chip or in a tooltip.
- No page anywhere credits, links to, or names PickleballEffect.
- The dataset itself (`assets/paddles.json`) is still a public, fetchable
  static file. To avoid republishing PickleballEffect's *exact* lab
  numbers, every percentile field it carries (`twistWeightPercentile`,
  `powerPercentile`, `spinPercentile`, `swingWeightPercentile`) is
  **banded to a band midpoint** by `coarsen_percentile()` before it's
  written — so the file exposes a bucket, not their measurement.
  `scripts/validate.mjs` fails the build on any value that isn't a legal
  band midpoint; that guard is what stops a raw percentile reaching the
  public file by accident, so keep the two in sync. The only way to fully
  firewall even the band is to move scoring server-side (a Cloud
  Function), which hasn't been built.

  **Resolution changed on 2026-07-18: 4 quartile tiers → 20 bands**
  (`PERCENTILE_BANDS`). Four tiers put the entire 486-paddle catalog on
  twenty distinct positions on a two-axis chart, so the scatter drew
  stacks of "identical" paddles and quiz podiums tied on every term about
  39% of the time. Twenty bands recovers 253 of the 403 positions the raw
  numbers would give. The firewall is unchanged **in kind** — what ships
  is still a band midpoint and never the measurement — only the
  resolution moved. Going all the way to raw was considered and rejected:
  it would publish their exact lab-derived percentiles from a commercial
  site, which is precisely what this section exists to prevent.

- `spinPercentile` is **derived by this pipeline**, not copied: the export
  gives a raw `Spin (RPM)` measurement with no percentile column, so
  `rank_percentile()` ranks it within the catalog and the result is banded
  like the rest. The four-word `Spin Rating` column is kept alongside it
  for the grid's spec chip, but it only has four values — which is why it
  can't carry the charts on its own.
- Basic specs (name, brand, price, weight, shape, core thickness, and —
  added 2026-07-18 — grip length, grip size, year released, grit type,
  build type) are treated as safe to keep, since those are just
  manufacturer facts that exist independent of PickleballEffect's own
  analysis — not their proprietary work product.

- **The `Discount Code` column is deliberately NOT imported.** The
  2026-07-18 export added it, and it is not yours: 377 rows carry
  `PBEFFECT` (PickleballEffect's own code) and 40 carry `INF-BRAYDONU`
  (an influencer's). Shipping them would route your traffic through
  someone else's affiliate relationship, earn you nothing, and name
  PickleballEffect on the site — which the second bullet above forbids.
  This is the same rule already applied to their "Link to Paddle" column
  (see step 6). Your own links live in `scripts/paddle-vendor-map.json`
  (brand → official site, baked into paddles.json at build time) and
  `assets/affiliate-map.json` (the served affiliate overlay, including the
  Amazon Associates tag and 26 verified per-paddle ASIN deep-links).
  **`affiliate-map.json`'s `asins` map is keyed by paddle id**, so after
  any rebuild that changes ids — name cleaning and brand-typo fixes both
  can — re-check that every ASIN key still resolves, or those paddles
  silently drop from a deep-link to a search link.

**If you add a new field to `assets/paddles.json` from a future export,
ask first: is this a raw manufacturer spec (safe), or one of
PickleballEffect's own lab-tested/derived metrics (keep it
internal-only, never display it, never re-add their branding/labels)?**

## Known gotchas (found while building this script)

- **`vendorSearchBase` must come from the vendor's origin, not the full
  `vendorUrl`.** Some brands' `vendorUrl` points at a specific page (e.g.
  Babolat's is `.../us/pickleball/paddles.html`), but the verified search
  route always lives at the domain root. Appending `/search?q=` to the
  full `vendorUrl` instead of just its origin produces a broken
  double-path URL. The script handles this correctly (see
  `vendor_fields()` in `rebuild_paddle_data.py`) — this is called out
  here so nobody "simplifies" it back to the wrong version later.
- **Id collisions are possible with a naive `-N` dedup suffix — use
  `--dupN` instead.** See step 4 above for the full "Friday Fever" / "Fever
  2" example. This was a real bug during this script's development, not a
  hypothetical: caught by a code-review pass that cross-referenced the
  live `assets/paddles.json` and found the exact real-product id pair
  that a naive scheme would have collided with on a future refresh.
- **Ids can shift slightly on a full refresh.** A few ids in the current
  `assets/paddles.json` were generated before the name-cleanup and
  brand-typo-fix passes existed, so they still contain the old
  uncleaned name/brand (e.g. an id containing `-red-no-weights` even
  though the displayed name no longer does). This script generates ids
  *after* cleaning, which is the more correct behavior — a small number
  of ids will change the first time you run it, which is expected and
  harmless (ids aren't displayed or referenced outside this file).
- **Blank/missing cells in `Paddle Name` or `Brand` are handled, not
  crashes.** A blank `Paddle Name` becomes `"Unnamed paddle"` and a blank
  `Brand` becomes `"Unknown"` rather than raising a `TypeError` deep in a
  loop over 486 rows with no indication of which row failed. If you see
  either of these in the output, that's a signal to go check the source
  spreadsheet for a genuinely blank row, not a script bug.

## Verifying the result

After running the script (or after changing any of its logic), it's
worth checking that it actually did what this doc claims. **Run this from
the repo root** (it uses paths relative to it). The helper functions
(`skill_level`, `clean_name`, `load_vendor_map`, etc.) can be imported and
tested even without `numbers-parser` installed — that dependency is only
imported lazily, inside `load_rows()`, which this snippet never calls:

```python
import sys, json
sys.path.insert(0, 'scripts')
import rebuild_paddle_data as script

d = json.load(open('assets/paddles.json'))

# skillLevel is derived from the RAW twist-weight percentile at build time,
# but assets/paddles.json stores the COARSENED percentile (see coarsen_
# percentile / the Data licensing section) — so it can no longer be recomputed
# from the served value. This check therefore only holds against a fresh raw
# export, not the shipped file: skip it here, or re-run the rebuild and diff
# the resulting skillLevel column instead. What IS still checkable on the
# served file is that every percentile is one of the four allowed tiers:
allowed = {None, 0.13, 0.38, 0.63, 0.88}
bad_tiers = [p['name'] for p in d
             if p['twistWeightPercentile'] not in allowed
             or p['powerPercentile'] not in allowed]
print('un-coarsened percentiles:', len(bad_tiers))  # expect 0

# Every brand should either have a vendor link or be a known gap.
vendor_map = script.load_vendor_map()
unmapped = sorted({p['brand'] for p in d if p['brand'] not in vendor_map})
print('unmapped brands:', unmapped)  # expect [] on a clean run

# No two paddles should ever share an id (would corrupt anything keyed on
# it, e.g. recommendedPaddleIds in a submitted quiz lead).
from collections import Counter
dupe_ids = [pid for pid, n in Counter(p['id'] for p in d).items() if n > 1]
print('duplicate ids:', dupe_ids)  # expect []
```

Then spot-check the live quiz in a browser (see the `verify` skill / this
repo's usual preview workflow) — run through it a few times with
different answers and confirm the "Best for" badges and vendor links
look sane before deploying.
