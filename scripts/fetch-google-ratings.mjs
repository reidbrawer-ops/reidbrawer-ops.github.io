// One-off/periodic admin script: looks up each venue in Google Places
// (Text Search, New) and writes its public rating + review count to
// assets/google-ratings.json. See GOOGLE_RATINGS_SETUP.md for the full
// walkthrough.
//
// This never runs in visitors' browsers and never touches an API key
// client-side — the site just fetches the static JSON this script produces,
// the same way it fetches courts-data.json. Google ratings are shown
// alongside community ratings, never blended into a single score.
//
// Requires Node 18+ (uses global fetch). No npm install needed.
//
// Usage:
//   export GOOGLE_PLACES_API_KEY=your-key-here
//   node scripts/fetch-google-ratings.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiKey = process.env.GOOGLE_PLACES_API_KEY;

if (!apiKey) {
  console.error("Missing GOOGLE_PLACES_API_KEY. See GOOGLE_RATINGS_SETUP.md.");
  process.exit(1);
}

const courtsPath = path.join(__dirname, "../assets/courts-data.json");
const outPath = path.join(__dirname, "../assets/google-ratings.json");
const courts = JSON.parse(readFileSync(courtsPath, "utf8"));

// Be polite to the API — a small delay between requests, not a burst of 84.
const DELAY_MS = 150;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function searchPlace(court) {
  const textQuery = court.address && court.address !== "Not specified"
    ? `${court.name}, ${court.address}`
    : `${court.name}, ${court.city}, CA`;

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.rating,places.userRatingCount",
    },
    body: JSON.stringify({ textQuery, maxResultCount: 1 }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }

  const data = await res.json();
  return data.places && data.places[0] ? data.places[0] : null;
}

// Simple mismatch heuristic: flag a match only when its name shares no
// *distinctive* word with the venue name we searched for — a cheap signal,
// not a verdict, meant to shorten the manual spot-check. Generic facility
// words are excluded from "distinctive" because they're nearly useless as a
// signal here: "park" alone appears in 39 of this site's 84 venue names and
// "center" in 17, so two unrelated parks would otherwise share a "word" and
// never get flagged.
const GENERIC_WORDS = new Set([
  "park", "center", "centre", "playground", "courts", "court", "rec",
  "recreation", "recreational", "community", "club", "complex", "facility",
  "facilities", "sports", "athletic", "athletics", "field", "fields", "gym",
  "gymnasium", "area", "the", "and", "of", "at",
]);

function normalizeName(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function distinctiveWords(s) {
  return new Set(
    normalizeName(s)
      .split(" ")
      .filter((w) => w.length > 2 && !GENERIC_WORDS.has(w))
  );
}

function looksLikeMismatch(courtName, matchedName) {
  if (!matchedName) return false;
  const a = normalizeName(courtName);
  const b = normalizeName(matchedName);
  if (!a || !b || a === b || a.includes(b) || b.includes(a)) return false;
  const aWords = distinctiveWords(courtName);
  const bWords = distinctiveWords(matchedName);
  // Neither name has a distinctive word to compare (e.g. "Community Park") —
  // not enough signal either way, so don't flag it.
  if (aWords.size === 0 || bWords.size === 0) return false;
  for (const w of aWords) {
    if (bWords.has(w)) return false;
  }
  return true;
}

function printDiffSummary(existing, out, courtById) {
  const gained = [];
  const lost = [];
  const suspicious = [];

  const allIds = new Set([...Object.keys(existing), ...Object.keys(out)]);
  for (const id of allIds) {
    const before = existing[id];
    const after = out[id];
    const name = courtById[id] ? courtById[id].name : id;
    if (!before && after) gained.push(`${name} (${after.rating}★, ${after.userRatingCount || 0} reviews)`);
    if (before && !after) lost.push(name);
    if (after && looksLikeMismatch(name, after.matchedName)) {
      suspicious.push(`${name} -> "${after.matchedName}"`);
    }
  }

  console.log("\n--- Diff vs. previous assets/google-ratings.json ---");
  console.log(
    gained.length ? `Gained a rating (${gained.length}):\n  ${gained.join("\n  ")}` : "Gained a rating: none"
  );
  console.log(lost.length ? `Lost a rating (${lost.length}):\n  ${lost.join("\n  ")}` : "Lost a rating: none");
  console.log(
    suspicious.length
      ? `Possibly wrong match — shares no words with the venue name (${suspicious.length}), check these first:\n  ${suspicious.join("\n  ")}`
      : "Possibly wrong matches: none flagged"
  );
}

async function run() {
  const existing = (() => {
    try {
      return JSON.parse(readFileSync(outPath, "utf8"));
    } catch {
      return {};
    }
  })();
  const courtById = Object.fromEntries(courts.map((c) => [c.id, c]));

  const out = {};
  let found = 0;
  let missing = 0;
  let errors = 0;

  for (const court of courts) {
    try {
      const place = await searchPlace(court);
      if (place && typeof place.rating === "number") {
        out[court.id] = {
          placeId: place.id,
          rating: place.rating,
          userRatingCount: place.userRatingCount || 0,
          matchedName: place.displayName ? place.displayName.text : null,
          fetchedAt: new Date().toISOString().slice(0, 10),
        };
        found++;
        console.log(`✓ ${court.name} -> "${out[court.id].matchedName}" ${place.rating}★ (${out[court.id].userRatingCount})`);
      } else {
        missing++;
        console.log(`- ${court.name}: no Google rating found`);
      }
    } catch (err) {
      errors++;
      console.error(`✗ ${court.name}: ${err.message}`);
      if (existing[court.id]) {
        out[court.id] = existing[court.id]; // keep last-known-good on a transient failure
      }
    }
    await sleep(DELAY_MS);
  }

  writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");
  console.log(`\nDone. ${found} found, ${missing} not found, ${errors} errors.`);
  console.log(`Wrote ${outPath}`);

  printDiffSummary(existing, out, courtById);

  console.log(`\nSpot-check a few "matchedName" values above against the real venue names before trusting this data —`);
  console.log(`text search can occasionally match the wrong nearby place.`);
}

run();
