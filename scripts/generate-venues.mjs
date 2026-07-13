// Regenerates the shared identity fields in assets/venues.json (name, city,
// address, url, confirmed, and a translated indoor/outdoor status) from
// assets/courts-data.json, which is the hand-edited source of truth for a
// venue's identity. courts-data.json and venues.json used to be maintained
// by hand in parallel with no link between them -- same 83 venues, same
// fields, edited twice. This script closes that gap for everything except
// lat/lon/approx, which come from manual geocoding this script can't do and
// are always carried over from the existing venues.json untouched.
//
// Run this after adding or editing a venue in courts-data.json, before
// committing, so venues.json can't quietly drift out of sync again.
//
// Usage:
//   node scripts/generate-venues.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const courtsPath = path.join(__dirname, "../assets/courts-data.json");
const venuesPath = path.join(__dirname, "../assets/venues.json");

const courts = JSON.parse(readFileSync(courtsPath, "utf8"));
const existingVenues = JSON.parse(readFileSync(venuesPath, "utf8"));
const existingById = new Map(existingVenues.map((v) => [v.id, v]));
const courtsById = new Map(courts.map((c) => [c.id, c]));

// courts-data.json's `indoorOutdoor` and venues.json's `indoor` describe the
// same fact in two different vocabularies (Title Case + "Not specified" vs.
// lowercase + "unknown") -- translate between them instead of maintaining
// both by hand, which is exactly how they drifted apart before this script.
const INDOOR_MAP = {
  Indoor: "indoor",
  Outdoor: "outdoor",
  Both: "both",
  "Not specified": "unknown",
};

let warnings = 0;
let missingGeocode = false;

// Preserve venues.json's existing record order (it groups by city, not the
// alphabetical-by-id order courts-data.json happens to use) so regenerating
// only touches the fields that actually changed -- anything else would make
// every future diff unreviewable. New courts with no prior venues.json
// entry are appended at the end once geocoded.
const orderedIds = [
  ...existingVenues.map((v) => v.id),
  ...courts.map((c) => c.id).filter((id) => !existingById.has(id)),
];

const venues = orderedIds.map((id) => {
  const court = courtsById.get(id);
  const existing = existingById.get(id);
  if (!court) {
    console.warn(`[generate-venues] "${id}" is in venues.json but no longer in courts-data.json -- dropping it.`);
    warnings++;
    return null;
  }
  if (!existing) {
    console.warn(`[generate-venues] "${id}" has no existing venues.json entry -- needs manual geocoding (lat/lon) before it can be added. Skipping for now.`);
    warnings++;
    missingGeocode = true;
    return null;
  }

  const derivedIndoor = INDOOR_MAP[court.indoorOutdoor] ?? "unknown";

  // Never let an unspecified courts-data.json status downgrade a more
  // specific value someone already entered directly in venues.json -- keep
  // the known fact, but flag the gap so courts-data.json gets filled in too.
  let indoor = derivedIndoor;
  if (derivedIndoor === "unknown" && existing.indoor && existing.indoor !== "unknown") {
    indoor = existing.indoor;
    console.warn(`[generate-venues] "${court.id}": indoorOutdoor is "Not specified" in courts-data.json but venues.json already has "${existing.indoor}" -- kept "${existing.indoor}". Consider filling in courts-data.json's indoorOutdoor to match.`);
    warnings++;
  } else if (existing.indoor && derivedIndoor !== existing.indoor) {
    console.warn(`[generate-venues] "${court.id}": indoorOutdoor ("${court.indoorOutdoor}") and venues.json's prior indoor ("${existing.indoor}") disagreed -- now set to "${derivedIndoor}" from courts-data.json.`);
    warnings++;
  }

  const venue = {
    name: court.name,
    city: court.city,
    address: court.address,
    lat: existing.lat,
    lon: existing.lon,
    url: court.url,
  };
  if (existing.approx !== undefined) venue.approx = existing.approx;
  venue.indoor = indoor;
  venue.id = court.id;
  venue.confirmed = court.confirmed;
  return venue;
});

if (missingGeocode) {
  console.error(`[generate-venues] Aborting write: fix the missing-geocode warning(s) above, then re-run.`);
  process.exit(1);
}

// Both source files escape every non-ASCII character as a \u escape (zero
// literal non-ASCII bytes in either file) -- match that convention so this
// script's output doesn't introduce a spurious encoding diff on every
// record with an em dash, curly quote, etc.
function toAsciiJson(value) {
  const chars = Array.from(JSON.stringify(value, null, 2));
  let out = "";
  for (const ch of chars) {
    const code = ch.codePointAt(0);
    out += code > 127 ? "\\u" + code.toString(16).padStart(4, "0") : ch;
  }
  return out;
}

const output = venues.filter(Boolean);
writeFileSync(venuesPath, toAsciiJson(output) + "\n");
console.log(`[generate-venues] Wrote ${output.length} venues to assets/venues.json${warnings ? ` (${warnings} warning(s) above)` : " (no drift found)"}.`);

// ---- map-data.json: the map's single pre-joined feed ---------------------
// The /map page used to fetch BOTH courts-data.json and venues.json and join
// ~200 records by id in the browser on every load. Pre-join here instead:
// one file, one request, no client-side join. It carries only the fields
// assets/map.js actually reads (courts-data's facts + each venue's geocode),
// so name/city/address/url aren't duplicated across two files anymore.
const mapDataPath = path.join(__dirname, "../assets/map-data.json");
const venueById = new Map(output.map((v) => [v.id, v]));
const mapData = courts.map((c) => {
  const v = venueById.get(c.id) || {};
  const rec = {
    id: c.id,
    name: c.name,
    city: c.city,
    neighborhood: c.neighborhood,
    address: c.address,
    url: c.url,
    indoor: v.indoor, // lowercase pin vocabulary, from venues
    indoorOutdoor: c.indoorOutdoor, // Title Case, from courts-data
    price: c.price,
    hours: c.hours,
    courts: c.courts,
    waitTime: c.waitTime,
    surface: c.surface,
    skill: c.skill,
    reservable: c.reservable,
    weather: c.weather,
    bookingUrl: c.bookingUrl,
    googleMapsUrl: c.googleMapsUrl,
    lastVerified: c.lastVerified,
  };
  // Optional geocode: omitted (not null) when a venue isn't plottable, so
  // map.js's `typeof lat === "number"` plottable test still works.
  if (typeof v.lat === "number") rec.lat = v.lat;
  if (typeof v.lon === "number") rec.lon = v.lon;
  if (v.approx !== undefined) rec.approx = v.approx;
  return rec;
});
writeFileSync(mapDataPath, toAsciiJson(mapData) + "\n");
const plottableCount = mapData.filter((r) => typeof r.lat === "number").length;
console.log(`[generate-venues] Wrote ${mapData.length} records to assets/map-data.json (${plottableCount} plottable).`);
