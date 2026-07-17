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

## Refresh Google ratings (monthly, optional — needs an API key)

1. `GOOGLE_PLACES_API_KEY=… node scripts/fetch-google-ratings.mjs`
   — writes `assets/google-ratings.json` (keeps last-known-good on errors).
2. Commit the file. Badges show a hardcoded `fetchedAt` date; this is a manual
   refresh, not a live sync (see `GOOGLE_RATINGS_SETUP.md`).

## Paddles & Gear (three pages)

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
  when you add one, or its pages silently keep a stale nav forever).
- "Before you head out" block: edit `partials/lane-router.html` →
  `node scripts/sync-lane-router.js`.
- (`scripts/build.mjs` regenerates head/header/footer from a template but its
  `--check` currently fails extraction across all pages — prefer the `sync-*`
  scripts above.)

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
| `npm run build` | Regenerate head/header/footer boilerplate (see caveat above). |
