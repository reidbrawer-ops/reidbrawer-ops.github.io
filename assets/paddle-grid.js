// Browsable paddle grid — the whole 486-paddle catalog behind four filters.
//
// Mounts into <div id="paddle-grid-app"> on paddles.html. Sibling to the quiz:
// the quiz answers "which paddle fits me?", this answers "show me everything."
// No framework — one class that re-renders its own root, matching paddle-quiz.js.
//
// Nothing here is reimplemented that the quiz already decided:
//   - Buy links come from vendorLinkFor (assets/affiliate-links.js), so the
//     Amazon allowlist, ASIN deep-links and the isAffiliate flag can never
//     drift between the quiz and the grid.
//   - Click attribution comes from trackVendorClicks (same module). It's
//     idempotent and delegated on document, so calling it from both surfaces
//     binds exactly one listener and every affiliate_click is counted once.
//   - The four trait ratings come from assets/paddle-ratings.js, so "the most
//     powerful paddle" is the same claim here as in the quiz's results.

import { vendorLinkFor, trackVendorClicks } from "/assets/affiliate-links.js";
// The same four ratings the quiz uses — so "most powerful" means one thing on
// this site. See assets/paddle-ratings.js.
import { powerRating, controlRating, spinRatingOf, forgivenessRatingOf, allCourtFit, APPROVAL_POOLS, tiebreakByTrait } from "/assets/paddle-ratings.js";
// The consolidated analytics view (axis explorer + value chart + stress-test),
// driven by the compare tray's selection. Same module the quiz results use.
import { renderPaddleCharts, seriesColorFor } from "/assets/paddle-charts.js";

const esc = (s) => window.PBUtils.escapeHtml(s);

// See assets/analytics.js. Deliberately NOT sending the search box's contents:
// the filters are a fixed enum and safe to report, but a free-text field can
// contain anything a visitor types, and /privacy commits to aggregate traffic
// data. How often search is used and whether it finds anything answers the
// product question ("is search pulling its weight?") without collecting prose.
const track = (name, params) => {
  if (typeof window.pbaTrack === "function") window.pbaTrack(name, params);
};

// paddles.json's percentiles are banded into 20 steps on the way out of
// scripts/rebuild_paddle_data.py — a data-licensing firewall (see RUNBOOK), and
// validate.mjs fails if a value is not a legal band midpoint. So the number is
// a BAND MIDPOINT, not a measurement: rendering "88th pct" would invent a
// precision the data doesn't carry and re-expose the licensed percentile the
// banding exists to withhold. paddle-quiz.js makes the same call. Words, not
// numbers.
//
// This buckets by RANGE rather than matching exact midpoints. It used to be a
// lookup table keyed on the four quartile values (0.13 / 0.38 / 0.63 / 0.88);
// when the data widened to 20 bands that table matched nothing and every Power
// chip silently vanished from the cards. A range test is resolution-independent
// and keeps the same four words a reader already knows.
const tierWord = (v) => {
  if (typeof v !== "number") return null;
  if (v < 0.25) return "Low";
  if (v < 0.5) return "Medium";
  if (v < 0.75) return "High";
  return "Very high";
};

// "Unapproved" is a VALUE of approvalBody, not the name of a body — so the
// obvious `${p.approvalBody} approved` renders "Unapproved approved" and
// asserts the exact opposite of the truth. That hits 5 paddles in the real
// catalog, and every one of them carries a tagged affiliate link, which is the
// worst possible place on this site to be wrong about a fact.
// (The mock never caught this: all 24 of its sample paddles are hardcoded
// approval:"UPA-A", so it never exercises the value the real data contains.)
const approvalNote = (p) => {
  if (!p.approvalBody) return null;
  if (p.approvalBody === "Unapproved") return "Not tournament approved";
  return `${p.approvalBody} approved`;
};

// Value domains come from the real catalog, not the design mock's 24-paddle
// sample — the mock has no "Extra-elongated", which would strand 6 real paddles
// behind a filter that can't reach them.
//
// Two kinds of filter, distinguished by whether the entry carries `tests`:
//   - exact-match on a field (`field`), for the categorical specs;
//   - a range/bucket predicate per option (`tests`), for the numeric ones.
// Price was the only bucketed filter and used to be special-cased inside
// filtered(); it moved into this shape when grip size, grip length and year
// arrived, so the loop has one rule instead of four exceptions.
//
// Bucket edges are read off the real distribution, not invented: grip size
// clusters hard at 4.13" (187 paddles) and 4.25" (239), and grip length at
// 5.5" (240) — which is also the point where a grip is long enough for a
// two-handed backhand, the reason anyone filters on it.
const FILTERS = [
  { key: "type", field: "paddleType", label: "Filter by paddle type", all: "All types",
    options: ["Power", "All-Court", "Control"] },
  { key: "shape", field: "shape", label: "Filter by shape", all: "All shapes",
    options: ["Elongated", "Widebody", "Hybrid", "Extra-elongated"] },
  { key: "price", label: "Filter by price", all: "All prices",
    options: [["under120", "Under $120"], ["120to200", "$120–$200"], ["over200", "$200+"]],
    tests: {
      under120: (p) => p.price < 120,
      "120to200": (p) => p.price >= 120 && p.price <= 200,
      over200: (p) => p.price > 200,
    } },
  { key: "skill", field: "skillLevel", label: "Filter by skill level", all: "All skill levels",
    options: ["Beginner", "Intermediate", "Advanced"] },
  { key: "gripLength", label: "Filter by grip length", all: "Any grip length",
    options: [["long", "Long grip — fits two hands (5.5″+)"], ["standard", "Standard grip (5.25–5.4″)"], ["short", "Short grip (under 5.25″)"]],
    tests: {
      long: (p) => p.gripLengthIn >= 5.5,
      standard: (p) => p.gripLengthIn >= 5.25 && p.gripLengthIn < 5.5,
      short: (p) => p.gripLengthIn < 5.25,
    } },
  { key: "gripSize", label: "Filter by grip size", all: "Any grip size",
    options: [["slim", "Slim grip (4.13″ or less)"], ["standard", "Standard grip (4.15–4.3″)"], ["thick", "Thick grip (4.5″+)"]],
    tests: {
      slim: (p) => p.gripSizeIn <= 4.13,
      standard: (p) => p.gripSizeIn > 4.13 && p.gripSizeIn <= 4.3,
      thick: (p) => p.gripSizeIn > 4.3,
    } },
  // Tournament approval, sharing APPROVAL_POOLS with the quiz so both surfaces
  // treat the 66 dual-certified paddles identically — they satisfy USAP and
  // UPA-A alike, and appear under either. Without this filter someone could
  // state a UPA-A requirement in the quiz and then have no way to hold to it
  // while browsing the catalog.
  { key: "approval", label: "Filter by tournament approval", all: "Any approval",
    options: [["usap", "USAP approved"], ["upa", "UPA-A approved"], ["either", "Approved by either"], ["unapproved", "Not tournament approved"]],
    tests: {
      usap: APPROVAL_POOLS.usap,
      upa: APPROVAL_POOLS.upa,
      either: APPROVAL_POOLS.either,
      unapproved: APPROVAL_POOLS.unapproved,
    } },
  { key: "year", label: "Filter by release year", all: "Any year",
    options: [["2026", "Released 2026"], ["2025", "Released 2025"], ["2024", "Released 2024"], ["older", "2023 & earlier"]],
    tests: {
      2026: (p) => p.yearReleased === 2026,
      2025: (p) => p.yearReleased === 2025,
      2024: (p) => p.yearReleased === 2024,
      older: (p) => p.yearReleased <= 2023,
    } },
];

// Derived from FILTERS so a new filter can't be added without its "all" default
// — the old literal listed four keys and would have silently left any fifth
// undefined, which reads as "not all" and would filter everything out on load.
const ALL_FILTERS_OFF = () => Object.fromEntries(FILTERS.map((f) => [f.key, "all"]));

// ---------- Ranking ----------
//
// The filters are exact-match, so everything that survives one matches it
// equally — "Power" is true of 187 paddles and says nothing about which is the
// most powerful. Ranking answers that second question: given what you asked
// for, how strongly does this paddle actually embody it.
//
// Only `type` and `skill` carry a gradient. Shape is categorical (a paddle is
// elongated or it isn't) and price is already a band the filter enforced, so
// neither can rank anything — selecting them narrows without reordering, which
// is the honest outcome rather than a fabricated tiebreak.
//
// Scores are 0-1 and averaged, so adding a second ranking filter re-weights
// rather than letting the first one dominate by accumulating points.
// "The best control paddle" is not "the most extreme control paddle". A paddle
// that dinks beautifully and can do nothing else is a worse recommendation than
// one with nearly as much touch that also drives, forgives an off-centre hit
// and bites the ball. Same for power: the hardest-hitting paddle in the catalog
// is a bad rec if it has no touch and a sweet spot the size of a coin. So both
// rankings are trait-dominant (0.7) with a well-roundedness term (0.3) rather
// than the raw rating.
//
// Roundedness is "the traits this filter didn't already ask about": always
// forgiveness and spin, plus the OPPOSITE of whatever the filter selected —
// power counts toward a control paddle's roundedness and vice versa. Passing
// the counterpart in is what keeps Power and Control symmetric. All-Court
// passes none, because its rating already asked about BOTH sides.
//
// This does NOT flip either sign. controlRating carries an inverted-power term,
// so at these weights power still nets out NEGATIVE for the Control ranking
// (0.7 x -0.5 + 0.1 = -0.25) and POSITIVE for Power (0.7 - 0.1 x 0.5 = +0.65).
// The counterpart term softens each rating's extremism without cancelling it —
// prefer a control paddle that kept some pop, and a power paddle that can still
// reset, over either taken to its limit.
const mean = (...ns) => ns.reduce((a, b) => a + b, 0) / ns.length;

const roundedness = (p, counterpart) => {
  const traits = [forgivenessRatingOf(p), spinRatingOf(p)];
  if (counterpart) traits.push(counterpart(p));
  return mean(...traits);
};

// Every ranking below is "what you asked for, dominant — plus what you didn't".
// Single-sourced so the 0.7/0.3 ratio is one number to tune, not six.
const blend = (primary, secondary) => primary * 0.7 + secondary * 0.3;

const TYPE_FIT = {
  Power: (p) => blend(powerRating(p), roundedness(p, controlRating)),
  Control: (p) => blend(controlRating(p), roundedness(p, powerRating)),
  // Balance, not mediocrity: closest to an even split between power and control.
  // Lives in paddle-ratings.js so the quiz's "All-around" answer scores it
  // identically — see allCourtFit.
  //
  // Balance needs the roundedness term MORE than the other two, not less, for
  // two reasons the catalog makes obvious:
  //
  //   1. Balance is blind to everything else. The old #1 was the Gearbox GX2
  //      Integra XL on forgiveness 0.07 — near the worst sweet spot in the
  //      catalog — purely because its power and control landed 0.48/0.49. The
  //      top 20 by raw balance averaged 0.373 forgiveness against a pool mean
  //      of 0.485, so this ranking was actively selecting for punishing paddles.
  //
  //   2. Perfect balance is what MISSING DATA looks like. An All-Court paddle
  //      with no powerPercentile gets powerRating 0.5 exactly (the label base),
  //      which puts controlRating at ~0.5, which scores allCourtFit 1.0 — the
  //      ceiling. Unmeasured paddles don't merely survive here, they win by
  //      construction. Forgiveness is the fix: twistWeightPercentile is on all
  //      486 paddles, so it is the one term no paddle can abstain from.
  //
  // No counterpart trait is passed: power and control are both already inside
  // allCourtFit, and adding either back would double-count the axis this
  // filter exists to balance. Level is deliberately absent too — control is
  // built as roughly inverted power, so (power + control) / 2 only spans
  // 0.388-0.613 across the whole pool and carries no signal to reward.
  "All-Court": (p) => blend(allCourtFit(p), roundedness(p)),
};

// Same 0.7/0.3 shape as TYPE_FIT, but the secondary term is chosen DIFFERENTLY
// and deliberately so.
//
// For a type filter, roundedness is unambiguously good: a power paddle that
// also forgives is simply a better power paddle. A skill level is not a trait
// though, it is a PLAYER — so its secondary traits are directional. Rewarding a
// beginner paddle for raw power would push beginners toward paddles that are
// harder to keep in play, which is the opposite of helping. So each level gets
// the traits that serve that player, not a generic well-roundedness score.
const SKILL_FIT = {
  // A beginner's paddle forgives: a big sweet spot matters more than pace.
  //
  // Forgiveness alone could not rank them. It is raw twistWeightPercentile,
  // banded to 20 steps, so 130 beginner paddles shared 15 scores and SEVENTEEN
  // tied for #1 — the podium was decided by the spin tiebreak, which is close
  // to irrelevant at this level. It showed: the Selkirk Omni (control 0.39,
  // power 0.57) took #1 over the Volair V.1F (control 0.82, power 0.22), the
  // far more beginner-appropriate paddle, on a spin coin-flip.
  //
  // Control is the secondary, NOT roundedness — keeping the ball in play is
  // what a beginner needs next after a big sweet spot. Spin and power are left
  // out on purpose.
  Beginner: (p) => blend(forgivenessRatingOf(p), controlRating(p)),
  // Advanced play rewards what you can DO with the ball over what you survive —
  // so power and spin still lead at 0.7. But taken alone that crowned paddles
  // in the bottom quartile of sweet spot (RPM Q2 at forgiveness 0.28, Luzz
  // Frozen Inferno at 0.23), and the modern advanced game is as much reset and
  // dink as it is pace. Forgiveness and control at 0.3 keep a cannon with no
  // touch from topping a list aimed at the best players.
  Advanced: (p) => blend(mean(powerRating(p), spinRatingOf(p)), mean(forgivenessRatingOf(p), controlRating(p))),
  // The all-rounder's compromise — some touch, still forgiving.
  //
  // DELIBERATELY has no secondary term, unlike every other ranking in this
  // file. Two things were measured before leaving it alone:
  //
  //   It doesn't need one. 159 paddles carry 110 distinct scores with a single
  //   paddle at the top — none of the mass-tie pathology that made the Control
  //   and Beginner rankings a tiebreak in a precision costume.
  //
  //   And no available trait helps. Power nearly cancels the control half
  //   (controlRating carries an inverted-power term, so at 0.35 control / 0.15
  //   power the net coefficient is 0.35 x -0.5 + 0.15 = -0.025, i.e. free), and
  //   spin does the same thing by proxy: corr(spin, power) = +0.51 against
  //   corr(spin, control) = -0.36. Forgiveness and control are already the
  //   primary. Both were tried; both dragged top-20 mean control BELOW the pool
  //   mean (0.391 and 0.435 against 0.475) on the one ranking whose premise is
  //   touch. Adding a term here buys tiebreak resolution this ranking does not
  //   need, at the cost of pointing intermediates at power paddles.
  Intermediate: (p) => mean(controlRating(p), forgivenessRatingOf(p)),
};

// null = nothing selected that can rank, so the catalog keeps its own order and
// no rank numbers are shown. A "#1" with no basis would be theatre.
function fitScore(paddle, filters) {
  const terms = [];
  const t = TYPE_FIT[filters.type];
  if (t) terms.push(t(paddle));
  const s = SKILL_FIT[filters.skill];
  if (s) terms.push(s(paddle));
  if (!terms.length) return null;
  return terms.reduce((a, b) => a + b, 0) / terms.length;
}

const rankable = (filters) => Boolean(TYPE_FIT[filters.type] || SKILL_FIT[filters.skill]);

// tiebreakByTrait() (spin → forgiveness → name) is the PRICE-FREE tiebreak —
// the grid asks "which paddle is most X", and a paddle is not more control-
// oriented for being cheap. The quiz uses the price-first tiebreak() instead,
// because it asks a different question; see the note above both in
// paddle-ratings.js.
//
// Ties still happen here: the percentiles are banded (the licensing firewall —
// see tierWord), so filtering to Power leaves paddles sharing fit scores — far
// fewer since the 2026-07-18 refresh took four tiers to twenty bands, but
// enough that the order matters. Without the tiebreak the order inside a tie
// would be catalog order — alphabetical by brand — so "#1 most powerful" would
// mean "first paddle whose brand starts with a digit". The rank number would be
// an accident in a precision costume.

// Brand and model only. Matching the spec fields too would mean typing "16"
// and getting every 16mm paddle, which is what the filters are for.
function matchesQuery(paddle, q) {
  if (!q) return true;
  const hay = `${paddle.brand} ${paddle.name}`.toLowerCase();
  // Every whitespace-separated term must appear, so "joola 16" narrows rather
  // than widens — people type a brand and a hint, not an exact string.
  return q.split(/\s+/).filter(Boolean).every((term) => hay.includes(term));
}

class PaddleGrid {
  constructor(root, paddles, affiliateMap) {
    this.root = root;
    this.paddles = paddles;
    this.total = paddles.length;
    this.affiliateMap = affiliateMap;
    this.filters = ALL_FILTERS_OFF();
    this.query = "";
    // Compare tray: up to 3 paddle ids, in the order added (which fixes their
    // series colors across the charts). Kept by id so it survives the grid
    // re-rendering its cards on every filter/search change.
    this.selected = [];
    this.byIdMap = new Map(paddles.map((p) => [p.id, p]));
    this.charts = null;
    root.addEventListener("change", (e) => this.onChange(e));
    root.addEventListener("click", (e) => this.onClick(e));
    root.addEventListener("input", (e) => this.onInput(e));
    // A search box inside a form would submit-and-reload on Enter, throwing away
    // the filters. Filtering is already live on input, so Enter has nothing left
    // to do.
    root.addEventListener("submit", (e) => e.preventDefault());
  }

  onChange(e) {
    const sel = e.target.closest("select[data-filter]");
    if (!sel) return;
    this.filters[sel.dataset.filter] = sel.value;
    this.render();
    this.scheduleAnalytics();
    track("browse_filter", { filter: sel.dataset.filter, value: sel.value, results: this.lastCount });
  }

  onInput(e) {
    const box = e.target.closest('[data-role="pg-search"]');
    if (!box) return;
    this.query = box.value.trim().toLowerCase();
    this.render();
    this.scheduleAnalytics();
    // Debounced to the end of typing — one event per search, not per keystroke.
    clearTimeout(this.searchTimer);
    const len = this.query.length;
    if (!len) return;
    this.searchTimer = setTimeout(() => {
      track("browse_search", { query_length: len, results: this.lastCount, found: this.lastCount > 0 ? 1 : 0 });
    }, 900);
  }

  onClick(e) {
    const cmp = e.target.closest('[data-action="compare"]');
    if (cmp) {
      if (!cmp.disabled) this.toggleCompare(cmp.dataset.id);
      return;
    }
    const unc = e.target.closest('[data-action="uncompare"]');
    if (unc) {
      this.toggleCompare(unc.dataset.id);
      return;
    }
    if (e.target.closest('[data-action="clear-compare"]')) {
      this.selected = [];
      this.syncCompareUI();
      return;
    }
    if (!e.target.closest('[data-action="reset-grid"]')) return;
    this.filters = ALL_FILTERS_OFF();
    this.query = "";
    // The controls outlive a render now, so state has to be pushed back into
    // them rather than re-emitted as markup with `selected` on the right option.
    this.root.querySelectorAll("select[data-filter]").forEach((s) => { s.value = "all"; });
    const box = this.root.querySelector('[data-role="pg-search"]');
    if (box) box.value = "";
    this.render();
    this.scheduleAnalytics();
  }

  activeFilterCount() {
    return FILTERS.filter((f) => this.filters[f.key] !== "all").length;
  }

  filtered() {
    const list = this.paddles.filter((p) => {
      if (!matchesQuery(p, this.query)) return false;
      for (const f of FILTERS) {
        const v = this.filters[f.key];
        if (v === "all") continue;
        if (f.tests) {
          const test = f.tests[v];
          // A paddle missing the spec fails a bucket filter rather than
          // slipping through: 3 paddles have no grip length, and "unknown" is
          // not the same as "matches what you asked for".
          if (!test || !test(p)) return false;
        } else if (p[f.field] !== v) return false;
      }
      return true;
    });

    if (!rankable(this.filters)) return list;
    // Score once per paddle, not once per comparison — sort() calls the
    // comparator O(n log n) times and these ratings are not free.
    return list
      .map((p) => ({ p, fit: fitScore(p, this.filters) }))
      .sort((a, b) => (Math.abs(b.fit - a.fit) > 1e-9 ? b.fit - a.fit : tiebreakByTrait(a.p, b.p)))
      .map(({ p }) => p);
  }

  filterHtml() {
    const sels = FILTERS.map((f) => {
      const opts = [`<option value="all">${esc(f.all)}</option>`].concat(
        f.options.map((o) => {
          const [val, label] = Array.isArray(o) ? o : [o, o];
          const sel = this.filters[f.key] === val ? " selected" : "";
          return `<option value="${esc(val)}"${sel}>${esc(label)}</option>`;
        })
      );
      return `<select class="pg-select" data-filter="${f.key}" aria-label="${esc(f.label)}">${opts.join("")}</select>`;
    });
    return `
      <div class="pg-search">
        <label class="visually-hidden" for="pg-search-input">Search paddles by brand or model</label>
        <svg class="pg-search-icon" width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="9" cy="9" r="6" stroke="currentColor" stroke-width="1.6"></circle><line x1="13.2" y1="13.2" x2="17" y2="17" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"></line></svg>
        <input id="pg-search-input" type="search" data-role="pg-search" autocomplete="off"
               placeholder="Search a brand or model — JOOLA, Perseus…">
      </div>
      <div class="pg-filters">${sels.join("")}<button type="button" class="pg-reset" data-action="reset-grid">Reset</button></div>`;
  }

  cardHtml(p, i) {
    const link = vendorLinkFor(p, this.affiliateMap);
    const chips = [p.shape, p.paddleType, p.skillLevel]
      .filter(Boolean)
      .map((c) => `<span class="pg-chip">${esc(c)}</span>`)
      .join("");

    // Only render a spec that actually exists — 137 paddles have no spinRating
    // and 9 no paddleType. An "unknown" placeholder would be noise; the site's
    // rule is to say nothing rather than fake a gap closed.
    const specs = [
      ["Weight", typeof p.weightOz === "number" ? `${p.weightOz}oz` : null],
      ["Core", typeof p.coreThicknessMm === "number" ? `${p.coreThicknessMm}mm` : null],
      ["Spin", p.spinRating],
      ["Power", tierWord(p.powerPercentile)],
      // Grip length is the spec people scan a card for — it decides whether a
      // two-handed backhand fits. Grip size isn't here on purpose: 87% of the
      // catalog is one of two near-identical values (4.13" / 4.25"), so it
      // discriminates almost nothing at a glance and is better served by the
      // filter, where it narrows.
      // "Handle", not "Grip": the card would otherwise show "Grip 5.75in" while
      // a "grip size" filter sits above it meaning circumference, and 5.75in of
      // circumference is a different (implausible) claim about the same paddle.
      ["Handle", typeof p.gripLengthIn === "number" ? `${p.gripLengthIn}in` : null],
      ["Released", p.yearReleased],
    ]
      .filter(([, v]) => v)
      .map(([k, v]) => `<div>${k} <b>${esc(String(v))}</b></div>`)
      .join("");

    let foot = "";
    if (link) {
      // rel and the "· affiliate" note are both conditional on isAffiliate — a
      // plain vendor link must never be dressed up as, or disclosed as, one
      // that earns a commission.
      const rel = link.isAffiliate ? "sponsored nofollow noopener" : "nofollow noopener";
      const note = [approvalNote(p), link.isAffiliate ? "affiliate" : null].filter(Boolean).join(" · ");
      const data = [
        `data-pq-paddle="${esc(p.id)}"`,
        `data-pq-brand="${esc(p.brand)}"`,
        `data-pq-link-type="${esc(link.linkType || "unknown")}"`,
        `data-pq-affiliate="${link.isAffiliate ? "1" : "0"}"`,
        // The quiz emits position 1..3; this grid emits 1..N over a filtered
        // list of up to 486. Both mount on /paddles and share one delegated
        // listener, so without a surface discriminator every average over
        // `position` silently mixes the two scales — and GA4 cannot backfill.
        `data-pq-surface="grid"`,
        `data-pq-position="${i + 1}"`,
      ].join(" ");
      // link.shortLabel, not a generic "Check price": vendorLinkFor already
      // knows whether this is a verified deep link to the exact model ("Buy on
      // Amazon"), a search that may or may not surface it ("Search Amazon",
      // "Search brand site"), or just the brand's front door ("Visit brand
      // site"). Saying which is honest about what the click will actually do.
      //
      // shortLabel rather than the quiz's brand-naming `label`: at 254px a card
      // cannot hold "Search Honolulu Pickleball" (193px of button against 218px
      // of content box, so 34 of 486 cards had the CTA hanging over the border,
      // and the widest buttons were double the narrowest). The brand is already
      // this card's eyebrow, and the visually-hidden suffix below still names
      // brand + model for anyone who arrives at the link out of context.
      foot = `<div class="pg-foot">
          <span class="pg-note">${esc(note)}</span>
          <a class="btn pg-buy" href="${esc(link.href)}" target="_blank" rel="${rel}" ${data}>${esc(link.shortLabel || link.label)}<span class="visually-hidden"> — ${esc(p.brand)} ${esc(p.name)} (opens in new tab)</span></a>
        </div>`;
    } else {
      const note = approvalNote(p);
      if (note) foot = `<div class="pg-foot"><span class="pg-note">${esc(note)}</span></div>`;
    }

    // One paddle in the catalog has no price. Math.round(null) is 0, so the
    // naive template renders "$0" — the price filter already excludes it from
    // every bucket, but the card still has to say something true.
    const price = typeof p.price === "number" ? `$${Math.round(p.price)}` : "Price n/a";

    // Rank only when the filters actually rank something (see fitScore).
    const rank = this.ranked ? `<span class="rank-badge${i === 0 ? " top" : ""}">#${i + 1}</span>` : "";

    // Compare toggle — adds the paddle to the tray that feeds the charts above.
    // Disabled (not removed) once three are chosen, so the cap is visible rather
    // than a click that silently does nothing.
    const selected = this.selected.includes(p.id);
    const atMax = this.selected.length >= 3;
    const compareBtn = `<button type="button" class="pg-compare-btn${selected ? " is-on" : ""}" data-action="compare" data-id="${esc(p.id)}" aria-pressed="${selected ? "true" : "false"}"${!selected && atMax ? " disabled" : ""}>${selected ? "✓ Comparing" : "+ Compare"}</button>`;

    return `<li class="pg-card">
      <div class="pg-head">
        <div>
          <div class="pg-brand">${rank}${esc(p.brand)}</div>
          <h3 class="pg-model">${esc(p.name)}</h3>
        </div>
        <div class="pg-price">${esc(price)}</div>
      </div>
      ${chips ? `<div class="pg-chips">${chips}</div>` : ""}
      ${specs ? `<div class="pg-specs">${specs}</div>` : ""}
      <div class="pg-actions">${compareBtn}${foot}</div>
    </li>`;
  }

  // The shell is built ONCE. Re-rendering the whole root on every filter change
  // would destroy the <select> the user just operated — focus falls to <body>,
  // so the next Tab restarts at the top of the document (WCAG 2.4.3) — and
  // would replace the role="status" node with a fresh one each time, which is
  // never announced (a live region has to persist and have its text change;
  // one inserted with content already in it doesn't fire). Same reason
  // dom-utils.js's PBUtils.setStatus writes textContent to a persistent node.
  mount() {
    // Collapsed by default. Expanded, this panel is ~900px tall — taller than
    // the viewport — so the first paddle card started below 1750px and the
    // page's actual subject was a screen and a half down. It stays ABOVE the
    // grid rather than moving below it: the grid runs 40,000px, and anything
    // after it is unreachable in practice.
    this.root.innerHTML = `
      ${this.filterHtml()}
      <details class="pg-compare" data-role="pg-compare">
        <summary class="pg-compare-summary">
          <span class="pg-compare-head">
            <span class="pc-eyebrow">Compare &amp; explore</span>
            <h2 class="pg-compare-title">Line paddles up side by side</h2>
          </span>
          <span class="pg-compare-state" data-role="pg-compare-state"></span>
        </summary>
        <div class="pg-compare-body">
          <div class="pg-tray" data-role="pg-tray"></div>
          <div class="pg-analytics" data-role="pg-analytics"></div>
        </div>
      </details>
      <p class="pg-count" role="status"></p>
      <div data-role="pg-disclosure"></div>
      <div class="pg-rent">
        <span class="pg-rent-label">New to the game?</span>
        <span class="pg-rent-body">Rent a paddle at a beginner-friendly court before you buy — most run $5–10 for the session.</span>
        <a class="pg-rent-link" href="#rent">Rent or demo first →</a>
      </div>
      <div data-role="pg-body"></div>`;
    this.countEl = this.root.querySelector(".pg-count");
    this.discEl = this.root.querySelector('[data-role="pg-disclosure"]');
    this.bodyEl = this.root.querySelector('[data-role="pg-body"]');
    this.trayEl = this.root.querySelector('[data-role="pg-tray"]');
    this.analyticsEl = this.root.querySelector('[data-role="pg-analytics"]');
    this.compareEl = this.root.querySelector('[data-role="pg-compare"]');
    this.compareStateEl = this.root.querySelector('[data-role="pg-compare-state"]');
    // `toggle` does not bubble, so this can't ride the delegated click listener
    // in the constructor.
    this.compareEl.addEventListener("toggle", () => {
      if (this.compareEl.open && this.analyticsStale) this.renderAnalytics();
      track("browse_compare_panel", { action: this.compareEl.open ? "open" : "close", tray_size: this.selected.length });
    });
    this.render();
    this.renderTray();
    // Not rendered yet — see refreshAnalytics. The panel starts closed, and the
    // charts are built the first time it is opened.
    this.analyticsStale = true;
    return this;
  }

  // The charts cost ~500 derived paddles and ~500 SVG circles to rebuild. With
  // the panel closed by default that would run on every filter change for a
  // view nobody is looking at, so while it's closed we only mark the charts
  // stale and let the toggle handler catch up.
  refreshAnalytics() {
    if (!this.compareEl || !this.compareEl.open) {
      this.analyticsStale = true;
      return;
    }
    this.renderAnalytics();
  }

  byId(id) {
    return this.byIdMap.get(id);
  }

  // Add or remove a paddle from the compare tray (cap 3). Everything the tray
  // touches — the card toggles, the chips, and the charts — is refreshed by
  // syncCompareUI so the three never drift out of agreement.
  toggleCompare(id) {
    const i = this.selected.indexOf(id);
    if (i >= 0) this.selected.splice(i, 1);
    else if (this.selected.length < 3) this.selected.push(id);
    else return; // at the cap — the card toggles are already disabled
    track("browse_compare", { action: i >= 0 ? "remove" : "add", paddle: id, tray_size: this.selected.length });
    this.syncCompareUI();
  }

  // Push the current selection into the three surfaces that reflect it, without
  // a full grid re-render (which would drop focus off the card just clicked).
  syncCompareUI() {
    const atMax = this.selected.length >= 3;
    this.root.querySelectorAll('[data-action="compare"]').forEach((btn) => {
      const on = this.selected.includes(btn.dataset.id);
      btn.classList.toggle("is-on", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.disabled = !on && atMax;
      btn.textContent = on ? "✓ Comparing" : "+ Compare";
    });
    this.renderTray();
    this.refreshAnalytics();
  }

  // The panel is collapsed by default, so the summary has to carry the state a
  // visitor would otherwise read off the tray — otherwise "+ Compare" on a card
  // turns one button teal and nothing else on the page acknowledges it.
  renderCompareState() {
    const n = this.selected.length;
    this.compareStateEl.textContent = n
      ? `${n} of 3 selected`
      : `Chart ${this.total} paddles on any two axes`;
    this.compareStateEl.classList.toggle("has-picks", n > 0);
  }

  renderTray() {
    this.renderCompareState();
    if (!this.selected.length) {
      // Wording follows the chart's actual behaviour: a tap now INSPECTS a dot
      // and the readout's button commits it. Tapping used to add it outright,
      // which on a lattice where 43 paddles can share one coordinate meant the
      // tap chose for you.
      this.trayEl.innerHTML = `<span class="pg-tray-hint">Add up to 3 paddles with “+ Compare” on any card below.</span>`;
      return;
    }
    const chips = this.selected
      .map((id, i) => {
        const p = this.byId(id);
        if (!p) return "";
        return `<span class="pg-tray-chip" style="--pick:${seriesColorFor(i)}"><span class="pg-tray-dot"></span><span class="pg-tray-name">${esc(p.brand)} ${esc(p.name)}</span><button type="button" class="pg-tray-x" data-action="uncompare" data-id="${esc(id)}" aria-label="Remove ${esc(p.name)} from comparison">✕</button></span>`;
      })
      .join("");
    this.trayEl.innerHTML = `${chips}<button type="button" class="pg-tray-clear" data-action="clear-compare">Clear all</button>`;
  }

  // Rebuild the charts for the current selection. The explorer is always shown
  // (the whole catalog is worth exploring with nothing picked yet); the value
  // chart and strip need at least one pick, and the stress-test at least two.
  // The previous instance's axis/preset are carried across so toggling a pick
  // doesn't jump the view back to the defaults.
  // Rebuilding the charts costs ~500 derived paddles and ~500 SVG circles, so
  // it must not run per keystroke of the search box. Filters fire a `change`
  // (rare, so the delay is imperceptible) and search fires `input`; one short
  // debounce covers both.
  scheduleAnalytics() {
    clearTimeout(this.analyticsTimer);
    this.analyticsTimer = setTimeout(() => this.refreshAnalytics(), 200);
  }

  renderAnalytics() {
    this.analyticsStale = false;
    const featured = this.selected.map((id) => this.byId(id)).filter(Boolean);
    const n = featured.length;
    // Nothing to show until something is compared. The axis explorer used to
    // fill this space with the whole catalog whether or not the visitor had
    // picked anything; without it the panel has no reason to exist empty.
    if (!n) {
      this.charts = null;
      this.analyticsEl.innerHTML = `<p class="pg-analytics-empty">Pick a paddle with “+ Compare” on any card below to see how it prices up against the field.</p>`;
      return;
    }
    const components = ["strip", "recommend"];
    if (n >= 2) components.push("stress");

    // The chart plots what the grid is showing. It used to plot the entire
    // catalog regardless: filtering to Control + Widebody + under $120 left the
    // grid with 3 cards and the chart with 485 dots, so the cloud described a
    // population the visitor had explicitly filtered away, and every rank in
    // the readout was measured against paddles not on the page.
    const list = this.filtered();
    const scoped = this.activeFilterCount() > 0 || this.query;
    const prev = this.charts ? { preset: this.charts.state.preset, scoreMode: this.charts.state.scoreMode } : null;
    this.analyticsEl.innerHTML = "";

    // Below two paddles there is no distribution to plot and no frontier to
    // draw — say so rather than render an axis through one dot. The compared
    // picks are still listed in the tray above, so nothing is lost.
    if (list.length < 2) {
      this.charts = null;
      this.analyticsEl.innerHTML = `<p class="pg-analytics-empty">${
        list.length ? "Only one paddle matches — widen a filter to compare it against the field." : "No paddles match those filters, so there's nothing to chart."
      }</p>`;
      return;
    }

    this.charts = renderPaddleCharts(this.analyticsEl, {
      // Featured paddles are derived separately from the plotted set, so a
      // compared pick stays on the chart even when a filter excludes it.
      paddles: list,
      featured,
      mode: "browse",
      components,
      initialState: prev,
      scopeLabel: scoped ? "matching your filters" : null,
      linkFor: (paddle) => vendorLinkFor(paddle, this.affiliateMap),
    });
  }

  render() {
    const list = this.filtered();
    this.ranked = rankable(this.filters);
    // Read by the filter/search events, which fire after render so they can
    // report what the visitor actually ended up looking at.
    this.lastCount = list.length;
    const links = list.map((p) => vendorLinkFor(p, this.affiliateMap)).filter(Boolean);
    const anyAmazon = links.some((l) => l.isAmazon);
    const anyAffiliate = links.some((l) => l.isAffiliate);

    // Say WHY the order is what it is. A ranked list that doesn't explain its
    // ranking reads as an endorsement; naming the basis makes it a filter.
    const basis = this.ranked
      ? ` Ranked by fit for ${[this.filters.type, this.filters.skill].filter((v) => v && v !== "all").join(" · ").toLowerCase()}.`
      : "";
    this.countEl.textContent = `Showing ${list.length} of ${this.total} paddles in the full catalog.${basis}`;

    // The Amazon Associates sentence is required verbatim by the Operating
    // Agreement wherever Associates links appear, and the disclosure sits with
    // the links rather than in a footnote — the design's own rule. Three
    // branches, because a filter that matches nothing shows no links at all:
    // claiming "we don't earn a commission from them" there would be a
    // statement about links that don't exist.
    const amazonNotice = anyAmazon ? " As an Amazon Associate I earn from qualifying purchases." : "";
    this.discEl.innerHTML = !links.length
      ? ""
      : anyAffiliate
        ? `<p class="affiliate-disclosure">Some paddle links below are affiliate links — we may earn a commission if you buy, at no extra cost to you. It never changes which paddles appear here or how they're described.${amazonNotice} <a href="/affiliate-disclosure">How this works</a>.</p>`
        : `<p class="affiliate-disclosure">These links go straight to each brand's own site — we don't earn a commission from them today. If that changes, we'll say so right here and on our <a href="/affiliate-disclosure">disclosure page</a>.</p>`;

    this.bodyEl.innerHTML = list.length
      ? `<ul class="pg-grid">${list.map((p, i) => this.cardHtml(p, i)).join("")}</ul>`
      : `<div class="pg-empty">
           <p>${this.query ? `No paddles match “${esc(this.query)}”${this.activeFilterCount() ? " with those filters" : ""}.` : "No paddles match those filters."}</p>
           <button type="button" class="btn" data-action="reset-grid">Reset</button>
         </div>`;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  // Bound before the mount guard and idempotent — the grid now lives on its own
  // page, where paddle-quiz.js isn't loaded, so it has to bind its own
  // attribution or every buy click here goes uncounted.
  trackVendorClicks();
  const root = document.getElementById("paddle-grid-app");
  if (!root) return;
  try {
    const [paddles, affiliateMap] = await Promise.all([
      fetch("/assets/paddles.json").then((r) => r.json()),
      fetch("/assets/affiliate-map.json", { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    new PaddleGrid(root, paddles, affiliateMap).mount();
  } catch (err) {
    console.error("[PaddleGrid] Failed to load paddle data.", err);
    root.innerHTML = `<p class="pq-error">Couldn't load the paddle catalog right now — try refreshing the page.</p>`;
  }
});
