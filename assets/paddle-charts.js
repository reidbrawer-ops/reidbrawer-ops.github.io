// Paddle comparison components — a "Your top 3" strip, a shopping recommender,
// and a priority stress-test. ONE surface uses them now:
//   - the quiz results page (assets/paddle-quiz.js) mounts recommend + stress
//     under the buy CTAs; featured = the quiz's top 3.
//
// The browse page was the second consumer, via assets/paddle-grid.js and then
// briefly assets/paddle-finder.js. Both are gone: paddle-grid.js was deleted
// when the faceted finder replaced it, and the finder's "Line paddles up side
// by side" panel was removed in favour of the dedicated head-to-head page at
// /paddles/browse/compare. That leaves `strip` with no caller — see mount().
//
// This module used to be three charts. Two have gone, and for the same reason
// both times: they answered questions about the CATALOG when the visitor is
// asking what to buy.
//
//   - The axis explorer (a 486-dot scatter with adjustable axes) was removed on
//     2026-07-18. It could show where a paddle sat but not whether that was any
//     good, and reading it was a project.
//   - The value chart (price against a normalised score, with a Pareto frontier
//     and a shaded dead zone) was replaced by buildRecommend. It needed three
//     concepts explained before it told anyone anything, and the one genuinely
//     useful thing in it — spotting an equivalent paddle for less — was a
//     footnote at the bottom. That footnote is now the whole component.
//
// The ratings behind it all: this site has FOUR it can honestly stand behind
// (power, control, spin, forgiveness — see assets/paddle-ratings.js), so the
// prototype's other two (pop, hand speed) are dropped rather than invented, and
// no surface prints a fabricated "match %".
//
// IMPORTANT — the ratings are banded. power/spin/control/forgiveness derive
// from percentiles that scripts/rebuild_paddle_data.py bands into 20 steps
// before they reach this public file (a data-licensing firewall —
// PickleballEffect's exact percentiles are proprietary; see
// PADDLE_DATA_SETUP.md). That is why the recommender talks in BANDS and treats
// anything under two of them as noise: 0.05 is the finest difference the data
// can express, so a one-band gap is an artifact, not a fact about a paddle.
//
// No framework — the stress-test's DOM is built once and MUTATED in place on
// preset changes (never re-serialized), because the CSS row re-sort is the
// component's delight moment and would not fire across an innerHTML swap. This
// mirrors the hand-rolled class style of the rest of this site.

import { powerRating, controlRating, spinRatingOf, forgivenessRatingOf, clamp01 } from "/assets/paddle-ratings.js";

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

// Shared with paddle-quiz.js's buy cards so paddle #1's teal card matches its
// teal dot on every chart. Falls back to the first accent past rank 3.
export function seriesColorFor(rank0) {
  return (SERIES[rank0] || SERIES[0]).solid;
}

// The four trait ratings that make up the overall score. Their display labels
// went with the axis explorer — nothing renders a per-trait name any more.
const RATINGS = {
  power: { get: (p) => powerRating(p) },
  spin: { get: (p) => spinRatingOf(p) },
  control: { get: (p) => controlRating(p) },
  forgiveness: { get: (p) => forgivenessRatingOf(p) },
};
const RATING_KEYS = ["power", "spin", "control", "forgiveness"];
// How each trait reads mid-sentence in the shopping copy ("better on spin and
// sweet spot"). "Forgiveness" is the internal name; "sweet spot" is what a
// buyer would actually say, and it's the wording the quiz already uses.
const TRAIT_WORD = { power: "power", spin: "spin", control: "control", forgiveness: "sweet spot" };

// "a", "a and b", "a, b and c" — Oxford-free, matching the site's prose.
function listWords(words) {
  if (words.length <= 1) return words[0] || "";
  return words.slice(0, -1).join(", ") + " and " + words[words.length - 1];
}

// All dynamic text is written via textContent (never innerHTML), so paddle
// names and brands need no escaping here — the DOM API handles it.
const fmtPrice = (n) => "$" + (Number.isInteger(n) ? n : n.toFixed(2));
const fmtScore = (n) => n.toFixed(1);

// Every element in this module is built here. Text goes in as textContent, so
// paddle names and brands are never parsed as markup — which is why nothing
// downstream escapes them.
function h(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
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
  { label: "Your level", keys: ["level"] },
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
    // Which components to render, in order. The only caller left is the quiz,
    // which passes ["recommend","stress"] — the buy cards above it already are
    // the top 3, so the strip would repeat them.
    //
    // `strip` therefore has no live caller: browse was its only consumer and
    // that panel is gone. It is kept because it is the one component that
    // renders a ranked set without a quiz behind it, which is what any future
    // "your picks" surface would need — but treat it as unexercised, and check
    // it renders before relying on it. Keep this default in step with the
    // `builders` map in mount(), since an unknown key fails soft.
    this.components = opts.components || ["recommend", "stress"];
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
    // Buy-link builder, supplied by the surface that holds the affiliate map
    // (vendorLinkFor bound to it). Passed in rather than imported so this
    // module keeps knowing nothing about affiliate configuration.
    this.linkFor = opts.linkFor || null;

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
    // instance's, so rebuilding on a selection change doesn't reset the view)
    // wins, then a valid ?preset=, then the defaults.
    const init = opts.initialState || {};
    const preset = init.preset && this.presets.some((p) => p.key === init.preset) ? init.preset : this.initialPreset();
    // Default the value chart to the visitor's own fit score wherever we have
    // it — that's the question they asked. Browse falls back to the average.
    this.state = { preset };
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
      recommend: () => this.buildRecommend(),
      stress: () => this.buildStressTest(),
    };
    for (const key of this.components) {
      const build = builders[key];
      if (build) this.root.appendChild(build());
    }
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


  // ===================== Shopping recommendations =====================
  //
  // Replaced a price-against-score scatter. That chart answered "what does the
  // curve look like" — a question about the catalog — when the visitor is
  // asking "what should I buy". Reading it required understanding a Pareto
  // frontier, a dead zone and a normalised score before it told anyone
  // anything, and the thing it was actually good at (spotting an equivalent
  // paddle for less) was one callout at the bottom.
  //
  // Same data, stated as a shopping decision: what the pick is genuinely best
  // at for its price, what costs less without giving anything up, and what is
  // worth a little more.
  //
  // Every claim here is a comparison the reader could check on the cards
  // themselves — no composite score, no "match %".

  // Trait deltas are quoted in BANDS, never decimals. The percentiles ship
  // banded into 20 steps (see the header), so 0.05 is the smallest difference
  // the data can express and anything finer is an artifact of averaging. Two
  // bands is the floor for calling a paddle better or worse at something —
  // one band is inside the noise the banding itself introduces.
  bandsBetween(a, b, key) {
    return Math.round((a.r[key] - b.r[key]) / 0.05);
  }

  // "Gives up nothing": no trait more than one band below the anchor.
  givesUpNothing(cand, anchor) {
    return RATING_KEYS.every((k) => this.bandsBetween(cand, anchor, k) >= -1);
  }

  // "Genuinely better": gives up nothing AND clears two bands somewhere.
  clearlyBetter(cand, anchor) {
    return this.givesUpNothing(cand, anchor) && RATING_KEYS.some((k) => this.bandsBetween(cand, anchor, k) >= 2);
  }

  // How far apart two paddles are overall — total band distance across the four
  // traits. Used to rank "similar" candidates so the closest match leads.
  bandDistance(a, b) {
    return RATING_KEYS.reduce((sum, k) => sum + Math.abs(this.bandsBetween(a, b, k)), 0);
  }

  // The traits a candidate beats or trails the anchor on, in plain words,
  // strongest first. Only differences of two bands or more are named.
  traitDeltaWords(cand, anchor) {
    const up = [];
    const down = [];
    for (const k of RATING_KEYS) {
      const d = this.bandsBetween(cand, anchor, k);
      if (d >= 2) up.push({ k, d });
      else if (d <= -2) down.push({ k, d });
    }
    up.sort((x, y) => y.d - x.d);
    down.sort((x, y) => x.d - y.d);
    return { up, down };
  }

  // The pool a recommendation or a "best at this price" claim may draw from.
  //
  // In quiz mode that is fitCatalog — the paddles the quiz actually scored,
  // which is the catalog minus whatever the visitor's tournament-approval
  // answer excluded (see the fitCatalog comment above; the mechanism was
  // already here, this panel just wasn't using it). These two methods read
  // this.catalog directly before, so the panel under a USAP-only podium could
  // recommend, and put a buy button on, a UPA-A-only paddle the visitor had
  // just told us they can't play with.
  get recoPool() {
    return this.fitCatalog || this.catalog;
  }

  // What the anchor is genuinely the best at, for its money.
  //
  // Scoped to paddles at or below its price, so the claim is "nothing cheaper
  // beats it at this" rather than a boast about the whole catalog. Ties are
  // counted, not hidden: with banded data a top spot is often shared, and
  // "best spin under $200 (tied with 3 others)" is the honest version.
  anchorStrengths(anchor) {
    const cheaperOrSame = this.recoPool.filter((d) => d.price <= anchor.price);
    const out = [];
    for (const k of RATING_KEYS) {
      let better = 0;
      let tied = 0;
      for (const d of cheaperOrSame) {
        if (d.id === anchor.id) continue;
        const b = this.bandsBetween(d, anchor, k);
        if (b > 0) better++;
        else if (b === 0) tied++;
      }
      if (better === 0) out.push({ key: k, tied, pool: cheaperOrSame.length });
    }
    return out;
  }

  buildRecommend() {
    const anchor = this.featured[0];
    const card = h("section", "pc-card pc-shop");
    if (!anchor) return card;

    card.appendChild(h("p", "pc-eyebrow", "Before you buy"));
    card.appendChild(h("h3", "pc-title", "Is there a better buy?"));
    card.appendChild(
      h("p", "pc-explain", `Every other paddle ${this.scopeLabel || "in the catalog"}, compared against ${anchor.name} on the four traits and the price.`)
    );

    card.appendChild(this.anchorPanel(anchor));

    const pool = this.recoPool.filter((d) => d.id !== anchor.id);
    const cheaper = pool
      .filter((d) => d.price < anchor.price && this.givesUpNothing(d, anchor))
      .sort((a, b) => this.bandDistance(a, anchor) - this.bandDistance(b, anchor) || a.price - b.price)
      .slice(0, 3);
    // "A little more" is capped at +25%: past that it stops being an upgrade to
    // the same purchase and becomes a different budget conversation.
    const upgrade = pool
      .filter((d) => d.price > anchor.price && d.price <= anchor.price * 1.25 && this.clearlyBetter(d, anchor))
      .sort((a, b) => this.bandDistance(b, anchor) - this.bandDistance(a, anchor) || a.price - b.price)
      .slice(0, 2);

    // Positions are numbered across the WHOLE panel, not per group, so the
    // data-pq-position GA4 reports for this surface is unique per link — two
    // links both reporting "position 1" (one cheaper, one upgrade) would make
    // the position histogram for surface=recommend meaningless.
    card.appendChild(this.recGroup("Costs less, gives up nothing", cheaper, anchor,
      `Nothing ${this.scopeLabel || "in the catalog"} costs less than ${anchor.name} without giving something up.`, 1));
    card.appendChild(this.recGroup("Worth a little more", upgrade, anchor,
      "Nothing within 25% more is clearly better — you're not leaving anything on the table by stopping here.", cheaper.length + 1));

    // Disclose against the links this panel ACTUALLY RENDERED, not against the
    // page's other surfaces. The finder's own syncDisclosure() computes its
    // Amazon flag from the 30 rows of the current page, while these rows are
    // drawn from the whole filtered list — so a filter whose first page is all
    // DTC brands but whose later pages include an allowlisted brand can render
    // an Amazon link here with the Associates sentence nowhere on the page. The
    // Operating Agreement requires that sentence verbatim wherever Associates
    // links appear, so it is conditioned on this panel's own links.
    const links = this.linkFor ? [...cheaper, ...upgrade].map((d) => this.linkFor(d.src)).filter(Boolean) : [];
    if (links.some((l) => l.isAffiliate)) {
      const amazonNotice = links.some((l) => l.isAmazon) ? " As an Amazon Associate I earn from qualifying purchases." : "";
      card.appendChild(h("p", "pc-note", "Some links here are affiliate links — we may earn a commission at no extra cost to you, and it never changes what gets recommended." + amazonNotice));
    }
    return card;
  }

  anchorPanel(anchor) {
    const box = h("div", "pc-shop-anchor");
    const head = h("div", "pc-shop-anchor-head");
    head.append(
      h("span", "pc-shop-anchor-label", "Your pick"),
      h("span", "pc-shop-anchor-name", `${anchor.brand} ${anchor.name}`),
      h("span", "pc-shop-anchor-price", fmtPrice(anchor.price))
    );
    box.appendChild(head);

    const strengths = this.anchorStrengths(anchor);
    const claim = h("p", "pc-shop-claim");
    if (!strengths.length) {
      claim.textContent = `Nothing it leads on outright below ${fmtPrice(anchor.price)} — the picks below cover the same ground for less.`;
      claim.classList.add("is-neutral");
    } else {
      const names = strengths.map((s) => TRAIT_WORD[s.key]);
      const tied = strengths.reduce((m, s) => Math.max(m, s.tied), 0);
      claim.textContent =
        `Best for ${listWords(names)} at ${fmtPrice(anchor.price)} or under` +
        (tied ? ` — tied with ${tied} ${plural(tied, "paddle", "paddles")}.` : ", outright.");
    }
    box.appendChild(claim);
    return box;
  }

  // startIndex is the 1-based position of this group's first row WITHIN THE
  // WHOLE panel — see buildRecommend; it ends up on each buy link as
  // data-pq-position.
  recGroup(title, rows, anchor, emptyNote, startIndex) {
    const wrap = h("div", "pc-shop-group");
    wrap.appendChild(h("h4", "pc-shop-grouptitle", title));
    if (!rows.length) {
      wrap.appendChild(h("p", "pc-shop-empty", emptyNote));
      return wrap;
    }
    rows.forEach((d, i) => wrap.appendChild(this.recRow(d, anchor, startIndex + i)));
    return wrap;
  }

  recRow(d, anchor, position) {
    const row = h("div", "pc-shop-row");
    const main = h("div", "pc-shop-main");
    main.appendChild(h("span", "pc-shop-name", `${d.brand} ${d.name}`));

    const { up, down } = this.traitDeltaWords(d, anchor);
    const parts = [];
    if (up.length) parts.push(`better ${listWords(up.slice(0, 2).map((x) => TRAIT_WORD[x.k]))}`);
    if (down.length) parts.push(`less ${listWords(down.slice(0, 2).map((x) => TRAIT_WORD[x.k]))}`);
    main.appendChild(h("span", "pc-shop-delta", parts.length ? parts.join(", ") : "a close match on all four traits"));
    row.appendChild(main);

    const money = h("div", "pc-shop-money");
    money.appendChild(h("span", "pc-shop-price", fmtPrice(d.price)));
    const diff = Math.round((d.price - anchor.price) * 100) / 100;
    const delta = h("span", "pc-shop-diff" + (diff < 0 ? " is-save" : ""), (diff < 0 ? "−" : "+") + fmtPrice(Math.abs(diff)));
    money.appendChild(delta);
    row.appendChild(money);

    const link = this.linkFor ? this.linkFor(d.src) : null;
    if (link) {
      const a = h("a", "pc-shop-buy", link.shortLabel || link.label);
      a.href = link.href;
      a.target = "_blank";
      a.rel = link.isAffiliate ? "sponsored nofollow noopener" : "nofollow noopener";
      // Same attribution the quiz and grid emit, so a click from here is counted
      // like any other and can be told apart by surface.
      a.setAttribute("data-pq-paddle", d.id);
      a.setAttribute("data-pq-brand", d.brand);
      a.setAttribute("data-pq-link-type", link.linkType || "unknown");
      a.setAttribute("data-pq-affiliate", link.isAffiliate ? "1" : "0");
      a.setAttribute("data-pq-surface", "recommend");
      // Required, not optional: affiliate-links.js reads Number(dataset.pqPosition)
      // unconditionally, so omitting it sent position: NaN to GA4 on every click
      // from this panel — which GA4 stores as a missing value, silently emptying
      // the position report for surface=recommend rather than erroring.
      a.setAttribute("data-pq-position", String(position));
      row.appendChild(a);
    }
    return row;
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

    // The legend is filtered to the buckets that actually score under the
    // current preset (see updateStress), because two of the five can be
    // legitimately empty for a given visitor: an advanced or pro answer zeroes
    // the level bonus (LEVEL_FORGIVENESS_BOOST), and a "no budget" answer makes
    // budgetFit null. The scorer drops zero-point terms, so those segments draw
    // at zero width — a legend naming a shade that appears nowhere in the bars
    // reads as a broken chart rather than as "this didn't apply to you". The
    // swatch colour stays pinned to the bucket's index so a bucket never
    // changes shade when a neighbour drops out.
    const legend = h("div", "pc-legend");
    this.stressLegendItems = this.stressFactors().map((factor, i) => {
      const item = h("span", "pc-legend-item");
      const sw = h("span", "pc-legend-swatch");
      sw.style.background = SEG_SHADES[i];
      item.appendChild(sw);
      item.appendChild(document.createTextNode(factor.label));
      legend.appendChild(item);
      return item;
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
        // NAME the bucket, never its points. This tooltip used to print
        // `${Math.round(c)} pts`, and under the browse (trait) lens c is
        // preset.weights[i] * r.f.r[factor.key] * 100 — the weights are public
        // constants a few lines up, spinRatingOf() returns spinPercentile
        // verbatim and forgivenessRatingOf() returns twistWeightPercentile
        // verbatim, so dividing the printed number by the known weight recovers
        // PickleballEffect's banded percentile exactly. PADDLE_DATA_SETUP.md's
        // licensing section forbids displaying those "not even as a chip or in
        // a tooltip". A share-of-bar or a band index would leak the same way
        // (the value factor is derived from public prices, so the row total is
        // solvable), so no derived number is printed at all — the bar length
        // still carries the magnitude visually, and the legend below already
        // names every shade. The label stays because matching five shades of
        // one colour by eye is the part the legend does badly.
        s.r.segs[i].title = factors[i].label;
      });
    });

    // Show only the buckets that draw something. The test is Math.max(0, c),
    // exactly what the widths above use, so the legend and the bars can't
    // disagree — including on the one term that can go negative (arm_feel, -10
    // for a firm face under "Fit & feel"). Re-run per preset rather than once at
    // build: "Budget first" patches the visitor's budget answer, which brings a
    // dead budget bucket back to life, and the legend should follow it.
    if (this.stressLegendItems) {
      this.stressLegendItems.forEach((item, i) => {
        const drawn = scored.some((s) => Math.max(0, s.contribs[i]) > 0);
        item.style.display = drawn ? "" : "none";
      });
    }

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
