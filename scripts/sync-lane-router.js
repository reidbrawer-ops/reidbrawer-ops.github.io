#!/usr/bin/env node
/**
 * Sync the "lane router" CTA block from its single source
 * (partials/lane-router.html) into every page that should carry it.
 *
 * The block is written between HTML marker comments so re-running this
 * script updates it in place — edit partials/lane-router.html, then:
 *     node scripts/sync-lane-router.js
 *
 * Targets: the map page + all individual city pages (cities/*.html except
 * index.html). The homepage keeps its own richer 3-lane variant and is not
 * managed here. The block is emitted as static HTML (not JS-injected) so it
 * stays crawlable on the SEO-critical city pages.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PARTIAL = path.join(ROOT, "partials", "lane-router.html");
const FOOTER_ANCHOR = '<footer class="site-footer">';
const START = "<!-- lane-router:start · source: partials/lane-router.html · regenerate: node scripts/sync-lane-router.js -->";
const END = "<!-- lane-router:end -->";

// Marked region (idempotent update target).
const markedRegion = /[ \t]*<!-- lane-router:start[\s\S]*?<!-- lane-router:end -->\n?/;
// The original unmarked block shipped before this script existed, matched by
// its region-head heading so we can retrofit it into a managed block.
const unmarkedBlock =
  /[ \t]*<section class="section">\s*<div class="container">\s*<div class="region-head">\s*<div>\s*<h2>Before you head out<\/h2>[\s\S]*?<\/section>\n?/;

function targets() {
  const citiesDir = path.join(ROOT, "cities");
  const cityPages = fs
    .readdirSync(citiesDir)
    .filter((f) => f.endsWith(".html") && f !== "index.html")
    .map((f) => path.join(citiesDir, f));
  return [path.join(ROOT, "map.html"), ...cityPages];
}

function main() {
  const block = fs.readFileSync(PARTIAL, "utf8").trim();
  const canonical = `${START}\n${block}\n${END}`;

  const changed = [];
  const unchanged = [];
  for (const file of targets()) {
    let src = fs.readFileSync(file, "utf8");
    if (!src.includes(FOOTER_ANCHOR)) {
      throw new Error(`${path.relative(ROOT, file)}: missing footer anchor`);
    }
    // Strip whichever form the block is currently in (marked or legacy).
    src = src.replace(markedRegion, "").replace(unmarkedBlock, "");
    // Re-insert the canonical block immediately before the footer.
    const next = src.replace(
      new RegExp(`\\n*${FOOTER_ANCHOR.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
      `\n\n${canonical}\n\n${FOOTER_ANCHOR}`
    );
    const original = fs.readFileSync(file, "utf8");
    if (next !== original) {
      fs.writeFileSync(file, next);
      changed.push(path.relative(ROOT, file));
    } else {
      unchanged.push(path.relative(ROOT, file));
    }
  }

  console.log(`Synced lane router from ${path.relative(ROOT, PARTIAL)}`);
  console.log(`  updated: ${changed.length}`);
  changed.forEach((f) => console.log(`    ${f}`));
  console.log(`  already current: ${unchanged.length}`);
}

main();
