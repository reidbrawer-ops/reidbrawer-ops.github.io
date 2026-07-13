# UX analysis — Pickleball Bay Area

Full user-experience review of the live site (https://pickleball-bay-area.web.app),
July 2026. Combines a hands-on walkthrough of the real deployed site (desktop
1280px + mobile 375px, across home / map / city page / paddles / learn / 404,
plus the search, quiz, and mobile-nav interactions) with a source-level audit of
accessibility, performance, content/trust, and the monetization funnel.

Findings are tagged **[P0]–[P3]** by priority and **effort** (S/M/L). A
consolidated roadmap is at the bottom.

---

## Executive summary

This is a genuinely well-designed, unusually *honest* directory. The information
architecture, editorial quality, and design discipline are better than the vast
majority of affiliate sites — the value proposition lands in five seconds, the
city pages are real SEO assets, and the "court data is independent, gear is the
only thing we point you toward" firewall is stated plainly and even enforced in
code. The core "find a court" experience works well on both desktop and mobile.

The problems are concentrated and, for the most part, cheap to fix. The single
most important fact: **the entire business — affiliate income — is switched off.**
The funnel is beautifully built but earns $0 today, sits behind an 11-question
quiz *and* a mandatory email wall, and has no analytics to measure any of it.
Separately, a **legal document names the wrong hosting company**, and there's a
cluster of **accessibility gaps** (no `<main>`/skip link, an unlabeled search
combobox, a contrast-failing "top pick" color) that would fail a WCAG 2.1 AA
audit. None are architectural; most are localized.

**Scorecard (subjective, 1–5):**

| Dimension | Score | One-line |
|---|---|---|
| Information architecture | 5 | Task-based entry lanes + region loop; exemplary |
| Content & editorial quality | 5 | Rich, honest, sourced; a real moat |
| Visual design | 4 | Clean, consistent system; one font never loads |
| Core journey (find a court) | 4 | Works well; court "detail" is a JS panel, not a page |
| Trust & credibility | 4 | Excellent positioning, undercut by a wrong-host privacy page |
| Mobile | 4 | Nav + pages solid; quiz results table is cramped |
| Accessibility | 2.5 | Good habits, systemic gaps; fails AA today |
| Performance | 3 | Good hygiene; two heavy third parties load eagerly |
| **Monetization funnel** | **1.5** | **Fully built, fully switched off, unmeasured** |

---

## What's working — don't break these

- **Value prop + IA.** "The Bay, court by court" + a one-sentence lede + three
  task lanes ("Find a court near you" / "Never played before?" / "Ready to
  buy") tell any visitor what to do in seconds. Regions are ordered "the way
  you'd actually drive the loop, not alphabetically" — a thoughtful touch.
- **Search.** The typeahead groups a city/region hit above its venues, has a
  visible clear button, supports arrow-key + Enter navigation, and keeps real
  `<a href>`s so cmd/ctrl/middle-click open the map in a new tab.
- **City pages are the crown jewel.** SEO-optimized titles ("Pickleball in
  Berkeley — Cedar Rose Park courts, booking, hours"), genuinely useful per-venue
  detail (reservable vs. walk-up, cost, hours, accessibility, noise mitigation,
  even the rec coordinator's email), honest caveats ("call before making a
  special trip"), **cited sources**, and community ratings.
- **Honesty discipline is engineered, not just claimed.** The quiz code renders
  a truthful "we don't earn a commission from them today" when a link isn't
  affiliate, wires `rel="sponsored"` only on genuine affiliate links, and keeps a
  hard firewall between court data and gear. This is the brand.
- **Microcopy.** Empty/error states are excellent and action-oriented ("No
  courts match these filters. [Clear filters]", "Couldn't pin down your
  location — search a city instead"). The 404 ("That court doesn't exist.") is
  on-brand with a clear recovery CTA.
- **Mobile nav works** (verified live): the hamburger toggles a `display:flex`
  panel with all 7 links and flips `aria-expanded`; Escape closes it.
- **Technical hygiene:** homepage search data is lazy-loaded on first focus, the
  map container has reserved height (no CLS), meta/canonical/OG are unique per
  page, JSON-LD is present on home + city pages, sitemap/robots are valid, image
  and font cache headers are correct, and forms use real `<label>`s with correct
  honeypots.

---

## Priority findings

### P0 — Critical (the business is off / experience is broken)

**1. Monetization is entirely disabled — every buy link earns $0. [P0, effort S]**
`assets/affiliate-map.json` has `"brands": {}` and `amazonFallback.enabled:false`,
so all 486 paddles resolve to plain, untagged brand links. The quiz → results →
buy path is fully built and correct, but generates no revenue right now. For a
site whose entire purpose is affiliate income, this is the headline issue.
*Fix:* enable the Amazon Associates fallback (one flag + tag) as an immediate
baseline, and/or populate `brands` for the highest-volume names (Selkirk, JOOLA,
CRBN, Six Zero). The code path already exists — this is config, not engineering.

**2. The quiz hides ALL results behind a mandatory email wall. [P0, effort S]**
`renderEmailStep()` gates the top-3 matches *and every buy button* behind "Enter
your email to reveal your top 3 picks." A cold visitor from a city page answers
11 questions, then hits a wall before seeing anything. This is the largest
affiliate leak on the site and also the one place the otherwise-low-friction,
no-login experience turns into a soft dark pattern — and it's unsignposted: the
homepage lane promises "See your matched picks" with no hint an email is
required. *Fix:* reveal results + buy links unconditionally; make email an
*optional* post-reveal action ("email me these picks / notify me on price
drops"). If the wall stays for now, at minimum add "(email required to see
results)" up front so the ask isn't a surprise at step 12.

**3. No conversion analytics — the funnel is unmeasurable. [P0, effort S]**
`assets/analytics.js` fires only GA4 `page_view` + an exception handler. There
are no events for quiz start, question progression, `generate_lead` on email
submit, or buy-link clicks. You cannot see completion rate, where drop-off
happens, what the email wall costs, or which paddles/vendors convert — so none
of the other funnel fixes can be validated. *Fix:* add events at quiz start,
lead capture, and buy-link click (with paddle id + brand + isAffiliate).

> P0 items 1–3 are near-zero effort and are the difference between a $0,
> invisible funnel and a measurable, earning one. Do these first.

---

### P1 — Serious (trust, accessibility, performance)

**4. The privacy policy names the wrong host. [P1, effort S]**
`privacy.html` says "This site is hosted on GitHub Pages… GitHub… receives
standard server logs" and links to GitHub's privacy statement. The site is on
**Firebase Hosting / Google** (`firebase.json`, `.firebaserc`, `RUNBOOK.md`). A
factual error in the one document where accuracy is a compliance expectation —
and it points visitors at the wrong company's policy. *Fix:* rewrite the Hosting
section to name Firebase/Google and link Google's policy.

**5. GA4 loads unconditionally with no consent/CCPA control. [P1, effort M]**
`analytics.js` loads gtag and sets cookies on every page before any consent.
There's no cookie banner, no "Do Not Sell or Share My Personal Information" link,
and no California-privacy section — on a California-targeted site. *Fix:* add a
minimal consent/opt-out control (or at least a CCPA-rights paragraph + a
Do-Not-Sell link) and consider gating GA until interaction.

**6. Accessibility: five systemic gaps that fail WCAG 2.1 AA. [P1, effort M]**
The site has good habits (real labels, `aria-live` on the map result count, a
list alternative to the map, a reduced-motion block) but:
- **No `<main>` landmark and no skip-to-content link on any of 53 pages** — every
  keyboard/SR user re-traverses the nav with no bypass. Fix in
  `partials/site-header.html` so it propagates.
- **The global search is a combobox with no combobox ARIA** — no
  `role="combobox"`, `aria-expanded`, or `aria-activedescendant`; results and the
  active option are never announced.
- **The paddle quiz discards focus on every step** (`root.innerHTML` replace with
  no focus move) and the email error isn't a live region — SR users never hear
  the next question or the error.
- **`--optic-deep` (#9aa81e) used as meaningful foreground fails contrast at
  ~2.6:1** — the community star-rating fill, the `#1` rank number, and the "★ Top
  pick" label. Darken the token for foreground use (keep `--optic` as a bg only).
- **Map markers have no accessible name** (~181 unlabeled keyboard tab stops).
  Add a `title`/`alt` per marker or set `keyboard:false` and rely on the labeled
  list.

**7. The Firestore SDK (~135 KB gz / ~543 KB raw) loads eagerly on /map and
/rankings. [P1, effort M]**
`court-ratings.js` fires a top-level dynamic import of firebase-app +
firebase-firestore on page load — before the user opens a court or scrolls to a
rating — purely to show vote counts. It's the single largest first-party payload
on those pages. *Fix:* defer the import until a court detail opens or the ratings
section scrolls into view; use Firestore **Lite** for the read path and only pull
the full SDK on an actual vote write.

**8. Every footer claims affiliate links exist "now," but none are active.
[P1, effort S]**
53 footers + the homepage + the disclosure page assert affiliate links in the
present tense, while `affiliate-map.json` is empty and the quiz correctly says
the opposite. It errs toward over-disclosure (not an FTC risk) but contradicts
the central honesty claim. *Fix:* soften static copy to "some links **may
become** affiliate links (disclosed at each one)" until a program is live, and
auto-swap when a brand is added. (Resolves itself the moment you do P0-1.)

---

### P2 — Moderate (friction, content gaps, polish that matters)

**9. The quiz is 11 questions with no skip, and jargon-heavy for beginners.
[P2, effort M]** Single-selects auto-advance and progress dots show "Step X of
Y" (good), but nothing is skippable and Q7–Q9 (weight / swing weight / twist
weight) are subtle and technical for the beginners the city funnel feeds in. Long
quizzes bleed completions. *Fix:* add "No preference / skip" fast paths, or
branch on the experience answer so beginners get a 5–6 question path.
*(Also: the intro says "11 questions" twice but the first step is labeled "Step 1
of 12" — reconcile.)*

**10. learn.html — the highest first-paddle-intent page — never enters the
funnel. [P2, effort S]** Its "What to bring" section discusses paddles but
actively steers *away* from buying and links to `/paddles` nowhere in the body
(only global nav/footer), and it has no "Before you head out" block. *Fix:* add a
"Ready for your own paddle? Rent one first, or take the quiz" CTA into "What to
bring," pointing at `/paddles#rent` and the quiz.

**11. Mobile quiz results are a horizontal-scroll table. [P2, effort M]** The
4-column comparison table (label + 3 paddles at `min-width:200px`) forces
horizontal scrolling on a 375px phone to reach picks #2/#3, and the buy buttons
sit at the bottom of a wide scroll region. *Fix:* on mobile, render results as
stacked one-paddle cards, each with its own buy button.

**12. Content gap: parking and restrooms are barely covered. [P2, effort M]**
Across the 42 city pages: cost 42/42, reservation/walk-up 42/42, lights 30/42,
restrooms 10/42, water 6/42, **parking 6/42**. Parking is the single most-wanted
missing datum for a suburban drive-to activity. *Fix:* add parking + restroom
fields to the venue-card fact template (even "not specified" for honesty),
prioritizing each page's flagship court.

**13. Two rating systems, only one explained. [P2, effort S]** City-page pills
show a 4-axis editorial rating (Surface/Level/Weather/Wait); `/rankings` collects
a 6-axis community rating (Beginner-friendliness/Surface/Wait/Advanced/Amenities/
Atmosphere). Nothing reconciles them or explains how the community score drives
the moving "Top pick." *Fix:* add a short "How community rankings work" note on
`/rankings`, cross-linked from About.

**14. The intended headline font never loads. [P2, effort S]** DESIGN.md
specifies `--font-headline: Bebas Neue` (condensed all-caps poster face) for all
h1/h2, but the Google Fonts request only fetches Space Grotesk / Inter / IBM Plex
Mono — so every headline silently renders in the Space Grotesk fallback. Visible
throughout the walkthrough (headlines are medium-width, not condensed). *Fix:*
decide intent — add `Bebas+Neue` to the font request, or remove it from CSS +
DESIGN.md so the system matches reality.

**15. Thin structured-data / no breadcrumbs. [P2, effort M]** Home + city pages
have good JSON-LD, but `/map`, `/rankings`, `/paddles`, `/learn`, `/about`, and
`/cities/` emit none, and no page has `BreadcrumbList`. *Fix:* add BreadcrumbList
site-wide and page-appropriate schema (ItemList on rankings, HowTo/FAQ on learn).

**16. Map page: no preconnect + render-blocking Leaflet from a third-party CDN.
[P2, effort S]** The map hits unpkg (Leaflet), gstatic (Firebase), cartocdn
(tiles), and GTM with none preconnected, and Leaflet CSS blocks first paint from
unpkg (a single point of failure). *Fix:* preconnect those origins; self-host
Leaflet from `/assets/`.

**17. Map double-fetches and client-joins two data files. [P2, effort M]**
`map.js` pulls `venues.json` (10 KB) *and* `courts-data.json` (37 KB) then joins
~200 records on the main thread every load. *Fix:* pre-join at build into one
slim `map-data.json` with only the fields the map needs.

**18. The quiz results screen is a conversion dead-end. [P2, effort M]** After
the table + disclosure, the only control is "Retake the quiz." The three buy
buttons compete 3-across with no priority on the #1 "Best match," and there's no
secondary gear, price framing, or trust cue. *Fix:* visually elevate the
best-match CTA and add a modest "commonly bought with" gear row (once affiliate
is live).

**19. Accessibility, moderate tier. [P2, effort M]** Form-control borders sit at
~1.3:1 (need 3:1); rating disclosure toggles lack `aria-expanded`; the hours
slider announces raw minutes ("720") not "12:00 PM"; the rankings heading
hierarchy is flat (region/city/court all `<h3>`); the mobile detail bottom-sheet
is a modal with no `role="dialog"`, focus trap, or focus-return-on-close; the
quiz email focus ring uses `--optic` at ~1.3:1; dynamic "no results"/leaderboard
updates aren't announced.

---

### P3 — Minor (polish)

- **Court "detail" is a JS panel, not a page.** Individual courts live as
  client-rendered detail panels at `/map` (deep-linkable via `?venue=`), so a
  specific court can't rank in Google or generate a social preview. The city page
  is the linkable per-court context. This is a reasonable architecture — just be
  aware the venue itself isn't an indexable/shareable destination. [effort L]
- **Buy-link edge case:** 37/486 paddles lack a `vendorSearchBase`, so their buy
  button dumps the user on the brand homepage to hunt for the model. [effort M]
- **Missed honest gear placements:** learn.html already names shoes and outdoor
  balls in prose — natural, disclosed affiliate spots, currently unlinked. Quiz
  results are a natural balls/bag cross-sell. (Do **not** monetize court
  reservations or coaching — that breaks the firewall that is the moat.) [effort S]
- **Copy consistency:** "updated Jul 2026" (home) vs "July 2026" (everywhere
  else); "Paddles & Gear" vs "paddles & gear" casing; "Directions ↗" vs
  "Directions →" arrow glyphs on the same city page; uniform "Verified July 2026"
  across all 42 pages reads as a batch stamp (mitigated by real per-page source
  links — consider per-page "last checked" dates). [effort S]
- **`paddle-quiz-skill-levels.png` is a 209 KB PNG** displayed at 1360×730 —
  convert to WebP (~30–60 KB). Already lazy + sized (no CLS/LCP hit). [effort S]
- **Empty `google-ratings.json` (3 bytes) is still fetched** on /map + /rankings
  — a wasted request until populated. [effort S]
- **`.web.app` mirror serves 200 without redirecting to the canonical `.com`** —
  canonical tags mitigate SEO, but the mirror is fully crawlable. [effort S]
- **Short cache TTL + unfingerprinted assets:** js/css/json are
  `max-age=600, must-revalidate`, so repeat visitors re-validate `style.css`,
  `map.js`, `courts-data.json` every 10 min. Fingerprint filenames → serve
  `immutable`. [effort M]
- **`/rankings` currently shows 0 votes everywhere** while copy says "rankings
  update live" — mitigated by an honest empty state, low stakes until traffic
  arrives. [effort S]
- **Templated secondary-venue prose** ("N outdoor courts in [City]. Same caveat
  as…") reads auto-generated next to the rich flagship writeups. [effort M]
- **Dead CSS** (`.pf-jumpnav`/`.pf-jump*`) and a redundant brand-link
  `alt` + `aria-label`; new-tab links have no "opens in new tab" hint for SR
  users. [effort S]

---

## Recommended roadmap

**This week — turn the business on (all effort S, ~half a day total):**
1. Enable the affiliate fallback/programs in `affiliate-map.json` (P0-1).
2. Drop the email wall to optional-after-reveal (P0-2).
3. Add quiz-start / lead / buy-click analytics events (P0-3).
4. Fix the privacy-policy host name (P1-4).
5. Soften the "affiliate links" footer copy until programs are live (P1-8).

**This month — trust, reach, access (mostly M):**
6. Accessibility P1 pass: `<main>` + skip link, search combobox ARIA, quiz focus
   management, darken `--optic-deep` for foreground, label map markers (P1-6).
7. Consent/CCPA control for GA4 (P1-5).
8. Defer + slim the Firestore load on /map and /rankings (P1-7).
9. learn.html → funnel handoff; stacked mobile quiz-results cards; shorten/branch
   the quiz (P2-9,10,11).
10. Add parking/restroom fields; explain the ranking methodology; resolve the
    Bebas Neue font decision (P2-12,13,14).

**Backlog — polish + SEO depth:**
11. BreadcrumbList + structured data; preconnect/self-host Leaflet; pre-joined
    map data; asset fingerprinting; WebP the quiz image; the P3 copy/consistency
    sweep.

---

*Method: live walkthrough of the deployed site (desktop + mobile) covering the
search, quiz, map, and mobile-nav interactions, plus four parallel source audits
(accessibility, performance, content/trust, monetization funnel). All findings
are read-only observations; no site files were modified.*
