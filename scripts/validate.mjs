#!/usr/bin/env node
// Data-integrity gate for the served JSON. Encodes the invariants that used to
// live only as prose in PADDLE_DATA_SETUP.md and the scripts' header comments,
// so a bad edit fails loudly (exit 1) instead of shipping. Wired as the
// Firebase `predeploy` hook and runnable directly: `npm run validate`.
//
// Checks:
//   1. courts-data.json <-> venues.json are in lockstep (same id set, count).
//   2. Ids are unique; core fields present; enums valid.
//   3. venues.indoor is the lowercase form of courts.indoorOutdoor.
//   4. lat/lon are both-null or both-number (no half-geocoded venue).
//   5. paddles.json: unique ids, and the two proprietary percentiles are only
//      ever the coarsened tiers (guards the data-licensing fix from regressing).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const warnings = [];
const fail = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

const YEAR_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const STALE_MONTHS = 12; // flag venues not re-verified in over a year

function load(rel) {
  try {
    return JSON.parse(readFileSync(join(ROOT, rel), "utf8"));
  } catch (e) {
    fail(`${rel}: could not read/parse — ${e.message}`);
    return null;
  }
}

const courts = load("assets/courts-data.json");
const venues = load("assets/venues.json");
const paddles = load("assets/paddles.json");

const INDOOR_OUTDOOR = new Set(["Indoor", "Outdoor", "Both"]);
const VENUE_INDOOR = new Set(["indoor", "outdoor", "both"]);
// Legal outputs of coarsen_percentile() in scripts/rebuild_paddle_data.py: the
// midpoint of each of 20 equal bands (0.025, 0.075 … 0.975). This is the guard
// that stops a RAW PickleballEffect percentile reaching the public file by
// accident — see PADDLE_DATA_SETUP.md "Data licensing". Widened from 4 quartile
// tiers to 20 bands on 2026-07-18 for chart granularity; the firewall is
// unchanged in kind, since what ships is still a band midpoint and never the
// measurement. `undefined` is legal because the rebuild omits absent fields.
const PERCENTILE_BANDS = 20;
const PADDLE_TIERS = new Set([
  null,
  undefined,
  ...Array.from({ length: PERCENTILE_BANDS }, (_, i) => Number(((i + 0.5) / PERCENTILE_BANDS).toFixed(4))),
]);

// ---- courts-data.json ----
const courtsById = new Map();
if (Array.isArray(courts)) {
  courts.forEach((c, i) => {
    const where = c && c.id ? c.id : `index ${i}`;
    if (!c || typeof c.id !== "string" || !c.id) return fail(`courts[${i}]: missing string id`);
    if (courtsById.has(c.id)) fail(`courts: duplicate id "${c.id}"`);
    courtsById.set(c.id, c);
    if (!c.name) fail(`courts ${where}: missing name`);
    if (!c.city) fail(`courts ${where}: missing city`);
    if (typeof c.confirmed !== "boolean") fail(`courts ${where}: confirmed must be boolean`);
    if (!INDOOR_OUTDOOR.has(c.indoorOutdoor))
      fail(`courts ${where}: indoorOutdoor "${c.indoorOutdoor}" not in {Indoor,Outdoor,Both}`);
    if (!YEAR_MONTH.test(c.lastVerified || ""))
      fail(`courts ${where}: lastVerified "${c.lastVerified}" must be "YYYY-MM"`);
  });

  // Staleness is a warning, not a failure — surfaces which venues are overdue
  // for a re-check without ever blocking a deploy.
  const now = new Date();
  const stale = [];
  courts.forEach((c) => {
    if (!YEAR_MONTH.test(c.lastVerified || "")) return;
    const [y, m] = c.lastVerified.split("-").map(Number);
    const monthsAgo = (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m);
    if (monthsAgo > STALE_MONTHS) stale.push(`${c.id} (${c.lastVerified})`);
  });
  if (stale.length)
    warn(`${stale.length} venue(s) not verified in over ${STALE_MONTHS} months: ${stale.slice(0, 8).join(", ")}${stale.length > 8 ? ", …" : ""}`);
} else {
  fail("courts-data.json is not an array");
}

// ---- venues.json ----
const venuesById = new Map();
if (Array.isArray(venues)) {
  venues.forEach((v, i) => {
    const where = v && v.id ? v.id : `index ${i}`;
    if (!v || typeof v.id !== "string" || !v.id) return fail(`venues[${i}]: missing string id`);
    if (venuesById.has(v.id)) fail(`venues: duplicate id "${v.id}"`);
    venuesById.set(v.id, v);
    if (v.indoor != null && !VENUE_INDOOR.has(v.indoor))
      fail(`venues ${where}: indoor "${v.indoor}" not in {indoor,outdoor,both}`);
    const latNum = typeof v.lat === "number";
    const lonNum = typeof v.lon === "number";
    if (latNum !== lonNum) fail(`venues ${where}: lat/lon must both be set or both null`);
  });
} else {
  fail("venues.json is not an array");
}

// ---- lockstep: same id set, and indoor matches indoorOutdoor ----
if (courtsById.size && venuesById.size) {
  for (const id of courtsById.keys())
    if (!venuesById.has(id)) fail(`lockstep: "${id}" is in courts-data.json but not venues.json`);
  for (const id of venuesById.keys())
    if (!courtsById.has(id)) fail(`lockstep: "${id}" is in venues.json but not courts-data.json`);
  for (const [id, v] of venuesById) {
    const c = courtsById.get(id);
    if (c && v.indoor != null && c.indoorOutdoor && v.indoor !== String(c.indoorOutdoor).toLowerCase())
      fail(`lockstep: "${id}" indoor "${v.indoor}" != courts indoorOutdoor "${c.indoorOutdoor}"`);
  }
}

// ---- map-data.json: the map's pre-joined feed, must stay in lockstep ----
// Built by scripts/generate-venues.mjs from courts-data.json + venues.json.
// These checks catch the failure mode where courts-data or a geocode was
// edited but `npm run generate-venues` wasn't re-run, leaving the map stale.
const mapData = load("assets/map-data.json");
if (Array.isArray(mapData)) {
  const mapById = new Map();
  mapData.forEach((r, i) => {
    const where = r && r.id ? r.id : `index ${i}`;
    if (!r || typeof r.id !== "string" || !r.id) return fail(`map-data[${i}]: missing string id`);
    if (mapById.has(r.id)) fail(`map-data: duplicate id "${r.id}"`);
    mapById.set(r.id, r);
    const latNum = typeof r.lat === "number";
    const lonNum = typeof r.lon === "number";
    if (latNum !== lonNum) fail(`map-data ${where}: lat/lon must both be set or both absent`);
  });
  const REGEN = "run: npm run generate-venues";
  for (const id of courtsById.keys())
    if (!mapById.has(id)) fail(`map-data drift: "${id}" is in courts-data.json but not map-data.json (${REGEN})`);
  for (const id of mapById.keys())
    if (!courtsById.has(id)) fail(`map-data drift: "${id}" is in map-data.json but not courts-data.json (${REGEN})`);
  // Key facts must match their sources so the feed can't go stale silently.
  for (const [id, r] of mapById) {
    const c = courtsById.get(id);
    const v = venuesById.get(id);
    if (c) {
      if (r.name !== c.name) fail(`map-data drift: "${id}" name mismatch (${REGEN})`);
      if (r.indoorOutdoor !== c.indoorOutdoor) fail(`map-data drift: "${id}" indoorOutdoor mismatch (${REGEN})`);
      if (r.googleMapsUrl !== c.googleMapsUrl) fail(`map-data drift: "${id}" googleMapsUrl mismatch (${REGEN})`);
    }
    if (v) {
      const vLat = typeof v.lat === "number" ? v.lat : undefined;
      const rLat = typeof r.lat === "number" ? r.lat : undefined;
      if (vLat !== rLat) fail(`map-data drift: "${id}" lat mismatch (${REGEN})`);
    }
  }
} else {
  fail("map-data.json is not an array");
}

// ---- paddles.json ----
if (Array.isArray(paddles)) {
  const seen = new Set();
  paddles.forEach((p, i) => {
    const where = p && p.id ? p.id : `index ${i}`;
    if (!p || typeof p.id !== "string" || !p.id) return fail(`paddles[${i}]: missing string id`);
    if (seen.has(p.id)) fail(`paddles: duplicate id "${p.id}"`);
    seen.add(p.id);
    // Every percentile-shaped field, not just the two the 13-column export
    // carried: spin and swing weight are banded from the same proprietary
    // source and need the same guard, or the firewall only covers half the file.
    for (const field of ["twistWeightPercentile", "powerPercentile", "spinPercentile", "swingWeightPercentile"]) {
      if (!PADDLE_TIERS.has(p[field]))
        fail(`paddles ${where}: ${field} ${p[field]} is not a legal band midpoint (see PADDLE_DATA_SETUP.md licensing)`);
    }
  });
} else {
  fail("paddles.json is not an array");
}

if (warnings.length) {
  console.warn(`⚠ validate: ${warnings.length} warning(s)`);
  warnings.forEach((w) => console.warn("  - " + w));
}
if (errors.length) {
  console.error(`✖ validate: ${errors.length} problem(s)\n`);
  errors.forEach((e) => console.error("  - " + e));
  process.exit(1);
}
console.log(
  `✔ validate: ${courtsById.size} courts ↔ ${venuesById.size} venues in lockstep, ` +
    `${Array.isArray(paddles) ? paddles.length : 0} paddles, all invariants hold.`
);
