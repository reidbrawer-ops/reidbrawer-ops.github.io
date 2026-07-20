// Shared paddle model — the one place that turns a row of assets/paddles.json
// into something a page can render.
//
// THIS FILE HAS NO IMPORTS, ON PURPOSE. It is loaded three ways:
//   1. the browser, as a hashed ES module (/assets/m/paddle-model.<hash>.js);
//   2. the browser again, from assets/paddle-finder.js and paddle-compare.js;
//   3. **Node**, by scripts/generate-paddle-pages.mjs, via a file:// URL.
// Node cannot resolve the site's "/assets/x.js" import specifiers (those only
// work under the page's importmap), so the moment this file imports a sibling
// the page generator breaks. Anything it needs from paddle-ratings.js is passed
// IN as an argument instead (see sortRows' `tiebreak` option).
//
// The licensing rule from PADDLE_DATA_SETUP.md governs everything below:
// PickleballEffect's lab numbers are used to RANK and CATEGORIZE, and are never
// displayed — "not even as a chip or in a tooltip". The percentiles in the JSON
// are already banded to 20 band midpoints so the file exposes a bucket rather
// than their measurement; printing "91st percentile" would hand back exactly the
// precision the banding exists to withhold. So: bars may be positioned by a
// percentile, and words may describe it, but no page ever prints the number.

/* ------------------------------------------------------------------ escaping */

// A local escaper rather than window.PBUtils.escapeHtml — `window` does not
// exist in the page generator, and the generator is the caller that writes the
// most untrusted-looking strings (brand names with "&" in them) to disk.
export const esc = (s) =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/* -------------------------------------------------------------- tier language */

// The four words the rest of the site already uses (paddle-grid.js, paddle-quiz.js).
// Range test, not midpoint lookup: the data widened from 4 tiers to 20 bands on
// 2026-07-18 and an exact-match table matched nothing.
export function tierWord(v) {
  if (typeof v !== "number") return null;
  if (v < 0.25) return "Low";
  if (v < 0.5) return "Medium";
  if (v < 0.75) return "High";
  return "Very high";
}

// Where a paddle sits relative to the rest of the catalog, in words. This is the
// replacement for the prototype's `ord(pct)` → "91st percentile", which is the
// one string in the whole design that cannot ship: it re-publishes a licensed
// measurement at two-digit precision. Five buckets, deliberately coarser than
// the 20 bands underneath, so the phrase never implies more resolution than the
// data carries.
export function bandPhrase(v) {
  if (typeof v !== "number") return null;
  if (v >= 0.8) return "Top fifth of the catalog";
  if (v >= 0.6) return "Upper range";
  if (v >= 0.4) return "Middle of the catalog";
  if (v >= 0.2) return "Lower range";
  return "Bottom fifth";
}

// spinRating ships as "Very High" while tierWord() returns "Very high", and the
// detail page prints both within about 200px of each other. One casing, chosen
// to match the site's existing sentence-case convention.
export const sentenceCase = (s) =>
  typeof s === "string" && s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;

// "Unapproved" is a VALUE of approvalBody, not the name of a body, so the
// obvious `${approvalBody} approved` renders "Unapproved approved" — the exact
// opposite of the truth, on 5 paddles that all carry tagged affiliate links.
export function approvalNote(p) {
  if (!p.approvalBody) return null;
  if (p.approvalBody === "Unapproved") return "Not tournament approved";
  return `${p.approvalBody} approved`;
}

export const moneyLabel = (v) => (typeof v === "number" ? `$${Math.round(v)}` : "Price n/a");

// True when we have at least one measured performance axis for this paddle.
// 126 of 486 have neither, and every view has to degrade rather than draw an
// empty chart: cards say "specs only", the detail page swaps the bars for a
// dashed note, and metric sorts push them to the tail.
export const hasLab = (p) => p.spinPercentile != null || p.powerPercentile != null;

/* ------------------------------------------------------------------- scoring */

// The neutral "how good is this paddle" score, used for the Best-overall sort
// when no filter gives fitScore() a basis, and as the baseline for the Top/Value
// picks on a detail page.
//
// Twist weight is on all 486 rows, so requiring >= 2 parts is what makes this
// null for the 126 specs-only paddles rather than silently ranking them on
// forgiveness alone. 360 paddles score; the rest sort last.
export function qualityScore(p) {
  const parts = [];
  if (p.spinPercentile != null) parts.push(p.spinPercentile);
  if (p.powerPercentile != null) parts.push(p.powerPercentile);
  if (p.twistWeightPercentile != null) parts.push(p.twistWeightPercentile);
  return parts.length >= 2 ? parts.reduce((a, b) => a + b, 0) / parts.length : null;
}

/* ------------------------------------------------------------------- buckets */

// Bucket edges are range tests, never string concatenation on the raw value.
// The catalog holds 11 distinct core thicknesses (10, 11, 12, 13, 14, 15, 16,
// 17, 18, 19, 20) and a label built as `${mm}mm` would offer checkboxes for
// five of them that match one paddle each — while a future 14.5mm row would
// land in a bucket that no checkbox can reach, making it unfilterable.
export const CORE_BUCKETS = [
  { label: "13mm and under", note: "thin & poppy", test: (mm) => mm <= 13 },
  { label: "14mm", test: (mm) => mm > 13 && mm <= 14 },
  { label: "15mm", test: (mm) => mm > 14 && mm <= 15 },
  { label: "16mm", test: (mm) => mm > 15 && mm <= 16 },
  { label: "17mm and up", note: "extra plush", test: (mm) => mm > 16 },
];

export const PRICE_BUCKETS = [
  { label: "Under $100", test: (v) => v < 100 },
  { label: "$100–150", test: (v) => v >= 100 && v < 150 },
  { label: "$150–220", test: (v) => v >= 150 && v < 220 },
  { label: "$220 and up", test: (v) => v >= 220 },
];

export const GRIP_BUCKETS = [
  { label: 'Under 4.2"', note: "smaller hands", test: (v) => v < 4.2 },
  { label: '4.2" and up', note: "larger hands", test: (v) => v >= 4.2 },
];

// Every bucket a paddle can land in must also be an offered checkbox, or those
// rows become unreachable behind a filter with no matching control. That is why
// the null cases get real labels ("Unrated", "Unlisted", "Not listed") instead
// of being dropped: 9 paddles have no paddleType, 36 no impactFeel, 1 no price.
const bucketOf = (buckets, v, nullLabel) => {
  if (typeof v !== "number") return nullLabel;
  const hit = buckets.find((b) => b.test(v));
  return hit ? hit.label : nullLabel;
};

export const priceBucket = (p) => bucketOf(PRICE_BUCKETS, p.price, "Not listed");
export const coreBucket = (p) => bucketOf(CORE_BUCKETS, p.coreThicknessMm, "Not listed");
export const gripBucket = (p) => bucketOf(GRIP_BUCKETS, p.gripSizeIn, "Not listed");

/* -------------------------------------------------------------------- facets */

// Every facet is multi-select: OR within a facet, AND across facets. `value`
// maps a row to the option label it belongs to (or an array, for facets where a
// row can sit in two pools at once — approval is the only one, because
// "USAP/UPA-A" is a dual certification and a shopper filtering for "USAP"
// expects those 66 paddles back).
export const FACETS = [
  {
    key: "price",
    label: "Price",
    options: PRICE_BUCKETS.map((b) => b.label).concat("Not listed"),
    value: priceBucket,
  },
  {
    key: "type",
    label: "Play style",
    options: ["Power", "All-Court", "Control", "Unrated"],
    value: (p) => p.paddleType || "Unrated",
  },
  {
    key: "skill",
    label: "Best for",
    options: ["Beginner", "Intermediate", "Advanced"],
    value: (p) => p.skillLevel,
  },
  {
    key: "shape",
    label: "Shape",
    options: ["Elongated", "Hybrid", "Widebody", "Extra-elongated"],
    value: (p) => p.shape,
  },
  {
    key: "core",
    label: "Core thickness",
    options: CORE_BUCKETS.map((b) => b.label).concat("Not listed"),
    value: coreBucket,
  },
  {
    key: "feel",
    label: "Impact feel",
    options: ["Soft/Dense", "Soft/Hollow", "Neutral", "Stiff/Dense", "Stiff/Hollow", "Unlisted"],
    value: (p) => p.impactFeel || "Unlisted",
  },
  {
    key: "spin",
    label: "Spin rating",
    options: ["Very High", "High", "Medium", "Low", "Not measured"],
    value: (p) => p.spinRating || "Not measured",
  },
  {
    key: "approval",
    label: "Tournament approval",
    options: ["USAP", "UPA-A", "Unapproved"],
    // Dual-certified paddles belong to both pools, so this returns an array.
    value: (p) => {
      const a = p.approvalBody;
      if (!a) return [];
      if (a === "USAP/UPA-A") return ["USAP", "UPA-A"];
      return [a];
    },
  },
  {
    key: "grip",
    label: "Grip circumference",
    options: GRIP_BUCKETS.map((b) => b.label).concat("Not listed"),
    value: gripBucket,
  },
  {
    key: "brand",
    label: "Brand",
    options: null, // derived from the data — 56 brands, see brandOptions()
    value: (p) => p.brand,
  },
];

export const emptyFilters = () => Object.fromEntries(FACETS.map((f) => [f.key, []]));

// Brand is the one facet whose options come from the data rather than a fixed
// list, so a new brand in a data refresh appears without a code change.
export const brandOptions = (rows) =>
  Array.from(new Set(rows.map((p) => p.brand).filter(Boolean))).sort((a, b) => a.localeCompare(b));

const facetHit = (facet, p, chosen) => {
  if (!chosen.length) return true;
  const v = facet.value(p);
  if (Array.isArray(v)) return v.some((x) => chosen.includes(x));
  return chosen.includes(v);
};

export const matchesQuery = (p, q) =>
  !q || `${p.brand} ${p.name}`.toLowerCase().includes(q);

// `skip` excludes one facet from the test — that is what makes the live counts
// work. A facet's own counts must be computed against everything EXCEPT itself,
// or checking "Power" instantly shows "All-Court 0" and the facet can never be
// widened again without a reset.
export function applyFacets(rows, filters, q, skip) {
  return rows.filter((p) => {
    if (!matchesQuery(p, q)) return false;
    return FACETS.every((f) => (f.key === skip ? true : facetHit(f, p, filters[f.key] || [])));
  });
}

export function facetCounts(rows, filters, q, facet) {
  const pool = applyFacets(rows, filters, q, facet.key);
  const counts = new Map();
  for (const p of pool) {
    const v = facet.value(p);
    for (const one of Array.isArray(v) ? v : [v]) {
      if (one == null) continue;
      counts.set(one, (counts.get(one) || 0) + 1);
    }
  }
  return counts;
}

/* --------------------------------------------------------------------- sorts */

export const SORTS = [
  { key: "best", label: "Best overall" },
  { key: "price-asc", label: "Price — low to high" },
  { key: "price-desc", label: "Price — high to low" },
  { key: "spin", label: "Most spin" },
  { key: "power", label: "Most power" },
  { key: "control", label: "Most control" },
  { key: "stability", label: "Most forgiving" },
  { key: "newest", label: "Newest first" },
  { key: "name", label: "Name A–Z" },
];

const SPIN_WORD_RANK = { "Very High": 3, High: 2, Medium: 1, Low: 0 };

// Sorts the rows in place-safe fashion (always on a copy).
//
// `opts.score` lets the caller substitute production's fitScore() when a type or
// skill filter gives it a basis; `opts.tiebreak` injects tiebreakByTrait from
// paddle-ratings.js, which this file cannot import (see the header). The epsilon
// matters far more here than in the prototype: banded percentiles mean exact
// ties are the norm rather than an edge case, so without a tiebreak the order
// inside a band is whatever the JSON happened to be written in.
export function sortRows(rows, key, opts = {}) {
  const tiebreak = opts.tiebreak || ((a, b) => `${a.brand} ${a.name}`.localeCompare(`${b.brand} ${b.name}`));
  const score = opts.score || qualityScore;

  const by = (fn, dir) => (a, b) => {
    const av = fn(a);
    const bv = fn(b);
    // Nulls sort last in BOTH directions — a paddle with no measured spin is not
    // "the least spinny paddle", it is a paddle we have not measured, and
    // burying it at the top of a price-descending list would be a lie by layout.
    if (av == null && bv == null) return tiebreak(a, b);
    if (av == null) return 1;
    if (bv == null) return -1;
    return (Math.abs(av - bv) > 1e-9 ? dir * (bv - av) : 0) || tiebreak(a, b);
  };

  const out = rows.slice();
  switch (key) {
    case "price-asc":
      return out.sort(by((p) => p.price, -1));
    case "price-desc":
      return out.sort(by((p) => p.price, 1));
    case "spin":
      return out.sort((a, b) => {
        const av = a.spinPercentile;
        const bv = b.spinPercentile;
        if (av == null && bv == null) return tiebreak(a, b);
        if (av == null) return 1;
        if (bv == null) return -1;
        if (Math.abs(av - bv) > 1e-9) return bv - av;
        // Inside a band, the word rating is the only extra signal we have.
        const aw = SPIN_WORD_RANK[a.spinRating] ?? -1;
        const bw = SPIN_WORD_RANK[b.spinRating] ?? -1;
        return bw - aw || tiebreak(a, b);
      });
    case "power":
      return out.sort(by((p) => p.powerPercentile, 1));
    case "control":
      // controlRating returns a number for every paddle (it leans on swing
      // weight, present on all 486), so — unlike spin/power — this sort has no
      // null tail. Falls back to qualityScore only if the caller forgot to
      // inject the scorer, which no live caller does.
      return out.sort(by(typeof opts.control === "function" ? opts.control : qualityScore, 1));
    case "stability":
      return out.sort(by((p) => p.twistWeightPercentile, 1));
    case "newest":
      return out.sort((a, b) => {
        const d = (b.yearReleased || 0) - (a.yearReleased || 0);
        if (d) return d;
        // Only six distinct years, so the tiebreak carries almost all of the
        // ordering — score first so "newest" still surfaces good paddles.
        const as = score(a);
        const bs = score(b);
        if (as == null && bs == null) return tiebreak(a, b);
        if (as == null) return 1;
        if (bs == null) return -1;
        return bs - as || tiebreak(a, b);
      });
    case "name":
      return out.sort((a, b) => `${a.brand} ${a.name}`.localeCompare(`${b.brand} ${b.name}`));
    case "best":
    default:
      return out.sort(by(score, 1));
  }
}

/* --------------------------------------------------------------- collections */

// The catalog's shortcut chips. `filters` is a partial — everything unnamed
// resets, because a collection is a fresh starting point rather than an
// additional constraint stacked on whatever was already checked.
//
// "Beginner friendly" is the one that changed most from the prototype, which
// approximated it with core + feel + price. Production carries a real
// skillLevel on all 486 rows, derived at pipeline time from twist weight, core
// and type against the PRE-banded percentile — strictly better information than
// anything reconstructible in the browser.
export const COLLECTIONS = [
  { key: "best", label: "Best overall", filters: {}, sort: "best" },
  { key: "value", label: "Under $100", filters: { price: ["Under $100"] }, sort: "best" },
  { key: "spin", label: "Spin machines", filters: { spin: ["Very High"] }, sort: "spin" },
  { key: "control", label: "Control & touch", filters: { type: ["Control"] }, sort: "best" },
  { key: "power", label: "Big power", filters: { type: ["Power"] }, sort: "power" },
  { key: "beginner", label: "Beginner friendly", filters: { skill: ["Beginner"] }, sort: "best" },
];

/* ---------------------------------------------------- recommendations & kin */

// Deltas are measured in BAND STEPS. One band is 0.05 wide, so a difference of
// 0.05 is the smallest difference the data can express at all — reporting it as
// "more power" would be reporting quantization noise. Two steps (0.10) is the
// floor for saying anything.
const BAND = 0.05;
const DELTA_MIN = 2 * BAND;

function reasonBits(p, d) {
  const bits = [];
  const delta = (a, b) => (a == null || b == null ? null : a - b);

  const dPw = delta(p.powerPercentile, d.powerPercentile);
  if (dPw != null && Math.abs(dPw) >= DELTA_MIN) bits.push(`${dPw > 0 ? "more" : "less"} power`);

  const dSp = delta(p.spinPercentile, d.spinPercentile);
  if (dSp != null && Math.abs(dSp) >= DELTA_MIN) {
    bits.push(`${dSp > 0 ? "more" : "less"} spin`);
  } else if (p.spinRating && d.spinRating && p.spinRating !== d.spinRating) {
    // Fallback for the 138 paddles with a spin word but no banded percentile.
    bits.push(`${p.spinRating.toLowerCase()} spin`);
  }

  const dTw = delta(p.twistWeightPercentile, d.twistWeightPercentile);
  if (dTw != null && Math.abs(dTw) >= DELTA_MIN) bits.push(`${dTw > 0 ? "more" : "less"} forgiving`);

  const dSw = delta(p.swingWeightPercentile, d.swingWeightPercentile);
  if (dSw != null && Math.abs(dSw) >= 3 * BAND) bits.push(dSw > 0 ? "slower through the air" : "quicker through the air");

  if (p.skillLevel && d.skillLevel && p.skillLevel !== d.skillLevel) {
    bits.push(`aimed at ${p.skillLevel.toLowerCase()}s`);
  }

  // Capped at three: this can emit five, and a five-clause sentence stops
  // reading as a recommendation and starts reading as a diff.
  return bits.slice(0, 3);
}

function reasonSentence(p, d, kind) {
  const bits = reasonBits(p, d);
  const same = bits.length ? bits.join(" · ") : "a near-identical spec profile";
  const core = p.coreThicknessMm != null ? `${p.coreThicknessMm}mm core` : "a comparable core";
  const shapeClause =
    p.shape === d.shape
      ? `Same ${String(p.shape || "").toLowerCase()} shape`
      : `${(p.shape || "Similar")} shape`;
  if (kind === "top") return `The step up in this play style: ${same}. ${shapeClause}, ${core}.`;
  return `Keeps the ${String(d.paddleType || "same").toLowerCase()} character for less: ${same}. ${shapeClause}, ${core}.`;
}

// Top Pick / Value Pick — same play style, one steps up the performance, one
// protects the wallet. Either may be absent; both may be absent for a paddle
// that is already the best-scoring one in a thin play-style pool.
export function pickRecos(d, rows) {
  const S = (p) => qualityScore(p);
  const base = S(d) ?? 0.5;

  const pool = rows.filter(
    (p) => p.id !== d.id && (p.paddleType || "") === (d.paddleType || "") && p.price != null
  );
  const scored = pool.filter((p) => S(p) != null);
  if (!scored.length) return [];

  // One full band step above, not the prototype's 0.02: on a mean of two or
  // three banded values no two paddles can differ by less than ~0.017, so a
  // 0.02 threshold admits pure quantization noise as "a step up".
  const top =
    scored
      .filter((p) => S(p) > base + BAND)
      .sort((a, b) => S(b) - S(a) || a.price - b.price)[0] ||
    scored.slice().sort((a, b) => S(b) - S(a) || a.price - b.price)[0];

  let value = null;
  if (d.price != null) {
    const cheaper = scored.filter((p) => p !== top && p.price <= d.price - 25);
    value =
      // Two band steps of tolerance — give up a little measured performance for
      // a real saving, but not a whole tier of it.
      cheaper
        .filter((p) => S(p) >= base - 2 * BAND)
        .sort((a, b) => S(b) - b.price / 1000 - (S(a) - a.price / 1000))[0] ||
      cheaper.sort((a, b) => S(b) - S(a))[0] ||
      null;
    // The prototype's third fallback was "cheapest in pool", which can return a
    // paddle that costs MORE than the one you are looking at — a "Value pick"
    // that is a price increase. Dropped rather than fixed: no card is better
    // than a wrong one.
  }

  const out = [];
  if (top) out.push(mkReco(top, d, "top"));
  if (value && value !== top) out.push(mkReco(value, d, "value"));
  return out;
}

function mkReco(p, d, kind) {
  const delta = d.price != null && p.price != null ? Math.round(p.price - d.price) : null;
  return {
    paddle: p,
    kind,
    badge: kind === "top" ? "Top pick" : "Value pick",
    reason: reasonSentence(p, d, kind),
    priceDelta: delta,
    deltaLabel: delta == null || delta === 0 ? null : delta < 0 ? `−$${Math.abs(delta)} vs this` : `+$${delta} vs this`,
    deltaDir: delta == null || delta === 0 ? "same" : delta < 0 ? "down" : "up",
  };
}

// Nearest neighbours across the whole catalog. A missing percentile costs
// nothing rather than counting as maximum distance — otherwise the 126
// specs-only paddles would only ever be similar to each other, and would never
// appear beneath a paddle that happens to have been measured.
export function similarPaddles(d, rows, n = 6) {
  const dist = (p) => {
    let s = 0;
    s += (p.paddleType || "") === (d.paddleType || "") ? 0 : 2.2;
    s += p.shape === d.shape ? 0 : 1.1;
    s += p.skillLevel === d.skillLevel ? 0 : 0.6;
    s += Math.abs((p.coreThicknessMm ?? 15) - (d.coreThicknessMm ?? 15)) * 0.32;
    // Damped relative to a raw swing weight (which the prototype divided by 9):
    // a banded percentile is a coarser claim than a measurement, so it should
    // not dominate the distance the way the raw number did.
    if (p.swingWeightPercentile != null && d.swingWeightPercentile != null)
      s += Math.abs(p.swingWeightPercentile - d.swingWeightPercentile) * 2.4;
    if (p.twistWeightPercentile != null && d.twistWeightPercentile != null)
      s += Math.abs(p.twistWeightPercentile - d.twistWeightPercentile) * 1.8;
    if (p.spinPercentile != null && d.spinPercentile != null)
      s += Math.abs(p.spinPercentile - d.spinPercentile) * 1.6;
    if (p.powerPercentile != null && d.powerPercentile != null)
      s += Math.abs(p.powerPercentile - d.powerPercentile) * 1.6;
    if (p.price != null && d.price != null) s += Math.abs(p.price - d.price) / 130;
    return s;
  };
  return rows
    .filter((p) => p.id !== d.id)
    .map((p) => ({ p, k: dist(p) }))
    .sort((a, b) => a.k - b.k)
    .slice(0, n)
    .map((x) => x.p);
}

/* ------------------------------------------------------------------- copy */

// The one-line description under the H1. Every clause is dropped rather than
// filled with a placeholder when its field is missing, so a sparse paddle gets a
// short true sentence instead of a long one with holes in it.
export function blurbFor(p) {
  const bits = [];
  bits.push(
    [p.yearReleased, String(p.shape || "").toLowerCase() || null, String(p.paddleType || "").toLowerCase() || null, "paddle"]
      .filter(Boolean)
      .join(" ")
  );
  const lead = `${bits[0]} from ${p.brand}`;
  const tail = [];
  if (p.coreThicknessMm != null) tail.push(`a ${p.coreThicknessMm}mm core`);
  // "Stiff/Hollow" -> "a stiff, hollow feel". The slash is a data encoding, not
  // punctuation anyone reads aloud.
  if (p.impactFeel) tail.push(`a ${String(p.impactFeel).toLowerCase().replace("/", ", ")} feel`);
  if (p.spinRating) tail.push(`${p.spinRating.toLowerCase()} spin`);
  if (!tail.length) return `${lead}.`;
  const joined = tail.length === 1 ? tail[0] : `${tail.slice(0, -1).join(", ")} and ${tail[tail.length - 1]}`;
  return `${lead}, with ${joined}.`;
}

// The full specification table. Twelve rows, not the prototype's fifteen: build
// generation, surface and spin durability are licensed fields that were never
// imported into paddles.json, and inventing them is not an option.
export function specRows(p) {
  return [
    ["Brand", p.brand],
    ["Released", p.yearReleased],
    ["Tournament approval", p.approvalBody],
    ["Shape", p.shape],
    ["Impact feel", p.impactFeel],
    ["Core thickness", p.coreThicknessMm != null ? `${p.coreThicknessMm} mm` : null],
    ["Static weight", p.weightOz != null ? `${p.weightOz} oz` : null],
    ["Balance point", p.balancePointMm != null ? `${p.balancePointMm} mm` : null],
    ["Grip length", p.gripLengthIn != null ? `${p.gripLengthIn} in` : null],
    ["Grip circumference", p.gripSizeIn != null ? `${p.gripSizeIn} in` : null],
    ["Spin rating", p.spinRating],
    ["Best for", p.skillLevel],
  ].filter(([, v]) => v != null && v !== "");
}

/* ------------------------------------------------------- performance bars */

// The rows of the detail page's "Measured performance" card, and the mini-bars
// on a catalog card.
//
// `word` is what the row prints. It is never a number: see the licensing note
// at the top. `w` is a bar width, which is the one legitimate use of the band —
// a relative position along the catalog, which is exactly what a bar is.
//
// Swing weight is inverted and renamed. A high swing weight is not "worse", it
// is slower and more stable, so the row is framed as Hand speed with the bar
// reversed — a long bar always means "more of the good thing named on the row",
// which is the only way a reader can scan eight bars without a legend.
//
// Control is the odd one out and comes in through `opts.control`. Unlike the
// others it is not a single measured percentile — no "control tier" exists in
// the data — but a composite the site assembles in controlRating()
// (paddle-ratings.js): inverted power, maneuverability and the play-style label.
// This module is import-free on purpose (Node loads it to prerender pages and
// cannot resolve the site's "/assets/*" specifiers), so it cannot import that
// function; the caller passes it in, which also keeps controlRating's single
// definition intact — a second copy here is exactly the drift paddle-ratings.js
// exists to prevent. Displaying it is licensing-safe for the same reason the
// other bars are: a bar position plus a tier WORD, never the number.
export function metricRows(p, opts = {}) {
  const control = typeof opts.control === "function" ? opts.control(p) : null;
  const rows = [
    {
      key: "spin",
      label: "Spin",
      v: p.spinPercentile,
      word: sentenceCase(p.spinRating) || tierWord(p.spinPercentile),
      note: "How much bite the face puts on the ball.",
    },
    {
      key: "power",
      label: "Power",
      v: p.powerPercentile,
      word: tierWord(p.powerPercentile),
      note: "Ball speed off the face on a full swing.",
    },
    {
      key: "control",
      label: "Control",
      v: control,
      word: tierWord(control),
      note: "Touch and placement — the trade-off against raw power.",
    },
    {
      key: "forgiveness",
      label: "Forgiveness",
      v: p.twistWeightPercentile,
      word: tierWord(p.twistWeightPercentile),
      note: "How stable the head stays on an off-centre hit.",
    },
    {
      key: "handspeed",
      label: "Hand speed",
      v: p.swingWeightPercentile == null ? null : 1 - p.swingWeightPercentile,
      word: tierWord(p.swingWeightPercentile == null ? null : 1 - p.swingWeightPercentile),
      note: "How quickly it moves in a hands battle at the kitchen.",
    },
  ];
  return rows.filter((r) => r.v != null && r.word);
}

// The mini-bar strip on a catalog card: the four "what's it like to hit with"
// axes — spin, power, control, forgiveness. Hand speed is detail-page only (a
// card can't carry five). No slice: control made the shopping axes four, and
// dropping one of the four a shopper filters on would be an arbitrary cut. Pass
// the same opts.control the detail page uses.
export function miniBars(p, opts = {}) {
  return metricRows(p, opts).filter((r) => r.key !== "handspeed");
}
