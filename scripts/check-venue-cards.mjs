// Checks each cities/<slug>.html page's hand-written venue-cards against
// assets/courts-data.json, which is the source of truth for a venue's facts.
// Unlike venues.json (see generate-venues.mjs), venue-card prose is NOT
// generated from courts-data.json -- it's hand-written narrative (stat-chip
// wording, rating-pill judgments, paragraph descriptions), so this script
// does not regenerate it. It only catches the one thing that's a reliable,
// literal echo of the data (the bold court-count number in each card's
// .facts block) and flags everything else as a warning for a human to
// reword, since hours/price/level/weather/reservable are routinely
// paraphrased, tightened, or hand-enhanced beyond what the raw field says --
// blindly overwriting them regresses real content (confirmed by scanning
// the existing site: e.g. several cards say "Indoor -- no weather factor"
// where courts-data.json just has "Not specified", which is the HTML being
// MORE correct, not less).
//
// Run this after editing courts-data.json for a venue that already has a
// city-page card, so drift between the two doesn't linger unnoticed.
//
// Usage:
//   node scripts/check-venue-cards.mjs           report all mismatches
//   node scripts/check-venue-cards.mjs --fix     also auto-fix single-number
//                                                 court-count mismatches
//                                                 (never touches split counts
//                                                 like "2 outdoor + 4 indoor",
//                                                 hours, price, or prose)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const courts = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/courts-data.json'), 'utf8'));
const courtsById = new Map(courts.map((c) => [c.id, c]));

const cityFiles = fs.readdirSync(path.join(ROOT, 'cities'))
  .filter((f) => f.endsWith('.html'))
  .sort();

const CARD_RE = /<div class="venue-card" id="([a-z0-9-]+)" data-court-id="\1">([\s\S]*?)\n {6}<\/div>/g;
const FACTS_RE = /class="facts">([\s\S]*?)<\/div>/;
const BOLD_NUM_RE = /<b>(\d+)<\/b>/g;

function unescapeHtml(s) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function checkField(body, labelPrefix, jsonValue, warnings, relPath, id, fieldName) {
  const re = new RegExp(`${labelPrefix}: ([^<]*)</span>`);
  const m = body.match(re);
  if (!m) return;
  const htmlValue = unescapeHtml(m[1]).trim();
  if (jsonValue && htmlValue !== jsonValue) {
    warnings.push({ relPath, id, field: fieldName, html: htmlValue, json: jsonValue });
  }
}

function main() {
  const fix = process.argv.includes('--fix');
  let cardsChecked = 0;
  let countFixes = 0;
  const countMismatches = [];
  const warnings = [];

  for (const file of cityFiles) {
    const relPath = path.join('cities', file);
    const abs = path.join(ROOT, relPath);
    let html = fs.readFileSync(abs, 'utf8');
    let changed = false;

    for (const m of html.matchAll(CARD_RE)) {
      const [, id, body] = m;
      const court = courtsById.get(id);
      if (!court) continue;
      cardsChecked++;

      const factsMatch = body.match(FACTS_RE);
      const factsBlock = factsMatch ? factsMatch[1] : '';
      const boldNums = [...factsBlock.matchAll(BOLD_NUM_RE)].map((n) => Number(n[1]));
      const htmlCount = boldNums.length ? boldNums.reduce((a, b) => a + b, 0) : null;
      const jsonCount = court.courts;

      if (htmlCount !== null && jsonCount !== null && htmlCount !== jsonCount) {
        if (fix && boldNums.length === 1) {
          const oldTag = `<b>${boldNums[0]}</b>`;
          const newTag = `<b>${jsonCount}</b>`;
          const cardStart = html.indexOf(m[0]);
          const factsStart = cardStart + body.indexOf(factsBlock);
          const before = html.slice(0, factsStart);
          const rest = html.slice(factsStart);
          const fixedRest = rest.replace(oldTag, newTag);
          html = before + fixedRest;
          changed = true;
          countFixes++;
        } else {
          countMismatches.push({ relPath, id, html: htmlCount, json: jsonCount, splitCount: boldNums.length > 1 });
        }
      }

      checkField(body, 'Hours', court.hours, warnings, relPath, id, 'hours');
      checkField(body, 'Level', court.skill, warnings, relPath, id, 'skill');
    }

    if (changed) fs.writeFileSync(abs, html, 'utf8');
  }

  console.log(`Checked ${cardsChecked} venue-cards across ${cityFiles.length} city pages.\n`);

  if (countFixes) console.log(`Fixed ${countFixes} single-number court-count mismatch(es).\n`);

  if (countMismatches.length) {
    console.log(`Court-count mismatches${fix ? ' (not auto-fixed -- split counts need a human to redistribute)' : ''}:`);
    for (const r of countMismatches) {
      console.log(`  ${r.relPath}  ${r.id}: page says ${r.html}, courts-data.json says ${r.json}`);
    }
    console.log('');
  } else {
    console.log('No court-count mismatches.\n');
  }

  if (warnings.length) {
    console.log(`${warnings.length} hours/level warning(s) -- these are often intentional paraphrasing, review before changing:`);
    for (const w of warnings) {
      console.log(`  ${w.relPath}  ${w.id} [${w.field}]:\n    page:  ${w.html}\n    data:  ${w.json}`);
    }
  }

  if (countMismatches.length > 0 && !fix) process.exit(1);
}

main();
