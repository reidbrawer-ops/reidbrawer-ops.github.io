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
// IMPORTANT — the scatter looks tiered on purpose. power/spin/control/
// forgiveness derive from percentiles that scripts/rebuild_paddle_data.py
// coarsens to four quartile bands (a data-licensing firewall — PickleballEffect's
// exact percentiles are proprietary; see PADDLE_DATA_SETUP.md). So many paddles
// share the same coordinates. dodgeCloud() spreads those exact overlaps a few
// pixels for legibility — it never changes a value, only nudges coincident dots
// apart so a cluster reads as a cluster instead of one dot.
//
// No framework — the chart DOM is built once and then MUTATED in place on
// axis/preset changes (never re-serialized), because the CSS transitions on
// dot position (2a) and bar re-sort (2c) are the components' delight moment
// and would not fire across an innerHTML swap. This mirrors the hand-rolled
// class style of the rest of this site (paddle-quiz.js, paddle-grid.js).

import { powerRating, controlRating, spinRatingOf, forgivenessRatingOf, clamp01 } from "/assets/paddle-ratings.js";

const SVGNS = "http://www.w3.org/2000/svg";

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
const RATING_KEYS = ["power", "spin", "control", "forgiveness"];
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

// Spread coincident points a few pixels apart (overplotting "dodge"). Because
// the ratings are coarsened to quartile tiers, dozens of paddles can land on
// one exact coordinate; without this a cluster of 40 reads as a single dot.
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
  // Overall = the transparent mean of the four ratings, on 0–100. This is 2b's
  // y-axis and the breakdown cards' headline; deliberately a plain average so
  // the score explains itself (see README 2b).
  const overall = ((r.power + r.spin + r.control + r.forgiveness) / 4) * 100;
  // src keeps the original paddle so a clicked scatter dot can be handed back
  // to the browse page's compare tray with all its fields intact.
  return { id: p.id, name: p.name, brand: p.brand, price: p.price, r, overall, src: p };
}

// ---------- 2c preset weighting ----------
//
// Five factors, all backed by real data: the four ratings plus "Value"
// (catalog-normalized cheapness). The prototype's fifth factor was
// "Durability", which this dataset has no field for — Value replaces it rather
// than fabricate a durability number. Each preset is a weight vector summing
// to 1; a paddle's total is Σ weightᵢ·scoreᵢ on 0–100, and the segments show
// exactly that decomposition.
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

// "As answered" (quiz) turns the visitor's real answers into a weight vector —
// the same signals the scorer in paddle-quiz.js leans on, expressed as
// priorities. Browse mode has no answers, so it falls back to "Balanced".
function answeredWeights(answers) {
  const w = { power: 1, control: 1, spin: 1, forgiveness: 1, value: 1 };
  if (!answers) return null;
  if (answers.style === "power") w.power += 2;
  else if (answers.style === "spin") w.spin += 2;
  else if (answers.style === "soft") w.control += 2;
  if (Array.isArray(answers.current)) {
    if (answers.current.includes("more_power")) w.power += 1;
    if (answers.current.includes("more_spin")) w.spin += 1;
    if (answers.current.includes("more_forgiveness")) w.forgiveness += 1;
    if (answers.current.includes("less_arm_strain")) w.forgiveness += 1;
  }
  if (answers.sensitivity === "sensitive") w.forgiveness += 1;
  if (answers.budget === "under100" || answers.budget === "100to200") w.value += 2;
  return normalize(C_FACTORS.map((f) => w[f.key]));
}

function buildPresets(answers) {
  // order: [power, control, spin, forgiveness, value]
  const P = (arr) => normalize(arr);
  const balanced = answeredWeights(answers) || P([1, 1, 1, 1, 1]);
  const presets = [];
  presets.push({
    key: "answered",
    label: answers ? "As answered" : "Balanced",
    weights: balanced,
    note: answers
      ? "Weighted the way you answered — your heaviest priorities count most. This is the ranking your quiz produced."
      : "An even weighting across all five factors — the neutral baseline before you lean it one way.",
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

    const prices = this.catalog.map((d) => d.price);
    this.priceMin = Math.min(...prices);
    this.priceMax = Math.max(...prices);
    // Price axis domain fit to real data, padded to round bounds.
    this.priceDom = [Math.floor((this.priceMin - 10) / 20) * 20, Math.ceil((this.priceMax + 10) / 20) * 20];

    // Value factor for 2c: catalog-normalized cheapness (cheaper → higher).
    const span = this.priceMax - this.priceMin || 1;
    for (const d of [...this.catalog, ...this.featured]) d.r.value = clamp01((this.priceMax - d.price) / span);

    this.presets = buildPresets(this.answers);
    // Initial view state — an explicit initialState (browse passes the previous
    // instance's, so rebuilding on a selection change doesn't reset the axes)
    // wins, then a valid ?preset=, then the defaults.
    const init = opts.initialState || {};
    let xKey = AXIS_KEYS.includes(init.xKey) ? init.xKey : "power";
    let yKey = AXIS_KEYS.includes(init.yKey) ? init.yKey : "control";
    if (xKey === yKey) yKey = xKey === "control" ? "power" : "control";
    const preset = init.preset && this.presets.some((p) => p.key === init.preset) ? init.preset : this.initialPreset();
    this.state = { xKey, yKey, preset, hovered: null };
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
      h("p", "pc-explain", this.mode === "browse"
        ? "The whole catalog, on whichever tradeoff you care about. Tap any dot to add it to your comparison; your picks stay highlighted."
        : "The whole catalog, on whichever tradeoff you care about. Your three matches stay highlighted.")
    );
    head.appendChild(titles);

    const pickers = h("div", "pc-axis-pickers");
    this.xPills = this.axisPillRow("X", "xKey");
    this.yPills = this.axisPillRow("Y", "yKey");
    pickers.append(this.xPills.row, this.yPills.row);
    head.appendChild(pickers);
    card.appendChild(head);

    const plot = h("div", "pc-plot");
    const s = svg("svg", { viewBox: "0 0 860 520", class: "pc-svg" });
    this.exGrid = svg("g", {});
    this.exCloudG = svg("g", { class: "pc-cloud" });
    this.exPickG = svg("g", {});
    s.append(this.exGrid, this.exCloudG, this.exPickG);

    // Cloud: one dot per catalog paddle. Built once; repositioned on axis
    // change. In browse the dots are hover-inspectable and click-to-add.
    const browse = this.mode === "browse";
    this.exCloud = this.catalog.map((d) => {
      const c = svg("circle", { r: browse ? "3" : "2.3", class: "pc-dot" + (browse ? " pc-dot--pick" : "") });
      if (browse) {
        c.addEventListener("mouseenter", () => this.showTip(d));
        c.addEventListener("mouseleave", () => this.hideTip());
        c.addEventListener("click", () => this.onDotClick && this.onDotClick(d.src));
      }
      this.exCloudG.appendChild(c);
      return { d, el: c };
    });
    // Featured: halo ring + solid centre, hover-tipped (and, in browse,
    // click to remove from the comparison).
    this.exPicks = this.featured.map((f) => {
      const ring = svg("circle", { r: "15", class: "pc-pick-ring", fill: haloFill(f.color), stroke: f.color.solid, "stroke-width": "2.5" });
      const dot = svg("circle", { r: "4", class: "pc-pick-dot", fill: f.color.solid });
      ring.addEventListener("mouseenter", () => this.showTip(f));
      ring.addEventListener("mouseleave", () => this.hideTip());
      if (browse) ring.addEventListener("click", () => this.onDotClick && this.onDotClick(f.src));
      this.exPickG.append(ring, dot);
      return { f, ring, dot };
    });
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
    this.exTip = h("div", "pc-tip");
    this.exTip.style.display = "none";
    this.exTip.append(h("div", "pc-tip-name"), h("div", "pc-tip-sub"));
    this.exOv.appendChild(this.exTip);
    card.appendChild(plot);

    this.exNote = h("p", "pc-note");
    card.appendChild(this.exNote);

    this.updateExplorer();
    return card;
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

    // Cloud reposition, with coincident dots dodged apart (see dodgeCloud).
    const raw = this.exCloud.map(({ d }) => ({ x: X(this.factorValue(d, xKey)), y: Y(this.factorValue(d, yKey)) }));
    const dd = dodgeCloud(raw);
    this.exCloud.forEach(({ el }, i) => {
      el.setAttribute("cx", dd[i].x.toFixed(1));
      el.setAttribute("cy", dd[i].y.toFixed(1));
    });
    // Featured stay at their TRUE (un-dodged) position, so the highlight marks
    // the real coordinate the cluster sits on.
    const off = [[24, 4, "start"], [-24, -12, "end"], [-24, 18, "end"]];
    this.exPicks.forEach(({ f, ring, dot }, i) => {
      const cx = X(this.factorValue(f, xKey));
      const cy = Y(this.factorValue(f, yKey));
      ring.setAttribute("cx", cx.toFixed(1));
      ring.setAttribute("cy", cy.toFixed(1));
      dot.setAttribute("cx", cx.toFixed(1));
      dot.setAttribute("cy", cy.toFixed(1));
      const o = off[i] || off[0];
      this.placeOv(this.exPickLabels[i], cx + o[0], cy + o[1], o[2], 860, 520);
    });
    if (this.state.hovered) this.positionTip();

    this.exNote.textContent = this.featured.length
      ? `${this.bestNote(xKey)} · ${this.bestNote(yKey)} — grey dots are the rest of the ${this.catalog.length} scored paddles.`
      : `Every grey dot is one of ${this.catalog.length} scored paddles. Tap one to start a comparison.`;
  }

  bestNote(key) {
    if (key === "price") {
      const b = this.featured.reduce((m, f) => (f.price < m.price ? f : m), this.featured[0]);
      return "Lowest price: " + b.name;
    }
    const b = this.featured.reduce((m, f) => (f.r[key] > m.r[key] ? f : m), this.featured[0]);
    return "Best " + RATINGS[key].label.toLowerCase() + ": " + b.name;
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

  // The tooltip works for any derived paddle — a featured pick or a plain
  // catalog dot in browse — so "tap a dot to see its values" and the featured
  // hover share one code path.
  showTip(d) {
    this.state.hovered = d;
    const { xKey, yKey } = this.state;
    const fmt = (k) => (k === "price" ? fmtPrice(d.price) : `${RATINGS[k].label} ${Math.round(d.r[k] * 100)}`);
    this.exTip.querySelector(".pc-tip-name").textContent = `${d.brand} ${d.name}`;
    this.exTip.querySelector(".pc-tip-sub").textContent = `${fmt(xKey)} · ${fmt(yKey)}`;
    this.exTip.style.display = "";
    this.positionTip();
  }
  positionTip() {
    const d = this.state.hovered;
    if (!d) return;
    const sx = this.axisScale(this.state.xKey);
    const sy = this.axisScale(this.state.yKey);
    const cx = 60 + ((this.factorValue(d, this.state.xKey) - sx.dom[0]) / (sx.dom[1] - sx.dom[0])) * 740;
    const cy = 470 - ((this.factorValue(d, this.state.yKey) - sy.dom[0]) / (sy.dom[1] - sy.dom[0])) * 430;
    this.exTip.style.left = ((cx / 860) * 100).toFixed(2) + "%";
    this.exTip.style.top = ((cy / 520) * 100).toFixed(2) + "%";
  }
  hideTip() {
    this.state.hovered = null;
    this.exTip.style.display = "none";
  }

  // ===================== 2b — Price vs. overall score =====================
  buildValue() {
    const card = h("section", "pc-card");
    card.appendChild(h("p", "pc-eyebrow", "What does each dollar buy?"));
    card.appendChild(h("h3", "pc-title", "Price against overall score"));
    const explain = h("p", "pc-explain");
    explain.innerHTML = "Up and left is better. The <strong>overall score</strong> is just the average of the four ratings you've seen on every chart — the cards below show how each one is built.";
    card.appendChild(explain);

    const scores = this.catalog.map((d) => d.overall);
    const yMin = Math.floor((Math.min(...scores) - 2) / 5) * 5;
    const yMax = Math.ceil((Math.max(...scores) + 2) / 5) * 5;
    const xDom = this.priceDom;
    const X = (v) => 60 + ((v - xDom[0]) / (xDom[1] - xDom[0])) * 740;
    const Y = (v) => 380 - ((v - yMin) / (yMax - yMin)) * 340;
    const xTicks = ticksFor(xDom[0], xDom[1], 50);
    const yTicks = ticksFor(yMin, yMax, 10);

    const plot = h("div", "pc-plot");
    const s = svg("svg", { viewBox: "0 0 860 430", class: "pc-svg" });
    const grid = svg("g", {});
    for (const t of xTicks) grid.appendChild(svg("line", { x1: X(t), y1: 40, x2: X(t), y2: 380, class: "pc-grid-line" }));
    for (const t of yTicks) grid.appendChild(svg("line", { x1: 60, y1: Y(t), x2: 800, y2: Y(t), class: "pc-grid-line" }));
    s.appendChild(grid);

    const front = this.frontier();
    if (front.length > 1) {
      const pts = front.map((d) => `${X(d.price).toFixed(1)},${Y(d.overall).toFixed(1)}`).join(" ");
      s.appendChild(svg("polyline", { points: pts, class: "pc-frontier" }));
    }

    // Catalog cloud (context), dodged, then featured on top.
    const cloudG = svg("g", { class: "pc-cloud" });
    const raw = this.catalog.map((d) => ({ x: X(d.price), y: Y(d.overall) }));
    const dd = dodgeCloud(raw);
    for (let i = 0; i < this.catalog.length; i++) cloudG.appendChild(svg("circle", { cx: dd[i].x.toFixed(1), cy: dd[i].y.toFixed(1), r: "2.3", class: "pc-dot" }));
    s.appendChild(cloudG);
    const pickG = svg("g", {});
    for (const f of this.featured) {
      pickG.appendChild(svg("circle", { cx: X(f.price).toFixed(1), cy: Y(f.overall).toFixed(1), r: "11", fill: haloFill(f.color), stroke: f.color.solid, "stroke-width": "2.5" }));
      pickG.appendChild(svg("circle", { cx: X(f.price).toFixed(1), cy: Y(f.overall).toFixed(1), r: "4", fill: f.color.solid }));
    }
    s.appendChild(pickG);
    plot.appendChild(s);

    const ov = h("div", "pc-ov");
    const mk = ovLabel(860, 430);
    for (const t of xTicks) ov.appendChild(this.tickLabel(mk(X(t), 397, "middle", "$" + t)));
    for (const t of yTicks) ov.appendChild(this.tickLabel(mk(48, Y(t), "end", "" + t)));
    ov.appendChild(mk(800, 410, "end", "Price →", null, "pc-axis-title"));
    ov.appendChild(mk(14, 26, "start", "Overall score ↑", null, "pc-axis-title"));
    if (front.length > 1) {
      const mid = front[Math.min(front.length - 1, Math.max(1, Math.floor(front.length / 2)))];
      ov.appendChild(mk(X(mid.price) + 6, Y(mid.overall) - 22, "start", "best score for the money", null, "pc-frontier-note"));
    }
    this.featured.forEach((f, i) => {
      const dx = i === 0 ? 16 : -16;
      const dy = i === 1 ? -18 : 16;
      ov.appendChild(mk(X(f.price) + dx, Y(f.overall) + dy, i === 0 ? "start" : "end", f.name, f.color.solid, "pc-pick-label"));
    });
    plot.appendChild(ov);
    card.appendChild(plot);

    if (this.featured.length) {
      const row = h("div", "pc-break-row");
      for (const f of this.featured) row.appendChild(this.breakdownCard(f));
      card.appendChild(row);
    }
    return card;
  }

  frontier() {
    const sorted = [...this.catalog].sort((a, b) => a.price - b.price || b.overall - a.overall);
    const out = [];
    let best = -Infinity;
    for (const d of sorted) {
      if (d.overall > best) {
        out.push(d);
        best = d.overall;
      }
    }
    return out;
  }

  breakdownCard(f) {
    const card = h("div", "pc-break-card");
    const head = h("div", "pc-break-head");
    const sw = h("span", "pc-break-swatch");
    sw.style.background = f.color.solid;
    head.appendChild(sw);
    head.appendChild(h("span", "pc-break-name", f.name));
    head.appendChild(h("span", "pc-break-price", fmtPrice(f.price)));
    card.appendChild(head);

    const body = h("div", "pc-break-body");
    const gauges = h("div", "pc-gauges");
    for (const key of RATING_KEYS) {
      const g = h("div", "pc-gauge");
      const track = h("div", "pc-gauge-track");
      const fill = h("div", "pc-gauge-fill");
      fill.style.height = (f.r[key] * 100).toFixed(0) + "%";
      fill.style.background = f.color.solid;
      track.appendChild(fill);
      track.title = `${RATINGS[key].label}: ${Math.round(f.r[key] * 100)} of 100`;
      g.appendChild(track);
      g.appendChild(h("span", "pc-gauge-label", RATINGS[key].short));
      gauges.appendChild(g);
    }
    body.appendChild(gauges);
    body.appendChild(h("div", "pc-break-avg", "→ avg"));
    const total = h("div", "pc-break-total");
    total.appendChild(h("div", "pc-break-score", fmtScore(f.overall)));
    total.appendChild(h("div", "pc-break-pp", `overall · $${(f.price / f.overall).toFixed(2)}/pt`));
    body.appendChild(total);
    card.appendChild(body);
    return card;
  }

  // ===================== 2c — Match stress-test =====================
  buildStressTest() {
    const card = h("section", "pc-card pc-stress");
    card.appendChild(h("p", "pc-eyebrow", this.mode === "quiz" ? "How solid is your #1?" : "How solid is the ranking?"));
    card.appendChild(h("h3", "pc-title", this.mode === "quiz" ? "Stress-test your match" : "Stress-test the ranking"));

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
      const roundel = h("span", "pc-roundel pc-roundel--sm");
      const meta = h("div", "pc-row-meta");
      const name = h("span", "pc-row-name", f.name);
      name.style.color = f.color.solid;
      meta.appendChild(name);
      meta.appendChild(h("span", "pc-row-brand", f.brand));
      const track = h("div", "pc-row-track");
      const segs = C_FACTORS.map((_, i) => {
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
    C_FACTORS.forEach((factor, i) => {
      const item = h("span", "pc-legend-item");
      const sw = h("span", "pc-legend-swatch");
      sw.style.background = SEG_SHADES[i];
      item.appendChild(sw);
      item.appendChild(document.createTextNode(factor.label));
      legend.appendChild(item);
    });
    card.appendChild(legend);
    card.appendChild(
      h("p", "pc-note", "If the podium barely moves as you change what matters, the recommendation is robust — which is exactly what you want to see right before the buy links.")
    );

    this.updateStress();
    return card;
  }

  setPreset(key) {
    if (this.state.preset === key) return;
    this.state.preset = key;
    this.syncPresetToUrl(key);
    this.updateStress();
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

  updateStress() {
    if (!this.stressRows.length) return;
    const preset = this.presets.find((p) => p.key === this.state.preset);
    for (const p of this.presets) this.presetPills[p.key].classList.toggle("is-active", p.key === preset.key);
    this.presetNote.textContent = preset.note;

    const scored = this.stressRows.map((r) => {
      const contribs = C_FACTORS.map((factor, i) => preset.weights[i] * r.f.r[factor.key] * 100);
      const total = contribs.reduce((a, b) => a + b, 0);
      return { r, contribs, total };
    });
    const order = [...scored].sort((a, b) => b.total - a.total);
    order.forEach((s, idx) => {
      s.r.row.style.top = idx * 70 + "px";
      s.r.roundel.textContent = String(idx + 1);
      s.r.total.textContent = Math.round(s.total) + "%";
      s.contribs.forEach((c, i) => {
        s.r.segs[i].style.width = c.toFixed(1) + "%";
        s.r.segs[i].title = `${C_FACTORS[i].label}: ${Math.round(c)} pts`;
      });
    });
  }
}

export function renderPaddleCharts(root, opts) {
  const controller = new PaddleCharts(root, opts.paddles, opts.featured, opts);
  controller.mount();
  return controller;
}
