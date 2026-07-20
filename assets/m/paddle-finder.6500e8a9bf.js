// The faceted paddle catalog — 486 paddles behind ten multi-select facets, a
// search box, eight sorts and 30-per-page pagination.
//
// Replaces the eight-<select> filter bar in assets/paddle-grid.js. The selects
// could only ever express one value per axis and gave no idea how many paddles
// were behind a choice, so narrowing was a guess that regularly landed on an
// empty grid. Checkboxes with live counts make the shape of the catalog
// visible before you commit to a click.
//
// What is NOT reimplemented here:
//   - All filtering, bucketing, sorting and card copy comes from
//     assets/paddle-model.js, which the prerendered detail pages also import.
//     Two implementations of "what is a 16mm paddle" is one too many.
//   - Buy links + click attribution: assets/affiliate-links.js, so the Amazon
//     allowlist, the ASIN deep links and the isAffiliate flag can never drift
//     between the quiz, the catalog and the detail pages.
//   - The compare selection: assets/paddle-tray.js, shared with the detail
//     pages (a paddle added there shows up in the tray here).
//   - fitScore and its rating tables are LIFTED VERBATIM from paddle-grid.js,
//     comments included — see the block below. They are production's tuned
//     ranking, not something to re-derive.
//
// The licensing rule (PADDLE_DATA_SETUP.md) governs every bar on every card:
// the percentiles rank and position, and are never printed. tierWord() supplies
// the word; the fill width supplies the position. No numbers.

import { vendorLinkFor, trackVendorClicks } from "/assets/affiliate-links.js";
import {
  powerRating,
  controlRating,
  spinRatingOf,
  forgivenessRatingOf,
  allCourtFit,
  tiebreakByTrait,
} from "/assets/paddle-ratings.js";
import {
  esc,
  approvalNote,
  moneyLabel,
  hasLab,
  qualityScore,
  CORE_BUCKETS,
  GRIP_BUCKETS,
  FACETS,
  emptyFilters,
  brandOptions,
  applyFacets,
  facetCounts,
  SORTS,
  sortRows,
  COLLECTIONS,
  miniBars,
} from "/assets/paddle-model.js";
import { getCompare, subscribe, toggleCompare, mountCompareTray, captureListFocus } from "/assets/paddle-tray.js";

// See assets/analytics.js. Deliberately NOT sending the search box's contents:
// the facets are a fixed enum and safe to report, but a free-text field can
// contain anything a visitor types, and /privacy commits to aggregate traffic
// data. Length and hit-count answer the product question ("is search pulling
// its weight?") without collecting prose.
const track = (name, params) => {
  if (typeof window.pbaTrack === "function") window.pbaTrack(name, params);
};

const PAGE = 30;
// How many brands the rail shows before the expander. 56 brands unrolled is
// taller than the viewport and buries every facet under it.
const BRAND_TOP = 10;

/* ================================================================== ranking
 *
 * Everything from here to fitScore() is lifted verbatim from paddle-grid.js —
 * production's tuned ranking, with the measurements that justify each weight.
 * Copied rather than imported because paddle-grid.js is the module this one
 * replaces and will be deleted; re-deriving these numbers would quietly
 * re-rank the catalog.
 */

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

/* ------------------------------------------------------------ facet extras */

// The parenthetical on a bucket ("thin & poppy"). The model carries these on
// the bucket definitions but FACETS.options is a flat list of labels, so the
// note has to be looked back up. Rendered as plain text inside the label rather
// than a new element — a class the stylesheet has never heard of would ship
// unstyled.
const OPTION_NOTES = new Map(
  [...CORE_BUCKETS, ...GRIP_BUCKETS].filter((b) => b.note).map((b) => [b.label, b.note])
);

// Play-style tag modifier. "All-Court" cannot go into a class name as-is, and
// the 9 paddles with no paddleType get the "Unrated" chip rather than no chip,
// so the card never has a silently missing row.
const TYPE_MOD = { Power: "power", Control: "control", "All-Court": "allcourt" };

/* --------------------------------------------------------------- URL state */

// Namespaced rather than named after what they filter. `preset` in particular
// is spoken for site-wide: it is paddle-charts.js's stress-test lens on
// /paddles, and four of its five values overlap COLLECTIONS keys, so a param
// with that name here would be ambiguous to anyone reading a shared link even
// though the charts no longer run on this page. See restoreFromUrl().
//
// Every write MERGES into the existing query string rather than replacing it,
// so params this module does not own — campaign tags, anything a future
// consumer adds — survive a filter change instead of being silently dropped.
const P_Q = "q";
const P_SORT = "s";
const P_PAGE = "pg";
// Collections get their own key rather than reusing `preset`, whose values
// overlap the collection keys four ways out of five. See restoreFromUrl().
const P_COLL = "c";
const facetParam = (key) => `f_${key}`;

/* ------------------------------------------------------------------- utils */

// `hidden` alone is not enough. The UA sets [hidden]{display:none} at the
// lowest specificity, so any `.pn-opt { display: flex }` in the stylesheet
// beats it and the "hidden" row stays on screen. The inline style is what
// actually hides it; the attribute is what tells assistive tech.
function showEl(el, on) {
  if (!el) return;
  el.hidden = !on;
  el.style.display = on ? "" : "none";
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

class PaddleFinder {
  constructor(root, paddles, affiliateMap) {
    this.root = root;
    this.rows = paddles;
    this.total = paddles.length;
    this.affiliateMap = affiliateMap;
    this.byId = new Map(paddles.map((p) => [p.id, p]));
    this.brands = brandOptions(paddles);
    this.labCount = paddles.filter(hasLab).length;

    this.filters = emptyFilters();
    // Two copies of the search string on purpose: `q` is the lower-cased needle
    // matchesQuery() compares against a lower-cased haystack, `qRaw` is what the
    // box shows and what the shareable URL carries — so a link someone sends
    // reads "?q=Perseus" rather than shouting the correction back at them.
    this.q = "";
    this.qRaw = "";
    this.sort = SORTS[0].key;
    this.page = 1;
    this.brandExpanded = false;
    this.collection = null; // which chip is lit, if any

    // Delegated once on the root, so the handlers survive every region patch
    // below. Per-node listeners would have to be rebound on each re-render and
    // would leak one closure per card per keystroke.
    root.addEventListener("click", (e) => this.onClick(e));
    root.addEventListener("change", (e) => this.onChange(e));
    root.addEventListener("input", (e) => this.onInput(e));
    // Enter in the search box would otherwise submit an enclosing form (the
    // page has one for site search) and reload, discarding every filter. The
    // list is already live on input, so Enter has nothing left to do.
    root.addEventListener("submit", (e) => e.preventDefault());
    root.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.railEl && this.railEl.classList.contains("is-open")) this.closeRail();
    });
  }

  /* ------------------------------------------------------------ URL state */

  // Only values that are real options are accepted. A hand-edited or truncated
  // URL can otherwise leave a filter active with no checkbox anywhere that can
  // switch it off.
  restoreFromUrl() {
    let sp;
    try {
      sp = new URLSearchParams(window.location.search);
    } catch {
      return; // no URL access (sandboxed) — start from the defaults
    }

    // DO NOT read ?preset= here. The handoff README describes it as a browse
    // param this module should honour, but that is a misreading: `preset`
    // belongs to assets/paddle-charts.js (see DESIGN.md, "The 2c preset syncs to
    // a ?preset= param"), and four of its five values — spin, control, power,
    // value — are also COLLECTIONS keys.
    //
    // The charts have since moved off this page entirely, so nothing here writes
    // ?preset= any more and the two params can no longer collide on one URL.
    // The rule stands anyway, for the links that outlived the collision: a
    // /paddles chart URL pasted onto this path, or a bookmark from before the
    // charts were removed, would land on ?preset=value and silently apply the
    // Under-$100 price filter — 486 paddles become 22, with a filter chip the
    // visitor never set, which writeUrl() then persists as f_price so the
    // accident is sticky and shareable. Honouring a param this page does not own
    // was the bug; deleting its writer does not make honouring it correct.
    //
    // A collection is addressable as ?c=<key> instead. It is applied first and
    // then overwritten by any explicit params on the same URL, so ?c=power&pg=3
    // means "the Big power collection, page 3" rather than silently resetting
    // to page 1.
    const coll = COLLECTIONS.find((c) => c.key === sp.get(P_COLL));
    if (coll) this.applyCollection(coll, { silent: true });

    this.qRaw = sp.get(P_Q) || "";
    this.q = this.qRaw.trim().toLowerCase();
    const s = sp.get(P_SORT);
    if (SORTS.some((x) => x.key === s)) this.sort = s;
    const pg = parseInt(sp.get(P_PAGE), 10);
    if (Number.isFinite(pg) && pg > 0) this.page = pg;

    for (const f of FACETS) {
      const param = facetParam(f.key);
      // Absent param means "leave it alone", not "clear it" — on a ?c=power URL
      // the collection has already populated this.filters, and overwriting every
      // facet with an empty getAll() would wipe the collection it just applied.
      if (!sp.has(param)) continue;
      const allowed = f.key === "brand" ? this.brands : f.options;
      const chosen = sp.getAll(param).filter((v) => allowed.includes(v));
      // De-duped: ?f_type=Power&f_type=Power would otherwise render two active
      // chips that both remove the same value.
      this.filters[f.key] = Array.from(new Set(chosen));
    }
  }

  // Debounced because Safari throttles history writes (~100 per 30s) and a fast
  // typist in the search box would burn that budget in one sentence, after
  // which the URL silently stops tracking the page.
  scheduleUrl() {
    clearTimeout(this.urlTimer);
    this.urlTimer = setTimeout(() => this.writeUrl(), 250);
  }

  writeUrl() {
    let sp;
    try {
      sp = new URLSearchParams(window.location.search);
    } catch {
      return;
    }
    // Clear only OUR keys. Everything else on the query string — `preset`,
    // campaign tags — is another owner's and survives untouched.
    sp.delete(P_Q);
    sp.delete(P_SORT);
    sp.delete(P_PAGE);
    sp.delete(P_COLL);
    for (const f of FACETS) sp.delete(facetParam(f.key));

    // The collection AND the facets it set are both written. The redundancy is
    // deliberate: it keeps the chip lit on a shared link, while the explicit
    // f_* params mean an old link still reproduces what its sender actually saw
    // even if the collection's definition is retuned later.
    if (this.collection) sp.set(P_COLL, this.collection);
    if (this.q) sp.set(P_Q, this.qRaw.trim());
    if (this.sort !== SORTS[0].key) sp.set(P_SORT, this.sort);
    if (this.page > 1) sp.set(P_PAGE, String(this.page));
    for (const f of FACETS) for (const v of this.filters[f.key]) sp.append(facetParam(f.key), v);

    const qs = sp.toString();
    // replaceState, not pushState: filtering is not navigation, and 40 pushes
    // of the Back button to escape a session of checkbox-clicking is a trap.
    // The hash is preserved — /paddles/browse#rent is a real inbound link.
    try {
      window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`);
    } catch {
      /* history unavailable — the page still works, it just can't be shared */
    }
  }

  /* -------------------------------------------------------------- querying */

  // fitScore takes ONE value per axis — TYPE_FIT[filters.type] is a lookup, not
  // a set intersection — so a multi-select facet can only feed it once the
  // visitor has narrowed to exactly one type or one skill level. Two checked
  // values means "either of these", which has no single gradient to rank along,
  // and inventing one (max? mean of both fits?) would be a ranking nobody asked
  // for. Those fall back to the neutral qualityScore, same as no filter at all.
  scoreFn() {
    const type = this.filters.type.length === 1 ? this.filters.type[0] : null;
    const skill = this.filters.skill.length === 1 ? this.filters.skill[0] : null;
    if (!TYPE_FIT[type] && !SKILL_FIT[skill]) return qualityScore;
    const legacy = { type, skill };
    // Non-null by construction: fitScore only returns null when neither axis is
    // rankable, which the guard above has already excluded.
    return (p) => fitScore(p, legacy);
  }

  // The words under "Ranked by fit for …". Only "best" is actually ordered by
  // the score; the other seven sorts have their own basis and claiming a fit
  // ranking there would be false.
  rankBasis() {
    if (this.sort !== "best") return "";
    const type = this.filters.type.length === 1 ? this.filters.type[0] : null;
    const skill = this.filters.skill.length === 1 ? this.filters.skill[0] : null;
    const bits = [TYPE_FIT[type] ? type : null, SKILL_FIT[skill] ? skill : null].filter(Boolean);
    return bits.length ? ` Ranked by fit for ${bits.join(" · ").toLowerCase()}.` : "";
  }

  activeCount() {
    return FACETS.reduce((n, f) => n + this.filters[f.key].length, 0);
  }

  anyActive() {
    return this.activeCount() > 0 || Boolean(this.q);
  }

  recompute() {
    const matched = applyFacets(this.rows, this.filters, this.q);
    this.list = sortRows(matched, this.sort, { score: this.scoreFn(), tiebreak: tiebreakByTrait, control: controlRating });
    this.pageCount = Math.max(1, Math.ceil(this.list.length / PAGE));
    // Filtering down while on page 12 must not strand the visitor on an empty
    // page with no way back but the pager.
    if (this.page > this.pageCount) this.page = this.pageCount;
  }

  /* ----------------------------------------------------------------- shell */

  // Built ONCE. Re-rendering the root on every checkbox click would destroy the
  // control the visitor just operated — focus falls to <body>, so the next Tab
  // restarts at the top of the document (WCAG 2.4.3) — and would replace the
  // role="status" node with a fresh one, which is never announced (a live
  // region has to persist and have its TEXT change; one inserted with content
  // already in it doesn't fire). Everything below patches a region instead.
  mount() {
    this.root.innerHTML = `
      <div class="pn-tools">
        <div class="pn-search">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false"><circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.6"></circle><path d="M11 11L14.5 14.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"></path></svg>
          <label class="visually-hidden" for="pn-q">Search paddles by brand or model</label>
          <input id="pn-q" class="pn-search-input" type="search" autocomplete="off"
                 placeholder="Search ${this.total} paddles or brands…" data-role="q">
          <button type="button" class="pn-search-clear" data-act="clear-q">Clear</button>
        </div>
        <div class="pn-collections" role="group" aria-label="Paddle collections">
          ${COLLECTIONS.map(
            (c) => `<button type="button" class="pn-chip" data-collection="${esc(c.key)}" aria-pressed="false">${esc(c.label)}</button>`
          ).join("")}
        </div>
      </div>

      <div class="pn-layout">
        <button type="button" class="pn-rail-toggle" data-act="open-rail" aria-expanded="false" aria-controls="pn-rail">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true" focusable="false"><path d="M1 3h12M3.5 7h7M5.5 11h3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"></path></svg>
          <span data-role="rail-toggle-label">Filters</span>
        </button>

        <aside class="pn-rail" id="pn-rail" aria-label="Filter paddles" tabindex="-1">
          <div class="pn-rail-head">
            <span>Filters</span>
            <button type="button" class="pn-reset" data-act="reset">Reset all</button>
            <button type="button" class="pn-sheet-close" data-act="close-rail">Done</button>
          </div>
          ${FACETS.map((f) => this.facetHtml(f)).join("")}
          <p class="pn-rail-note">Lab-measured spin, power and forgiveness cover ${this.labCount} of ${this.total} paddles; the rest show manufacturer specs only.</p>
        </aside>

        <div class="pn-results" data-role="results" tabindex="-1">
          <div class="pn-toolbar">
            <p class="pn-count" role="status"></p>
            <div class="pn-active" data-role="active"></div>
            <div class="pn-sort">
              <label for="pn-sort">Sort</label>
              <select id="pn-sort" data-role="sort">
                ${SORTS.map((s) => `<option value="${esc(s.key)}">${esc(s.label)}</option>`).join("")}
              </select>
            </div>
          </div>
          <div data-role="disclosure"></div>
          <!-- Kept from production, pg-rent-* classes intact so paddles.css
               still styles it. The href moved from "#rent" to /paddles/rent:
               that anchor only exists on the rent page, so on this one the
               link had been going nowhere since the three-lane split. -->
          <div class="pg-rent">
            <span class="pg-rent-label">New to the game?</span>
            <span class="pg-rent-body">Rent a paddle at a beginner-friendly court before you buy — most run $5–10 for the session.</span>
            <a class="pg-rent-link" href="/paddles/rent">Rent or demo first →</a>
          </div>
          <div data-role="body"></div>
          <div data-role="pager"></div>
        </div>
      </div>`;

    const $ = (sel) => this.root.querySelector(sel);
    this.qEl = $('[data-role="q"]');
    this.clearQEl = $(".pn-search-clear");
    this.resetEl = $(".pn-reset");
    this.sheetCloseEl = $(".pn-sheet-close");
    this.railEl = $(".pn-rail");
    this.railToggleEl = $(".pn-rail-toggle");
    this.railToggleLabelEl = $('[data-role="rail-toggle-label"]');
    this.resultsEl = $('[data-role="results"]');
    this.countEl = $(".pn-count");
    this.activeEl = $('[data-role="active"]');
    this.sortEl = $('[data-role="sort"]');
    this.discEl = $('[data-role="disclosure"]');
    this.bodyEl = $('[data-role="body"]');
    this.pagerEl = $('[data-role="pager"]');

    // Cache the option rows once. Every later update writes counts and checked
    // state into these same nodes — rebuilding the rail's markup would move
    // focus off the checkbox mid-click and re-collapse the brand list.
    this.optionEls = new Map();
    for (const f of FACETS) {
      this.optionEls.set(
        f.key,
        Array.from(this.root.querySelectorAll(`.pn-opt[data-facet="${f.key}"]`))
      );
    }

    this.qEl.value = this.qRaw;
    this.sortEl.value = this.sort;
    this.syncChecks();
    this.update({ keepPage: true });

    mountCompareTray();
    // The card buttons and the bottom tray read one selection. Subscribing
    // (rather than re-rendering the grid on every toggle) is what keeps focus on
    // the button that was just pressed — and it is what makes FIFO eviction
    // visible: adding a third paddle flips TWO card buttons, the one clicked and
    // the one that just left the tray, neither of which is re-rendered.
    subscribe(() => this.syncCompareButtons());
    return this;
  }

  facetHtml(f) {
    const options = f.key === "brand" ? this.brandOrder() : f.options;
    const rows = options.map((label) => {
      const note = OPTION_NOTES.get(label);
      return `<label class="pn-opt" data-facet="${esc(f.key)}" data-value="${esc(label)}">
          <input type="checkbox" data-facet="${esc(f.key)}" value="${esc(label)}">
          <span class="pn-opt-label">${esc(label)}${note ? ` · ${esc(note)}` : ""}</span>
          <span class="pn-opt-count" aria-hidden="true"></span>
        </label>`;
    });
    // The expander sits OUTSIDE .pn-opts so pressing it doesn't destroy the
    // element focus is currently on.
    const more =
      f.key === "brand"
        ? `<button type="button" class="pn-more" data-act="brands" aria-expanded="false">Show all ${this.brands.length} brands</button>`
        : "";
    return `<section class="pn-facet" data-facet="${esc(f.key)}">
        <h3 class="pn-facet-head">${esc(f.label)}</h3>
        <div class="pn-opts">${rows.join("")}</div>
        ${more}
      </section>`;
  }

  // Brand order is fixed at mount, by catalog-wide count. It deliberately does
  // NOT re-sort as filters narrow: a list that reorders under the cursor is
  // unusable, and the brand you just checked could drop out of the visible ten
  // and become impossible to uncheck without expanding.
  brandOrder() {
    const n = new Map();
    for (const p of this.rows) if (p.brand) n.set(p.brand, (n.get(p.brand) || 0) + 1);
    return this.brands.slice().sort((a, b) => (n.get(b) || 0) - (n.get(a) || 0) || a.localeCompare(b));
  }

  /* ---------------------------------------------------------------- events */

  onInput(e) {
    const box = e.target.closest('[data-role="q"]');
    if (!box) return;
    this.qRaw = box.value;
    this.q = this.qRaw.trim().toLowerCase();
    this.collection = null;
    this.update();
    clearTimeout(this.searchTimer);
    const len = this.q.length;
    if (!len) return;
    // One event at the end of typing, not one per keystroke.
    this.searchTimer = setTimeout(() => {
      track("browse_search", { query_length: len, results: this.list.length, found: this.list.length > 0 ? 1 : 0 });
    }, 900);
  }

  onChange(e) {
    const box = e.target.closest('input[type="checkbox"][data-facet]');
    if (box) {
      const key = box.dataset.facet;
      const val = box.value;
      const at = this.filters[key].indexOf(val);
      if (box.checked && at < 0) this.filters[key].push(val);
      else if (!box.checked && at >= 0) this.filters[key].splice(at, 1);
      this.collection = null;
      this.update();
      track("browse_filter", { filter: key, value: val, on: box.checked ? 1 : 0, results: this.list.length });
      return;
    }
    const sel = e.target.closest('[data-role="sort"]');
    if (sel) {
      this.sort = sel.value;
      this.collection = null;
      this.update();
      track("browse_sort", { sort: this.sort, results: this.list.length });
    }
  }

  onClick(e) {
    const act = e.target.closest("[data-act]");
    const chip = e.target.closest("[data-collection]");

    if (chip) {
      const c = COLLECTIONS.find((x) => x.key === chip.dataset.collection);
      if (c) this.applyCollection(c);
      return;
    }
    if (!act) return;

    switch (act.dataset.act) {
      case "clear-q":
        this.q = "";
        this.qRaw = "";
        this.qEl.value = "";
        this.collection = null;
        this.qEl.focus();
        this.update();
        break;
      case "reset":
        this.resetAll();
        break;
      case "brands":
        this.brandExpanded = !this.brandExpanded;
        act.setAttribute("aria-expanded", this.brandExpanded ? "true" : "false");
        act.textContent = this.brandExpanded ? "Show fewer" : `Show all ${this.brands.length} brands`;
        this.syncBrandVisibility();
        break;
      case "open-rail":
        this.openRail();
        break;
      case "close-rail":
        this.closeRail();
        break;
      case "compare": {
        const p = this.byId.get(act.dataset.id);
        // No cap check and no disabled state to respect: toggleCompare() evicts
        // the oldest pick when the tray is full, so every click is a real add or
        // remove. `act.disabled` is still tested because a click can arrive on a
        // button disabled for some other reason later.
        if (p && !act.disabled) {
          // Snapshot before the toggle. At the cap an add silently evicts the
          // oldest pick, and an evicting add is otherwise indistinguishable in
          // GA4 from an ordinary one — same action, same tray_size of 2. This is
          // the main monetization on-ramp, so how often the tray drops a paddle
          // the visitor had already shortlisted is worth being able to measure.
          //
          // Diffed rather than read from the tray: takeEvicted() is only truthy
          // during write()'s synchronous subscriber fan-out, which has already
          // finished by the time toggleCompare() returns here.
          const before = getCompare().map((x) => x.id);
          const on = toggleCompare(p);
          const after = getCompare();
          const evicted = on ? before.find((id) => id !== p.id && !after.some((x) => x.id === id)) : null;
          track("browse_compare", {
            action: on ? "add" : "remove",
            paddle: p.id,
            tray_size: after.length,
            ...(evicted ? { evicted } : {}),
          });
        }
        break;
      }
      case "page": {
        const n = Number(act.dataset.page);
        if (!Number.isFinite(n) || n === this.page) break;
        this.page = Math.min(Math.max(1, n), this.pageCount);
        this.update({ keepPage: true });
        // Focus first, then scroll: a pager click leaves focus on a button that
        // is about to be re-rendered, so without this the keyboard lands back
        // at <body> and the next Tab restarts the whole document.
        this.resultsEl.focus({ preventScroll: true });
        this.resultsEl.scrollIntoView({ block: "start" });
        track("browse_page", { page: this.page, pages: this.pageCount });
        break;
      }
      case "remove-facet": {
        const { facet, value } = act.dataset;
        this.filters[facet] = this.filters[facet].filter((v) => v !== value);
        this.collection = null;
        this.syncChecks();
        this.update();
        break;
      }
      default:
        break;
    }
  }

  // A collection is a fresh starting point, not another constraint stacked on
  // whatever was already checked — so it clears the filters AND the search box
  // before applying its own. COLLECTIONS.filters is a partial for exactly that
  // reason.
  applyCollection(c, opts = {}) {
    this.filters = emptyFilters();
    // .slice(), not the array itself: COLLECTIONS is a module-level constant and
    // checking a box afterwards would push into it, permanently editing the
    // collection for the rest of the session.
    for (const [key, values] of Object.entries(c.filters)) this.filters[key] = values.slice();
    this.q = "";
    this.qRaw = "";
    this.sort = c.sort || SORTS[0].key;
    this.page = 1;
    this.collection = c.key;
    if (opts.silent) return; // called from restoreFromUrl, before the shell exists
    this.qEl.value = "";
    this.sortEl.value = this.sort;
    this.syncChecks();
    this.update();
    track("browse_collection", { collection: c.key, results: this.list.length });
  }

  resetAll() {
    this.filters = emptyFilters();
    this.q = "";
    this.qRaw = "";
    this.page = 1;
    this.collection = null;
    this.qEl.value = "";
    this.syncChecks();
    this.update();
  }

  openRail() {
    this.railEl.classList.add("is-open");
    this.railToggleEl.setAttribute("aria-expanded", "true");
    // Move focus into the sheet, or a keyboard visitor is left tabbing through
    // the results behind an overlay they can't see past.
    //
    // NOT `querySelector("button, input")`. The first match in DOM order is
    // .pn-reset, which syncChrome() hides via showEl() whenever no filter is
    // active — i.e. on exactly the first open, the common case. focus() on a
    // display:none element is a silent no-op with no error, so the sheet opened
    // with activeElement still on <body> and the next Tab restarted at the top
    // of the document, behind the overlay.
    //
    // The Done button is the deliberate landing spot rather than just "the
    // first visible control": it is the way back out, which is what someone who
    // has just opened a full-screen sheet most needs to be able to find. The
    // offsetParent test skips anything showEl() has hidden; the rail itself
    // (tabindex="-1") is the last resort so focus is never left on <body>.
    const visible = (n) => n && n.offsetParent !== null;
    const target = [this.sheetCloseEl, ...this.railEl.querySelectorAll("button, input")].find(visible);
    (target || this.railEl).focus();
  }

  closeRail() {
    this.railEl.classList.remove("is-open");
    this.railToggleEl.setAttribute("aria-expanded", "false");
    this.railToggleEl.focus();
  }

  /* ----------------------------------------------------------- region sync */

  update(opts = {}) {
    if (!opts.keepPage) this.page = 1;
    this.recompute();
    this.syncCounts();
    this.syncActive();
    this.syncStatus();
    this.syncDisclosure();
    this.renderBody();
    this.renderPager();
    this.syncChrome();
    this.scheduleUrl();
  }

  // Push state INTO the existing controls rather than re-emitting markup with
  // `checked` on the right boxes — the controls outlive a render now.
  syncChecks() {
    for (const [key, els] of this.optionEls) {
      const chosen = this.filters[key];
      for (const el of els) {
        const box = el.querySelector("input");
        box.checked = chosen.includes(box.value);
      }
    }
  }

  // Counts are computed against every OTHER facet (facetCounts passes the
  // facet's own key as `skip`), which is what stops a facet zeroing itself out:
  // check "Power" and without the skip every other play style instantly reads 0
  // and can never be widened again without a reset.
  syncCounts() {
    for (const f of FACETS) {
      const counts = facetCounts(this.rows, this.filters, this.q, f);
      for (const el of this.optionEls.get(f.key)) {
        const n = counts.get(el.dataset.value) || 0;
        el.querySelector(".pn-opt-count").textContent = String(n);
        // The count is the entire premise of this rail, and it reaches a screen
        // reader through NOTHING otherwise: .pn-opt-count is aria-hidden (kept
        // that way so the mono number is not read twice, once as the label's
        // text and once as its own node) and .is-zero is a colour change. So a
        // blind user heard "Widebody, checkbox" whether it matched 131 paddles
        // or none, and could only find out by checking it and hearing the
        // result count fall to zero.
        //
        // aria-label overrides the wrapping <label>, so it has to carry the
        // whole visible string — read back off the DOM rather than rebuilt from
        // OPTION_NOTES here, so the two can never word it differently.
        const box = el.querySelector("input");
        const text = el.querySelector(".pn-opt-label").textContent;
        box.setAttribute("aria-label", `${text} — ${n === 0 ? "no matches" : plural(n, "paddle", "paddles")}`);
        // Greyed, not removed and not disabled: a zero-count option that
        // vanishes takes the layout with it on every keystroke, and one that
        // can't be clicked can't be UNchecked either.
        el.classList.toggle("is-zero", n === 0);
      }
    }
    this.syncBrandVisibility();
  }

  // Collapsed shows the first BRAND_TOP of the fixed order — plus any brand
  // that is currently checked, wherever it sits in the list. Without that
  // exception, checking "Vatic Pro" from the expanded list and collapsing again
  // hides an active filter with no control to release it.
  syncBrandVisibility() {
    const els = this.optionEls.get("brand");
    if (!els) return;
    els.forEach((el, i) => {
      const on = el.querySelector("input").checked;
      showEl(el, this.brandExpanded || i < BRAND_TOP || on);
    });
  }

  syncActive() {
    const chips = [];
    for (const f of FACETS) {
      for (const v of this.filters[f.key]) {
        chips.push(
          `<button type="button" class="pn-active-chip" data-act="remove-facet" data-facet="${esc(f.key)}" data-value="${esc(v)}">` +
            `<span class="visually-hidden">Remove filter: </span>${esc(f.label)}: ${esc(v)}<span aria-hidden="true"> ×</span></button>`
        );
      }
    }
    // Removing a chip runs syncChecks() -> update() -> here, and this
    // assignment destroys the very button that was just pressed — the same
    // dropped-to-<body> bug the pager handles by hand above. Move focus to the
    // chip that slid into the removed one's place, or to the results region
    // when that was the last filter and the chip row is now empty.
    const restore = captureListFocus(this.activeEl, ".pn-active-chip");
    this.activeEl.innerHTML = chips.join("");
    if (restore() === null) this.resultsEl.focus({ preventScroll: true });
  }

  // A persistent role="status" whose TEXT changes — never a replaced node. See
  // PBUtils.setStatus in dom-utils.js; a live region inserted with its content
  // already in place is never announced.
  syncStatus() {
    const n = this.list.length;
    const text =
      n === this.total
        ? `All ${this.total} paddles.`
        : `${plural(n, "paddle", "paddles")} of ${this.total}.`;
    window.PBUtils.setStatus(this.countEl, `${text}${this.rankBasis()}`);
  }

  // One compact muted line, sitting with the links rather than in a footnote.
  // The Amazon Associates sentence stays VERBATIM — it is required by the
  // Operating Agreement wherever Associates links appear, so amazonNotice is the
  // one part of this string that must never be shortened or paraphrased. Three
  // branches, because a filter that matches nothing shows no links at all:
  // claiming anything about commission there would describe links that don't exist.
  syncDisclosure() {
    const links = this.pageRows().map((p) => vendorLinkFor(p, this.affiliateMap)).filter(Boolean);
    const anyAmazon = links.some((l) => l.isAmazon);
    const anyAffiliate = links.some((l) => l.isAffiliate);
    const amazonNotice = anyAmazon ? " As an Amazon Associate I earn from qualifying purchases." : "";
    this.discEl.innerHTML = !links.length
      ? ""
      : anyAffiliate
        ? `<p class="affiliate-disclosure">Affiliate links, at no extra cost to you.${amazonNotice} <a href="/affiliate-disclosure">How this works</a>.</p>`
        : `<p class="affiliate-disclosure">These links go to each brand's own site — we earn no commission. <a href="/affiliate-disclosure">How this works</a>.</p>`;
  }

  syncChrome() {
    showEl(this.clearQEl, Boolean(this.q));
    showEl(this.resetEl, this.anyActive());
    const n = this.activeCount();
    this.railToggleLabelEl.textContent = n ? `Filters (${n})` : "Filters";
    for (const chip of this.root.querySelectorAll("[data-collection]")) {
      const on = chip.dataset.collection === this.collection;
      chip.classList.toggle("is-on", on);
      chip.setAttribute("aria-pressed", on ? "true" : "false");
    }
  }

  pageRows() {
    return this.list.slice((this.page - 1) * PAGE, this.page * PAGE);
  }

  /* ------------------------------------------------------------------ body */

  renderBody() {
    const rows = this.pageRows();
    if (!rows.length) {
      // h3 rather than a bespoke class: every heading on this site is already
      // the editorial serif (DESIGN.md), so the design's serif line costs no
      // new CSS.
      this.bodyEl.innerHTML = `<div class="pn-empty">
          <h3>Nothing matches that combination.</h3>
          <p>Loosen a filter or two — the catalog is deep.</p>
          <button type="button" class="btn" data-act="reset">Reset all filters</button>
        </div>`;
      return;
    }
    const offset = (this.page - 1) * PAGE;
    this.bodyEl.innerHTML = `<div class="pn-grid">${rows.map((p, i) => this.cardHtml(p, offset + i)).join("")}</div>`;
    this.syncCompareButtons();
  }

  // `rank` is the paddle's position in the WHOLE filtered list, not its index
  // on this page — the buy link reports it as data-pq-position, and a per-page
  // 1..30 would silently rescale a metric GA4 has been collecting as 1..N since
  // before pagination existed.
  cardHtml(p, rank) {
    const link = vendorLinkFor(p, this.affiliateMap);
    const type = p.paddleType || "Unrated";
    const tags = [
      `<span class="pn-tag pn-tag--${TYPE_MOD[type] || "unrated"}">${esc(type)}</span>`,
      p.shape ? `<span class="pn-tag">${esc(p.shape)}</span>` : "",
      p.skillLevel ? `<span class="pn-tag">${esc(p.skillLevel)}</span>` : "",
    ].join("");

    // Bars are positioned by the banded percentile; the WORD is what the row
    // prints. Never the number — see the licensing note at the top of
    // paddle-model.js. 126 paddles have no measured axis at all and get the
    // honest line instead of three empty tracks.
    const bars = hasLab(p)
      ? `<div class="pn-bars">${miniBars(p, { control: controlRating })
          .map(
            (b) => `<div class="pn-bar">
              <span class="pn-bar-label">${esc(b.label)}</span>
              <span class="pn-track"><span class="pn-fill pn-fill--${esc(b.key)}" style="width:${Math.round(b.v * 100)}%"></span></span>
              <span class="pn-bar-word">${esc(b.word)}</span>
            </div>`
          )
          .join("")}</div>`
      : `<p class="pn-nolab">Not lab-tested yet — specs only</p>`;

    const specs = [
      p.coreThicknessMm != null ? `${p.coreThicknessMm}mm` : null,
      p.weightOz != null ? `${p.weightOz} oz` : null,
    ].filter(Boolean);

    let buy = "";
    if (link) {
      // rel and the "· affiliate" note are both conditional on isAffiliate — a
      // plain vendor link must never be dressed up as, or disclosed as, one
      // that earns a commission. approvalNote() rather than
      // `${approvalBody} approved`, which renders "Unapproved approved" on the
      // 5 paddles that are not tournament legal.
      const rel = link.isAffiliate ? "sponsored nofollow noopener" : "nofollow noopener";
      const note = [approvalNote(p), link.isAffiliate ? "affiliate" : null].filter(Boolean).join(" · ");
      const data = [
        `data-pq-paddle="${esc(p.id)}"`,
        `data-pq-brand="${esc(p.brand)}"`,
        `data-pq-link-type="${esc(link.linkType || "unknown")}"`,
        `data-pq-affiliate="${link.isAffiliate ? "1" : "0"}"`,
        // Still "grid": same page, same funnel, same 1..N position scale as
        // before. A new surface name would fork the series in GA4 and nothing
        // can backfill the old one.
        `data-pq-surface="grid"`,
        `data-pq-position="${rank + 1}"`,
      ].join(" ");
      // shortLabel, not label: at card width "Search Honolulu Pickleball" is a
      // 193px button in a 218px content box. The brand is the card's own
      // eyebrow, and the visually-hidden suffix still names brand + model for
      // anyone who reaches the link out of context.
      // .pn-buy alone, NOT "btn pn-buy": the global .btn is the site's solid
      // optic primary, and 30 of them in a grid turns the catalog into a wall
      // of buttons with no visual hierarchy. A card's job is to get you to the
      // detail page; the solid primary CTA lives there, once.
      buy = `<a class="pn-buy" href="${esc(link.href)}" target="_blank" rel="${rel}" ${data}>${esc(link.shortLabel || link.label)}<span class="visually-hidden"> — ${esc(p.brand)} ${esc(p.name)} (opens in new tab)</span></a>
        ${note ? `<span class="pn-note">${esc(note)}</span>` : ""}`;
    } else {
      const note = approvalNote(p);
      buy = note ? `<span class="pn-note">${esc(note)}</span>` : "";
    }

    // The name is the stretched link over the whole card. The compare button
    // and the buy link come AFTER it in source order so the stylesheet can lift
    // them above the stretch without a z-index war (see .pn-card in the
    // stylesheet); anything before it would be unclickable.
    return `<article class="pn-card" data-id="${esc(p.id)}">
        <span class="pn-card-brand">${esc(p.brand)}</span>
        <h3 class="pn-card-name"><a class="pn-card-link" href="/paddles/browse/p/${esc(p.id)}">${esc(p.name)}</a></h3>
        <div class="pn-card-chips">${tags}</div>
        ${bars}
        ${specs.length ? `<p class="pn-card-specs">${esc(specs.join(" · "))}</p>` : ""}
        <div class="pn-card-foot">
          <span class="pn-price">${esc(moneyLabel(p.price))}</span>
          ${buy}
        </div>
        <button type="button" class="pn-compare" data-act="compare" data-id="${esc(p.id)}" aria-pressed="false">+ Compare</button>
      </article>`;
  }

  renderPager() {
    if (this.pageCount <= 1) {
      this.pagerEl.innerHTML = "";
      return;
    }
    const page = this.page;
    let nums;
    if (this.pageCount <= 7) {
      nums = Array.from({ length: this.pageCount }, (_, i) => i + 1);
    } else {
      // 1 … p-1 p p+1 … last. De-duped and sorted because near either end the
      // window overlaps the anchors (page 2 would otherwise render "1 1 2 3").
      nums = [...new Set([1, page - 1, page, page + 1, this.pageCount])]
        .filter((n) => n >= 1 && n <= this.pageCount)
        .sort((a, b) => a - b);
    }

    const items = [];
    nums.forEach((n, i) => {
      if (i > 0 && n - nums[i - 1] > 1) items.push(`<span aria-hidden="true">…</span>`);
      const on = n === page;
      items.push(
        `<button type="button" class="pn-page${on ? " is-current" : ""}" data-act="page" data-page="${n}"${on ? ' aria-current="page"' : ""}>` +
          `<span class="visually-hidden">Page </span>${n}</button>`
      );
    });

    const first = (page - 1) * PAGE + 1;
    const last = Math.min(this.list.length, page * PAGE);
    this.pagerEl.innerHTML = `<nav class="pn-pager" aria-label="Catalog pages">
        <button type="button" class="pn-page" data-act="page" data-page="${page - 1}"${page === 1 ? " disabled" : ""}>← Prev</button>
        ${items.join("")}
        <button type="button" class="pn-page" data-act="page" data-page="${page + 1}"${page === this.pageCount ? " disabled" : ""}>Next →</button>
      </nav>
      <p class="pn-pager-note">Page ${page} of ${this.pageCount} · showing ${first}–${last} of ${this.list.length}</p>`;
  }

  /* --------------------------------------------------------------- compare */

  // Patches the buttons in place. Re-rendering the grid here would drop focus
  // off the button that was just pressed — the whole reason the tray is a
  // subscription rather than a state field.
  //
  // Every button is rewritten on every change, not just the one clicked, because
  // the tray evicts: adding a third paddle turns one card's button on and
  // another's off, and the second card is nowhere near the cursor.
  syncCompareButtons() {
    const ids = getCompare().map((x) => x.id);
    for (const btn of this.root.querySelectorAll('[data-act="compare"]')) {
      const on = ids.includes(btn.dataset.id);
      btn.classList.toggle("is-on", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.textContent = on ? "✓ Comparing" : "+ Compare";
    }
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  // Bound before the mount guard and idempotent — this page is the only one
  // that loads it, so without this every buy click here goes uncounted.
  trackVendorClicks();
  const root = document.getElementById("paddle-finder-app");
  if (!root) return;
  try {
    const [paddles, affiliateMap] = await Promise.all([
      fetch("/assets/paddles.json").then((r) => r.json()),
      fetch("/assets/affiliate-map.json", { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    const finder = new PaddleFinder(root, paddles, affiliateMap);
    // URL state is restored BEFORE the shell is built, so the first paint is
    // already the filtered view — no flash of all 486 cards, and no second
    // layout pass on a shared link.
    finder.restoreFromUrl();
    finder.mount();
  } catch (err) {
    console.error("[PaddleFinder] Failed to load paddle data.", err);
    root.innerHTML = `<p class="pq-error">Couldn't load the paddle catalog right now — try refreshing the page.</p>`;
  }
});
