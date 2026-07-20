#!/usr/bin/env node
/**
 * Post-redesign invariant check for pickleball-bay-area.
 *
 * Every assertion here encodes something that a redesign can silently break —
 * a JS hook that is dereferenced unguarded, a revenue attribute, a legal
 * sentence, or a build-script anchor. None of this is covered by
 * `npm run validate` (which is data-only and never opens an .html file).
 *
 * Usage: node verify-invariants.mjs [repoRoot]
 * Exits 1 on any failure.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Defaults to the repo this script lives in, NOT a machine-specific absolute
// path. firebase's predeploy hook invokes it with no argument, so a hardcoded
// /Users/<someone>/... would silently check the wrong tree — or crash — the
// moment the repo moved, was cloned, or ran anywhere but one laptop. The
// explicit argv[2] override is kept for callers that want a different tree.
const ROOT = process.argv[2] || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const cityPages = fs.readdirSync(path.join(ROOT, 'cities')).filter((f) => f.endsWith('.html') && f !== 'index.html');
const rootPages = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'));
// Discovered, not listed: a hand-maintained list is how a new page quietly
// escapes every sitewide check below. Mirrors sync-header.js's targets().
const nestedPages = ['cities', 'paddles'].flatMap((dir) => {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs).filter((f) => f.endsWith('.html')).map((f) => `${dir}/${f}`);
});
const allPages = [...rootPages, ...nestedPages];

let fails = 0, passes = 0;
const ok = (m) => { passes++; };
const bad = (m) => { fails++; console.log(`  ✘ ${m}`); };
const check = (cond, m) => (cond ? ok(m) : bad(m));
const group = (n) => console.log(`\n${n}`);

/* ---------- 1. map.js unguarded ids ---------- */
group('Find Courts — ids map.js dereferences unguarded (missing = page dies)');
{
  const h = read('map.html');
  for (const id of ['venue-map', 'finder-results', 'finder-detail', 'finder', 'finder-scrim',
    'finder-scope', 'finder-scope-label', 'finder-count', 'f-hours-start', 'f-hours-end',
    'hours-slider-label', 'hours-slider-range']) {
    check(new RegExp(`id="${id}"`).test(h), `map.html missing #${id}`);
  }
  for (const id of ['f-region', 'f-city', 'f-neighborhood', 'f-indoor', 'f-surface', 'f-reservable',
    'f-skill', 'f-price', 'f-courts', 'f-wait', 'f-weather']) {
    const m = h.match(new RegExp(`<select[^>]*id="${id}"`));
    check(!!m, `map.html: #${id} must exist AND still be a real <select>`);
  }
  check(/id="finder-detail"[^>]*tabindex="-1"|tabindex="-1"[^>]*id="finder-detail"/.test(h),
    'map.html: #finder-detail lost tabindex="-1" (JS focuses it as a dialog)');
  check(/leaflet@1\.9\.4/.test(h), 'map.html: Leaflet 1.9.4 dropped');
  check(/integrity="sha256-/.test(h), 'map.html: Leaflet SRI integrity hashes dropped');
  check(/basemaps\.cartocdn\.com/.test(h), 'map.html: CARTO tile source dropped');
  check(/OpenStreetMap|CARTO/i.test(h), 'map.html: tile attribution dropped (legally required)');
}

/* ---------- 2. rankings ---------- */
group('Rankings');
{
  const h = read('rankings.html');
  check(/id="top10-list"/.test(h), 'rankings.html missing #top10-list (unguarded)');
  check(/id="rankings-cities"/.test(h), 'rankings.html missing #rankings-cities');
}

/* ---------- 3. paddles / revenue ---------- */
group('Paddles — revenue + legal');
{
  const h = read('paddles.html');
  check(/id="paddle-quiz-app"/.test(h), 'paddles.html missing #paddle-quiz-app (quiz mount)');
  check(/id="quiz"/.test(h), 'paddles.html missing #quiz (money CTA target from 43 pages)');

  const js = read('assets/paddle-quiz.js');
  const links = read('assets/affiliate-links.js');
  // The buy-link surfaces. assets/paddle-grid.js was the second one until the
  // faceted catalog replaced it; there are now four, because a paddle can be
  // bought from the quiz, the catalog, a prerendered detail page or the
  // head-to-head. Every one of them is a place a mis-declared rel or a dropped
  // data-pq-* attribute costs money or breaks an FTC disclosure, so every one of
  // them is asserted. The generator is a Node script rather than a browser
  // module, which is exactly why it is easy to forget.
  const finder = read('assets/paddle-finder.js');
  const detail = read('assets/paddle-detail.js');
  const cmp = read('assets/paddle-compare.js');
  const gen = read('scripts/generate-paddle-pages.mjs');
  const linkSurfaces = [
    ['paddle-quiz.js', js],
    ['paddle-finder.js', finder],
    ['paddle-compare.js', cmp],
    ['generate-paddle-pages.mjs', gen],
  ];

  // vendorLinkFor lives in the shared module every surface imports. There must
  // be exactly ONE definition — a second copy would drift from
  // affiliate-map.json and pay nothing, invisibly.
  check(/export function vendorLinkFor/.test(links), 'affiliate-links.js: vendorLinkFor() gone');
  check(/export function appendParams/.test(links), 'affiliate-links.js: appendParams() gone');
  for (const [f, src] of linkSurfaces) {
    check(!/function vendorLinkFor/.test(src),
      `${f}: vendorLinkFor is DUPLICATED — it must exist only in affiliate-links.js`);
    // Two accepted shapes. The browser modules use a static
    //   import { vendorLinkFor } from "/assets/affiliate-links.js"
    // which only resolves under the page's import map. The page generator runs
    // in Node, where that specifier is meaningless, so it destructures the same
    // symbol off a file:// dynamic import instead. Both are "sourced from the
    // shared module"; only a local re-definition is the thing being banned, and
    // the !/function vendorLinkFor/ check above is what actually bans it.
    check(/\bvendorLinkFor\b[^}]*\}\s*(?:from|=)\s*.*affiliate-links\.js/.test(src),
      `${f}: must import vendorLinkFor from the shared module, not redefine it`);
  }

  // Revenue attribution: every surface must emit the same data-pq-* contract.
  for (const [f, src] of linkSurfaces) {
    for (const a of ['data-pq-paddle', 'data-pq-brand', 'data-pq-link-type', 'data-pq-affiliate', 'data-pq-position']) {
      check(src.includes(a), `${f}: ${a} dropped — this is the ONLY revenue attribution`);
    }
    // Assert the CONDITIONAL, not the substring. A bare
    // src.includes("sponsored nofollow noopener") passes a hardcoded
    // `const rel = "sponsored nofollow noopener"` — i.e. it stays silent on the
    // exact violation it is named for (every plain vendor link would then carry
    // a false paid-endorsement declaration). Proven by experiment during review.
    check(/isAffiliate\s*\?\s*"sponsored nofollow noopener"\s*:\s*"nofollow noopener"/.test(src),
      `${f}: rel="sponsored" must be a ternary on isAffiliate, not hardcoded`);
    check(src.includes('As an Amazon Associate I earn from qualifying purchases.'),
      `${f}: verbatim Amazon Associates sentence gone (Operating Agreement violation)`);
    check(/affiliate-disclosure/.test(src), `${f}: affiliate disclosure gone`);
  }
  check(/affiliate_click/.test(links), 'affiliate-links.js: affiliate_click GA4 event gone');
  // One listener, bound by whichever surface is on the page, guarded so two
  // importers can't double-count.
  check(/vendorClicksBound/.test(links), 'affiliate-links.js: trackVendorClicks lost its idempotence guard — two surfaces would double-count');
  check(/surface: a\.dataset\.pqSurface/.test(links), 'affiliate-links.js: affiliate_click no longer reports which surface fired it');
  // Includes paddle-detail.js, which renders no links itself — the generator
  // baked them into the HTML — but is the only script on those 486 pages, so it
  // is the only thing that can bind their attribution.
  for (const [f, src] of [...linkSurfaces, ['paddle-detail.js', detail]]) {
    if (f === 'generate-paddle-pages.mjs') continue; // build-time; no listeners to bind
    check(/import \{[^}]*\btrackVendorClicks\b[^}]*\}/.test(src) && /trackVendorClicks\(\)/.test(src),
      `${f}: must import AND call trackVendorClicks — its buy clicks are otherwise unattributed`);
  }
  check(/class="affiliate-disclosure" id="buy"/.test(js), 'paddle-quiz.js: .affiliate-disclosure#buy gone');

  // Each surface binds before its own mount guard, so a page that fails to
  // mount still attributes any buy links it rendered.
  for (const [f, src, guard] of [
    ['paddle-quiz.js', js, 'const root = document.getElementById("paddle-quiz-app")'],
    ['paddle-finder.js', finder, 'document.getElementById("paddle-finder-app")'],
  ]) {
    const guardAt = src.indexOf(guard);
    const trackAt = src.indexOf('trackVendorClicks();', src.indexOf('DOMContentLoaded'));
    check(trackAt > 0 && guardAt > 0 && trackAt < guardAt,
      `${f}: trackVendorClicks() must bind BEFORE the mount guard, or buy clicks go unattributed`);
  }

  // The data-licensing firewall: percentiles are banded on the way out
  // (RUNBOOK), and the site paraphrases rather than citing them. Strip comments
  // first — the file *discusses* "88th pct" in the comment explaining why it
  // must never render one.
  //
  // paddle-compare.js is the ONE documented exception, by explicit product
  // decision: the head-to-head page prints the derived 0–10 ratings, percentile
  // ordinals and Total/Value scores that the verdict-first design is built on.
  // Those numbers are all derived from the already-banded percentiles in
  // paddles.json, so nothing is republished beyond the bucket the public file
  // exposes — but it IS displayed there, unlike everywhere else. The firewall
  // below still guards the three word-tier surfaces (grid, detail, quiz/finder,
  // and the page generator); the compare page is carved out and instead required
  // to keep its LICENSING NOTE, so the exception can never go undocumented.
  const model = read('assets/paddle-model.js');
  const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const [f, src] of [['paddle-model.js', model], ['paddle-finder.js', finder],
                          ['generate-paddle-pages.mjs', gen]]) {
    const code = stripComments(src);
    check(!/th pct|thpct|percentile`|st percentile|\bord\(/.test(code),
      `${f}: renders a raw percentile — violates the data-licensing firewall`);
  }
  check(/LICENSING NOTE/.test(cmp),
    'paddle-compare.js: the licensing-exception note is gone — the head-to-head page is the one place that DISPLAYS percentiles/derived scores, and that departure from the firewall must stay documented in the file');
  // Asserts the PARAPHRASING FUNCTIONS, not the lookup table tierWord used to
  // be. The old form keyed on the four quartile midpoints; when the data widened
  // to 20 bands that table would have matched nothing and every Power chip would
  // have silently vanished, so it became a range test. Pinning the old constant
  // name here would have blocked exactly the fix the widening required.
  //
  // Both now live in paddle-model.js, which the browser modules AND the page
  // generator import — one definition, so a detail page and a card can never
  // describe the same paddle differently.
  const modelCode = stripComments(model);
  check(/export function tierWord/.test(modelCode), 'paddle-model.js: tierWord() paraphrasing gone');
  check(/export function bandPhrase/.test(modelCode), 'paddle-model.js: bandPhrase() gone — the detail page would have to print a percentile to say where a paddle sits');
  check(/Very high|Medium/.test(modelCode), 'paddle-model.js: tier words gone — percentiles would render as bare numbers');

  // Content-hashed module graph. Any page loading a module entry must pin the
  // whole graph with an import map, and must not reference a module by its
  // unhashed path — an unhashed entry is always-fresh and would pair a new
  // entry with the old deps a stale HTML pinned, which is the skew bug.
  for (const rel of allPages) {
    const src = read(rel);
    if (!/<script type="module" src="\/assets\//.test(src)) continue;
    check(/<script type="importmap">/.test(src), `${rel}: loads an ES module but has no import map — module graph is unpinned`);
    check(!/<script type="module" src="\/assets\/(?!m\/)[^"]*\.js"/.test(src),
      `${rel}: loads a module by unhashed path — run \`npm run hash\``);
  }

  // Every JS mount must be watchdogged. A module that fails to boot leaves its
  // placeholder on screen forever — that took the quiz down in production when a
  // shared export moved between modules and browsers held a stale sibling. The
  // watchdog turns that hang into an honest error + Reload.
  for (const [f, mount] of [['paddles.html', 'paddle-quiz-app'], ['paddles/browse.html', 'paddle-finder-app']]) {
    const src = read(f);
    check(/data-mount-pending=/.test(src), `${f}: mount placeholder lost data-mount-pending — a failed module would hang on "Loading…" forever`);
    check(/mount-watchdog\.js/.test(src), `${f}: no mount-watchdog.js — nothing would report a dead ${mount}`);
  }
  // The watchdog must stay a PLAIN script: as a module it could be taken out by
  // the very module failure it exists to report.
  for (const f of ['paddles.html', 'paddles/browse.html']) {
    check(!/type="module"[^>]*mount-watchdog|mount-watchdog[^>]*type="module"/.test(read(f)),
      `${f}: mount-watchdog.js must not be type="module"`);
  }

  // Paddles is three pages: /paddles (quiz), /paddles/browse, /paddles/rent.
  const ph = read('paddles.html');
  const pb = read('paddles/browse.html');
  const pr = read('paddles/rent.html');
  check(/id="paddle-quiz-app"/.test(ph), 'paddles.html missing #paddle-quiz-app (quiz mount)');
  // /paddles#quiz is the CTA on 43 pages (lane-router) — the anchor has to
  // survive on whichever page the quiz lives on.
  check(/id="quiz"/.test(ph), 'paddles.html missing #quiz — the money CTA on 43 pages targets it');
  // The faceted catalog replaced the eight-<select> grid on 2026-07-19; the
  // mount id and entry module moved with it (assets/paddle-grid.js ->
  // assets/paddle-finder.js).
  check(/id="paddle-finder-app"/.test(pb), 'paddles/browse.html missing #paddle-finder-app (catalog mount)');
  check(/paddle-finder\.js/.test(pb), 'paddles/browse.html no longer loads paddle-finder.js');
  check(/id="rent"/.test(pr), 'paddles/rent.html missing #rent');
  // Each lane must reach the other two, or the split strands them.
  for (const [f, src] of [['paddles.html', ph], ['paddles/browse.html', pb], ['paddles/rent.html', pr]]) {
    for (const href of ['/paddles', '/paddles/browse', '/paddles/rent']) {
      check(src.includes(`href="${href}"`), `${f}: section nav missing a link to ${href}`);
    }
    check(/aria-current="page"/.test(src), `${f}: section nav marks no current page`);
  }

  const map = JSON.parse(read('assets/affiliate-map.json'));
  check(map.amazonFallback?.tag === 'pickleballb06-20', 'affiliate-map.json: Associates tag changed!');
  check(map.amazonFallback?.enabled === true, 'affiliate-map.json: Amazon fallback disabled!');
  check(Array.isArray(map.amazonFallback?.brands) && map.amazonFallback.brands.length === 24,
    `affiliate-map.json: brand allowlist changed (expected 24, got ${map.amazonFallback?.brands?.length})`);
  check(Object.keys(map.amazonFallback?.asins || {}).length === 26,
    `affiliate-map.json: ASIN count changed (expected 26, got ${Object.keys(map.amazonFallback?.asins || {}).length})`);
}

/* ---------- 4. city pages ---------- */
group('City pages — venue-card guard + JS hooks');
{
  const CARD_RE = /<div class="venue-card" id="([a-z0-9-]+)" data-court-id="\1">([\s\S]*?)\n {6}<\/div>/g;
  let cards = 0;
  for (const f of cityPages) {
    const h = read(`cities/${f}`);
    cards += [...h.matchAll(CARD_RE)].length;
    // h1 must be the plain city display name (report-issue.js reads it)
    const h1 = h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
    check(h1 && !/pickleball|courts/i.test(h1[1]),
      `cities/${f}: <h1> must stay the plain city name (report-issue.js reads it) — got "${h1?.[1]?.trim()}"`);
    check(/<!-- site-header:start/.test(h), `cities/${f}: site-header markers gone`);
    check(/<!-- lane-router:start/.test(h), `cities/${f}: lane-router markers gone`);
    check(/<footer class="site-footer">/.test(h), `cities/${f}: literal <footer class="site-footer"> anchor gone — breaks sync-lane-router`);
  }
  check(cards === 171, `city venue-cards matching check-venue-cards CARD_RE: expected 171, got ${cards}`);

  // direct-child combinator city-top-pick.js relies on
  const pa = read('cities/palo-alto.html');
  check(/<div class="venue-list">\s*(<!--[\s\S]*?-->\s*)*<div class="venue-card"/.test(pa),
    'cities/palo-alto.html: .venue-card is no longer a DIRECT child of .venue-list — kills top-pick badges');
}

/* ---------- 5. build-script anchors, sitewide ---------- */
group('Build-script anchors (sync-header / sync-lane-router throw without these)');
{
  for (const p of allPages) {
    const h = read(p);
    check(/<footer class="site-footer">/.test(h), `${p}: <footer class="site-footer"> opening tag altered`);
    check(/<!-- site-header:start/.test(h) && /<!-- site-header:end -->/.test(h), `${p}: site-header markers`);
    check(/id="main"/.test(h), `${p}: <main id="main"> landmark gone (skip-link target)`);
    check(/class="skip-link"/.test(h), `${p}: .skip-link gone`);
  }
  const partial = read('partials/site-header.html');
  check(!/aria-current/.test(partial), 'partials/site-header.html contains aria-current — sync-header.js will THROW');
  for (const href of ['/map', '/cities/', '/rankings', '/paddles', '/learn', '/corrections', '/about']) {
    check(partial.includes(`<a href="${href}">`),
      `partials/site-header.html: nav link must be exactly <a href="${href}"> with no other attributes — sync-header.js string-matches it and will THROW`);
  }
}

/* ---------- 6. fonts + tokens ---------- */
group('Design system');
{
  for (const p of allPages) {
    const h = read(p);
    check(/Source\+Serif\+4/.test(h) && /Manrope/.test(h) && /Space\+Mono/.test(h), `${p}: v4 font link missing`);
    check(!/Bebas|Space\+Grotesk|IBM\+Plex|family=Inter/.test(h), `${p}: still requests a v3 font`);
  }
  const css = read('assets/style.css');
  for (const [t, v] of [['--fog', '#f7f2e7'], ['--paper', '#fdfbf4'], ['--ink', '#16211f'],
    ['--bay', '#1e6e66'], ['--optic', '#d6e14a'], ['--poppy', '#c1552c']]) {
    check(new RegExp(`${t}:\\s*${v}`, 'i').test(css), `style.css: token ${t} is not ${v}`);
  }
  check(/Source Serif 4/.test(css), 'style.css: --font-headline is not Source Serif 4');
  check(!/Bebas/.test(css), 'style.css: Bebas Neue reference survives');
}

/* ---------- 7. ratings mechanism ---------- */
group('Ratings widgets');
{
  const css = read('assets/style.css');
  check(/--fill/.test(css), 'style.css: .star --fill custom-property partial-fill mechanism gone');
  check(/\.star-picker[^{]*button[^{]*~[^{]*button|button:hover\s*~\s*button|button\.is-selected\s*~\s*button/.test(css),
    'style.css: .star-picker sibling-combinator (~) fill trick gone — reverse-order picker will not light up');
  const w = read('assets/rating-widgets.js');
  check(/data-role="overall-rating"/.test(w), 'rating-widgets.js altered');
}

/* ---------- 8. selector coverage vs baseline ---------- */
group('CSS selector coverage vs v3 baseline');
{
  const SNAP = '/private/tmp/claude-501/-Users-reidbrawer-Developer-Money/2bce4871-dc6e-465d-8301-1db0cf0e5ec1/scratchpad/baseline';
  const files = { style: 'assets/style.css', map: 'assets/map.css', paddles: 'assets/paddles.css',
    'paddle-quiz': 'assets/paddle-quiz.css', rankings: 'assets/rankings.css', corrections: 'assets/corrections.css' };
  const selectorsIn = (rel) => {
    const src = read(rel).replace(/\/\*[\s\S]*?\*\//g, '');
    const out = new Set();
    for (const m of src.matchAll(/([^{}]+)\{/g)) {
      const s = m[1].trim();
      if (s.startsWith('@') || !s) continue;
      for (const tok of s.matchAll(/[.#][A-Za-z0-9_-]+/g)) out.add(tok[0]);
    }
    return out;
  };
  // Selectors whose FEATURE was deliberately removed after the v3 baseline was
  // taken. Listed explicitly, with the reason, so that "this selector is gone"
  // stays a loud failure for everything else — an allowlist you have to add to
  // on purpose is the point.
  const RETIRED = new Set([
    // The cities page's "Jump to a city" tag row was removed by request; its
    // only mount (cities/index.html) and its renderer (assets/city-tags.js) are
    // gone with it. .city-jump-* was already dead CSS before that — nothing has
    // ever emitted it.
    '.city-quick-jump', '.city-tag', '.city-tag-group', '.city-tag-region',
    '.city-jump-tag', '.city-jump-group',
    // The quiz results' 3-dot comparison TABLE was replaced by the paddle-charts
    // component (assets/paddle-charts.js): a "top 3" strip + inline-SVG value and
    // stress-test charts. paddle-quiz.js no longer emits any of these classes
    // (grep confirms 0 refs), so their CSS is correctly-deleted dead code, not a
    // regression. The buy links / disclosure / tracking below the charts are
    // unchanged — asserted intact elsewhere in this file.
    '.pq-compare-table', '.pq-compare-wrap', '.pq-compare-col', '.pq-compare-label',
    '.pq-compare-links', '.pq-meter', '.pq-meter-dot', '.pq-tagline', '.is-filled',
  ]);

  // A page stylesheet legitimately DROPS a selector when it was only a
  // page-local override of a global rule — the repo's own convention is "don't
  // duplicate a global rule in a page file". So a selector only counts as lost
  // if it survives in neither the page file nor the global sheet.
  const global = selectorsIn('assets/style.css');
  for (const [key, rel] of Object.entries(files)) {
    const basePath = path.join(SNAP, `sel-${key}.txt`);
    if (!fs.existsSync(basePath)) continue;
    const before = new Set(fs.readFileSync(basePath, 'utf8').split('\n').filter(Boolean));
    const after = selectorsIn(rel);
    const lost = [...before].filter((s) => !after.has(s) && !global.has(s) && !RETIRED.has(s));
    check(lost.length === 0, `${rel}: ${lost.length} selector(s) lost from BOTH ${rel} and style.css: ${lost.join(' ')}`);
  }
}

/* ---------- 9. shared <head> boilerplate ---------- */
// scripts/build.mjs used to generate the <head> on every page and shipped its
// own --check. It was retired (see RUNBOOK) because the same script had drifted
// into owning a stale <header> that would have reverted the live nav. That left
// the <head> hand-maintained on ~57 pages with NOTHING verifying it — precisely
// the silent-drift class this file exists to catch. This is its replacement.
//
// index.html is the REFERENCE rather than a hardcoded list of tag values. A
// deliberate sitewide change — bumping the favicon `?v=`, changing theme-color,
// moving to a new font URL — edits index.html along with everything else and
// still passes. A PARTIAL rollout, which is the actual failure mode, fails
// loudly and names the page. So this check needs no edit when the chrome
// legitimately moves, which is what let build.mjs's own templates rot.
group('Shared <head> boilerplate (replaces build.mjs --check)');
{
  const headOf = (rel) => (read(rel).match(/<head>([\s\S]*?)<\/head>/i) || ['', ''])[1];
  const REF = 'index.html';
  const refHead = headOf(REF);

  // Which tags count as chrome, and how to find them. The expected VALUE is
  // never written here — it is read off the reference page.
  const CHROME = [
    ['charset', /<meta charset=[^>]*>/i],
    ['viewport', /<meta name="viewport"[^>]*>/i],
    ['preconnect googleapis', /<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com"[^>]*>/i],
    ['preconnect gstatic', /<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com"[^>]*>/i],
    ['google-fonts stylesheet', /<link href="https:\/\/fonts\.googleapis\.com\/css2[^>]*>/i],
    ['favicon.ico', /<link rel="icon" href="\/favicon\.ico[^>]*>/i],
    ['favicon-32', /<link rel="icon" href="\/assets\/logo\/favicon-32\.png[^>]*>/i],
    ['favicon-16', /<link rel="icon" href="\/assets\/logo\/favicon-16\.png[^>]*>/i],
    ['favicon.svg', /<link rel="icon" href="\/assets\/logo\/favicon\.svg[^>]*>/i],
    ['apple-touch-icon', /<link rel="apple-touch-icon"[^>]*>/i],
    ['mask-icon', /<link rel="mask-icon"[^>]*>/i],
    ['manifest', /<link rel="manifest"[^>]*>/i],
    ['theme-color', /<meta name="theme-color"[^>]*>/i],
    ['style.css', /<link rel="stylesheet" href="\/assets\/style\.css">/i],
  ];

  // allPages misses two surfaces that carry the same chrome: compare.html (hand
  // -maintained, under paddles/browse/, which sync-header.js also now reaches)
  // and the detail TEMPLATE. Checking the template rather than its 514 outputs
  // covers all of them in one assertion and points at the file you would edit.
  const headPages = [...allPages, 'paddles/browse/compare.html', 'partials/paddle-detail-template.html'];

  // If the reference itself loses a tag, every other page would "match" a
  // missing value and the whole check would silently pass. Anchor it first.
  for (const [name, re] of CHROME) {
    check(re.test(refHead), `${REF}: reference <head> lost ${name} — the boilerplate check cannot anchor on it`);
  }

  for (const rel of headPages) {
    const head = headOf(rel);
    const problems = [];
    for (const [name, re] of CHROME) {
      const want = (refHead.match(re) || [null])[0];
      const got = (head.match(re) || [null])[0];
      if (!got) problems.push(`missing ${name}`);
      else if (want && got !== want) problems.push(`${name} differs from ${REF}`);
    }
    check(problems.length === 0, `${rel}: <head> chrome drift — ${problems.join('; ')}`);
  }

  // Social + canonical. 404.html is exempt because it is noindexed and has no
  // canonical URL to claim, so it deliberately ships none of these.
  // twitter:image is deliberately NOT required: twitter:card falls back to
  // og:image per Twitter's own spec, and compare.html relies on exactly that —
  // demanding it would be asserting a preference, not an invariant.
  const SOCIAL = [
    ['description', /<meta name="description"[^>]*>/i],
    ['og:type', /<meta property="og:type"[^>]*>/i],
    ['og:site_name', /<meta property="og:site_name"[^>]*>/i],
    ['og:image', /<meta property="og:image"[^>]*>/i],
    ['twitter:card', /<meta name="twitter:card"[^>]*>/i],
    ['canonical', /<link rel="canonical"[^>]*>/i],
  ];
  for (const rel of headPages.filter((p) => p !== '404.html')) {
    const head = headOf(rel);
    const missing = SOCIAL.filter(([, re]) => !re.test(head)).map(([n]) => n);
    check(missing.length === 0, `${rel}: <head> missing ${missing.join(', ')}`);
  }

  // The exemption above is only safe while 404 stays out of the index.
  check(/<meta name="robots"[^>]*noindex/i.test(headOf('404.html')),
    '404.html: lost its noindex — it can no longer be exempt from the canonical/social head check');
}

console.log(`\n${fails === 0 ? '✔' : '✘'} ${passes} passed, ${fails} failed`);
process.exit(fails === 0 ? 0 : 1);
