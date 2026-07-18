// Paddle comparison visualizations — a "Your top 3" strip plus three
// interactive charts: an axis-adjustable catalog scatter (2a), a
// price-vs-overall-score value chart (2b), and a preset-reweighted priority
// stress-test (2c). Two surfaces use it:
//   - the quiz results page (assets/paddle-quiz.js) mounts the value + stress
//     charts under the buy CTAs; featured = the quiz's top 3.
//   - the browse page (assets/paddle-grid.js) mounts the full set as a
//     consolidated analytics view; featured = the paddles the visitor picked
//     into the compare tray, and the scatter's dots are clickable to add more.
//
// Recreated from design_handoff_paddle_comparison/README.md. The prototype's
// data was illustrative and used six normalized lab ratings; this site only
// has FOUR trait ratings it can honestly stand behind (power, control, spin,
// forgiveness — see assets/paddle-ratings.js), so the two the data can't back
// (pop, hand speed) are dropped rather than invented, and the headline figure
// is the transparent overall score, never a fabricated "match %".
//
// IMPORTANT — the scatter is banded on purpose. power/spin/control/forgiveness
// derive from percentiles that scripts/rebuild_paddle_data.py bands into 20
// steps before they reach this public file (a data-licensing firewall —
// PickleballEffect's exact percentiles are proprietary; see
// PADDLE_DATA_SETUP.md). Paddles can therefore still share coordinates, and
// dodgeCloud() spreads those exact overlaps a few pixels for legibility — it
// never changes a value, only nudges coincident dots apart so a cluster reads
// as a cluster instead of one dot.
//
// It used to be four quartile bands, which put the entire 486-paddle catalog on
// twenty distinct positions; the 2026-07-18 refresh widened it to twenty bands
// and 253 positions, so the clusters are real overlap now rather than an
// artifact of the storage format.
//
// No framework — the chart DOM is built once and then MUTATED in place on
// axis/preset changes (never re-serialized), because the CSS transitions on
// dot position (2a) and bar re-sort (2c) are the components' delight moment
// and would not fire across an innerHTML swap. This mirrors the hand-rolled
// class style of the rest of this site (paddle-quiz.js, paddle-grid.js).

import { powerRating, controlRating, spinRatingOf, forgivenessRatingOf, clamp01, ratingKnown } from "/assets/paddle-ratings.js";

const SVGNS = "http://www.w3.org/2000/svg";

// See assets/analytics.js. Which axis pairs and presets people actually reach
// for is the only way to know whether these controls earn their complexity —
// a pill nobody presses is a pill to delete.
const track = (name, params) => {
  if (typeof window.pbaTrack === "function") window.pbaTrack(name, params);
};

// The 2c preset is synced to this query param so a shared results link
// reproduces the lens the sharer was looking at (README "State Management").
const PRESET_PARAM = "preset";

// One accent per featured paddle, keyed by rank. These are the site's three
// real accents (teal / clay / olive) in their text-safe variants, so the same
// value can serve as dot fill, ring stroke, label text and bar fill without
// failing contrast (bare --poppy/--optic do). Halo rings use the 16%-alpha
// tint of the same rgb.
const SERIES = [
  { solid: "#1e6e66", rgb: "30,110,102" },  // --bay
  { solid: "#9c4322", rgb: "156,67,34" },   // --poppy-deep
  { solid: "#56621a", rgb: "86,98,26" },    // --kitchen
];
const haloFill = (s) => `rgba(${s.rgb},0.16)`;

// Shared with paddle-quiz.js's buy cards so paddle #1's teal card matches its
// teal dot on every chart. Falls back to the first accent past rank 3.
export function seriesColorFor(rank0) {
  return (SERIES[rank0] || SERIES[0]).solid;
}

// The four trait ratings, in the order they read across every chart. `get`
// returns the 0–1 rating; charts scale to 0–100 for display.
const RATINGS = {
  power: { label: "Power", short: "PWR", get: (p) => powerRating(p) },
  spin: { label: "Spin", short: "SPN", get: (p) => spinRatingOf(p) },
  control: { label: "Control", short: "CTL", get: (p) => controlRating(p) },
  forgiveness: { label: "Forgiveness", short: "FGV", get: (p) => forgivenessRatingOf(p) },
};
// 2a's axis pills: the four ratings plus price. (The prototype listed "Hand
// speed" too — no such field exists here, so it is not offered.)
const AXIS_KEYS = ["power", "spin", "control", "forgiveness", "price"];

// All dynamic text is written via textContent (never innerHTML), so paddle
// names and brands need no escaping here — the DOM API handles it.
const fmtPrice = (n) => "$" + (Number.isInteger(n) ? n : n.toFixed(2));
const fmtScore = (n) => n.toFixed(1);

function svg(tag, attrs) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}
function h(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
// An absolutely-positioned overlay label placed by PERCENT of the SVG box, so
// it tracks the responsive <svg width:100%> with no resize handler — exactly
// how the prototype positions every tick and data label.
function ovLabel(vbW, vbH) {
  return (xPx, yPx, anchor, text, color, cls) => {
    const d = h("div", "pc-ov-label" + (cls ? " " + cls : ""));
    d.style.left = ((xPx / vbW) * 100).toFixed(2) + "%";
    d.style.top = ((yPx / vbH) * 100).toFixed(2) + "%";
    d.style.transform = anchor === "middle" ? "translate(-50%,-50%)" : anchor === "start" ? "translate(0,-50%)" : "translate(-100%,-50%)";
    if (color) d.style.color = color;
    d.textContent = text;
    return d;
  };
}

// "Nice" tick list for a value domain — used for the price axis, whose range
// comes from the real catalog rather than a fixed 0–100.
function ticksFor(min, max, step) {
  const out = [];
  for (let v = Math.ceil(min / step) * step; v <= max - step / 2; v += step) out.push(v);
  return out;
}

// A 1/2/5/10-style step that lands ~`target` ticks across a range. The value
// chart's y-axis is a fixed 0–100 in "catalog average" mode but a raw quiz
// score in "fit for you" mode, whose range depends entirely on the answers —
// so the old hardcoded step of 10 could produce two ticks or forty.
function niceStep(range, target = 6) {
  if (!(range > 0)) return 1;
  const rough = range / target;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  return (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
}

// Spread coincident points a few pixels apart (overplotting "dodge"). Because
// the ratings are banded, several paddles can still land on one exact
// coordinate; without this a cluster reads as a single dot.
// Points are grouped by a coarse cell, then those in a shared cell are laid out
// on a golden-angle spiral around their shared centre — deterministic, so the
// same catalog always dodges the same way. It moves DISPLAY positions only; the
// underlying tier values are untouched, and lone dots never move.
function dodgeCloud(pts, cell = 4, maxR = 13) {
  const groups = new Map();
  for (let i = 0; i < pts.length; i++) {
    const key = Math.round(pts[i].x / cell) + "," + Math.round(pts[i].y / cell);
    let g = groups.get(key);
    if (!g) groups.set(key, (g = []));
    g.push(i);
  }
  const out = pts.map((p) => ({ x: p.x, y: p.y }));
  for (const idxs of groups.values()) {
    const n = idxs.length;
    if (n <= 1) continue;
    let cx = 0;
    let cy = 0;
    for (const i of idxs) {
      cx += pts[i].x;
      cy += pts[i].y;
    }
    cx /= n;
    cy /= n;
    const R = Math.min(maxR, 2.6 * Math.sqrt(n));
    idxs.forEach((i, k) => {
      const r = R * Math.sqrt((k + 0.5) / n);
      const theta = k * 2.399963229728653; // golden angle
      out[i].x = cx + r * Math.cos(theta);
      out[i].y = cy + r * Math.sin(theta);
    });
  }
  return out;
}

// ---------- Derived per-paddle model ----------

function derive(p) {
  const r = {
    power: clamp01(RATINGS.power.get(p)),
    spin: clamp01(RATINGS.spin.get(p)),
    control: clamp01(RATINGS.control.get(p)),
    forgiveness: clamp01(RATINGS.forgiveness.get(p)),
  };
  // Which of those four the catalog actually has evidence for. 137 of 486
  // paddles carry no spinRating and therefore sit at a flat 0.5 — fine for
  // ranking, a fabrication if drawn as a measurement. `known` lets the charts
  // draw them as unrated and keep them out of every "Nth of M" claim.
  const known = {
    power: ratingKnown(p, "power"),
    spin: ratingKnown(p, "spin"),
    control: ratingKnown(p, "control"),
    forgiveness: ratingKnown(p, "forgiveness"),
    price: true,
  };
  // Overall = the transparent mean of the four ratings, on 0–100. This is 2b's
  // y-axis and the breakdown cards' headline; deliberately a plain average so
  // the score explains itself (see README 2b).
  const overall = ((r.power + r.spin + r.control + r.forgiveness) / 4) * 100;
  // src keeps the original paddle so a clicked scatter dot can be handed back
  // to the browse page's compare tray with all its fields intact.
  return { id: p.id, name: p.name, brand: p.brand, price: p.price, r, known, overall, src: p };
}

// 1st, 2nd, 3rd… — spelled out because "Spin: 1 of 348" reads as a count.
function ordinal(n) {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return n + "th";
  return n + ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th");
}
const plural = (n, one, many) => (n === 1 ? one : many);

// ---------- 2c preset weighting ----------
//
// Five factors, all backed by real data: the four ratings plus "Value"
// (catalog-normalized cheapness). The prototype's fifth factor was
// "Durability", which this dataset has no field for — Value replaces it rather
// than fabricate a durability number. Each preset is a weight vector summing
// to 1; a paddle's total is Σ weightᵢ·scoreᵢ on 0–100, and the segments show
// exactly that decomposition.
// ---------- Quiz stress-test: "what if you'd answered differently?" ----------
//
// Each preset patches the visitor's real answers and re-scores the three picks
// with the QUIZ'S OWN model (opts.scoreWith → paddle-quiz.js scorePaddle), so:
//   - the baseline is their actual answers and therefore reproduces the podium
//     above it exactly, by construction rather than by coincidence;
//   - every other pill is a real, answerable counterfactual — "if you'd said
//     you were a power player" — rather than an abstract reweighting of traits.
//
// This replaced a parallel five-factor trait model whose scores could contradict
// the visitor outright: it counted forgiveness and cheapness as universal goods,
// so a precise low-twist paddle bought by someone who asked for precision, or a
// $280 paddle bought by someone who said price was no object, could not win.
// Measured over 1,500 answer sets, that model put the quiz's own #1 last 21% of
// the time and never-first 28% of the time, directly above the buy links.
const ANSWER_PRESETS = [
  { key: "answered", label: "As you answered", patch: null,
    note: "Your actual answers — the ranking you already have." },
  { key: "power", label: "Power first", patch: { style: "power", current: ["more_power"] },
    note: "As if pace were the whole game and nothing else counted." },
  { key: "spin", label: "Spin first", patch: { style: "spin", current: ["more_spin"] },
    note: "As if you only cared about how much the ball bites." },
  { key: "control", label: "Control & feel", patch: { style: "soft", current: ["more_forgiveness"] },
    note: "As if you lived at the kitchen line and wanted the biggest sweet spot." },
  { key: "value", label: "Budget first", patch: { budget: "under100" },
    note: "As if you'd capped yourself at $100 and let that decide." },
];

// The score's named terms, grouped into five stable buckets so the stacked bar
// keeps one legend across presets — the raw term list changes shape with the
// answers, which would otherwise re-label the legend on every pill.
const TERM_GROUPS = [
  { label: "What the paddle is", keys: ["traits"] },
  { label: "Your style", keys: ["style", "want_power", "want_spin", "want_sweet", "want_light", "want_arm"] },
  { label: "Fit & feel", keys: ["feel", "shape", "arm_forgive", "arm_feel", "arm_light"] },
  { label: "Your level", keys: ["skill", "frequency"] },
  { label: "Budget", keys: ["budget"] },
];

const C_FACTORS = [
  { key: "power", label: "Power & drive" },
  { key: "control", label: "Control & touch" },
  { key: "spin", label: "Spin & shaping" },
  { key: "forgiveness", label: "Forgiveness" },
  { key: "value", label: "Value" },
];
const SEG_SHADES = ["rgba(22,33,31,.92)", "rgba(22,33,31,.72)", "rgba(22,33,31,.54)", "rgba(22,33,31,.38)", "rgba(22,33,31,.24)"];

function normalize(w) {
  const s = w.reduce((a, b) => a + b, 0) || 1;
  return w.map((x) => x / s);
}

// The presets are HYPOTHETICALS, deliberately. There used to be a first preset
// called "As answered" that rebuilt the visitor's answers as a five-factor
// weight vector and captioned itself "This is the ranking your quiz produced" —
// but it dropped skill match, shape, weight fit, twist-weight fit, sensitivity
// and frequency, which is most of the real scorer. Simulated over 3,000 answer
// sets it contradicted the actual podium 71% of the time and displaced the real
// #1 pick 57% of the time, immediately above the buy links.
//
// The fix is not a better approximation. The real answer-weighted ranking is
// stated in one sentence under the pick cards (paddle-quiz.js fitScaleNote),
// straight from the scorer's own terms, so this component no longer has to
// imitate it and doesn't try. Its job
// is the honest one it was always good at: if you cared about something ELSE,
// would the podium hold? The baseline is therefore an even weighting, described
// as exactly that, and no preset here claims to be the quiz.
function buildPresets() {
  // order: [power, control, spin, forgiveness, value]
  const P = (arr) => normalize(arr);
  const presets = [];
  presets.push({
    key: "answered",
    label: "Balanced",
    weights: P([1, 1, 1, 1, 1]),
    note: "All five factors weighted evenly — the neutral baseline.",
  });
  presets.push({ key: "spin", label: "Spin first", weights: P([0.6, 0.5, 2.4, 0.6, 0.5]), note: "If spin were everything, the heaviest-biting paddle stretches its lead." });
  presets.push({ key: "control", label: "Control & feel", weights: P([0.5, 1.7, 0.5, 1.5, 0.6]), note: "Prioritize touch and a big sweet spot and the softer, more forgiving picks jump ahead." });
  presets.push({ key: "power", label: "Power first", weights: P([2.3, 0.6, 0.8, 0.6, 0.6]), note: "All-out power rewards the biggest drivers and reshuffles the podium toward them." });
  presets.push({ key: "value", label: "Budget first", weights: P([0.7, 0.7, 0.7, 0.7, 2.2]), note: "Dollars first: the cheapest strong paddle runs away with it." });
  return presets;
}

// ---------- Controller ----------

class PaddleCharts {
  constructor(root, catalog, featured, opts) {
    opts = opts || {};
    this.root = root;
    this.mode = opts.mode || "quiz";
    this.answers = opts.answers || null;
    this.onDotClick = opts.onDotClick || null;
    // Which components to render, in order. Quiz results pass ["value","stress"]
    // (the buy cards above replace the strip; the explorer lives on browse);
    // browse passes the full set, gated on how many paddles are selected.
    this.components = opts.components || ["strip", "explorer", "value", "stress"];
    // Featured (≤3, already rank-ordered). Give each its series accent.
    this.featured = featured.slice(0, 3).map((p, i) => ({ ...derive(p), color: SERIES[i], rank: i + 1 }));
    // The whole scored catalog, minus anything with no price (can't plot it).
    this.catalog = catalog.filter((p) => p.price != null).map(derive);

    // The quiz's own per-paddle fit scores (id -> score), when the quiz mounted
    // us. This is the visitor's definition of "performance", so the value chart
    // can plot price against what THEY asked for instead of a flat trait mean.
    // Absent on browse, where nobody has answered anything.
    this.fitScores = opts.fitScores || null;
    // Raw scores are placed on 0–100 against the range the visitor's answers
    // actually produced (paddle-quiz.js fitOutOf100). Monotonic, so the
    // ordering, the Pareto frontier and the cheaper-equivalent search are all
    // unchanged — it only makes the axis readable and match the pick cards.
    this.fitScale = opts.fitScale || null;
    if (this.fitScores) {
      const span = this.fitScale ? this.fitScale.max - this.fitScale.min : 0;
      const norm = (raw) => {
        if (typeof raw !== "number") return undefined;
        if (!this.fitScale || span <= 0) return 100;
        return ((raw - this.fitScale.min) / span) * 100;
      };
      for (const d of [...this.catalog, ...this.featured]) d.fit = norm(this.fitScores.get(d.id));
      // A paddle the quiz never scored (filtered out by a tournament-legal
      // answer) has no fit and is dropped from fit-scored views rather than
      // plotted at zero, which would read as "terrible for you" instead of
      // "excluded by your own answer".
      this.fitCatalog = this.catalog.filter((d) => typeof d.fit === "number");
    }
    // Per-pick score terms from the real quiz scorer, aligned to `featured`.

    // What set the dots represent, in words — "matching your filters" on browse
    // once the grid is narrowed, null when the plot is the whole catalog. Every
    // "Nth of M" claim and the dot legend carry it, so a rank can't be read as
    // catalog-wide when it is only within a filter.
    this.scopeLabel = opts.scopeLabel || null;

    // The browse chart now follows the grid's filters, so the plotted set can be
    // small or empty. Math.min of nothing is Infinity, which would poison the
    // axis domain and render an invisible chart rather than an obviously broken
    // one — guard, and give a degenerate range (one paddle, or several at one
    // price) enough width to draw.
    const prices = this.catalog.map((d) => d.price);
    this.priceMin = prices.length ? Math.min(...prices) : 0;
    this.priceMax = prices.length ? Math.max(...prices) : 0;
    if (this.priceMax - this.priceMin < 20) this.priceMax = this.priceMin + 20;
    // Price axis domain fit to real data, padded to round bounds.
    this.priceDom = [Math.floor((this.priceMin - 10) / 20) * 20, Math.ceil((this.priceMax + 10) / 20) * 20];

    // Value factor for 2c: catalog-normalized cheapness (cheaper → higher).
    const span = this.priceMax - this.priceMin || 1;
    for (const d of [...this.catalog, ...this.featured]) d.r.value = clamp01((this.priceMax - d.price) / span);

    // Two stress-tests, because the two surfaces have different truths to tell.
    // The quiz has real answers, so it re-scores under altered answers with the
    // real model. Browse has none — there is no ranking to contradict there —
    // so it keeps the trait-weight lens, which is honest in that context.
    this.scoreWith = opts.scoreWith || null;
    this.answerStress = Boolean(this.scoreWith && this.answers);
    this.presets = this.answerStress ? ANSWER_PRESETS : buildPresets();
    // Initial view state — an explicit initialState (browse passes the previous
    // instance's, so rebuilding on a selection change doesn't reset the axes)
    // wins, then a valid ?preset=, then the defaults.
    const init = opts.initialState || {};
    let xKey = AXIS_KEYS.includes(init.xKey) ? init.xKey : "power";
    let yKey = AXIS_KEYS.includes(init.yKey) ? init.yKey : "control";
    if (xKey === yKey) yKey = xKey === "control" ? "power" : "control";
    const preset = init.preset && this.presets.some((p) => p.key === init.preset) ? init.preset : this.initialPreset();
    // Default the value chart to the visitor's own fit score wherever we have
    // it — that's the question they asked. Browse falls back to the average.
    const wantMode = init.scoreMode === "overall" || init.scoreMode === "fit" ? init.scoreMode : this.canScoreByFit() ? "fit" : "overall";
    const scoreMode = this.canScoreByFit() ? wantMode : "overall";
    // hovered/pinned feed focusPaddle(), which falls back to the top pick —
    // there is no separate "focus" field to drift out of sync with them.
    this.state = { xKey, yKey, preset, scoreMode, hovered: null, pinned: null };
  }

  // Initial 2c preset: an explicit, known ?preset= wins; otherwise the default
  // (index 0). An unknown value is ignored rather than trusted, so a
  // hand-edited URL can't put the component into a state with no matching pill.
  initialPreset() {
    try {
      const key = new URLSearchParams(window.location.search).get(PRESET_PARAM);
      if (key && this.presets.some((p) => p.key === key)) return key;
    } catch (e) {
      /* no URL access (e.g. sandboxed) — fall through to the default */
    }
    return this.presets[0].key;
  }

  mount() {
    this.root.classList.add("pc-root");
    const builders = {
      strip: () => this.buildStrip(),
      explorer: () => this.buildExplorer(),
      value: () => this.buildValue(),
      stress: () => this.buildStressTest(),
    };
    for (const key of this.components) {
      const build = builders[key];
      if (build) this.root.appendChild(build());
    }
  }

  factorValue(d, key) {
    return key === "price" ? d.price : d.r[key] * 100;
  }

  // Domain + ticks + label formatter for a given axis key.
  axisScale(key) {
    if (key === "price") {
      return { dom: this.priceDom, ticks: ticksFor(this.priceDom[0], this.priceDom[1], 50), fmt: (v) => "$" + v };
    }
    return { dom: [0, 100], ticks: [0, 20, 40, 60, 80, 100], fmt: (v) => "" + v };
  }

  // ---------- "Is this the best?" — rank, ties, and domination ----------
  //
  // The scatter can show you WHERE a paddle sits; it can't tell you whether
  // that's good. These do, and they have to be honest about ties to be worth
  // anything: the ratings are banded (the licensing firewall — see the header),
  // so paddles still share values and a bare "1st of 348" can imply a
  // uniqueness the data does not support. Saying "tied with N others" turns a
  // flattering non-fact into the useful one: where the tie is wide you cannot
  // differentiate on this axis, so decide on something else. Ties are far
  // narrower since the 2026-07-18 refresh widened four tiers to twenty bands,
  // which is exactly why the count is worth printing rather than assuming.

  // Is a better than b on `key`? Cheaper wins on price; higher wins on ratings.
  betterOn(a, b, key) {
    return key === "price" ? a.price < b.price : this.factorValue(a, key) > this.factorValue(b, key);
  }
  atLeastOn(a, b, key) {
    return key === "price" ? a.price <= b.price : this.factorValue(a, key) >= this.factorValue(b, key);
  }

  // Rank among paddles the catalog actually rates on this axis. Returns null
  // for an unrated paddle — it has no place in the ordering, so it gets no
  // claim rather than a fabricated one.
  rankOf(d, key) {
    if (!d.known[key]) return null;
    const pool = this.catalog.filter((o) => o.known[key]);
    const v = this.factorValue(d, key);
    let better = 0;
    let tied = 0;
    for (const o of pool) {
      const ov = this.factorValue(o, key);
      if (key === "price" ? ov < v : ov > v) better++;
      else if (ov === v) tied++;
    }
    return { rank: better + 1, tied, total: pool.length };
  }

  rankLabel(d, key) {
    const label = key === "price" ? "Price" : RATINGS[key].label;
    const r = this.rankOf(d, key);
    if (!r) return `${label}: not rated in this catalog`;
    // The scope suffix is load-bearing once browse filters the plot: "3rd of
    // 39" reads as a catalog-wide rank unless it says which 39.
    const head = `${label}: ${ordinal(r.rank)} of ${r.total}${this.scopeLabel ? " " + this.scopeLabel : ""}`;
    // tied counts the paddle itself, so subtract it to describe the others.
    const others = r.tied - 1;
    return others > 0 ? `${head} — tied with ${others} ${plural(others, "other", "others")}` : head;
  }

  // Every paddle at least as good on BOTH axes and strictly better on one —
  // the direct answer to "does this give me the best X and Y?". An empty list
  // means nothing in 486 paddles beats it on both, which is the strongest
  // claim this data can make and the one worth putting on screen.
  dominators(d, xKey, yKey) {
    return this.catalog.filter(
      (o) =>
        o.id !== d.id &&
        o.known[xKey] &&
        o.known[yKey] &&
        this.atLeastOn(o, d, xKey) &&
        this.atLeastOn(o, d, yKey) &&
        (this.betterOn(o, d, xKey) || this.betterOn(o, d, yKey))
    );
  }

  // ===================== Top 3 strip =====================
  buildStrip() {
    const card = h("section", "pc-card pc-strip");
    const lead = h("div", "pc-strip-lead");
    lead.appendChild(h("span", "pc-eyebrow", this.mode === "quiz" ? "Matched to you" : "Comparing"));
    lead.appendChild(h("span", "pc-strip-leadtitle", this.mode === "quiz" ? "Your top 3" : `Your picks (${this.featured.length})`));
    card.appendChild(lead);

    for (const f of this.featured) {
      const item = h("div", "pc-strip-item");
      const roundel = h("span", "pc-roundel", String(f.rank));
      const bar = h("span", "pc-strip-bar");
      bar.style.background = f.color.solid;
      const meta = h("div", "pc-strip-meta");
      meta.appendChild(h("span", "pc-strip-name", f.name));
      meta.appendChild(h("span", "pc-strip-sub", `${f.brand} · ${fmtPrice(f.price)} list`));
      const score = h("div", "pc-strip-score");
      const num = h("span", "pc-strip-num", fmtScore(f.overall));
      num.style.color = f.color.solid;
      score.appendChild(num);
      score.appendChild(h("span", "pc-strip-scorelabel", "overall"));
      item.append(roundel, bar, meta, score);
      card.appendChild(item);
    }
    return card;
  }

  // ===================== 2a — Catalog explorer =====================
  buildExplorer() {
    const card = h("section", "pc-card");
    const head = h("div", "pc-head");
    const titles = h("div", "pc-titles");
    titles.appendChild(h("p", "pc-eyebrow", "Explore any tradeoff"));
    titles.appendChild(h("h3", "pc-title", "Pick your axes"));
    titles.appendChild(
      h("p", "pc-explain", `${this.scopeLabel ? "The paddles matching your filters" : "The whole catalog"}, on whichever tradeoff you care about. Tap any dot to see where it ranks on both axes — and what, if anything, beats it on both.`)
    );
    head.appendChild(titles);

    const pickers = h("div", "pc-axis-pickers");
    this.xPills = this.axisPillRow("X", "xKey");
    this.yPills = this.axisPillRow("Y", "yKey");
    pickers.append(this.xPills.row, this.yPills.row);
    head.appendChild(pickers);
    card.appendChild(head);

    const plot = h("div", "pc-plot");
    const s = svg("svg", { viewBox: "0 0 860 520", class: "pc-svg pc-svg--interactive" });
    this.exSvg = s;
    this.exGrid = svg("g", {});
    this.exCloudG = svg("g", { class: "pc-cloud" });
    this.exPickG = svg("g", {});
    s.append(this.exGrid, this.exCloudG, this.exPickG);

    // Cloud: one dot per catalog paddle. Built once; repositioned on axis
    // change. Dots carry NO listeners of their own — see hitTest: a 3px target
    // inside a 43-paddle dodged cluster is not a target, it's a coin flip, and
    // on a touch screen mouseenter never fires at all. One handler on the SVG
    // picks the nearest dot within a generous radius instead, which works the
    // same for a mouse, a finger and a stylus.
    this.exCloud = this.catalog.map((d) => {
      const c = svg("circle", { r: "2.6", class: "pc-dot" });
      this.exCloudG.appendChild(c);
      return { d, el: c };
    });
    // Featured: halo ring + solid centre.
    this.exPicks = this.featured.map((f) => {
      const ring = svg("circle", { r: "15", class: "pc-pick-ring", fill: haloFill(f.color), stroke: f.color.solid, "stroke-width": "2.5" });
      const dot = svg("circle", { r: "4", class: "pc-pick-dot", fill: f.color.solid });
      this.exPickG.append(ring, dot);
      return { f, ring, dot };
    });
    // Ring drawn around whatever the readout is currently describing.
    this.exFocusRing = svg("circle", { r: "10", class: "pc-focus-ring", style: "display:none" });
    s.appendChild(this.exFocusRing);

    s.addEventListener("pointermove", (e) => this.hitTest(e, false));
    s.addEventListener("pointerleave", () => this.clearHover());
    s.addEventListener("click", (e) => this.hitTest(e, true));
    plot.appendChild(s);

    this.exOv = h("div", "pc-ov");
    plot.appendChild(this.exOv);
    this.exXTitle = h("div", "pc-ov-label pc-axis-title");
    this.exYTitle = h("div", "pc-ov-label pc-axis-title");
    this.exOv.append(this.exXTitle, this.exYTitle);
    this.exPickLabels = this.featured.map((f) => {
      const l = h("div", "pc-ov-label pc-pick-label", f.name);
      l.style.color = f.color.solid;
      this.exOv.appendChild(l);
      return l;
    });
    card.appendChild(plot);

    // The readout replaces the old floating tooltip. A tooltip could only ever
    // say where a dot sits; the question is whether that's any good, which
    // needs room for two rank lines and a verdict. It also survives touch,
    // which a hover tooltip never did.
    this.exReadout = h("div", "pc-readout");
    this.exReadout.setAttribute("role", "status");
    card.appendChild(this.exReadout);

    this.exNote = h("p", "pc-note");
    card.appendChild(this.exNote);

    this.updateExplorer();
    return card;
  }

  // ---------- focus: which paddle the readout describes ----------

  // Pointer position -> nearest plotted dot, in viewBox units. Generous radius
  // (18 units ~ a fingertip at mobile widths) so the 3px dots are reachable.
  hitTest(e, pin) {
    if (!this.exPositions || !this.exPositions.length) return;
    const rect = this.exSvg.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const vx = ((e.clientX - rect.left) / rect.width) * 860;
    const vy = ((e.clientY - rect.top) / rect.height) * 520;
    let best = null;
    let bestDist = Infinity;
    for (const p of this.exPositions) {
      const dx = p.x - vx;
      const dy = p.y - vy;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        bestDist = dist;
        best = p;
      }
    }
    if (!best || bestDist > 18 * 18) {
      if (!pin) this.clearHover();
      return;
    }
    if (pin) {
      this.state.pinned = best.d;
      track("chart_inspect", { mode: this.mode, paddle: best.d.id, x: this.state.xKey, y: this.state.yKey });
    }
    this.state.hovered = best.d;
    this.renderReadout();
  }

  clearHover() {
    this.state.hovered = null;
    this.renderReadout();
  }

  // Pinned (tapped) wins over hovered wins over the top pick — so the panel
  // always describes something rather than going blank.
  focusPaddle() {
    return this.state.hovered || this.state.pinned || this.featured[0] || null;
  }

  axisPillRow(label, stateKey) {
    const row = h("div", "pc-axis-row");
    row.appendChild(h("span", "pc-axis-label", label));
    const group = h("div", "pc-pillgroup");
    const pills = {};
    for (const key of AXIS_KEYS) {
      const b = h("button", "pc-pill", RATINGS[key] ? RATINGS[key].label : "Price");
      b.type = "button";
      b.addEventListener("click", () => this.setAxis(stateKey, key));
      group.appendChild(b);
      pills[key] = b;
    }
    row.appendChild(group);
    return { row, pills };
  }

  // Selecting the factor already on the other axis swaps them (never X == Y).
  setAxis(stateKey, key) {
    const other = stateKey === "xKey" ? "yKey" : "xKey";
    if (this.state[stateKey] === key) return;
    if (this.state[other] === key) this.state[other] = this.state[stateKey];
    this.state[stateKey] = key;
    this.updateExplorer();
    track("chart_axis", { mode: this.mode, x: this.state.xKey, y: this.state.yKey });
  }

  updateExplorer() {
    const { xKey, yKey } = this.state;
    const sx = this.axisScale(xKey);
    const sy = this.axisScale(yKey);
    const X = (v) => 60 + ((v - sx.dom[0]) / (sx.dom[1] - sx.dom[0])) * 740;
    const Y = (v) => 470 - ((v - sy.dom[0]) / (sy.dom[1] - sy.dom[0])) * 430;

    for (const key of AXIS_KEYS) {
      this.xPills.pills[key].classList.toggle("is-active", xKey === key);
      this.yPills.pills[key].classList.toggle("is-active", yKey === key);
    }

    // Gridlines snap (no animation); tick labels rebuilt alongside.
    this.exGrid.replaceChildren();
    for (const t of sx.ticks) this.exGrid.appendChild(svg("line", { x1: X(t), y1: 40, x2: X(t), y2: 470, class: "pc-grid-line" }));
    for (const t of sy.ticks) this.exGrid.appendChild(svg("line", { x1: 60, y1: Y(t), x2: 800, y2: Y(t), class: "pc-grid-line" }));

    this.exOv.querySelectorAll(".pc-tick").forEach((n) => n.remove());
    const ov = ovLabel(860, 520);
    for (const t of sx.ticks) this.exOv.appendChild(this.tickLabel(ov(X(t), 487, "middle", sx.fmt(t))));
    for (const t of sy.ticks) this.exOv.appendChild(this.tickLabel(ov(48, Y(t), "end", sy.fmt(t))));

    this.placeOv(this.exXTitle, 800, 500, "end", 860, 520);
    this.exXTitle.textContent = (xKey === "price" ? "Price" : RATINGS[xKey].label) + " →";
    this.placeOv(this.exYTitle, 14, 26, "start", 860, 520);
    this.exYTitle.textContent = (yKey === "price" ? "Price" : RATINGS[yKey].label) + " ↑";

    // A paddle the catalog doesn't rate on a chosen axis is HIDDEN rather than
    // drawn at the mid-value its rating function falls back to. 137 paddles
    // carry no spinRating; plotting them at "spin 50" would put a fabricated
    // measurement on screen and, worse, bury the real mid-spin paddles inside a
    // cluster of paddles that were never measured at all. The note below says
    // how many dropped out and why, so the missing dots are a disclosure
    // instead of a silent filter.
    const plotted = [];
    this.exPositions = [];
    const raw = this.exCloud.map(({ d }) => ({ x: X(this.factorValue(d, xKey)), y: Y(this.factorValue(d, yKey)) }));
    const dd = dodgeCloud(raw);
    this.exCloud.forEach(({ d, el }, i) => {
      if (!d.known[xKey] || !d.known[yKey]) {
        el.style.display = "none";
        return;
      }
      el.style.display = "";
      el.setAttribute("cx", dd[i].x.toFixed(1));
      el.setAttribute("cy", dd[i].y.toFixed(1));
      plotted.push(d);
      this.exPositions.push({ d, x: dd[i].x, y: dd[i].y });
    });
    this.exPlottedCount = plotted.length;
    // Featured stay at their TRUE (un-dodged) position, so the highlight marks
    // the real coordinate the cluster sits on.
    const off = [[24, 4, "start"], [-24, -12, "end"], [-24, 18, "end"]];
    this.exPicks.forEach(({ f, ring, dot }, i) => {
      const shown = f.known[xKey] && f.known[yKey];
      ring.style.display = dot.style.display = shown ? "" : "none";
      this.exPickLabels[i].style.display = shown ? "" : "none";
      if (!shown) return;
      const cx = X(this.factorValue(f, xKey));
      const cy = Y(this.factorValue(f, yKey));
      ring.setAttribute("cx", cx.toFixed(1));
      ring.setAttribute("cy", cy.toFixed(1));
      dot.setAttribute("cx", cx.toFixed(1));
      dot.setAttribute("cy", cy.toFixed(1));
      const o = off[i] || off[0];
      this.placeOv(this.exPickLabels[i], cx + o[0], cy + o[1], o[2], 860, 520);
      this.exPositions.push({ d: f, x: cx, y: cy });
    });

    const dropped = this.catalog.length - this.exPlottedCount;
    // Name every axis with gaps, not just the first — picking power against
    // spin drops paddles for two different reasons and blaming one of them
    // would be wrong about the other.
    const gaps = [xKey, yKey]
      .filter((k, i, arr) => arr.indexOf(k) === i && !this.catalog.every((d) => d.known[k]))
      .map((k) => (RATINGS[k] ? RATINGS[k].label.toLowerCase() : "price"));
    this.exNote.textContent = dropped
      ? `${this.exPlottedCount} of ${this.catalog.length} paddles plotted — the other ${dropped} carry no ${gaps.join(" or ")} rating in this catalog, so they're left out rather than drawn at a made-up middle value.`
      : `All ${this.exPlottedCount} paddles ${this.scopeLabel || "in the catalog"} are plotted. Dots are nudged apart where several share the same tier — position is a tier, not a measurement.`;

    this.renderReadout();
  }

  // ---------- the readout: "is this actually the best?" ----------
  renderReadout() {
    if (!this.exReadout) return;
    const { xKey, yKey } = this.state;
    const d = this.focusPaddle();
    this.exReadout.replaceChildren();

    if (!d) {
      this.exReadout.appendChild(h("p", "pc-readout-empty", "Tap any dot to see how that paddle ranks on both axes."));
      this.exFocusRing.style.display = "none";
      return;
    }

    // Move the focus ring onto whatever we're describing — but only when that
    // paddle is actually on screen for the current axes.
    const onPlot = d.known[xKey] && d.known[yKey];
    if (onPlot) {
      const pos = this.exPositions.find((p) => p.d.id === d.id);
      if (pos) {
        this.exFocusRing.setAttribute("cx", pos.x.toFixed(1));
        this.exFocusRing.setAttribute("cy", pos.y.toFixed(1));
        this.exFocusRing.style.display = "";
      } else this.exFocusRing.style.display = "none";
    } else this.exFocusRing.style.display = "none";

    const head = h("div", "pc-readout-head");
    const sw = h("span", "pc-readout-swatch");
    const feat = this.featured.find((f) => f.id === d.id);
    sw.style.background = feat ? feat.color.solid : "rgba(var(--ink-rgb),0.35)";
    head.append(sw, h("span", "pc-readout-name", `${d.brand} ${d.name}`), h("span", "pc-readout-price", `${fmtPrice(d.price)} list`));
    this.exReadout.appendChild(head);

    const ranks = h("div", "pc-readout-ranks");
    for (const key of [xKey, yKey]) ranks.appendChild(h("span", "pc-readout-rank", this.rankLabel(d, key)));
    this.exReadout.appendChild(ranks);

    // The verdict. This is the whole point of the panel.
    const verdict = h("p", "pc-readout-verdict");
    if (!onPlot) {
      verdict.textContent = "Not rated on both of these axes, so it can't be ranked against the rest here.";
      verdict.classList.add("is-neutral");
    } else {
      const dom = this.dominators(d, xKey, yKey);
      const cheaper = dom.filter((o) => o.price < d.price);
      const xL = (xKey === "price" ? "price" : RATINGS[xKey].label.toLowerCase());
      const yL = (yKey === "price" ? "price" : RATINGS[yKey].label.toLowerCase());
      if (!dom.length) {
        verdict.textContent = `Nothing ${this.scopeLabel || "in the catalog"} beats it on ${xL} and ${yL} together. On these two axes, this is as good as it gets.`;
        verdict.classList.add("is-good");
      } else {
        const n = dom.length;
        const base = `${n} ${plural(n, "paddle beats", "paddles beat")} it on ${xL} and ${yL} together`;
        verdict.textContent = cheaper.length
          ? `${base} — and ${cheaper.length} of those ${plural(cheaper.length, "costs", "cost")} less. Cheapest: ${cheaper.reduce((m, o) => (o.price < m.price ? o : m), cheaper[0]).name}.`
          : `${base}, but none of them for less money.`;
        verdict.classList.add(cheaper.length ? "is-warn" : "is-neutral");
      }
    }
    this.exReadout.appendChild(verdict);

    // Browse can act on what it's looking at. The button, not the dot, is the
    // compare control now — a tap that lands on one of 43 dodged dots in a
    // cluster should not silently commit a choice.
    if (this.mode === "browse" && this.onDotClick) {
      const inTray = this.featured.some((f) => f.id === d.id);
      const btn = h("button", "pc-readout-action" + (inTray ? " is-on" : ""), inTray ? "Remove from comparison" : "+ Add to comparison");
      btn.type = "button";
      btn.disabled = !inTray && this.featured.length >= 3;
      if (btn.disabled) btn.textContent = "Comparison is full (3)";
      btn.addEventListener("click", () => this.onDotClick(d.src));
      this.exReadout.appendChild(btn);
    }
  }

  tickLabel(node) {
    node.classList.add("pc-tick");
    return node;
  }
  placeOv(el, xPx, yPx, anchor, vbW, vbH) {
    el.style.left = ((xPx / vbW) * 100).toFixed(2) + "%";
    el.style.top = ((yPx / vbH) * 100).toFixed(2) + "%";
    el.style.transform = anchor === "middle" ? "translate(-50%,-50%)" : anchor === "start" ? "translate(0,-50%)" : "translate(-100%,-50%)";
  }

  // ===================== 2b — Price against performance =====================
  //
  // "What gives me the best performance for my money" is two questions: what
  // does the curve look like, and where do I get off it. The frontier answers
  // the first and used to be a dashed line with a whispered caption; it now
  // carries the headline, because the finding is genuinely strong — the curve
  // flattens well below the top of the price range, so the most expensive
  // paddles are not buying score. The "for less" callout answers the second.
  //
  // On the quiz results the y-axis is the visitor's OWN fit score, not the
  // catalog-wide trait average. A flat mean of four traits marks down exactly
  // the specialist a power player came for, so measuring "performance" that way
  // answers the money question with the wrong numerator.
  buildValue() {
    const card = h("section", "pc-card pc-value");
    card.appendChild(h("p", "pc-eyebrow", "What does each dollar buy?"));
    this.valueTitle = h("h3", "pc-title");
    card.appendChild(this.valueTitle);
    this.valueExplain = h("p", "pc-explain");
    card.appendChild(this.valueExplain);

    // Mode switch, only where there's a real second option: the quiz knows what
    // this visitor asked for, browse doesn't.
    if (this.canScoreByFit()) {
      const pills = h("div", "pc-pillgroup pc-value-modes");
      this.valuePills = {};
      for (const [key, label] of [["fit", "Fit for you"], ["overall", "Catalog average"]]) {
        const b = h("button", "pc-pill", label);
        b.type = "button";
        b.addEventListener("click", () => this.setScoreMode(key));
        pills.appendChild(b);
        this.valuePills[key] = b;
      }
      card.appendChild(pills);
    }

    this.valueBody = h("div", "pc-value-body");
    card.appendChild(this.valueBody);
    this.updateValue();
    return card;
  }

  // Fit scoring needs the quiz's scores AND enough scored paddles to plot.
  canScoreByFit() {
    return Boolean(this.fitCatalog && this.fitCatalog.length > 1);
  }
  valueScoreOf(d) {
    return this.state.scoreMode === "fit" ? d.fit : d.overall;
  }
  // Fit is quoted as a whole number on the pick cards, so quote it the same way
  // here — 93.75 showing as "94" above and "93.8" below is one paddle with two
  // scores as far as a reader is concerned.
  fmtValueScore(n) {
    return this.state.scoreMode === "fit" ? String(Math.round(n)) : fmtScore(n);
  }
  valueSet() {
    return this.state.scoreMode === "fit" ? this.fitCatalog : this.catalog;
  }

  setScoreMode(key) {
    if (this.state.scoreMode === key) return;
    this.state.scoreMode = key;
    this.updateValue();
    track("chart_score_mode", { mode: this.mode, score_mode: key });
  }

  updateValue() {
    const byFit = this.state.scoreMode === "fit";
    const set = this.valueSet();
    const scoreOf = (d) => this.valueScoreOf(d);
    const yLabel = byFit ? "Fit for you" : "Overall score";

    this.valueTitle.textContent = byFit ? "Price against fit for you" : "Price against overall score";
    this.valueExplain.textContent = byFit
      ? "Up and left is better. Height is your own fit score, so this is value measured against what you asked for."
      : "Up and left is better. Height is the plain average of the four ratings, which rates a specialist and an all-rounder alike.";
    if (this.valuePills) {
      for (const key in this.valuePills) this.valuePills[key].classList.toggle("is-active", this.state.scoreMode === key);
    }

    this.valueBody.replaceChildren();
    if (set.length < 2) return;

    const scores = set.map(scoreOf);
    const rawMin = Math.min(...scores);
    const rawMax = Math.max(...scores);
    const step = niceStep(rawMax - rawMin);
    const yMin = Math.floor(rawMin / step) * step;
    const yMax = Math.ceil(rawMax / step) * step;
    const xDom = this.priceDom;
    const X = (v) => 60 + ((v - xDom[0]) / (xDom[1] - xDom[0])) * 740;
    const Y = (v) => 380 - ((v - yMin) / (yMax - yMin || 1)) * 340;
    const xTicks = ticksFor(xDom[0], xDom[1], 50);
    const yTicks = ticksFor(yMin, yMax + step / 2, step);

    const plot = h("div", "pc-plot");
    const s = svg("svg", { viewBox: "0 0 860 430", class: "pc-svg" });
    const grid = svg("g", {});
    for (const t of xTicks) grid.appendChild(svg("line", { x1: X(t), y1: 40, x2: X(t), y2: 380, class: "pc-grid-line" }));
    for (const t of yTicks) grid.appendChild(svg("line", { x1: 60, y1: Y(t), x2: 800, y2: Y(t), class: "pc-grid-line" }));
    s.appendChild(grid);

    const front = this.frontier();
    // Draw the frontier as a STAIRCASE, not a diagonal. The diagonal implied
    // that a paddle existed at every price along it; the step is what the data
    // says — the score holds flat until some paddle actually beats it.
    if (front.length > 1) {
      const pts = [];
      front.forEach((d, i) => {
        if (i) pts.push(`${X(d.price).toFixed(1)},${Y(scoreOf(front[i - 1])).toFixed(1)}`);
        pts.push(`${X(d.price).toFixed(1)},${Y(scoreOf(d)).toFixed(1)}`);
      });
      const top = front[front.length - 1];
      pts.push(`${X(xDom[1]).toFixed(1)},${Y(scoreOf(top)).toFixed(1)}`);
      s.appendChild(svg("polyline", { points: pts.join(" "), class: "pc-frontier" }));
      // Everything right of the last frontier point is paying more for no more.
      s.appendChild(svg("rect", { x: X(top.price).toFixed(1), y: "40", width: Math.max(0, X(xDom[1]) - X(top.price)).toFixed(1), height: "340", class: "pc-deadzone" }));
    }

    // Catalog cloud (context), dodged, then frontier members, then featured.
    const cloudG = svg("g", { class: "pc-cloud" });
    const raw = set.map((d) => ({ x: X(d.price), y: Y(scoreOf(d)) }));
    const dd = dodgeCloud(raw);
    for (let i = 0; i < set.length; i++) cloudG.appendChild(svg("circle", { cx: dd[i].x.toFixed(1), cy: dd[i].y.toFixed(1), r: "2.3", class: "pc-dot" }));
    s.appendChild(cloudG);
    const frontG = svg("g", {});
    for (const d of front) frontG.appendChild(svg("circle", { cx: X(d.price).toFixed(1), cy: Y(scoreOf(d)).toFixed(1), r: "3.6", class: "pc-frontier-dot" }));
    s.appendChild(frontG);
    const pickG = svg("g", {});
    for (const f of this.featured) {
      if (byFit && typeof f.fit !== "number") continue;
      pickG.appendChild(svg("circle", { cx: X(f.price).toFixed(1), cy: Y(scoreOf(f)).toFixed(1), r: "11", fill: haloFill(f.color), stroke: f.color.solid, "stroke-width": "2.5" }));
      pickG.appendChild(svg("circle", { cx: X(f.price).toFixed(1), cy: Y(scoreOf(f)).toFixed(1), r: "4", fill: f.color.solid }));
    }
    s.appendChild(pickG);
    plot.appendChild(s);

    const ov = h("div", "pc-ov");
    const mk = ovLabel(860, 430);
    for (const t of xTicks) ov.appendChild(this.tickLabel(mk(X(t), 397, "middle", "$" + t)));
    for (const t of yTicks) ov.appendChild(this.tickLabel(mk(48, Y(t), "end", String(Math.round(t)))));
    ov.appendChild(mk(800, 410, "end", "Price →", null, "pc-axis-title"));
    ov.appendChild(mk(14, 26, "start", yLabel + " ↑", null, "pc-axis-title"));
    if (front.length > 1) {
      // Sits low in the dead zone, not at the top: the pick labels crowd the
      // upper band (the featured paddles are near the frontier by definition)
      // and the note collided with them.
      const top = front[front.length - 1];
      ov.appendChild(mk(X(top.price) + 10, 356, "start", byFit ? "nothing pricier fits you better" : "nothing pricier scores higher", null, "pc-frontier-note"));
    }
    this.featured.forEach((f, i) => {
      if (byFit && typeof f.fit !== "number") return;
      const dx = i === 0 ? 16 : -16;
      const dy = i === 1 ? -18 : 16;
      ov.appendChild(mk(X(f.price) + dx, Y(scoreOf(f)) + dy, i === 0 ? "start" : "end", f.name, f.color.solid, "pc-pick-label"));
    });
    plot.appendChild(ov);
    this.valueBody.appendChild(plot);

    // Say what a grey dot is. The explorer has always labelled its cloud; this
    // chart never did, and readers reported the dots as confusing out of
    // context — reasonably, since the frontier headline below argues FROM them
    // ("451 paddles cost more and none fits you better") without ever saying
    // what they are.
    const legend = h("p", "pc-note pc-dot-legend");
    legend.textContent = this.scopeLabel
      ? `Each grey dot is one of the ${set.length} paddles ${this.scopeLabel}. Your picks are ringed.`
      : `Each grey dot is one of the ${set.length} paddles scored for you. Your ${this.featured.length === 1 ? "pick is" : "picks are"} ringed.`;
    this.valueBody.appendChild(legend);

    this.valueBody.appendChild(this.frontierHeadline(front, set));
    const cheaper = this.cheaperEquivalent();
    if (cheaper) this.valueBody.appendChild(cheaper);
  }
  // A per-pick trait breakdown (four gauges + score + $/pt) used to sit here.
  // It repeated itself: across sampled answer sets, two of the three picks share
  // an identical four-trait profile 38% of the time — the picks are selected to
  // suit one set of answers, so they tend to be alike — which rendered two
  // side-by-side cards a reader cannot tell apart. Trait comparison is better
  // served by the explorer below, where any two traits can be put on the axes
  // and the whole catalog gives the numbers a scale.

  // "Past $X, nothing scores higher" — the single most useful sentence this
  // chart can produce, and previously not said anywhere.
  frontierHeadline(front, set) {
    const wrap = h("div", "pc-headline-wrap");
    const p = h("p", "pc-headline");
    if (front.length < 2) {
      p.textContent = `${set.length} paddles plotted.`;
      wrap.appendChild(p);
      return wrap;
    }
    const byFit = this.state.scoreMode === "fit";
    const top = front[front.length - 1];
    const above = set.filter((d) => d.price > top.price).length;
    const scope = this.scopeLabel ? ` ${this.scopeLabel}` : "";
    p.textContent = above
      ? `The curve stops at ${fmtPrice(top.price)}. ${above} ${plural(above, "paddle costs", "paddles cost")} more than ${top.name}${scope} and not one of them ${byFit ? "fits you better" : "scores higher"} — past that price you're buying something other than ${byFit ? "fit" : "score"}.`
      : `${top.name} at ${fmtPrice(top.price)} tops the curve, and nothing${scope || " in the catalog"} costs more.`;
    wrap.appendChild(p);
    // Your budget answer is one of the terms in your fit score, so a cheap
    // paddle is partly winning here because you asked for a cheap paddle. Say
    // so — an unqualified "nothing pricier fits you better" would be passing a
    // constraint the visitor set off as a discovery the data made.
    // Only when budget actually scored. "No budget" makes budgetScore null and
    // the term is dropped from the sum entirely (see paddle-quiz.js), so for
    // those visitors price is NOT steering the curve and saying it is would be
    // a caveat about a term they don't have.
    if (byFit && above && this.answers && this.answers.budget && this.answers.budget !== "nobudget") {
      wrap.appendChild(
        h("p", "pc-note", "Bear in mind your budget answer is itself one of the scored terms, so price is partly steering this curve. Switch to “Catalog average” to see the shape without it.")
      );
    }
    return wrap;
  }

  // "Same performance, less money" — for the top pick, the cheapest paddle that
  // matches or beats it. This is the question people actually came to ask, and
  // the honest answer is often yes.
  cheaperEquivalent() {
    const f = this.featured[0];
    if (!f) return null;
    const byFit = this.state.scoreMode === "fit";
    if (byFit && typeof f.fit !== "number") return null;
    const target = this.valueScoreOf(f);
    const cheaper = this.valueSet().filter((d) => d.id !== f.id && d.price < f.price && this.valueScoreOf(d) >= target);
    const box = h("div", "pc-alt");
    if (!cheaper.length) {
      box.classList.add("is-good");
      box.appendChild(h("p", "pc-alt-body", `Nothing cheaper than ${f.name} matches it${byFit ? " for you" : ""}. At ${fmtPrice(f.price)} it's the least you can pay for this much ${byFit ? "fit" : "score"}.`));
      return box;
    }
    const best = cheaper.reduce((m, d) => (d.price < m.price ? d : m), cheaper[0]);
    // Rounded before formatting: 169.99 - 109.99 is 60.000000000000014 in
    // binary floating point, which fmtPrice renders as "$60.00" instead of the
    // "$60" it gives every other whole-dollar figure on the page.
    const saving = Math.round((f.price - best.price) * 100) / 100;
    box.appendChild(h("p", "pc-alt-label", "Same performance, less money"));
    box.appendChild(
      h("p", "pc-alt-body",
        `${best.brand} ${best.name} at ${fmtPrice(best.price)} scores ${this.fmtValueScore(this.valueScoreOf(best))} against ${f.name}'s ${this.fmtValueScore(target)} — ${fmtPrice(saving)} less. ${cheaper.length - 1 > 0 ? `${cheaper.length - 1} other ${plural(cheaper.length - 1, "paddle does", "paddles do")} the same.` : ""}`.trim())
    );
    // The "treat this as a tie, not a win" caveat that used to sit here is now
    // said better under the pick cards, with the actual scores (paddle-quiz.js
    // fitScaleNote) — and since the podium breaks ties on price, a cheaper
    // equal is already promoted rather than merely noted.
    return box;
  }

  frontier() {
    const sorted = [...this.valueSet()].sort((a, b) => a.price - b.price || this.valueScoreOf(b) - this.valueScoreOf(a));
    const out = [];
    let best = -Infinity;
    for (const d of sorted) {
      const v = this.valueScoreOf(d);
      if (v > best) {
        out.push(d);
        best = v;
      }
    }
    return out;
  }

  // ===================== 2c — Match stress-test =====================
  buildStressTest() {
    const card = h("section", "pc-card pc-stress");
    card.appendChild(h("p", "pc-eyebrow", this.mode === "quiz" ? "How solid is your #1?" : "How solid is the ranking?"));
    card.appendChild(h("h3", "pc-title", this.mode === "quiz" ? "Stress-test your match" : "Stress-test the ranking"));
    card.appendChild(
      h("p", "pc-explain", this.answerStress
        ? "Each pill re-runs the quiz as if you'd answered differently. The discs keep your ranking, so watch the rows move."
        : "Each pill is a what-if, not your result. The discs keep your ranking, so watch the rows move.")
    );

    const pills = h("div", "pc-pillgroup pc-preset-group");
    this.presetPills = {};
    for (const p of this.presets) {
      const b = h("button", "pc-pill", p.label);
      b.type = "button";
      b.addEventListener("click", () => this.setPreset(p.key));
      pills.appendChild(b);
      this.presetPills[p.key] = b;
    }
    card.appendChild(pills);
    this.presetNote = h("p", "pc-explain pc-preset-note");
    card.appendChild(this.presetNote);

    const rows = h("div", "pc-rows");
    rows.style.height = Math.max(0, this.featured.length * 70 - 14) + "px";
    this.stressRows = this.featured.map((f) => {
      const row = h("div", "pc-row");
      // The disc carries the paddle's rank FROM THE RESULTS and never changes.
      // It used to be renumbered to the row's position under the current
      // preset, which meant the neutral "Balanced" view could label a different
      // paddle "1" than the pick cards did, directly under a heading asking
      // "how solid is your #1?" — the card contradicted the page it was
      // explaining. Fixed identity plus a moving row is also just a better
      // stress test: seeing disc 1 slide to the bottom is the answer.
      const roundel = h("span", "pc-roundel pc-roundel--sm", String(f.rank));
      roundel.title = `#${f.rank} in your results`;
      const meta = h("div", "pc-row-meta");
      const name = h("span", "pc-row-name", f.name);
      name.style.color = f.color.solid;
      meta.appendChild(name);
      meta.appendChild(h("span", "pc-row-brand", f.brand));
      const track = h("div", "pc-row-track");
      const segs = this.stressFactors().map((_, i) => {
        const seg = h("div", "pc-seg");
        seg.style.background = SEG_SHADES[i];
        track.appendChild(seg);
        return seg;
      });
      const total = h("div", "pc-row-total");
      row.append(roundel, meta, track, total);
      rows.appendChild(row);
      return { f, row, roundel, segs, total };
    });
    card.appendChild(rows);

    const legend = h("div", "pc-legend");
    this.stressFactors().forEach((factor, i) => {
      const item = h("span", "pc-legend-item");
      const sw = h("span", "pc-legend-swatch");
      sw.style.background = SEG_SHADES[i];
      item.appendChild(sw);
      item.appendChild(document.createTextNode(factor.label));
      legend.appendChild(item);
    });
    card.appendChild(legend);
    // Replaces a static "if the podium barely moves, the recommendation is
    // robust" note that restated the heading and told the visitor nothing about
    // their own result. This says what actually happened.
    this.stressVerdict = h("p", "pc-note");
    card.appendChild(this.stressVerdict);

    this.updateStress();
    return card;
  }

  setPreset(key) {
    if (this.state.preset === key) return;
    this.state.preset = key;
    this.syncPresetToUrl(key);
    this.updateStress();
    track("chart_preset", { mode: this.mode, preset: key });
  }

  // Reflect the chosen preset in the URL with replaceState — never pushState,
  // so cycling presets doesn't stack history entries that hijack the Back
  // button. The default preset gets a clean URL (param removed) rather than a
  // pinned ?preset=answered on every share; any other query params and the
  // hash are preserved. URL sync is a nicety, so a failure is swallowed.
  syncPresetToUrl(key) {
    try {
      const params = new URLSearchParams(window.location.search);
      if (key === this.presets[0].key) params.delete(PRESET_PARAM);
      else params.set(PRESET_PARAM, key);
      const qs = params.toString();
      const url = window.location.pathname + (qs ? "?" + qs : "") + window.location.hash;
      window.history.replaceState(window.history.state, "", url);
    } catch (e) {
      /* history/URL unavailable — the chart still works, just no deep link */
    }
  }

  // Which five buckets the bar segments and legend represent — the quiz's own
  // score-term groups when we have answers, the trait factors otherwise.
  stressFactors() {
    return this.answerStress ? TERM_GROUPS : C_FACTORS;
  }

  // Re-run the REAL scorer with the visitor's answers patched by this preset.
  scoreByAnswers(preset) {
    const answers = preset.patch ? { ...this.answers, ...preset.patch } : this.answers;
    return this.stressRows.map((r) => {
      const { score, terms } = this.scoreWith(r.f.src, answers);
      const byKey = new Map(terms.map((t) => [t.key, t.points]));
      const contribs = TERM_GROUPS.map((g) => g.keys.reduce((sum, k) => sum + (byKey.get(k) || 0), 0));
      return { r, contribs, total: score };
    });
  }

  // The 0–100 scale for a preset, anchored on the best and worst scores any
  // paddle in the catalog gets under those answers.
  //
  // Without this the three bars read 100% / 99% / 98%: raw scores share a large
  // base (traits, skill match, feel) so three good picks differ by a couple of
  // points out of ~250, and dividing by the leader compresses them into a band
  // no eye can separate. Anchoring on the catalog spread is also what the pick
  // cards already do, so the "As you answered" column matches the fit numbers
  // above it rather than being a fourth scale on the page.
  stressScale(preset) {
    if (!preset.patch && this.fitScale) return this.fitScale; // cards' own scale
    this._stressScales = this._stressScales || {};
    if (this._stressScales[preset.key]) return this._stressScales[preset.key];
    const answers = { ...this.answers, ...preset.patch };
    let min = Infinity;
    let max = -Infinity;
    for (const d of this.catalog) {
      const s = this.scoreWith(d.src, answers).score;
      if (s < min) min = s;
      if (s > max) max = s;
    }
    // Computed once per preset and cached — 450-odd scorePaddle calls is fine
    // on a click, wasteful on every re-render.
    return (this._stressScales[preset.key] = { min, max });
  }

  // Browse's lens: no answers exist, so weight the four traits plus value.
  scoreByTraits(preset) {
    return this.stressRows.map((r) => {
      const contribs = C_FACTORS.map((factor, i) => preset.weights[i] * r.f.r[factor.key] * 100);
      return { r, contribs, total: contribs.reduce((a, b) => a + b, 0) };
    });
  }

  updateStress() {
    if (!this.stressRows.length) return;
    const preset = this.presets.find((p) => p.key === this.state.preset);
    for (const p of this.presets) this.presetPills[p.key].classList.toggle("is-active", p.key === preset.key);
    this.presetNote.textContent = preset.note;

    const scored = this.answerStress ? this.scoreByAnswers(preset) : this.scoreByTraits(preset);
    const order = [...scored].sort((a, b) => b.total - a.total);
    // Percentages are relative to the best of the three under this lens, so the
    // leader always reads 100%. The raw quiz score has no meaningful ceiling to
    // divide by — it moves with how many terms the answers put in play — and an
    // absolute number here would be one more scale the visitor can't reconcile
    // with the fit score on the cards.
    if (this.answerStress) {
      const scale = this.stressScale(preset);
      const span = scale.max - scale.min;
      for (const s of scored) s.pct = span > 0 ? clamp01((s.total - scale.min) / span) * 100 : 100;
    } else {
      // Trait lens (browse): scores are already 0–100-ish, relative to the best.
      const best = order.length ? order[0].total : 1;
      for (const s of scored) s.pct = best > 0 ? (s.total / best) * 100 : 0;
    }
    const factors = this.stressFactors();
    order.forEach((s, idx) => {
      s.r.row.style.top = idx * 70 + "px";
      s.r.total.textContent = Math.round(s.pct) + "%";
      // Segment widths are shares of THIS row's own total, scaled by how the row
      // compares to the leader — so a shorter bar means a lower score and the
      // segments still read as a breakdown of it.
      const sum = s.contribs.reduce((a, b) => a + Math.max(0, b), 0) || 1;
      s.contribs.forEach((c, i) => {
        s.r.segs[i].style.width = ((Math.max(0, c) / sum) * s.pct).toFixed(2) + "%";
        s.r.segs[i].title = `${factors[i].label}: ${Math.round(c)} pts`;
      });
    });

    // Where your top pick ended up under this lens — the question the card asks.
    const topRow = this.stressRows.find((r) => r.f.rank === 1);
    if (this.stressVerdict && topRow) {
      const pos = order.findIndex((s) => s.r === topRow) + 1;
      // Deliberately not "that's what it costs to care about this one thing" —
      // true of the four leaning presets, false of Balanced, which is an even
      // weighting. One sentence that holds for all five.
      this.stressVerdict.textContent = pos === 1
        ? `Your #1 (${topRow.f.name}) still leads here — it holds up even when the priorities change.`
        : `Here your #1 (${topRow.f.name}) slips to ${ordinal(pos)}. These five factors aren't what your answers weighed, so the podium moves.`;
    }
  }
}

export function renderPaddleCharts(root, opts) {
  const controller = new PaddleCharts(root, opts.paddles, opts.featured, opts);
  controller.mount();
  return controller;
}
