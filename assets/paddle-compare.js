// Head-to-head compare — /paddles/browse/compare?vs=<idA>,<idB>.
//
// The verdict-first editorial redesign (design handoff "3a"). Two paddles are
// compared at all times; the reader can SWAP either side for one of the "Other
// options", and every derived region — kicker, verdict, recommendation cards,
// radar "fingerprint", differences table, Total/Value rows and the swap labels —
// recomputes from the active pair.
//
// ─────────────────────────────────────────────────────────────────────────────
// LICENSING NOTE — READ BEFORE COPYING ANY OF THIS ELSEWHERE.
//
// Everywhere else on the site (grid, detail, quiz) the PickleballEffect lab
// percentiles are a firewall case: used to rank/categorize, NEVER printed as a
// number — see PADDLE_DATA_SETUP.md "Data licensing" and paddle-model.js's
// bandPhrase(), the deliberate replacement for "91st percentile". THIS PAGE is
// the one intentional exception: per an explicit product decision it prints the
// derived 0–10 ratings, the percentile ordinals, a Total score /50 and a Value
// score (points per $100). Those numbers are all derived from the banded
// percentiles in paddles.json, so nothing here re-publishes a raw measurement
// beyond the bucket the public file already exposes — but it does DISPLAY the
// bucket, which the rest of the site does not. Keep that departure contained to
// this file. Do not lift ratingOf()/totalOf()/percentiles into paddle-model.js
// where the word-tier surfaces import from, or the firewall leaks.
//
// Production has no raw 0–10 ratings (the handoff's `r:{spin:9.2,…}` are
// placeholders). Each axis rating is derived from its banded percentile:
// rating = pctl / 10, so a 93rd-percentile axis reads 9.3 / "93rd pctl" — one
// number, shown as an absolute score and its rank, which is what it is.
//
// URL: ?vs=a,b (shareable, updated on every swap). ?a=&b= is still accepted so
// links minted by paddle-tray.js before this redesign keep working.
// ─────────────────────────────────────────────────────────────────────────────

import { esc, moneyLabel, approvalNote, qualityScore, similarPaddles, hasLab } from "/assets/paddle-model.js";
import { vendorLinkFor, trackVendorClicks } from "/assets/affiliate-links.js";
import { controlRating } from "/assets/paddle-ratings.js";

/* --------------------------------------------------------------- empty states */

// Reached without a valid pair. Each says what happened rather than "something
// went wrong", because the fix differs: a stale bookmark needs a new pick, a
// hand-edited URL needs a second id. No id is echoed back — a compare URL is the
// one place a stranger's string would be printed onto the page, and the ids are
// slugs that answer no question "Browse all paddles" doesn't already answer.
const REASONS = {
  none: "This comparison link doesn't name any paddles. Pick two from the catalog and the head-to-head builds itself.",
  one: "This comparison link only names one paddle. Head to head needs two — pick a second one and we'll line them up.",
  same: "That's the same paddle on both sides. Pick a different second paddle and we'll show you where they part company.",
  unknown:
    "We can't find one of these paddles in the catalog any more — the link is probably older than our last data refresh. Pick two current ones and we'll compare those.",
};

// The verdict headline is the page's h1 on a successful render and it lives
// inside the module. The empty/error states carry no heading of their own — the
// static .h2h-fallback block in the HTML keeps its "Head to head." h1 visible
// for exactly these cases (it's only hidden once the module mounts).
const emptyHtml = (reason) =>
  `<div class="ph-empty"><p>${reason}</p><a class="btn" href="/paddles/browse">Browse all paddles</a></div>`;

/* --------------------------------------------------------------- axis scoring */

// The five performance axes, in RADAR vertex order (spin at 12 o'clock, then
// clockwise). angle is the SVG angle used by pentagon(); pct maps a paddle to a
// 0–1 percentile. Hand speed is swing weight inverted (a low swing weight is
// quick hands, which is the good thing the axis names). Control has no measured
// tier in the data, so it comes in as a catalog rank of controlRating() — the
// one axis whose percentile is a rank across our catalog rather than a lab
// percentile; honest, because there is no lab control number to borrow.
const AXES = [
  { key: "spin", label: "Spin", angle: -90, tip: "How much RPM the surface generates on serves and rolls.", pct: (p) => p.spinPercentile },
  { key: "power", label: "Power", angle: -18, tip: "Pop on drives and serves — how fast the ball leaves the face.", pct: (p) => p.powerPercentile },
  { key: "forgive", label: "Forgiveness", angle: 54, tip: "Sweet-spot size and stability on off-center hits.", pct: (p) => p.twistWeightPercentile },
  { key: "hands", label: "Hand speed", angle: 126, tip: "How quickly the paddle moves in fast kitchen exchanges — driven by swing weight.", pct: (p) => (p.swingWeightPercentile == null ? null : 1 - p.swingWeightPercentile) },
  { key: "control", label: "Control", angle: 198, tip: "Touch on resets, drops and dinks — how predictably the ball comes off the face.", pct: (p) => null /* filled by makeControlPct */ },
];

// Table order differs from the radar (the handoff leads the table with the
// axes a shopper feels first). Followed by the two spec rows, which are lower-
// wins and single-line (no percentile).
const TABLE_AXES = ["hands", "forgive", "spin", "power", "control"];
const SPEC_ROWS = [
  { key: "weight", label: "Static weight", tip: "Weight on a scale, unmodified. Lighter is easier on the arm.", get: (p) => p.weightOz, fmt: (v) => `${v} oz`, lowerWins: true },
  { key: "price", label: "Price", tip: "Street price at time of writing.", get: (p) => p.price, fmt: (v) => `$${Math.round(v)}`, lowerWins: true },
];

const axByKey = Object.fromEntries(AXES.map((a) => [a.key, a]));
const ord = (n) => {
  const t = n % 100;
  if (t >= 11 && t <= 13) return `${n}th`;
  return `${n}${{ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th"}`;
};

// controlRating is a composite, not a percentile, so its rank has to be built
// from the whole catalog before any cell can print a "Nth pctl" for it. Returns
// a pct(p) that gives the fraction of the catalog this paddle's control beats.
function makeControlPct(rows) {
  const vals = rows.map((p) => controlRating(p)).filter((v) => typeof v === "number").sort((x, y) => x - y);
  const n = vals.length;
  return (p) => {
    const v = controlRating(p);
    if (typeof v !== "number" || !n) return null;
    // Count strictly-below, then centre inside the tie band, so a value equal to
    // the catalog median lands near 50 rather than being pushed to 100 by <=.
    let lo = 0;
    let hi = 0;
    for (const x of vals) {
      if (x < v - 1e-9) lo++;
      if (x <= v + 1e-9) hi++;
    }
    return (lo + hi) / (2 * n);
  };
}

// One paddle's data on one axis. pct is 0–1 or null; pctl is the integer
// ordinal we print; rating is pctl/10 so the two lines never contradict.
function axisDatum(axis, p) {
  const pct = axis.pct(p);
  if (pct == null) return { pct: null, pctl: null, rating: null };
  const pctl = Math.max(1, Math.min(100, Math.round(pct * 100)));
  return { pct, pctl, rating: pctl / 10 };
}

// Sum of the five axis ratings, out of 50 — null unless all five are present,
// because a Total computed over four axes is not "out of 50" and silently
// under-scores a half-measured paddle against a fully measured one.
function totalOf(p) {
  let sum = 0;
  for (const a of AXES) {
    const d = axisDatum(a, p);
    if (d.rating == null) return null;
    sum += d.rating;
  }
  return sum;
}

const valueOf = (p, total) => (total != null && typeof p.price === "number" && p.price > 0 ? (total / p.price) * 100 : null);
const f1 = (v) => (v == null ? "—" : v.toFixed(1));

// One tie predicate for the whole page. analyse() and the two number rows both
// read it, so the verdict can never say "higher total" over a row that prints
// "Even" — they used to disagree, because analyse() compared with a bare >=.
const sameScore = (x, y) => Math.abs(x - y) < 1e-9;

/* --------------------------------------------------------------- radar points */

const CX = 130;
const CY = 118;
const RMAX = 84;

// SVG polygon points for one paddle. A missing axis collapses to the centre; a
// paddle with no lab data at all returns null and its polygon is dropped rather
// than drawn as a dot at the origin.
function pentagon(p) {
  let any = false;
  const pts = AXES.map((a) => {
    const pct = a.pct(p);
    if (pct != null) any = true;
    const r = (pct == null ? 0 : Math.max(0, Math.min(1, pct))) * RMAX;
    const rad = (a.angle * Math.PI) / 180;
    return `${(CX + r * Math.cos(rad)).toFixed(1)},${(CY + r * Math.sin(rad)).toFixed(1)}`;
  });
  return any ? pts.join(" ") : null;
}

/* -------------------------------------------------------------- "Get X if…" */

// Reasons to choose `win` over `lose`, richest advantage first. Perf axes are
// ranked by percentile gap; the two spec rows earn a bullet only when this
// paddle is the cheaper or the lighter one. Capped at three so the card reads as
// a recommendation, not a diff. Always returns at least one true clause.
const AXIS_BULLET = {
  spin: "you lean on spin to serve and roll the ball",
  power: "you want more pop on drives and serves",
  forgive: "you want a bigger, more forgiving sweet spot",
  hands: "you want the faster hands in kitchen exchanges",
  control: "you play a touch-and-control game at the net",
};

// The catalog band at/above which an axis counts as a genuine strength worth
// citing on its own — the same 0.66 the detail-page bars use to colour a bar
// "high". Below it, an uncontested axis is just average, not a selling point.
const STRENGTH_PCT = 0.66;

function pickBullets(win, lose) {
  const scored = []; // head-to-head edges: both measured, this paddle ahead
  const solo = []; // strengths the opponent was never benched on (see below)
  for (const a of AXES) {
    const w = axisDatum(a, win);
    const l = axisDatum(a, lose);
    if (w.pct != null && l.pct != null && w.pct - l.pct >= 0.05) {
      scored.push({ gap: w.pct - l.pct, text: AXIS_BULLET[a.key] });
    } else if (w.pct != null && l.pct == null && w.pct >= STRENGTH_PCT) {
      // The opponent has no measurement on this axis, so we cannot say this
      // paddle has "more" of it — the "—" in the differences table means
      // unmeasured, not low, and it might well be higher. But this paddle
      // measurably sits in the catalog's top third here, and that is a true
      // reason to pick it phrased as a play style ("you lean on spin"), which
      // claims nothing about the other paddle. Without this branch an
      // "OUR PICK — HIGHER TOTAL" whose margin comes entirely from spin/power
      // the opponent never benched falls back to a limp shape line — the pick's
      // own justification made invisible. Ranked strictly below every real
      // head-to-head edge, so a proven gap always outranks an uncontested one.
      solo.push({ pct: w.pct, text: AXIS_BULLET[a.key] });
    }
  }
  scored.sort((x, y) => y.gap - x.gap);
  solo.sort((x, y) => y.pct - x.pct);
  const bullets = scored.map((s) => s.text).concat(solo.map((s) => s.text));

  if (typeof win.price === "number" && typeof lose.price === "number" && win.price <= lose.price - 15) {
    bullets.unshift(`budget matters — it's $${Math.round(lose.price - win.price)} cheaper`);
  }
  if (bullets.length < 3 && typeof win.weightOz === "number" && typeof lose.weightOz === "number" && lose.weightOz - win.weightOz >= 0.15) {
    bullets.push("you want the lighter paddle, easier on the arm");
  }
  if (!bullets.length) {
    if (win.shape && win.shape === lose.shape) bullets.push(`you prefer ${win.brand}'s take on the ${String(win.shape).toLowerCase()} shape`);
    else if (win.shape) bullets.push(`you want the ${String(win.shape).toLowerCase()} shape`);
    else bullets.push(`you prefer ${win.brand}'s feel`);
  }
  return bullets.slice(0, 3);
}

/* ------------------------------------------------------- shared-specs strip */

// Attributes are synthesised from safe manufacturer fields — the handoff's
// `attrs` array does not exist in the data, and the face-material line it shows
// ("raw carbon face") is one of the licensed fields we never imported.
function attrsOf(p) {
  const out = [];
  if (typeof p.coreThicknessMm === "number") out.push(`${p.coreThicknessMm}mm core`);
  if (p.shape) out.push(`${p.shape} shape`);
  if (p.approvalBody && p.approvalBody !== "Unapproved") out.push(`${p.approvalBody} approved`);
  return out;
}

function sharedStrip(a, b) {
  const bs = attrsOf(b);
  const shared = attrsOf(a).filter((x) => bs.includes(x));
  return shared.length ? `BOTH HAVE: ${shared.join(" · ").toUpperCase()}` : "FEW SHARED SPECS — SEE EACH REVIEW";
}

/* ------------------------------------------------------------------- verdict */

// Everything the view needs, computed once from the active pair. Slot A is deep
// green, slot B is olive, by position.
//
// `basis` records WHAT the verdict rests on, and the headline and the pick badge
// are both derived from it — they used to be hardcoded to "higher total", which
// made the page claim a Total comparison it had not made. 171 of the catalog's
// paddles have no complete Total (totalOf needs all five axes), so on 55% of
// pairs at least one side prints "—" on that row:
//
//   total    both Totals present and different — a real Total comparison
//   tie      both Totals present and equal — nobody wins, say so
//   measured only one side (or neither) has a Total, but qualityScore separates
//            them on the axes we do hold for both — a real but narrower call
//   none     neither paddle has enough bench data to separate them at all.
//            Previously this fell through to `(qA ?? -1) >= (qB ?? -1)`, which
//            is always true, so slot A "won" purely for being first in ?vs= —
//            reversing the URL flipped the verdict with no change in data.
function analyse(a, b, labCount) {
  const tA = totalOf(a);
  const tB = totalOf(b);
  const vA = valueOf(a, tA);
  const vB = valueOf(b, tB);
  const bothTotals = tA != null && tB != null;

  let basis;
  let winnerSlot;
  if (bothTotals) {
    basis = sameScore(tA, tB) ? "tie" : "total";
    winnerSlot = tA > tB ? "a" : "b";
  } else {
    const qA = qualityScore(a);
    const qB = qualityScore(b);
    if (qA == null && qB == null) basis = "none";
    else basis = sameScore(qA ?? -1, qB ?? -1) ? "none" : "measured";
    winnerSlot = (qA ?? -1) > (qB ?? -1) ? "a" : "b";
  }
  // Nothing is picked on "tie" or "none", so fall back to the order the URL
  // named them in — the strict > above resolves an unpicked pair to slot B,
  // which would silently render the second paddle's card first while the
  // kicker above it still reads "A vs B".
  if (basis === "tie" || basis === "none") winnerSlot = "a";
  // win/lose are then only the slot order the two cards render in, and the view
  // gives neither of them the pick treatment.
  const win = winnerSlot === "a" ? a : b;
  const lose = winnerSlot === "a" ? b : a;

  const hi = bothTotals ? Math.max(tA, tB) : null;
  const lo = bothTotals ? Math.min(tA, tB) : null;
  const bothValues = vA != null && vB != null;
  const valWin = bothValues ? (vA > vB ? a : b) : null;
  const valEven = bothValues && sameScore(vA, vB);

  let blurb;
  if (basis === "total" && bothValues) {
    const vHi = Math.max(vA, vB);
    const vLo = Math.min(vA, vB);
    blurb =
      valWin === win || valEven
        ? `Total score ${f1(hi)}–${f1(lo)}, and the better value at ${f1(vHi)} points per $100.`
        : `Total score ${f1(hi)}–${f1(lo)}; but the ${valWin.short} is the better value — ${f1(vHi)} vs ${f1(vLo)} points per $100.`;
  } else if (basis === "total") {
    blurb = `Total score ${f1(hi)}–${f1(lo)}.`;
  } else if (basis === "tie") {
    // Dead level on the one number that decides this page. Naming the better
    // value is a real tiebreak; picking one anyway would not be.
    blurb = bothValues && !valEven
      ? `Dead level on Total, ${f1(hi)} each. The ${valWin.short} is the better value — ${f1(Math.max(vA, vB))} vs ${f1(Math.min(vA, vB))} points per $100.`
      : `Dead level on Total, ${f1(hi)} each. Pick on feel, shape and price.`;
  } else if (basis === "measured") {
    // No complete Total for one side — describe the call without inventing a
    // score. We still know who came out ahead on the data we hold for both.
    blurb = `The ${win.short} edges it across the measurements we hold for both. Their detail pages carry everything else.`;
  } else {
    blurb = `Neither of these has been through the bench we score Totals from, so we're not going to call a winner on numbers we don't have. What we do hold is below — and each one's own case is worth reading.`;
  }

  return {
    a, b, win, lose, winnerSlot, basis,
    totals: { a: tA, b: tB },
    values: { a: vA, b: vB },
    kicker: `${a.name} (${moneyLabel(a.price)}) vs ${b.name} (${moneyLabel(b.price)})`,
    blurb,
    strip: sharedStrip(a, b),
    labCount,
  };
}

/* --------------------------------------------------------------- CTA + notes */

// The buy control, reused from the grid/quiz so one delegated trackVendorClicks
// counts all three surfaces. rel and the "· affiliate" suffix are conditional on
// isAffiliate — a plain vendor link must never be dressed up as a commissioned
// one. A paddle with no vendor at all (3 of the catalog) falls back to its
// detail page so the card never carries a dead or empty CTA.
function ctaHtml(p, affiliateMap, position, variant) {
  const link = vendorLinkFor(p, affiliateMap);
  if (!link) {
    const href = `/paddles/browse/p/${encodeURIComponent(p.id)}`;
    const note = approvalNote(p);
    return `<div class="h2h-cta-row">
      <a class="h2h-cta h2h-cta--${variant}" href="${esc(href)}">See the review<span class="visually-hidden"> for ${esc(p.brand)} ${esc(p.name)}</span></a>
      ${note ? `<span class="h2h-cta-note">${esc(note)}</span>` : ""}
    </div>`;
  }
  const rel = link.isAffiliate ? "sponsored nofollow noopener" : "nofollow noopener";
  // "affiliate link", not bare "affiliate" — same wording as the grid's
  // .pn-note, because it is the same disclosure doing the same job beside the
  // same kind of button, and two surfaces wording it differently is a tell.
  const note = [approvalNote(p), link.isAffiliate ? "affiliate link" : null].filter(Boolean).join(" · ");
  const data = [
    `data-pq-paddle="${esc(p.id)}"`,
    `data-pq-brand="${esc(p.brand)}"`,
    `data-pq-link-type="${esc(link.linkType || "unknown")}"`,
    `data-pq-affiliate="${link.isAffiliate ? "1" : "0"}"`,
    `data-pq-surface="compare"`,
    `data-pq-position="${position}"`,
  ].join(" ");
  return `<div class="h2h-cta-row">
    <a class="h2h-cta h2h-cta--${variant}" href="${esc(link.href)}" target="_blank" rel="${rel}" ${data}>${esc(link.shortLabel || link.label)}<span class="visually-hidden"> — ${esc(p.brand)} ${esc(p.name)} (opens in new tab)</span></a>
    ${note ? `<span class="h2h-cta-note">${esc(note)}</span>` : ""}
  </div>`;
}

// The Associates sentence is required verbatim wherever Associates links appear,
// and sits with the links, not in a footnote. Three branches: the third case is
// real — two paddles can both be honest un-tagged brand links, and claiming "we
// don't earn a commission" when there are no links at all is a statement about
// nothing.
function disclosureHtml(links) {
  if (!links.length) return "";
  const amazon = links.some((l) => l.isAmazon) ? " As an Amazon Associate I earn from qualifying purchases." : "";
  return links.some((l) => l.isAffiliate)
    ? `<p class="h2h-disclosure">One or more links above are affiliate links — we may earn a commission at no extra cost to you. It never changes which paddle wins a row here or how either is described.${amazon} <a href="/affiliate-disclosure">How this works</a>.</p>`
    : `<p class="h2h-disclosure">These links go straight to each brand's own site — we don't earn a commission from them today. If that changes, we'll say so right here and on our <a href="/affiliate-disclosure">disclosure page</a>.</p>`;
}

/* ------------------------------------------------------------------ markup */

const tipTag = (label, tip) => `<span class="tip">${esc(label)}<span class="h2h-tip">${esc(tip)}</span></span>`;

// A two-line rating cell (perf axis) or a one-line spec cell. `win` bolds the
// winner; a tie bolds neither, which is the honest outcome.
function cellHtml(datum, win, twoLine) {
  const cls = `h2h-cell${win ? " is-win" : ""}`;
  if (!twoLine) return `<span class="${cls}">${esc(datum.label)}</span>`;
  const pctl = datum.pctl == null ? "" : `<span class="h2h-pctl">${ord(datum.pctl)} pctl</span>`;
  return `<span class="${cls}"><span class="h2h-rating">${esc(datum.label)}</span>${pctl}</span>`;
}

function edgeHtml(winnerSlot, aShort, bShort, even) {
  if (even) return `<span class="h2h-edge h2h-edge--even">Even</span>`;
  return winnerSlot === "a"
    ? `<span class="h2h-edge h2h-edge--a">${esc(aShort)}</span>`
    : `<span class="h2h-edge h2h-edge--b">${esc(bShort)}</span>`;
}

function perfRow(axis, a, b) {
  const da = axisDatum(axis, a);
  const db = axisDatum(axis, b);
  const both = da.pct != null && db.pct != null;
  const even = both && Math.abs(da.pct - db.pct) < 1e-9;
  let winnerSlot = null;
  if (both && !even) winnerSlot = da.pct > db.pct ? "a" : "b";
  const cA = { label: da.rating == null ? "—" : f1(da.rating), pctl: da.pctl };
  const cB = { label: db.rating == null ? "—" : f1(db.rating), pctl: db.pctl };
  return `<div class="h2h-row">
    ${tipTag(axis.label, axis.tip)}
    ${cellHtml(cA, winnerSlot === "a", true)}
    ${cellHtml(cB, winnerSlot === "b", true)}
    ${both ? edgeHtml(winnerSlot, a.short, b.short, even) : `<span class="h2h-edge h2h-edge--even">—</span>`}
  </div>`;
}

function specRow(spec, a, b) {
  const av = spec.get(a);
  const bv = spec.get(b);
  const both = typeof av === "number" && typeof bv === "number";
  const even = both && sameScore(av, bv);
  let winnerSlot = null;
  if (both && !even) winnerSlot = (av < bv) === spec.lowerWins ? "a" : "b";
  const cA = { label: typeof av === "number" ? spec.fmt(av) : "—" };
  const cB = { label: typeof bv === "number" ? spec.fmt(bv) : "—" };
  return `<div class="h2h-row">
    ${tipTag(spec.label, spec.tip)}
    ${cellHtml(cA, winnerSlot === "a", false)}
    ${cellHtml(cB, winnerSlot === "b", false)}
    ${both ? edgeHtml(winnerSlot, a.short, b.short, even) : `<span class="h2h-edge h2h-edge--even">—</span>`}
  </div>`;
}

function scoreRow(label, tip, av, bv, a, b, rowMod) {
  // Higher score always wins on these two rows (more total, more value per $).
  const both = av != null && bv != null;
  const even = both && sameScore(av, bv);
  let winnerSlot = null;
  if (both && !even) winnerSlot = av > bv ? "a" : "b";
  return `<div class="h2h-row ${rowMod}">
    <span class="tip h2h-score-label">${esc(label)}<span class="h2h-tip">${esc(tip)}</span></span>
    <span class="h2h-score-val${winnerSlot === "a" ? " is-win" : ""}">${f1(av)}</span>
    <span class="h2h-score-val${winnerSlot === "b" ? " is-win" : ""}">${f1(bv)}</span>
    ${both ? edgeHtml(winnerSlot, a.short, b.short, even) : `<span class="h2h-edge h2h-edge--even">—</span>`}
  </div>`;
}

function radarHtml(a, b) {
  const pa = pentagon(a);
  const pb = pentagon(b);
  const label = (x, y, anchor, text, ls) =>
    `<text x="${x}" y="${y}" text-anchor="${anchor}" style="font:700 9px var(--font-mono);fill:#77762F;letter-spacing:${ls}">${text}</text>`;
  return `<svg viewBox="0 0 260 230" class="h2h-radar-svg" role="img" aria-label="Percentile fingerprint comparing ${esc(a.short)} and ${esc(b.short)} across spin, power, forgiveness, hand speed and control.">
    <polygon points="130,34 209.9,92 179.4,186 80.6,186 50.1,92" fill="none" stroke="#DDD8C6" stroke-width="1"></polygon>
    <polygon points="130,62 183.3,100.7 162.9,163.3 97.1,163.3 76.7,100.7" fill="none" stroke="#DDD8C6" stroke-width="1"></polygon>
    <polygon points="130,90 156.6,109.3 146.5,140.7 113.5,140.7 103.4,109.3" fill="none" stroke="#DDD8C6" stroke-width="1"></polygon>
    <line x1="130" y1="118" x2="130" y2="34" stroke="#DDD8C6" stroke-width="1"></line>
    <line x1="130" y1="118" x2="209.9" y2="92" stroke="#DDD8C6" stroke-width="1"></line>
    <line x1="130" y1="118" x2="179.4" y2="186" stroke="#DDD8C6" stroke-width="1"></line>
    <line x1="130" y1="118" x2="80.6" y2="186" stroke="#DDD8C6" stroke-width="1"></line>
    <line x1="130" y1="118" x2="50.1" y2="92" stroke="#DDD8C6" stroke-width="1"></line>
    ${pa ? `<polygon points="${pa}" fill="rgba(23,89,74,.13)" stroke="#17594A" stroke-width="2"></polygon>` : ""}
    ${pb ? `<polygon points="${pb}" fill="rgba(163,176,47,.2)" stroke="#8C9A2B" stroke-width="2"></polygon>` : ""}
    ${label(130, 24, "middle", "SPIN", ".1em")}
    ${label(216, 88, "start", "POWER", ".1em")}
    ${label(186, 201, "start", "FORGIVE", ".1em")}
    ${label(74, 201, "end", "HANDS", ".1em")}
    ${label(48, 88, "end", "CONTROL", ".02em")}
  </svg>`;
}

// badgeText is null on every card that isn't the pick, and on BOTH cards when
// analyse() couldn't separate the pair — the badge is a claim, so it is passed
// in from the basis rather than inferred from the variant.
function recoCard(p, other, affiliateMap, variant, position, badgeText) {
  const bullets = pickBullets(p, other).map((b) => `<li>${esc(b)}</li>`).join("");
  const badge = badgeText ? `<span class="h2h-reco-badge">${esc(badgeText)}</span>` : "";
  return `<div class="h2h-reco h2h-reco--${variant}">
    ${badge}
    <div class="h2h-reco-title">Get the ${esc(p.short)} if…</div>
    <ul class="h2h-reco-bullets">${bullets}</ul>
    ${ctaHtml(p, affiliateMap, position, variant)}
  </div>`;
}

function optionCard(p, badge, aShort, bShort) {
  const badgeHtml = badge
    ? `<span class="h2h-obadge h2h-obadge--${badge === "TOP PICK" ? "top" : "value"}">${esc(badge)}</span>`
    : "";
  const href = `/paddles/browse/p/${encodeURIComponent(p.id)}`;
  return `<div class="h2h-option">
    <div class="h2h-option-head">${badgeHtml}<b class="h2h-option-name">${esc(p.name)}</b> <span class="h2h-option-price">${esc(moneyLabel(p.price))}</span></div>
    <p class="h2h-option-desc">${esc(p.desc)} <a class="h2h-option-link" href="${esc(href)}">Details &rarr;</a></p>
    <div class="h2h-swap">
      <span class="h2h-swap-label">SWAP IN:</span>
      <button type="button" class="h2h-swap-btn h2h-swap-btn--a" data-swap="${esc(p.id)}" data-slot="a">&#8646; Swap in for ${esc(aShort)}</button>
      <button type="button" class="h2h-swap-btn h2h-swap-btn--b" data-swap="${esc(p.id)}" data-slot="b">&#8646; Swap in for ${esc(bShort)}</button>
    </div>
  </div>`;
}

/* -------------------------------------------------------------------- render */

// The headline and the pick badge, both keyed off analyse()'s basis so neither
// can assert a comparison the page didn't make. "picked" is false when the pair
// couldn't be separated: no badge, no winner styling, and a headline that says
// so instead of naming one.
const VERDICT = {
  total: { picked: true, badge: "OUR PICK — HIGHER TOTAL" },
  measured: { picked: true, badge: "OUR PICK — ON WHAT WE MEASURED" },
  tie: { picked: false, badge: null },
  none: { picked: false, badge: null },
};

function moduleHtml(model, roster, affiliateMap) {
  const { a, b, win, lose, winnerSlot, basis, totals, values, kicker, blurb, strip, labCount } = model;
  const winPos = winnerSlot === "a" ? 1 : 2;
  const losePos = winnerSlot === "a" ? 2 : 1;
  const verdict = VERDICT[basis];
  const headline = verdict.picked
    ? `The verdict: get the <span class="h2h-mark">${esc(win.short)}</span>.`
    : basis === "tie"
      ? `The verdict: <span class="h2h-mark">it's a tie</span>.`
      : `We can't <span class="h2h-mark">call this one</span>.`;

  const perfRows = TABLE_AXES.map((k) => perfRow(axByKey[k], a, b)).join("");
  const specRowsHtml = SPEC_ROWS.map((s) => specRow(s, a, b)).join("");
  const totalRow = scoreRow(
    "Total score",
    "Sum of the five playtest ratings — spin, power, forgiveness, hand speed, control. Out of 50.",
    totals.a, totals.b, a, b, "h2h-row--total"
  );
  const valueRow = scoreRow(
    "Value score",
    "Rating points per $100 — total score ÷ price × 100. Higher = more paddle for the money.",
    values.a, values.b, a, b, "h2h-row--value"
  );

  const others = roster.filter((r) => r.id !== a.id && r.id !== b.id);
  const optionCards = others.map((r) => optionCard(r, r.badge, a.short, b.short)).join("");

  const links = [vendorLinkFor(a, affiliateMap), vendorLinkFor(b, affiliateMap)].filter(Boolean);

  return `<div class="h2h">
    <header class="h2h-header">
      <div class="h2h-kicker">${esc(kicker)}</div>
      <h1 class="h2h-verdict">${headline}</h1>
      <p class="h2h-blurb">${esc(blurb)}</p>
    </header>

    <h2 class="visually-hidden">Which to get, and why</h2>
    <div class="h2h-recos">
      ${recoCard(win, lose, affiliateMap, verdict.picked ? "win" : "even", winPos, verdict.badge)}
      ${recoCard(lose, win, affiliateMap, verdict.picked ? "lose" : "even", losePos, null)}
    </div>

    <div class="h2h-analysis">
      <div class="h2h-radar">
        <div class="h2h-radar-label">THE FINGERPRINT</div>
        ${radarHtml(a, b)}
        <div class="h2h-legend">
          <span class="h2h-legend-item"><i class="h2h-dot h2h-dot--a"></i>${esc(a.short)}</span>
          <span class="h2h-legend-item"><i class="h2h-dot h2h-dot--b"></i>${esc(b.short)}</span>
        </div>
      </div>
      <div class="h2h-table">
        <div class="h2h-table-label">WHERE THEY ACTUALLY DIFFER</div>
        <div class="h2h-rows">
          <div class="h2h-row h2h-row--head">
            <span>METRIC</span>
            <span class="h2h-col-a">${esc(a.short.toUpperCase())}</span>
            <span class="h2h-col-b">${esc(b.short.toUpperCase())}</span>
            <span class="h2h-col-edge">EDGE</span>
          </div>
          ${perfRows}
          ${specRowsHtml}
          ${totalRow}
          ${valueRow}
        </div>
        <div class="h2h-strip">${esc(strip)}</div>
        <p class="h2h-caption">Small gray figures are percentiles — where each paddle ranks against the ${labCount} we've lab-tested; 93rd = better than 93% of them. The fingerprint is percentile-scaled.</p>
      </div>
    </div>

    <div class="h2h-others">
      <div class="h2h-others-label">OTHER OPTIONS</div>
      <div class="h2h-others-grid">${optionCards}</div>
      ${disclosureHtml(links)}
    </div>
  </div>`;
}

/* ------------------------------------------------------- roster & app state */

// Badges are intrinsic to the alternatives and computed once, so a paddle keeps
// its badge as it moves in and out of the duo. TOP PICK = the highest-scoring
// alternative; VALUE = the best score-per-dollar among the rest.
function badgeAlternatives(alts) {
  const scored = alts.map((p) => ({ p, q: qualityScore(p) ?? 0, v: typeof p.price === "number" && p.price > 0 ? (qualityScore(p) ?? 0) / p.price : 0 }));
  const top = scored.slice().sort((x, y) => y.q - x.q)[0];
  const value = scored.filter((s) => s.p !== (top && top.p)).sort((x, y) => y.v - x.v)[0];
  for (const s of scored) s.p.badge = s === top ? "TOP PICK" : s === value ? "VALUE" : "";
  return alts;
}

// The swap pool: paddles near the opening pair, restricted to full-lab rows so a
// swap never lands the reader on a half-empty radar. Computed once from the
// opening duo and then held stable, so the "Other options" list doesn't churn
// under the reader between swaps.
function buildRoster(a, b, rows) {
  const seen = new Set([a.id, b.id]);
  const alts = [];
  for (const cand of [...similarPaddles(a, rows, 10), ...similarPaddles(b, rows, 10)]) {
    // Candidates must be fully specced: a complete Total (all five axes) AND a
    // price, so a swap never lands the reader on a half-empty radar, a "—" Total
    // or a "Price n/a" kicker/value row.
    if (seen.has(cand.id) || !hasLab(cand) || totalOf(cand) == null || typeof cand.price !== "number") continue;
    seen.add(cand.id);
    alts.push(cand);
    if (alts.length >= 4) break;
  }
  badgeAlternatives(alts);
  return [a, b, ...alts];
}

// Slug + short name + one-line blurb are attached once; the model reads them off
// the row so the view never recomputes copy mid-swap.
function decorate(p) {
  p.short = baseShort(p); // a default; the active pair is disambiguated in paint()
  p.desc = oneLiner(p);
  if (!("badge" in p)) p.badge = "";
  return p;
}

// The short name is what fits on a swap button, a legend dot and a column
// header. Take the distinctive tail of the model name — the last word, or the
// last two when the last is a bare designator like "X" or "PP" that means
// nothing alone ("Power 2 Hurache X" → "Hurache X", "Prism Flash 16" → "Flash").
function baseShort(p) {
  const words = String(p.name || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return p.brand || "Paddle";
  // Drop trailing size/spec tokens like "16", "16mm", "8.0oz".
  const meaningful = words.filter((w) => !/^\d+(\.\d+)?(mm|oz|")?$/i.test(w));
  const pool = meaningful.length ? meaningful : words;
  let tail = pool.slice(-1);
  if (tail[0].length <= 2 && pool.length >= 2) tail = pool.slice(-2);
  return tail.join(" ");
}

// The two active shorts have to be TELLABLE APART — a table with two "Control"
// columns helps no one. When the tails collide, fall back to the brand (if the
// brands differ) and then to the full model name.
function distinctShorts(a, b) {
  let sa = baseShort(a);
  let sb = baseShort(b);
  if (sa.toLowerCase() === sb.toLowerCase()) {
    if (a.brand && b.brand && a.brand !== b.brand) {
      sa = a.brand.split(/\s+/)[0];
      sb = b.brand.split(/\s+/)[0];
    } else {
      sa = a.name;
      sb = b.name;
    }
  }
  return [sa, sb];
}

function oneLiner(p) {
  const bits = [];
  if (p.shape) bits.push(String(p.shape).toLowerCase());
  if (p.paddleType) bits.push(String(p.paddleType).toLowerCase());
  const kind = bits.length ? `${bits.join(" ")} paddle` : "paddle";
  const tail = [];
  if (typeof p.coreThicknessMm === "number") tail.push(`${p.coreThicknessMm}mm core`);
  if (p.spinRating) tail.push(`${String(p.spinRating).toLowerCase()} spin`);
  return tail.length ? `${cap(kind)} — ${tail.join(", ")}.` : `${cap(kind)} from ${p.brand}.`;
}
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/* -------------------------------------------------------------------- mount */

const prefersReducedMotion = () =>
  typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

document.addEventListener("DOMContentLoaded", async () => {
  trackVendorClicks();

  const root = document.getElementById("paddle-compare-app");
  if (!root) return;

  const params = new URLSearchParams(window.location.search);
  // ?vs=a,b is the redesign's form; ?a=&b= is still read so pre-redesign tray
  // links keep working.
  const vs = (params.get("vs") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const aId = (vs[0] || params.get("a") || "").trim();
  const bId = (vs[1] || params.get("b") || "").trim();

  if (!aId && !bId) return void (root.innerHTML = emptyHtml(REASONS.none));
  if (!aId || !bId) return void (root.innerHTML = emptyHtml(REASONS.one));
  if (aId === bId) return void (root.innerHTML = emptyHtml(REASONS.same));

  let rows;
  let affiliateMap;
  try {
    [rows, affiliateMap] = await Promise.all([
      fetch("/assets/paddles.json").then((r) => r.json()),
      fetch("/assets/affiliate-map.json", { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    if (!Array.isArray(rows) || !rows.length) throw new Error("paddles.json is not a non-empty array");
  } catch (err) {
    console.error("[PaddleCompare] Failed to load paddle data.", err);
    root.innerHTML = `<p class="pq-error">Couldn't load the paddle catalog right now — try refreshing the page.</p>`;
    return;
  }

  const byId = new Map(rows.map((p) => [p.id, p]));
  const a0 = byId.get(aId);
  const b0 = byId.get(bId);
  if (!a0 || !b0) return void (root.innerHTML = emptyHtml(REASONS.unknown));

  // controlRating's catalog rank has to exist before any axis prints, so bind it
  // into the control axis before the first render.
  const controlPct = makeControlPct(rows);
  axByKey.control.pct = controlPct;

  const labCount = rows.filter((p) => totalOf(p) != null).length;

  decorate(a0);
  decorate(b0);
  const roster = buildRoster(a0, b0, rows).map(decorate);
  const rosterById = new Map(roster.map((p) => [p.id, p]));

  // duo holds the two active ids; everything else derives from it.
  let duo = [a0.id, b0.id];

  const paint = () => {
    const a = rosterById.get(duo[0]);
    const b = rosterById.get(duo[1]);
    // Disambiguate the two active shorts once per render — every region that
    // prints a short (verdict, legend, headers, edges, swap buttons) reads these.
    [a.short, b.short] = distinctShorts(a, b);
    const model = analyse(a, b, labCount);
    root.innerHTML = moduleHtml(model, roster, affiliateMap);
    document.title = `${a.brand} ${a.name} vs ${b.brand} ${b.name} — Pickleball Bay Area`;
    // The module's verdict is now the page's visible h1; retire the static
    // fallback header so the two don't both show.
    const wrap = root.closest(".ph-wrap");
    if (wrap) wrap.classList.add("h2h-mounted");
  };

  const swap = (id, slot) => {
    const idx = slot === "a" ? 0 : 1;
    if (!rosterById.has(id) || duo[idx] === id) return;
    // If the incoming paddle is already the OTHER slot, ignore — a paddle can't
    // face itself. (The buttons for the current duo aren't rendered, but a fast
    // double-click could still race.)
    if (duo[1 - idx] === id) return;
    duo = idx === 0 ? [id, duo[1]] : [duo[0], id];

    const url = new URL(window.location.href);
    url.searchParams.delete("a");
    url.searchParams.delete("b");
    url.searchParams.set("vs", duo.join(","));
    window.history.replaceState(null, "", url);

    if (prefersReducedMotion()) return void paint();
    root.classList.add("is-swapping");
    window.setTimeout(() => {
      paint();
      requestAnimationFrame(() => root.classList.remove("is-swapping"));
    }, 150);
  };

  // Delegated: the markup is replaced on every swap, so binding to root once and
  // reading data-swap/data-slot off the button survives every re-render.
  root.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-swap]");
    if (btn && root.contains(btn)) {
      e.preventDefault();
      swap(btn.getAttribute("data-swap"), btn.getAttribute("data-slot"));
      return;
    }
    // Touch tooltips: tap a .tip to open it, tap elsewhere to dismiss. Desktop
    // hover is pure CSS and unaffected.
    const tip = e.target.closest(".tip");
    root.querySelectorAll(".tip.is-open").forEach((t) => {
      if (t !== tip) t.classList.remove("is-open");
    });
    if (tip) tip.classList.toggle("is-open");
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".tip")) root.querySelectorAll(".tip.is-open").forEach((t) => t.classList.remove("is-open"));
  });

  paint();
});
