# Maintainer runbook

The one place that lists the update sequences. Each is a short, ordered
checklist — follow it top to bottom so the derived files never drift. All
commands run from the repo root. `npm run validate` is also the Firebase
`predeploy` hook, so a broken data edit blocks deploy automatically.

---

## Update a venue (closed, new hours, court count, added/removed)

1. Edit the source of truth: **`assets/courts-data.json`** (name, city,
   `indoorOutdoor`, `courts`, `hours`, `price`, `confirmed`, etc.).
2. Regenerate the map files: `npm run generate-venues`
   (derives `assets/venues.json` **and** the map's pre-joined
   `assets/map-data.json`; aborts if any venue is missing a geocode).
   `npm run validate` fails if `map-data.json` drifts from its sources, so this
   step can't be skipped.
3. Reconcile the city-page cards: `npm run check` (runs `validate` +
   `check-venue-cards`). `node scripts/check-venue-cards.mjs --fix` auto-fixes
   the bold court-count number; hours/skill mismatches are warnings you resolve
   by hand.
4. Hand-edit the venue's prose card in **`cities/<city>.html`** (the sentence
   description, the `Sources:` line, and the "Verified <month>" text).
5. `npm run validate` → must print ✔ before you deploy.

New venue also needs lat/lon: add `lat`/`lon` to its `venues.json` entry
(geocode the address once) or `generate-venues` will refuse to write.

## Refresh the paddle database (quarterly, or on a new export)

1. Export a fresh copy of the PickleballEffect database to
   `../Paddle Database.numbers` (kept out of git; see `PADDLE_DATA_SETUP.md`).
2. `pip install numbers-parser` (first time only).
3. `python3 scripts/rebuild_paddle_data.py "../Paddle Database.numbers"`
   — regenerates `assets/paddles.json`. Percentiles are coarsened to quartile
   tiers on the way out (data-licensing firewall — do not undo).
4. Resolve any "unmapped brand" warning by adding the brand to
   `scripts/paddle-vendor-map.json`.
5. `npm run validate` → confirms unique ids and that percentiles are still
   coarsened tiers.
6. `npm run generate-paddles` → rewrites the 486 detail pages and the sitemap's
   paddle region from the new data. **Skipping this leaves every detail page
   showing the old specs and prices**, and any paddle dropped from the export
   keeps a live page until the generator prunes it.
7. `npm run hash` → the regenerated pages need a current import map.

## Paddle detail pages (486 of them, one template)

`/paddles/browse/p/<id>` is a real prerendered file per paddle, not a client
route — that is what makes them indexable and what makes an unknown slug a hard
404 instead of a soft one. `<id>` is the paddle's `id` from `assets/paddles.json`
verbatim; never re-derive a slug from brand+name, because `id` is also the ASIN
lookup key in `assets/affiliate-map.json`.

Edit **`partials/paddle-detail-template.html`**, never a generated page — every
file under `paddles/browse/p/` is overwritten on the next run. Then:
`npm run generate-paddles && npm run hash`.

Two things that bite:

- **`scripts/sync-header.js` cannot reach these pages.** Its `targets()` is not
  recursive, so a header change followed by `npm run sync` updates 53 pages and
  silently leaves 486 with the old nav. The generator inlines the header itself,
  so **after any edit to `partials/site-header.html` you must also re-run
  `npm run generate-paddles`.** `npm run check` catches the drift if you forget.
- **Never create `paddles/browse/index.html`.** A directory index shadows the
  sibling `paddles/browse.html` and `/paddles/browse` starts serving the wrong
  page with no error anywhere. The `paddles/browse/` directory itself is fine.

## Refresh Google ratings (monthly, optional — needs an API key)

1. `GOOGLE_PLACES_API_KEY=… node scripts/fetch-google-ratings.mjs`
   — writes `assets/google-ratings.json` (keeps last-known-good on errors).
2. Commit the file. Badges show a hardcoded `fetchedAt` date; this is a manual
   refresh, not a live sync (see `GOOGLE_RATINGS_SETUP.md`).

## Paddles (three pages)

`/paddles` is the quiz, `/paddles/browse` the catalog, `/paddles/rent` the shop
directory — `paddles.html`, `paddles/browse.html`, `paddles/rent.html`. The
section nav is inlined on all three; edit one, edit all three (the invariant
check fails if a lane stops linking to the other two). `/paddles#quiz` is the
CTA on 43 pages, so the quiz must stay at `/paddles` with that anchor intact.
Buy links and click tracking come from `assets/affiliate-links.js`; the trait
ratings from `assets/paddle-ratings.js`. Neither is duplicated — don't.

## Site-wide chrome (nav / head / lane-router)

- Header: edit `partials/site-header.html` → `node scripts/sync-header.js`
  (covers root pages + `cities/*` + `paddles/*`; add a directory to `targets()`
  when you add one, or its pages silently keep a stale nav forever). **It does
  not recurse**, so the 486 pages under `paddles/browse/p/` need
  `npm run generate-paddles` as well — see the paddle detail pages section.
- "Before you head out" block: edit `partials/lane-router.html` →
  `node scripts/sync-lane-router.js`.
- `<head>` boilerplate (fonts, favicons, OG/Twitter tags) is **hand-maintained
  per page**. It used to be generated by `scripts/build.mjs`, which was retired
  in July 2026: it was a second generator that also owned the `<header>`, and it
  had drifted badly — it still carried the pre-dropdown flat nav and a "More"
  menu missing the legal links, so running it would have silently reverted the
  live header. Nothing in `npm run check` covered it, so the drift was invisible.
  The header now has exactly one owner (`sync-header.js`), and the footer stays
  deliberately per-page (see below). Recover the old file from git history if you
  ever want the head templating back — but give it a `--check` in `npm run check`
  first, or it will rot the same way.

## Editing an ES module → run `npm run hash`

`assets/*.js` modules are content-hashed into `assets/m/<name>.<hash>.js`, and
every page that loads one carries a generated `<script type="importmap">`
pinning the whole graph. **Edit a module, then run `npm run hash`** (same shape
as `npm run sync` for the header partial) and commit the result.

You cannot forget: `npm run check` and the Firebase **predeploy** hook both run
`hash-modules.mjs --check`, so a stale import map blocks the deploy.

Why it exists: modules import each other by bare path, so when a shared export
moved between two of them, browsers holding one stale sibling got *"does not
provide an export named X"*, the module aborted, and the quiz — the revenue
funnel — sat on "Loading…" forever. The import map fixes that structurally: a
document resolves EVERY specifier through the one map it was served with, so
you get a wholly-new graph or a wholly-old one, never a mix. Hashed files are
`immutable` (cached a year); the unhashed originals stay on disk as `no-cache`
so a browser too old for import maps still resolves the plain paths.

Module **source is never rewritten** — it still says
`import … from "/assets/paddle-ratings.js"`. Only the HTML changes. That keeps
diffs readable and means a hash change never cascades into its importers.

The `data-mount-pending` watchdog (`assets/mount-watchdog.js`) remains the
backstop: if a module still fails to boot for any reason, the placeholder
becomes an honest error plus a Reload button instead of hanging forever.

## Deploy

1. `npm run validate` (also runs automatically as the `predeploy` hook).
2. `firebase deploy --only hosting` (or add `,firestore` when rules change).
3. Spot-check: the changed city page, `/map`, `/rankings`, and that
   `/pickleheads-research/*.json` and `/assets/paddles.json` don't expose raw
   research or raw percentiles.

## npm scripts

| Command | What it does |
|---|---|
| `npm run validate` | Data-integrity gate (lockstep, ids, enums, paddle tiers). Predeploy hook. **Data only — it never opens an .html file, so it cannot catch a broken page.** |
| `npm run check` | `validate` + `check-venue-cards` + `check-redesign-invariants` (fuller pre-deploy pass). |
| `node scripts/check-redesign-invariants.mjs` | The HTML/JS contract `validate` can't see: the map ids that are dereferenced unguarded, the `data-pq-*` revenue attributes, the verbatim Amazon Associates sentence, the single-definition rule for `vendorLinkFor`, the sync-script anchors, and the fonts/tokens. Add an assertion here whenever you find a hook whose loss would be silent. |
| `npm run generate-venues` | Rebuild `venues.json` + `map-data.json` from `courts-data.json`. |
| `npm run sync` | Re-inject the shared header + lane-router partials. |
