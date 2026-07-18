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
import { powerRating, controlRating, spinRatingOf, forgivenessRatingOf, tiebreak } from "/assets/paddle-ratings.js";
// The consolidated analytics view (axis explorer + value chart + stress-test),
// driven by the compare tray's selection. Same module the quiz results use.
import { renderPaddleCharts, seriesColorFor } from "/assets/paddle-charts.js";

const esc = (s) => window.PBUtils.escapeHtml(s);

// paddles.json's percentiles are coarsened to quartile tiers on the way out of
// scripts/rebuild_paddle_data.py — a data-licensing firewall (see RUNBOOK), and
// validate.mjs fails if the values are anything but these four. So the number is
// a TIER MIDPOINT, not a measurement: rendering "88th pct" would invent a
// precision the data doesn't carry and re-expose the licensed percentile the
// coarsening exists to withhold. paddle-quiz.js makes the same call for the
// comparison table ("deliberately paraphrased into a dot rating rather than
// citing the exact proprietary lab-tested percentiles"). Words, not numbers.
const TIER_WORD = { 0.13: "Low", 0.38: "Medium", 0.63: "High", 0.88: "Very high" };
const tierWord = (v) => (typeof v === "number" ? TIER_WORD[v] || null : null);

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
const FILTERS = [
  { key: "type", field: "paddleType", label: "Filter by paddle type", all: "All types",
    options: ["Power", "All-Court", "Control"] },
  { key: "shape", field: "shape", label: "Filter by shape", all: "All shapes",
    options: ["Elongated", "Widebody", "Hybrid", "Extra-elongated"] },
  { key: "price", field: null, label: "Filter by price", all: "All prices",
    options: [["under120", "Under $120"], ["120to200", "$120–$200"], ["over200", "$200+"]] },
  { key: "skill", field: "skillLevel", label: "Filter by skill level", all: "All skill levels",
    options: ["Beginner", "Intermediate", "Advanced"] },
];

const PRICE_TEST = {
  under120: (p) => p.price < 120,
  "120to200": (p) => p.price >= 120 && p.price <= 200,
  over200: (p) => p.price > 200,
};

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
const TYPE_FIT = {
  Power: (p) => powerRating(p),
  Control: (p) => controlRating(p),
  // Balance, not mediocrity: closest to an even split between power and control.
  "All-Court": (p) => 1 - Math.abs(powerRating(p) - controlRating(p)),
};

const SKILL_FIT = {
  // A beginner's paddle forgives: a big sweet spot matters more than pace.
  Beginner: (p) => forgivenessRatingOf(p),
  // Advanced play rewards what you can DO with the ball over what you survive.
  Advanced: (p) => (powerRating(p) + spinRatingOf(p)) / 2,
  // The all-rounder's compromise — some touch, still forgiving.
  Intermediate: (p) => (controlRating(p) + forgivenessRatingOf(p)) / 2,
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

// tiebreak() (spin → forgiveness → name) is shared with the quiz — it lives in
// paddle-ratings.js now so both surfaces order equal-scoring paddles the same
// way. Ties are the norm here, not an edge case: powerPercentile is coarsened to
// four quartile tiers (the licensing firewall — see TIER_WORD), so filtering to
// Power leaves ~187 paddles sharing about five distinct fit scores, ~37 tied at
// each. Without the tiebreak the order inside a tier would be catalog order —
// alphabetical by brand — so "#1 most powerful" would mean "first paddle whose
// brand starts with a digit". The rank number would be an accident in a
// precision costume.

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
    this.filters = { type: "all", shape: "all", price: "all", skill: "all" };
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
  }

  onInput(e) {
    const box = e.target.closest('[data-role="pg-search"]');
    if (!box) return;
    this.query = box.value.trim().toLowerCase();
    this.render();
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
    this.filters = { type: "all", shape: "all", price: "all", skill: "all" };
    this.query = "";
    // The controls outlive a render now, so state has to be pushed back into
    // them rather than re-emitted as markup with `selected` on the right option.
    this.root.querySelectorAll("select[data-filter]").forEach((s) => { s.value = "all"; });
    const box = this.root.querySelector('[data-role="pg-search"]');
    if (box) box.value = "";
    this.render();
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
        if (f.key === "price") {
          if (typeof p.price !== "number" || !PRICE_TEST[v](p)) return false;
        } else if (p[f.field] !== v) return false;
      }
      return true;
    });

    if (!rankable(this.filters)) return list;
    // Score once per paddle, not once per comparison — sort() calls the
    // comparator O(n log n) times and these ratings are not free.
    return list
      .map((p) => ({ p, fit: fitScore(p, this.filters) }))
      .sort((a, b) => (Math.abs(b.fit - a.fit) > 1e-9 ? b.fit - a.fit : tiebreak(a.p, b.p)))
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
      // link.label, not a generic "Check price": vendorLinkFor already knows
      // whether this is a verified deep link to the exact model ("Buy on
      // Amazon"), a search that may or may not surface it ("Search Amazon",
      // "Search Six Zero"), or just the brand's front door ("Visit Gearbox").
      // Saying which is honest about what the click will actually do, and it's
      // what the quiz's results have always said.
      foot = `<div class="pg-foot">
          <span class="pg-note">${esc(note)}</span>
          <a class="btn pg-buy" href="${esc(link.href)}" target="_blank" rel="${rel}" ${data}>${esc(link.label)}<span class="visually-hidden"> — ${esc(p.brand)} ${esc(p.name)} (opens in new tab)</span></a>
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
    this.root.innerHTML = `
      ${this.filterHtml()}
      <section class="pg-compare">
        <div class="pg-compare-head">
          <div>
            <p class="pc-eyebrow">Compare &amp; explore</p>
            <h2 class="pg-compare-title">Line paddles up side by side</h2>
          </div>
          <div class="pg-tray" data-role="pg-tray"></div>
        </div>
        <div class="pg-analytics" data-role="pg-analytics"></div>
      </section>
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
    this.render();
    this.renderTray();
    this.renderAnalytics();
    return this;
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
    this.renderAnalytics();
  }

  renderTray() {
    if (!this.selected.length) {
      this.trayEl.innerHTML = `<span class="pg-tray-hint">Add up to 3 paddles — tap a dot in the chart, or “+ Compare” on any card below.</span>`;
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
  renderAnalytics() {
    const featured = this.selected.map((id) => this.byId(id)).filter(Boolean);
    const n = featured.length;
    const components = ["explorer"];
    if (n >= 1) {
      components.unshift("strip");
      components.push("value");
    }
    if (n >= 2) components.push("stress");

    const prev = this.charts ? { xKey: this.charts.state.xKey, yKey: this.charts.state.yKey, preset: this.charts.state.preset } : null;
    this.analyticsEl.innerHTML = "";
    this.charts = renderPaddleCharts(this.analyticsEl, {
      paddles: this.paddles,
      featured,
      mode: "browse",
      components,
      initialState: prev,
      onDotClick: (paddle) => this.toggleCompare(paddle.id),
    });
  }

  render() {
    const list = this.filtered();
    this.ranked = rankable(this.filters);
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
