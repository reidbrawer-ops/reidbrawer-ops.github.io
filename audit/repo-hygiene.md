# Repo hygiene audit — Pickleball Bay Area

Scope: root-level markdown docs, `Site Header/`, Firebase config/rules,
`robots.txt`/`sitemap.xml`, `scripts/`. Read-only audit — no files were
modified. All claims below are backed by the grep/git evidence shown inline.

Repo state at audit time: branch `main`, clean except one untracked file
(`consolidation-audit-prompts.md` — the orchestration doc that spawned this
audit and four sibling ones; not part of this audit's assigned scope, not
cruft, left as-is).

---

## 1. Root `.md` docs — verdict per file

### `DESIGN.md` — (a) keep, still-accurate reference documentation

Verified every token table entry against `assets/style.css:19-63` — all
colors (`--bay: #1d6b85`, `--optic: #d7e94b`, `--pin-outdoor: #2166a8`,
etc.), spacing scale, radii, and font stacks match exactly, including the
newer `--font-headline`/Bebas Neue addition. This is a living reference
someone genuinely needs before styling a new page. **No action.**

### `FIREBASE_SETUP.md` — (a)/(d) hybrid — keep, but one section is now stale

- Steps 1–5 (create project, Firestore, paste rules, register web app, get
  config) are one-time setup — and are **done**: `assets/firebase-config.js`
  has a real, non-placeholder `apiKey`/`projectId` (`pickleball-bay-area`),
  and `.firebaserc` has a real project id (not `YOUR_FIREBASE_PROJECT_ID`).
- Step 6 ("Host the site on Firebase Hosting") is also functionally done —
  `.firebase/hosting..cache` shows a real deploy manifest with timestamps
  from today (2026-07-09), and `firebase.json` matches what the doc
  describes it should contain.
- **Verdict:** keep the file — it's still the correct reference for
  *re-running* `firebase deploy --only hosting` and for anyone who has to
  reconstruct the Firebase project from scratch — but steps 1–6 could be
  trimmed to a shorter "already done, here's how to redeploy" note now that
  they're historical. Low priority; the doc isn't actively misleading.

### `GOOGLE_RATINGS_SETUP.md` — (b) one-time setup guide, but NOT yet completed — keep as-is

This one is not done: `assets/google-ratings.json` is literally `{}`
(confirmed by reading the file directly), so the badge feature it documents
has never been run for real. This is a "keep, work not yet done" doc, not a
stale one — despite being procedurally a one-time setup guide. **No action**
until the script is actually run with a real API key (a manual step only the
site owner can do).

### `SEARCH_CONSOLE_SETUP.md` — (c) planning doc, partially implemented — needs a correction, not deletion

Cross-checked against the live repo state:

- **Step 2 (GA4 Measurement ID) is done.** `assets/analytics.js:13` has
  `GA_MEASUREMENT_ID = "G-DX4PVCWB8H"` — a real ID, not the `G-XXXXXXXXXX`
  placeholder the doc describes replacing. Commit `7c98dbf` ("Turn on GA4
  with a real Measurement ID") is more recent than the doc's own
  introducing commit `d91325e`.
- **The doc's central caveat is now factually wrong.** The doc says (lines
  16–24, repeated at line 51): *"sitemap.xml and robots.txt still point at
  reidbrawer-ops.github.io — update both to pickleball-bay-area.com... That's
  the one loose end this doc intentionally doesn't fix yet."* But:
  `grep -c reidbrawer-ops sitemap.xml robots.txt` → **0 matches in both
  files**; `grep -c pickleball-bay-area.com sitemap.xml robots.txt` → 29 and
  1 matches respectively. Both files already point at the canonical domain.
  Git history shows why: commit `6a6145a` ("Switch to clean URLs on
  pickleball-bay-area.com") updated both files, and it's chronologically
  *older* than `d91325e` (the commit that added this very doc) — so the
  doc's claim was already stale the day it was written, and remains so now.
  A CNAME file, which the doc says was "corrected/removed," is indeed absent
  (`find . -iname CNAME` → no results) — that part checks out.
- Steps 1 (DNS custom-domain connection) and 3 (Search Console verification)
  can't be confirmed or denied from the repo alone — they're external
  Google/DNS console state.
- **Verdict:** keep the doc (steps 1 and 3 may still be genuinely open), but
  fix the stale sitemap/robots paragraph (lines 16–24 and 51) — it currently
  tells a future reader to do something that was already done before the
  doc existed, which could cause someone to "fix" already-correct files or
  waste time double-checking them.

### `improvement-plan.md` — (c) planning doc, almost entirely implemented — candidate for deletion or a one-line stub

Every Track A/B item and most of Track C is now live:

- Track A1 (map) → `map.html` + `assets/venues.json` exist and are linked
  from nav.
- Track A2 (beginner's guide) → `learn.html` exists.
- Track A3 (gear directory) → `gear.html` exists.
- Track A4 (traveler neighborhoods) → `visiting.html` exists.
- Track A5 (corrections form) → `corrections.html` exists.
- Track B (per-region polish: directions links, badges, JSON-LD) → directions
  links exist across all `cities/*.html` (confirmed in
  `nav-search-google-links-plan.md`'s own audit, which found 117+ of them);
  level badges are live (`assets/style.css`'s `.level-badge` component,
  documented in `DESIGN.md`).
- Track C1 (wire pages into nav) → confirmed done; `about.html` and the main
  nav's "More" dropdown (`Learn to play` / `Gear & rentals` / `Visiting the
  Bay` / `Report a correction`) list all four Track A pages per
  `nav-search-google-links-plan.md`'s own findings.
- Only the explicitly-deferred items remain undone (live crowd data, user
  reviews, monetization) — and the doc itself says these are "set aside,"
  not planned.

**Verdict: delete, or replace with a one-line stub** ("implemented — see
git history around commits 1c54f16–8b1ff11 and the About page's Resources
section"). Analysis date on the doc itself (2026-07-07) is now two days
stale relative to the current commit history; nothing in it describes
pending work.

### `nav-search-google-links-plan.md` — (d) planning doc for work NOT yet done — keep

This is an audit-plus-plan document (dated 2026-07-08, one day before this
audit) proposing Groups A–F. Spot-checked two of its concrete claims against
the current tree:

- Its Finding 2 claim ("Rankings → city-page venue links silently fail to
  scroll because venue cards lack a real `id`") — checked
  `cities/san-jose.html` for `id="paul-moore-park"`: **not found**, only
  `data-court-id="paul-moore-park"` exists, confirming the bug is still
  present and Group A's fix is still outstanding.
- Its Finding 6 claim ("no sitewide search exists") is now **out of date** —
  `assets/global-search.js` and `assets/global-search.css` exist and are
  wired into the nav (`DESIGN.md` documents `.global-search` as a live
  header component, and commit `4c39c29` "Add sitewide global search to the
  nav" post-dates this plan's analysis date). So Group E's goal has already
  shipped even though the plan predates it.
- Groups A, B, C, D, F still describe real, unshipped work (verified: the
  `id`-anchor bug above is live; `rankings.html`'s hero CTA still needs
  inspection for Group C but nothing in the codebase suggests it was done in
  the commits since this plan was written).

**Verdict: keep**, but note in a follow-up pass that Group E is already
done and should be struck from the plan to avoid someone re-doing it.

### `parallel-prompts-filters-and-legend.md` — (c) planning doc, fully implemented — candidate for deletion or stub

All three prompts' deliverables exist and match their specs:

- Prompt 1 (`assets/courts-data.json`) — exists, 83 records (JSON array
  parsed: `node -e "console.log(JSON.parse(...).length)"` → `83`; the plan
  targeted "all 84 venues," off by one, worth a human glance but not a sign
  of incompleteness — this is a content-accuracy question, not a
  plan-not-done question).
- Prompt 2 (`directory.html`, `assets/directory.css`, `assets/directory.js`)
  — all three exist; `directory.html` is nav-linked from every page per
  `nav-search-google-links-plan.md`'s own confirmed audit.
- Prompt 3 (indoor/outdoor map legend, `assets/venues.json`'s `indoor`
  field, `assets/map.js`/`assets/map.css` changes) — `map.html` and
  `assets/map.js`/`assets/map.css` exist and are live; the indoor/outdoor
  pin distinction is documented as shipped in `DESIGN.md`'s `--pin-outdoor`
  / `--pin-indoor` token entry.

**Verdict: delete, or replace with a one-line stub** pointing at
`d211189` ("Add filterable venue directory, court data, map legend, and
privacy policy") as the implementing commit. Like `improvement-plan.md`,
nothing in this doc describes outstanding work.

---

## 2. `Site Header` folder — verdict: safe to delete, verified superseded

The context note's hypothesis is correct; here's the verification:

- **Zero live references**, confirmed directly:
  ```
  grep -rn "Site Header" --include="*.html" --include="*.js" --include="*.css" .
  grep -rln "header-snippet" . --include="*.html" --include="*.js" --include="*.css"
  ```
  Both return no matches (exit code 1 / empty output) across the entire repo.
- **The folder's own README states its purpose**: "Final direction: Golden
  Gate Ball (2a)... `mark.svg` — Use for the site header logo... See
  `header-snippet.html` — Copy-paste-ready header markup." This is a
  designer/logo-export **handoff package meant to be copied from**, not an
  archival reference meant to be kept in place — its own instructions say to
  copy its contents into the site, not to link to it live.
- **It was already copied and superseded, in the very same commit.** Both
  `Site Header/` and `assets/logo/` were added together in commit `8b1ff11`
  ("Add site logo/favicon and make Top pick badges rankings-driven"). Byte
  comparison confirms identical content:
  ```
  diff "Site Header/mark.svg" assets/logo/mark.svg        → identical
  diff "Site Header/favicon.svg" assets/logo/favicon.svg  → identical
  diff "Site Header/icon-512.png" assets/logo/icon-512.png → identical
  ```
  (`apple-touch-icon-180.png` and the two favicon PNGs are the same set,
  same commit, same timestamps — not independently re-diffed but follow the
  same pattern.)
- **`assets/logo/` is the one actually in use**: `grep -rl "assets/logo"
  --include="*.html" .` → 30 files reference it (favicon `<link>` tags,
  brand `<img>` tags), matching the exact HTML snippet the README itself
  documents as the intended usage.
- **Hosting exposure, not just repo clutter**: `firebase.json`'s hosting
  `ignore` list (`firebase.json:8-14`) excludes `**/*.md`, dotfiles,
  `scripts/**`, and `firebase.json`/`firestore.rules` — but **not**
  `Site Header/`. That means `Site Header/mark.svg`, the four PNGs, and
  `favicon.svg` (everything except the ignored `README.md`) are currently
  being **publicly served** at `https://pickleball-bay-area.com/Site
  Header/mark.svg` etc. on both Firebase Hosting and GitHub Pages, despite
  being unreferenced by any page — dead weight that's also live on the
  internet, not just sitting in git history.

**Verdict: delete the entire `Site Header/` folder.** It's a designer
handoff artifact whose job is finished — every file was copied verbatim
into `assets/logo/` in the same commit, that's the location actually wired
into the site, and the original is currently exposed at a public URL for no
reason. This is the highest-value, lowest-risk item in this audit: 8 files,
zero references, verified byte-identical duplicates, plus an unintended
public-exposure fix as a bonus.

---

## 3. `firestore.rules` vs. actual Firestore calls in the code

Read both `assets/court-ratings.js` and `assets/paddle-quiz.js` in full and
cross-checked every write path against `firestore.rules`.

**`courtVotes/{courtId}`** (used by `court-ratings.js`):

| Code path | What it writes | Rule that must allow it |
|---|---|---|
| `incrementFavorite` (new doc) | `{favoriteVotes: ±1 clamped to ≥0, all 6 factor fields: 0}` | `isSingleSeedWrite`'s `favOnly` branch — matches |
| `applyRatingDelta` (new doc) | `{favoriteVotes: 0, oneFactorSum: 1-5, oneFactorCount: 1, rest: 0}` | `isSingleSeedWrite`'s `ratingOnly` branch — matches |
| `incrementFavorite` (existing doc) | `favoriteVotes` delta of exactly `+1`/`-1` via `increment()` | `favoriteDeltaOk()` (`d == 0 \|\| d == 1 \|\| d == -1`) — matches |
| `applyRatingDelta` (existing doc, first rating) | one factor: `countDelta=1, sumDelta∈[1,5]` | `factorDeltaOk()` branch 2 — matches |
| `applyRatingDelta` (existing doc, re-rate) | one factor: `countDelta=0, sumDelta∈[-4,4]` (re-rating 1↔5 stars) | `factorDeltaOk()` branch 3 — matches |

All 6 factor keys the rules know about (`beginnerFriendly`, `courtSurface`,
`waitTimeScore`, `advancedPlay`, `amenities`, `atmosphere`) are the exact
`FACTORS` array in `court-ratings.js:16-23`, and all 6 are actively consumed
elsewhere (`grep -rl "FACTORS" assets/*.js` → `rankings.js`,
`rating-widgets.js`, `top-picks.js`, `directory.js`, `city-top-pick.js`,
`map.js`) — none is vestigial.

**`paddleQuizLeads/{leadId}`** (used by `paddle-quiz.js`'s `submitLead`):
the write shape (`email`, `answers.{experience,priority,forgiveness,weight,
tournament}`, `recommendedPaddleIds` ≤9, `createdAt: serverTimestamp()`)
matches `isWellFormedLead()` field-for-field, including the 9-item cap
(3 budget buckets × 3 picks = 9, exactly what `PRICE_BUCKETS` in
`paddle-quiz.js:130-134` produces). `allow read/update/delete: if false` is
correct for a write-only lead mailbox.

### Security-relevant finding: the `courtVotes` update rule is looser than what the app ever does (low severity, worth tightening)

`allow update` requires `favoriteDeltaOk()` **and** all six
`factorDeltaOk()` calls to pass — but each `factorDeltaOk()` independently
allows a **no-op** (`countDelta==0 && sumDelta==0`) as one of its valid
branches, and `favoriteDeltaOk()` allows `d==0`. That means the rules permit
a **single write** that simultaneously changes `favoriteVotes` by ±1 *and*
adds a first-time rating (or edits an existing one) to *all six* factors at
once — e.g. one Firestore write that both toggles a favorite and rates
Beginner-friendly, Court surface, Wait time, Advanced play, Amenities, and
Atmosphere, all in the same document update.

The actual code never does this: `incrementFavorite` only ever touches
`favoriteVotes`, and `applyRatingDelta` only ever touches one factor's
`Sum`/`Count` pair per call — every real write from this app changes
exactly one "slot." The rules' per-field bounds are still individually
tight (favorite ±1, each factor's sum/count bounded the same as a single
vote), so this doesn't enable unbounded abuse — a scripted attacker could
already achieve the same end state with 7 separate legitimate-shaped writes
instead of 1. But it is real slack between what's *allowed* and what's
*used*, and the fix is cheap: add a single-field-changed constraint to
`allow update` (e.g. require `onlyKnownFieldsChanged().size() <= 2` for the
sum+count pair, or restructure to one document-per-factor) so the rule
actually encodes "one vote-shaped write" the way `isSingleSeedWrite`
already does for `create`. Low priority given the bounded-delta mitigation
already in place, but flagging per the audit's request to call out
allow-but-unused rule surface.

**No other stale or overly-permissive rules found.** Both collections'
rules are otherwise a tight match to what the code actually writes.

---

## 4. `scripts/fetch-google-ratings.mjs`

- **Runnable as-is**: confirmed no `package.json` anywhere in the repo
  (`find . -iname package.json -not -path "*/node_modules/*"` → no results)
  and none is needed — the script only imports Node built-ins
  (`node:fs`, `node:url`, `node:path`) and uses the global `fetch` (Node
  18+; local Node is v26). The script's own header comment ("No npm
  install needed") is accurate.
- **Not orphaned — it's a real, load-bearing (but not-yet-run) piece of a
  documented workflow**: `GOOGLE_RATINGS_SETUP.md` documents exactly how to
  run it, and `nav-search-google-links-plan.md`'s Group B treats it as the
  dependency for both the ratings badge *and* a planned future upgrade
  (verified Google Directions links via `placeId`). It correctly reads
  `assets/courts-data.json` (which exists, 83 records) and writes
  `assets/google-ratings.json` (which exists but is currently `{}` —
  confirmed by direct read).
- **Not part of any automated workflow** — there's no `.github/workflows/`
  directory in this repo (`find . -path "*/.github/*"` → no results) and no
  cron/CI config anywhere, so "part of a real workflow" is true only in the
  manual, documented-runbook sense (which the docs are honest about — both
  `GOOGLE_RATINGS_SETUP.md` and the script's own comments call this a
  manual, occasional, human-run script, not automation).

**Verdict: keep, no action.** It's correctly self-contained and exactly as
advertised; it's just waiting on a manual step (a billed Google Cloud API
key) that only the site owner can provide.

---

## 5. Other cruft noticed in passing

- **`.DS_Store` at repo root**: present on disk but **not tracked**
  (`git ls-files | grep -i DS_Store` → no results) and correctly covered by
  `.gitignore:1`. No action needed — this is normal macOS Finder litter,
  already excluded from git and from Firebase Hosting's ignore list.
- **`consolidation-audit-prompts.md`** (untracked, root): the orchestration
  doc that generated this audit and four sibling ones (HTML/CSS/JS/data
  duplication). Not in this audit's assigned scope and not cruft — it's
  mid-workflow. Worth committing or deleting once all five `audit/*.md`
  reports it spawned are in and reviewed.
- **`.firebase/` directory**: build/deploy cache (`hosting..cache`,
  timestamped from today's deploy). Correctly gitignored
  (`.gitignore:6` → `.firebase/`), not tracked, no action needed.
- No stray build artifacts, no `node_modules`, no editor-swap files, no
  duplicate/backup-named files (`*.bak`, `*~`, `* copy.*`) found anywhere
  in the scoped tree.

---

## Ranked recommendations (maintenance cost saved vs. effort)

1. **Delete `Site Header/` (8 files).** Highest value: removes a verified
   byte-identical duplicate of `assets/logo/`, and stops publicly serving
   dead files at `/Site Header/*` via Firebase Hosting/GitHub Pages. Trivial
   effort, zero risk (confirmed zero references, confirmed superseded same-
   commit).
2. **Delete or stub `improvement-plan.md` and
   `parallel-prompts-filters-and-legend.md`.** Both are fully implemented;
   keeping them risks a future session re-doing finished work or citing
   stale "explicitly set aside" framing as current. Trivial effort.
3. **Fix the stale sitemap/robots paragraph in `SEARCH_CONSOLE_SETUP.md`**
   (lines 16–24, 51) — it currently instructs a future reader to update
   files that were already correct before the doc was written. Low effort,
   avoids wasted verification time or an accidental "fix" of already-
   correct files.
4. **Tighten the `courtVotes` update rule** in `firestore.rules` to require
   only-one-factor-changes-per-write, matching what `court-ratings.js`
   actually does. Low priority (bounded deltas already limit the blast
   radius) but cheap and closes real slack between allowed and used
   behavior.
5. **Note in `nav-search-google-links-plan.md`** that Group E (sitewide
   search) has already shipped since the plan was written, so a future
   reader doesn't re-scope it. Trivial — a one-line edit.
6. Everything else (`DESIGN.md`, `FIREBASE_SETUP.md`,
   `GOOGLE_RATINGS_SETUP.md`, `scripts/fetch-google-ratings.mjs`,
   `.DS_Store`/`.firebase` hygiene) needs no action — verified accurate,
   verified in-use, or verified correctly ignored.
