#!/usr/bin/env node
/**
 * Sync the site header from its single source (partials/site-header.html)
 * into every page. Edit the partial, then:
 *     node scripts/sync-header.js
 *
 * The header is identical on all 53 pages except the `aria-current="page"`
 * marker on the active nav item, which this script re-derives from each
 * page's own path — so the partial itself stays free of per-page state.
 *
 * The block is written between <!-- site-header:start/end --> markers and
 * replaced in place, so re-running updates it without moving or duplicating
 * it. It is emitted as static HTML (not JS-injected) so the nav stays
 * crawlable and the active state renders without a flash.
 *
 * The footer is intentionally NOT managed here: 6 pages carry deliberate
 * per-page footer variation (the "Popular" column drops the current city;
 * paddles/rankings have tailored footer-note text). Blindly syncing one
 * footer partial would erase that, so it's left alone.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PARTIAL = path.join(ROOT, "partials", "site-header.html");
const START = "<!-- site-header:start · source: partials/site-header.html · regenerate: node scripts/sync-header.js -->";
const END = "<!-- site-header:end -->";

// Existing header in either form: already-marked region, or the raw element.
const headerRe = /(?:[ \t]*<!-- site-header:start[\s\S]*?<!-- site-header:end -->)|(?:<header class="site-header">[\s\S]*?<\/header>)/;

// Which nav link is "current" for a given page, by path. null = no active item
// (homepage, privacy, affiliate-disclosure, 404).
//
// The three Paddles lanes each light their OWN item inside the "Paddles"
// dropdown, and main() additionally lights the "Paddles" summary whenever the
// active href is one of them — so the tab reads as current and the open menu
// shows which lane you're on. Browse's children (the compare page, and the
// generated detail pages, which the generator handles) count as the browse lane.
function activeHref(rel) {
  if (rel.startsWith("cities/")) return "/cities/";
  if (rel === "paddles/browse.html" || rel.startsWith("paddles/browse/")) return "/paddles/browse";
  if (rel === "paddles/rent.html") return "/paddles/rent";
  if (rel.startsWith("paddles/") || rel === "paddles.html") return "/paddles";
  return {
    "map.html": "/map",
    "rankings.html": "/rankings",
    "learn.html": "/learn",
    "corrections.html": "/corrections",
    "about.html": "/about",
  }[path.basename(rel)] || null;
}

// True for the three hrefs that live inside the "Paddles" dropdown, so their
// pages also light the summary that contains them.
const isPaddleLane = (href) => href === "/paddles" || href === "/paddles/browse" || href === "/paddles/rent";

function targets() {
  const root = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html"));
  // Any directory that holds pages carrying the shared header. Add one here and
  // its pages are synced — a page that silently misses the sync keeps a stale
  // nav forever, and nothing else would catch it.
  const nested = ["cities", "paddles", "paddles/browse"].flatMap((dir) => {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) return [];
    return fs
      .readdirSync(abs)
      .filter((f) => f.endsWith(".html"))
      .map((f) => path.join(dir, f));
  });
  return [...root, ...nested];
}

function main() {
  const base = fs.readFileSync(PARTIAL, "utf8").trim();
  if (base.includes("aria-current")) {
    throw new Error("partials/site-header.html must not contain aria-current");
  }

  const changed = [];
  let current = 0;
  for (const rel of targets()) {
    const file = path.join(ROOT, rel);
    const src = fs.readFileSync(file, "utf8");
    if (!headerRe.test(src)) throw new Error(`${rel}: no header found`);

    // Apply this page's active nav state to a fresh copy of the partial.
    let header = base;
    const active = activeHref(rel);
    if (active) {
      const marker = `<a href="${active}">`;
      if (!header.includes(marker)) throw new Error(`${rel}: nav link ${active} not in partial`);
      header = header.replace(marker, `<a href="${active}" aria-current="page">`);
      // A paddle lane also lights the dropdown it lives in.
      if (isPaddleLane(active)) {
        const summary = "<summary>Paddles</summary>";
        if (!header.includes(summary)) throw new Error(`${rel}: <summary>Paddles</summary> not in partial`);
        header = header.replace(summary, `<summary aria-current="page">Paddles</summary>`);
      }
    }
    const instance = `${START}\n${header}\n${END}`;

    const next = src.replace(headerRe, instance);
    if (next !== src) {
      fs.writeFileSync(file, next);
      changed.push(`${rel}${active ? ` (active: ${active})` : ""}`);
    } else {
      current++;
    }
  }

  console.log(`Synced header from ${path.relative(ROOT, PARTIAL)}`);
  console.log(`  updated: ${changed.length}`);
  changed.forEach((f) => console.log(`    ${f}`));
  console.log(`  already current: ${current}`);
}

main();
