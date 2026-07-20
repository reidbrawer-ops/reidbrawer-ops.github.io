#!/usr/bin/env node
/**
 * Stamp the 486 paddle detail pages out of ONE template.
 *
 *     node scripts/generate-paddle-pages.mjs           write paddles/browse/p/*.html
 *     node scripts/generate-paddle-pages.mjs --check   verify they're current; exit 1 on drift
 *
 * WHY THIS EXISTS
 * ---------------
 * The owner's constraint was "each paddle page should be generated from the same
 * template rather than having 486+ different pages to upkeep". So the editable
 * surface is exactly two files — partials/paddle-detail-template.html for the
 * markup and this script for the content — and paddles/browse/p/ is build
 * output, the same deal cities/*.html has with generate-venues.mjs.
 *
 * The pages are STATIC-COMPLETE. Every bar, spec, pick and buy link is baked in
 * here, so the browser fetches no catalog: 486 pages each pulling the 257KB
 * paddles.json to render facts known at build time would cost a second of TTI
 * and hide the whole catalog from crawlers, for nothing.
 *
 * THREE THINGS THIS SCRIPT OWNS THAT NOTHING ELSE COVERS
 * ------------------------------------------------------
 * 1. The inlined site header. scripts/sync-header.js's targets() is
 *    NON-RECURSIVE (root + cities/ + paddles/), so it can never reach
 *    paddles/browse/p/ — these pages would keep a stale nav forever and no
 *    existing check would notice. --check therefore diffs each page's header
 *    region against partials/site-header.html and names it as header drift.
 * 2. Orphan pruning. A paddle dropped from the catalog leaves a live, indexed,
 *    linked-from-sitemap page behind. Files whose id is no longer in
 *    paddles.json are deleted (reported, not deleted, under --check).
 * 3. The sitemap's <!-- paddles:start/end --> region.
 *
 * WHAT IT DELIBERATELY DOES **NOT** CREATE
 * ----------------------------------------
 * paddles/browse/index.html. Firebase Hosting serves a directory index in
 * preference to the sibling paddles/browse.html, so creating one would silently
 * replace the catalog at /paddles/browse with whatever that index contained.
 * The bare paddles/browse/ directory is fine; an index.html in it is not.
 *
 * The dependency modules are pulled in over file:// URLs. That works because
 * paddle-model.js, affiliate-links.js and paddle-ratings.js all have zero
 * imports — Node cannot resolve the site's "/assets/x.js" specifiers, which only
 * mean anything under a page's import map, so the moment one of those files
 * imports a sibling this generator breaks. paddle-model.js says so in its own
 * header; don't add an import to any of the three.
 * (Node prints one MODULE_TYPELESS_PACKAGE_JSON warning for this. Do NOT
 * silence it by adding "type":"module" to package.json — scripts/*.js are
 * CommonJS and would all break.)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "paddles", "browse", "p");
const CHECK = process.argv.includes("--check");

const ORIGIN = "https://pickleball-bay-area.com";
const BASE_PATH = "/paddles/browse/p";

// The month the served prices were last rebuilt (see PADDLE_DATA_SETUP.md /
// scripts/rebuild_paddle_data.py). Printed under every price, so it has to be
// bumped whenever paddles.json is refreshed — a price with a stale "as of" is
// worse than a price with none.
const PRICE_AS_OF = "July 2026";

const HEADER_START =
  "<!-- site-header:start · source: partials/site-header.html · regenerate: node scripts/sync-header.js -->";
const HEADER_END = "<!-- site-header:end -->";
const SITEMAP_START = "  <!-- paddles:start · generated: node scripts/generate-paddle-pages.mjs -->";
const SITEMAP_END = "  <!-- paddles:end -->";

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const load = (rel) => JSON.parse(read(rel));
const dep = async (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);

const {
  esc,
  bandPhrase,
  approvalNote,
  moneyLabel,
  hasLab,
  sortRows,
  pickRecos,
  similarPaddles,
  blurbFor,
  specRows,
  metricRows,
} = await dep("assets/paddle-model.js");
const { vendorLinkFor } = await dep("assets/affiliate-links.js");
const { tiebreakByTrait, controlRating } = await dep("assets/paddle-ratings.js");

/* ------------------------------------------------------------------ header */

// Byte-identical to what sync-header.js would have written for a page under
// paddles/browse/, because these detail pages ARE browse children: its
// activeHref maps paddles/browse/* to the "/paddles/browse" lane and lights the
// "Paddles" dropdown summary that contains it. The three throws mirror
// sync-header.js's: a partial that already carries aria-current, or whose nav
// link/summary grew an attribute, breaks the string match there too, and finding
// out here is cheaper than shipping dead navs on every detail page.
function headerBlock(partial) {
  const base = partial.trim();
  if (base.includes("aria-current")) {
    throw new Error("partials/site-header.html must not contain aria-current");
  }
  const marker = '<a href="/paddles/browse">';
  if (!base.includes(marker)) {
    throw new Error(`partials/site-header.html: nav link ${marker} not found (attribute added?)`);
  }
  const summary = "<summary>Paddles</summary>";
  if (!base.includes(summary)) {
    throw new Error(`partials/site-header.html: ${summary} not found (nav dropdown changed?)`);
  }
  return `${HEADER_START}\n${base
    .replace(marker, '<a href="/paddles/browse" aria-current="page">')
    .replace(summary, '<summary aria-current="page">Paddles</summary>')}\n${HEADER_END}`;
}

const HEADER_REGION_RE = /<!-- site-header:start[\s\S]*?<!-- site-header:end -->/;

/* ----------------------------------------------------- title disambiguation */

// Four ids end in --dupN, and one of those pairs — JOOLA's two "Hyperion 3S
// (16mm)" rows — is a genuine name collision. Two pages with the same <title>
// and the same description are a duplicate-content signal that can cost both of
// them; the other three pairs already differ by a "+" in the model name.
//
// Derived, not hardcoded to that one pair: the next data refresh will collide
// somewhere else. The first field on which the whole colliding group holds
// DISTINCT non-null values wins, so the suffix is always a real fact that
// actually tells the two pages apart. Year comes first because it is the
// difference a shopper would recognise — and is exactly what does NOT separate
// the Hyperions (both 2024), which is why a year-only rule would have failed
// silently on the one pair that needed it.
const DISAMBIGUATORS = [
  ["yearReleased", (v) => `${v} release`],
  ["balancePointMm", (v) => `${v}mm balance point`],
  ["weightOz", (v) => `${v} oz build`],
  ["coreThicknessMm", (v) => `${v}mm core`],
  ["price", (v) => `$${Math.round(v)} build`],
];

function dupLabels(rows) {
  const groups = new Map();
  for (const p of rows) {
    const key = `${p.brand} ${p.name}`.toLowerCase();
    groups.set(key, (groups.get(key) || []).concat(p));
  }
  const labels = new Map();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const field = DISAMBIGUATORS.find(([f]) => {
      const vs = group.map((p) => p[f]);
      return vs.every((v) => v != null) && new Set(vs).size === group.length;
    });
    for (const p of group) {
      // No distinguishing spec at all (never true today): the id is unique by
      // construction, and an ugly title beats two identical ones.
      labels.set(p.id, field ? field[1](p[field[0]]) : p.id);
    }
  }
  return labels;
}

/* -------------------------------------------------------------------- head */

const titleFor = (p, dup) =>
  `${p.brand} ${p.name}${dup ? `, ${dup}` : ""} — paddle specs & performance — Pickleball Bay Area`;

// Trailing SENTENCES are dropped rather than the string being cut at 160
// characters: a description that stops at "the closes" reads as broken markup,
// and Google truncates the tail anyway. The dup label sits second so it is the
// last thing to go.
//
// It opens with the model name because blurbFor() never mentions it, and two
// paddles can share a blurb without sharing a name — "Joy S" and "Joy S +" are
// the same year, shape, core and feel, so without the name their descriptions
// were byte-identical while their titles were not.
function descriptionFor(p, dup) {
  const parts = [`${p.name}: ${blurbFor(p)}`];
  if (dup) parts.push(`The ${dup}.`);
  if (p.price != null) parts.push(`Around ${moneyLabel(p.price)}.`);
  parts.push("Full specs, measured performance and the closest alternatives.");
  while (parts.length > 1 && parts.join(" ").length > 165) parts.pop();
  return parts.join(" ");
}

// JSON-LD carries name, brand and an offers price — and NOTHING measured. The
// percentiles are licensed and banded (PADDLE_DATA_SETUP.md); putting a band in
// structured data would republish it in the one format built for machines to
// copy wholesale, which is the opposite of what the banding is for.
function jsonLd(p, canonical, buyHref) {
  const crumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      ["Home", `${ORIGIN}/`],
      ["Paddles", `${ORIGIN}/paddles`],
      ["Browse all paddles", `${ORIGIN}/paddles/browse`],
      [`${p.brand} ${p.name}`, canonical],
    ].map(([name, item], i) => ({ "@type": "ListItem", position: i + 1, name, item })),
  };
  const product = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${p.brand} ${p.name}`,
    brand: { "@type": "Brand", name: p.brand },
    category: "Pickleball paddle",
    url: canonical,
  };
  if (p.price != null) {
    product.offers = {
      "@type": "Offer",
      price: p.price.toFixed(2),
      priceCurrency: "USD",
      // Not availability:InStock — we don't track any retailer's stock, and a
      // rich result claiming we do would be a lie Google renders for us.
      url: buyHref || canonical,
    };
  }
  // A literal "</script>" inside a JSON string ends the block early and dumps
  // the rest of the graph into the DOM as text. Escaping "<" is the standard
  // guard and survives JSON parsing unchanged.
  const emit = (o) =>
    `<script type="application/ld+json">\n${JSON.stringify(o).replace(/</g, "\\u003c")}\n</script>`;
  return `${emit(crumbs)}\n${emit(product)}`;
}

/* -------------------------------------------------------------------- body */

const detailHref = (p) => `${BASE_PATH}/${encodeURIComponent(p.id)}`;

function specsHtml(p) {
  return specRows(p)
    .map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`)
    .join("\n              ");
}

// .pn-tag is shared, not borrowed: paddle-finder.css defines the outlined base
// specifically for "the detail title block … its USAP and year chips", and the
// catalog cards use the same class, so a chip looks identical wherever it lands.
// Only the play style is tinted — TYPE_MOD mirrors assets/paddle-finder.js so
// "Power" is clay on a card and clay here.
const TYPE_MOD = { Power: "power", Control: "control", "All-Court": "allcourt" };

function chipsHtml(p) {
  const style = p.paddleType
    ? `<span class="pn-tag pn-tag--${TYPE_MOD[p.paddleType] || "unrated"}">${esc(p.paddleType)}</span>`
    : "";
  const rest = [p.shape, approvalNote(p), p.yearReleased, p.skillLevel]
    .filter(Boolean)
    .map((c) => `<span class="pn-tag">${esc(c)}</span>`)
    .join("");
  return style + rest;
}

// The bars are the licensing firewall's sharpest edge. The percentile reaches
// the page ONLY as a CSS width — a bar's position along the catalog, which is
// what a bar means — and never as text: the row prints tierWord() and
// bandPhrase(), both of which are coarser than the 20 bands underneath. There
// is no tooltip, no title attribute and no data-* carrying the number, because
// "not even as a chip or in a tooltip" is the licence term verbatim.
function barsHtml(p) {
  const rows = metricRows(p, { control: controlRating });
  // Unreachable on today's data — twist weight and swing weight are on all 486
  // rows, so every paddle draws at least Forgiveness and Hand speed. Kept
  // because a future refresh that drops either field would otherwise emit
  // <div class="pd-bars"></div>: an empty frame under a heading promising
  // measured performance.
  if (!rows.length) {
    return `<p class="pd-nolab">This paddle hasn't been through the bench our performance bands come from. The specifications below are the manufacturer's own, and they're the only claim we'll make about it.</p>`;
  }
  const bars = rows
    .map((r) => {
      // Hand speed is always neutral. It is the one row where more is not
      // better: a heavy head is slower but steadier, so colouring a short bar
      // "bad" would tell a control player the wrong thing. (The row is already
      // inverted by metricRows so a long bar still means "more hand speed" —
      // the colour just declines to have an opinion about it.)
      const tone = r.key === "handspeed" ? "neutral" : r.v >= 0.66 ? "high" : r.v >= 0.33 ? "mid" : "low";
      const width = `${Number((r.v * 100).toFixed(1))}%`;
      // A <div>, not a <span>. .pd-fill sets height/width but no `display`, and
      // neither property applies to a non-replaced inline box — as a span every
      // bar computed to 0x0 and the whole card rendered as four empty tracks,
      // confirmed in the browser. A div is block by default and stays correct
      // if the stylesheet later adds display:block itself.
      return `<div class="pd-bar">
              <p class="pd-bar-head"><span class="pd-bar-label">${esc(r.label)}</span><span class="pd-bar-word">${esc(r.word)}</span><span class="pd-bar-band">${esc(bandPhrase(r.v) || "")}</span></p>
              <div class="pd-track"><div class="pd-fill pd-fill--${tone}" style="width:${width}"></div><span class="pd-median" aria-hidden="true"></span></div>
              <p class="pd-bar-note">${esc(r.note)}</p>
            </div>`;
    })
    .join("\n            ");
  // 126 paddles have neither a spin nor a power band, so their card silently
  // renders two bars where others render four. Say so: an absent row is
  // indistinguishable from a row we chose not to show, and a reader comparing
  // two tabs would otherwise read the gap as "no power" rather than "not
  // measured" — the exact inference hasLab() exists to prevent everywhere else.
  const gap = hasLab(p)
    ? ""
    : `\n            <p class="pd-nolab">Spin and power aren't shown here: this paddle hasn't been through the bench those two bands come from, and ${CATALOG_NOLAB} of the ${CATALOG_TOTAL} haven't. What's above is measured; nothing is estimated.</p>`;
  return `<div class="pd-bars">\n            ${bars}${gap}\n          </div>`;
}

// One CTA, never two. vendorLinkFor returns null only when a paddle has neither
// a vendorSearchBase nor a vendorUrl — nothing in today's catalog, but the
// Google fallback is what stands between a future data refresh dropping a
// vendor field and a detail page with no way to buy the thing it describes.
// It is rendered in the SAME solid style, so the page never reads as "here is a
// buy button, and also, in case it doesn't work, a search".
function ctaHtml(p, affiliateMap) {
  const link = vendorLinkFor(p, affiliateMap);
  const href = link
    ? link.href
    : `https://www.google.com/search?q=${encodeURIComponent(`${p.brand} ${p.name} pickleball paddle`)}`;
  const label = link ? link.label : `Search ${p.brand}`;
  const isAffiliate = Boolean(link && link.isAffiliate);
  const linkType = link ? link.linkType || "unknown" : "brand-search";
  // rel and the disclosure below are both conditional on isAffiliate — a plain
  // vendor link must never carry a paid-endorsement declaration it hasn't
  // earned, and an affiliate link must never be missing one.
  const rel = isAffiliate ? "sponsored nofollow noopener" : "nofollow noopener";
  const data = [
    `data-pq-paddle="${esc(p.id)}"`,
    `data-pq-brand="${esc(p.brand)}"`,
    `data-pq-link-type="${esc(linkType)}"`,
    `data-pq-affiliate="${isAffiliate ? "1" : "0"}"`,
    // "detail" keeps these out of the grid's 1..N and the quiz's 1..3 position
    // scales, which would otherwise average together into nonsense in GA4 with
    // no way to unpick them afterwards.
    `data-pq-surface="detail"`,
    `data-pq-position="1"`,
  ].join(" ");
  const html = `<a class="btn pd-cta" href="${esc(href)}" target="_blank" rel="${rel}" ${data}>${esc(label)}<span class="visually-hidden"> &mdash; ${esc(p.brand)} ${esc(p.name)} (opens in new tab)</span></a>`;
  return { html, isAffiliate, isAmazon: Boolean(link && link.isAmazon), href, hasVendor: Boolean(link) };
}

function priceHtml(p) {
  const note =
    p.price != null
      ? `Street price as of ${PRICE_AS_OF} &mdash; retailers move it.`
      : `We don't have a street price for this one. The link goes to the brand so you can check.`;
  return `<div>
            <p class="pd-price">${esc(moneyLabel(p.price))}</p>
            <p class="pd-price-note">${note}</p>
          </div>`;
}

// The Amazon Associates sentence is required VERBATIM by the Operating
// Agreement wherever an Associates link appears, and it sits with the link
// rather than in a footnote. Three branches because all three are true
// somewhere in the catalog, and each says something different about money.
function disclosureHtml(cta) {
  if (!cta.hasVendor) {
    return `<p class="pd-disclosure">That's a plain Google search &mdash; we don't have a vendor link for this paddle and we earn nothing from it. <a href="/affiliate-disclosure">How our links work</a>.</p>`;
  }
  if (!cta.isAffiliate) {
    return `<p class="pd-disclosure">This link goes straight to the brand's own site &mdash; we don't earn a commission from it today. If that changes, we'll say so right here and on our <a href="/affiliate-disclosure">disclosure page</a>.</p>`;
  }
  const amazon = cta.isAmazon ? " As an Amazon Associate I earn from qualifying purchases." : "";
  return `<p class="pd-disclosure">This is an affiliate link &mdash; we may earn a commission if you buy, at no extra cost to you. It never changes which paddles appear here or how they're described.${amazon} <a href="/affiliate-disclosure">How this works</a>.</p>`;
}

function recosHtml(p, pool) {
  const recos = pickRecos(p, pool);
  // No card is better than a wrong one: a paddle that is already the best in a
  // thin play-style pool gets no picks, and the section disappears rather than
  // showing an empty frame or a "pick" that is a price increase.
  if (!recos.length) return "";
  const cards = recos
    .map((r) => {
      const delta = r.deltaLabel
        ? ` <span class="pd-reco-delta is-${esc(r.deltaDir)}">${esc(r.deltaLabel)}</span>`
        : "";
      // A card, not one big <a>. The badge is absolutely positioned and
      // overhangs the corner, and paddle-finder.css styles .pd-reco-name a and
      // .pd-reco-go as separate links — wrapping the whole card would also
      // nest the reason paragraph inside a link, which screen readers read out
      // as one enormous link name.
      const href = detailHref(r.paddle);
      return `<div class="pd-reco pd-reco--${esc(r.kind)}">
              <span class="pd-reco-badge">${esc(r.badge)}</span>
              <h3 class="pd-reco-name"><a href="${href}">${esc(r.paddle.brand)} ${esc(r.paddle.name)}</a></h3>
              <p class="pd-reco-price">${esc(moneyLabel(r.paddle.price))}${delta}</p>
              <p class="pd-reco-reason">${esc(r.reason)}</p>
              <a class="pd-reco-go" href="${href}">See this paddle &rarr;</a>
            </div>`;
    })
    .join("\n            ");
  return `<section class="pd-section pd-recos">
          <h2>Where to go from here.</h2>
          <p class="pd-caption">Same play style, a different trade-off &mdash; one steps up the measured performance, one protects your wallet.</p>
          <div class="pd-reco-grid">
            ${cards}
          </div>
        </section>`;
}

// A similar-paddle card. No image well — there are no product photos, and the
// dimensioned blueprint that used to fill it read as clutter at this size. The
// card is now a typographic lockup that mirrors the catalog card (.pn-card):
// mono brand eyebrow, serif name, then a foot with the price and the play-style
// chip pinned to a hairline. Same class vocabulary (.pn-tag), so a chip looks
// identical whether it lands on a catalog card, the title block, or here.
//
// The whole card is the link; the play-style chip is a plain <span>, not a
// nested control, so there is no invalid interactive nesting.
const similarCard = (s) => {
  const chip = s.paddleType
    ? `<span class="pn-tag pn-tag--${TYPE_MOD[s.paddleType] || "unrated"}">${esc(s.paddleType)}</span>`
    : `<span class="pn-tag pn-tag--unrated">Unrated</span>`;
  return `<a class="pd-similar-card" href="${detailHref(s)}">
              <span class="pd-similar-brand">${esc(s.brand)}</span>
              <span class="pd-similar-name">${esc(s.name)}</span>
              <span class="pd-similar-foot">
                <span class="pd-similar-price">${esc(moneyLabel(s.price))}</span>
                ${chip}
              </span>
            </a>`;
};

function similarHtml(p, pool) {
  const kin = similarPaddles(p, pool, 6);
  if (!kin.length) return "";
  const cards = kin.map(similarCard).join("\n            ");
  return `<section class="pd-section pd-similar">
          <h2>Similar paddles.</h2>
          <p class="pd-caption">The closest six in the catalog on shape, core, balance and measured character &mdash; not just the same brand.</p>
          <div class="pd-similar-row">
            ${cards}
          </div>
        </section>`;
}

// .clear-btn, NOT the catalog's .pn-compare. Both toggle the same tray, but
// .pn-compare is `position: absolute; top: 8px; right: 8px` — it is pinned to
// the corner of a `position: relative` catalog card, and .pd-buy is not
// positioned, so on a detail page it escapes to the top-right of the VIEWPORT
// and floats over the header (seen in the browser before this was changed).
// .clear-btn is style.css's established secondary pill, described there as
// exactly this: a utility action sitting inside a card.
//
// It ships inert, at aria-pressed="false" and with no .is-on. The pressed state
// lives in sessionStorage, which a build cannot read, so a prerendered
// "✓ Comparing" would be a lie on every load where the tray is empty —
// assets/paddle-detail.js sets all three from the real tray on mount.
const compareHtml = (p) =>
  `<button type="button" class="clear-btn" data-pd-compare data-id="${esc(p.id)}" data-name="${esc(p.name)}" data-brand="${esc(p.brand)}" aria-pressed="false">+ Compare</button>`;

/* ---------------------------------------------------------------- assembly */

function renderPage(p, ctx) {
  const dup = ctx.dups.get(p.id) || null;
  const canonical = `${ORIGIN}${detailHref(p)}`;
  const cta = ctaHtml(p, ctx.affiliateMap);

  const tokens = {
    TITLE: esc(titleFor(p, dup)),
    DESCRIPTION: esc(descriptionFor(p, dup)),
    CANONICAL: esc(canonical),
    JSONLD: jsonLd(p, canonical, cta.hasVendor ? cta.href : null),
    SITE_HEADER: ctx.header,
    BRAND: esc(p.brand),
    NAME: esc(p.name),
    TITLE_CHIPS: chipsHtml(p),
    BLURB: esc(blurbFor(p)),
    PRICE: priceHtml(p),
    CTA: cta.html,
    COMPARE: compareHtml(p),
    DISCLOSURE: disclosureHtml(cta),
    BARS: barsHtml(p),
    CATALOG_TOTAL: String(CATALOG_TOTAL),
    SPECS: specsHtml(p),
    RECOS: recosHtml(p, ctx.pool),
    SIMILAR: similarHtml(p, ctx.pool),
  };

  let out = ctx.template;
  for (const [k, v] of Object.entries(tokens)) out = out.replaceAll(`{{${k}}}`, v);
  const left = out.match(/\{\{[A-Z_]+\}\}/);
  // A typo'd token would otherwise ship as literal "{{BLURB}}" on 486 pages.
  if (left) throw new Error(`template token ${left[0]} has no value (paddle ${p.id})`);
  return out;
}

// Undo what scripts/hash-modules.mjs does to a page, so --check compares like
// with like. Hashing runs AFTER this generator (see npm run check ordering): it
// injects an import map and rewrites the module entry to /assets/m/<hash>.js, so
// a byte comparison against the freshly-rendered template would report all 486
// pages as drifted the moment anyone ran `npm run hash`. Writes use the same
// normalisation, so regenerating an unchanged page doesn't throw its import map
// away and force a re-hash.
const unhash = (html) =>
  html
    .replace(/[ \t]*<!-- importmap:start[\s\S]*?<!-- importmap:end -->\n?/, "")
    .replace(/\/assets\/m\/paddle-detail\.[0-9a-f]{6,}\.js/g, "/assets/paddle-detail.js");

/* ----------------------------------------------------------------- sitemap */

function sitemapRegion(rows) {
  const urls = rows
    .map(
      (p) => `  <url>
    <loc>${ORIGIN}${detailHref(p)}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>`
    )
    .join("\n");
  return `${SITEMAP_START}\n${urls}\n${SITEMAP_END}`;
}

function applySitemap(rows) {
  const rel = "sitemap.xml";
  const src = read(rel);
  const region = sitemapRegion(rows);
  const marked = new RegExp(
    `${SITEMAP_START.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${SITEMAP_END.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`
  );
  const next = marked.test(src)
    ? src.replace(marked, region)
    : src.replace("</urlset>", `${region}\n</urlset>`);
  if (next === src) return { changed: false, count: rows.length };
  if (!CHECK) fs.writeFileSync(path.join(ROOT, rel), next);
  return { changed: true, count: rows.length };
}

/* -------------------------------------------------------------------- main */

const paddles = load("assets/paddles.json");
// Catalog counts shown in visitor-facing copy (the perf caption and the
// specs-only note). Derived from the data, not hardcoded, so a data refresh
// that changes the catalog size — adding paddles, or PickleballEffect widening
// the bench — can't leave a stale "486" / "126" baked into every detail page.
// CATALOG_NOLAB counts paddles with neither a spin nor a power band, i.e.
// !hasLab(p) — the ones whose card renders two bars instead of four.
const CATALOG_TOTAL = paddles.length;
const CATALOG_NOLAB = paddles.filter((p) => p.spinPercentile == null && p.powerPercentile == null).length;
const affiliateMap = load("assets/affiliate-map.json");
const partial = read("partials/site-header.html");
// Strip the template's build documentation — everything before the doctype. It
// explains the generator, not the paddle, and 486 copies of it is 486 copies of
// a comment no visitor benefits from.
//
// Anchored to a LINE-START doctype (`^` under /m), not just the first one in
// the file. Without the anchor the lazy match stopped at a doctype mentioned
// inside the comment itself, so the strip cut the comment in half and the rest
// of that sentence rendered as visible text above the header on all 486 pages.
const DOCTYPE_RE = /^[\s\S]*?(?=^<!doctype html>)/m;
const templateSrc = read("partials/paddle-detail-template.html");
if (!DOCTYPE_RE.test(templateSrc)) {
  throw new Error("partials/paddle-detail-template.html: no `<!doctype html>` at the start of a line");
}
const template = templateSrc.replace(DOCTYPE_RE, "");

const header = headerBlock(partial);

// Pre-ranked pool for pickRecos and similarPaddles. Both resolve exact ties by
// falling back on input order (Array.sort is stable), and after the percentiles
// were banded to 20 steps exact ties are the norm rather than an edge case —
// paddles.json is alphabetical by brand, so untreated, "closest match" would
// break ties in favour of brands starting with a digit. Ranking the pool by
// quality first makes those tiebreaks mean something and makes the output
// deterministic across runs.
const pool = sortRows(paddles, "best", { tiebreak: tiebreakByTrait });
const ctx = { template, header, affiliateMap, pool, dups: dupLabels(paddles) };

if (!CHECK) fs.mkdirSync(OUT_DIR, { recursive: true });

const drift = [];
let written = 0;
let unchanged = 0;

for (const p of paddles) {
  const file = path.join(OUT_DIR, `${p.id}.html`);
  const next = renderPage(p, ctx);
  const exists = fs.existsSync(file);
  const current = exists ? unhash(fs.readFileSync(file, "utf8")) : null;

  if (current === next) {
    unchanged++;
    continue;
  }
  if (CHECK) {
    // Name header drift specifically. Everything else is "the template or the
    // data moved"; a stale header means somebody edited the partial and ran
    // sync-header.js, which cannot reach this directory — a failure mode with
    // no other alarm on it anywhere in the repo.
    const had = current && current.match(HEADER_REGION_RE);
    const why = !exists
      ? "missing"
      : had && had[0] !== header
        ? "stale site header (partials/site-header.html changed)"
        : "content out of date";
    drift.push(`paddles/browse/p/${p.id}.html: ${why}`);
    continue;
  }
  fs.writeFileSync(file, next);
  written++;
}

// Orphans: a page whose paddle left the catalog stays live, indexed and linked
// from the sitemap until something deletes it.
const ids = new Set(paddles.map((p) => `${p.id}.html`));
const orphans = fs.existsSync(OUT_DIR)
  ? fs.readdirSync(OUT_DIR).filter((f) => f.endsWith(".html") && !ids.has(f))
  : [];
for (const f of orphans) {
  if (CHECK) drift.push(`paddles/browse/p/${f}: orphan — no such paddle id in assets/paddles.json`);
  else fs.unlinkSync(path.join(OUT_DIR, f));
}

const sitemap = applySitemap(paddles);
if (CHECK && sitemap.changed) drift.push("sitemap.xml: the paddles:start/end region is out of date");

if (CHECK) {
  if (drift.length) {
    console.error("✘ paddle detail pages are stale — run: npm run generate-paddles");
    for (const d of drift.slice(0, 10)) console.error(`   ${d}`);
    if (drift.length > 10) console.error(`   …and ${drift.length - 10} more`);
    process.exit(1);
  }
  console.log(`✔ paddle pages current: ${unchanged} pages, sitemap region ${sitemap.count} urls`);
} else {
  console.log(
    `✔ generated ${paddles.length} paddle pages -> paddles/browse/p/ ` +
      `(${written} written, ${unchanged} already current, ${orphans.length} orphan(s) pruned)`
  );
  console.log(`   sitemap.xml paddles region: ${sitemap.count} urls${sitemap.changed ? " (rewritten)" : " (already current)"}`);
  console.log("   run `npm run hash` next — the new pages have no import map yet");
}
