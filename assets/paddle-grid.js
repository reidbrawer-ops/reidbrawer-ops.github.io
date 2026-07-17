// Browsable paddle grid — the whole 486-paddle catalog behind four filters.
//
// Mounts into <div id="paddle-grid-app"> on paddles.html. Sibling to the quiz:
// the quiz answers "which paddle fits me?", this answers "show me everything."
// No framework — one class that re-renders its own root, matching paddle-quiz.js.
//
// Two things it deliberately does NOT do:
//   1. It does not build its own buy links. vendorLinkFor is imported from
//      assets/affiliate-links.js so the Amazon allowlist, ASIN deep-links and
//      the isAffiliate flag can never drift between the quiz and the grid.
//   2. It does not bind its own click tracking. paddle-quiz.js's
//      trackVendorClicks() is delegated on document against a[data-pq-paddle],
//      so the cards below are already attributed. A second listener would
//      double-count every affiliate_click.

import { vendorLinkFor } from "/assets/affiliate-links.js";

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

class PaddleGrid {
  constructor(root, paddles, affiliateMap) {
    this.root = root;
    this.paddles = paddles;
    this.total = paddles.length;
    this.affiliateMap = affiliateMap;
    this.filters = { type: "all", shape: "all", price: "all", skill: "all" };
    root.addEventListener("change", (e) => this.onChange(e));
    root.addEventListener("click", (e) => this.onClick(e));
  }

  onChange(e) {
    const sel = e.target.closest("select[data-filter]");
    if (!sel) return;
    this.filters[sel.dataset.filter] = sel.value;
    this.render();
  }

  onClick(e) {
    if (!e.target.closest('[data-action="reset-grid"]')) return;
    this.filters = { type: "all", shape: "all", price: "all", skill: "all" };
    // The selects outlive a render now, so state has to be pushed back into
    // them rather than re-emitted as markup with `selected` on the right option.
    this.root.querySelectorAll("select[data-filter]").forEach((s) => { s.value = "all"; });
    this.render();
  }

  filtered() {
    return this.paddles.filter((p) => {
      for (const f of FILTERS) {
        const v = this.filters[f.key];
        if (v === "all") continue;
        if (f.key === "price") {
          if (typeof p.price !== "number" || !PRICE_TEST[v](p)) return false;
        } else if (p[f.field] !== v) return false;
      }
      return true;
    });
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
    return `<div class="pg-filters">${sels.join("")}<button type="button" class="pg-reset" data-action="reset-grid">Reset filters</button></div>`;
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
      foot = `<div class="pg-foot">
          <span class="pg-note">${esc(note)}</span>
          <a class="btn pg-buy" href="${esc(link.href)}" target="_blank" rel="${rel}" ${data}>Check price<span class="visually-hidden"> for ${esc(p.brand)} ${esc(p.name)} (opens in new tab)</span></a>
        </div>`;
    } else {
      const note = approvalNote(p);
      if (note) foot = `<div class="pg-foot"><span class="pg-note">${esc(note)}</span></div>`;
    }

    // One paddle in the catalog has no price. Math.round(null) is 0, so the
    // naive template renders "$0" — the price filter already excludes it from
    // every bucket, but the card still has to say something true.
    const price = typeof p.price === "number" ? `$${Math.round(p.price)}` : "Price n/a";

    return `<li class="pg-card">
      <div class="pg-head">
        <div>
          <div class="pg-brand">${esc(p.brand)}</div>
          <h3 class="pg-model">${esc(p.name)}</h3>
        </div>
        <div class="pg-price">${esc(price)}</div>
      </div>
      ${chips ? `<div class="pg-chips">${chips}</div>` : ""}
      ${specs ? `<div class="pg-specs">${specs}</div>` : ""}
      ${foot}
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
    this.render();
    return this;
  }

  render() {
    const list = this.filtered();
    const links = list.map((p) => vendorLinkFor(p, this.affiliateMap)).filter(Boolean);
    const anyAmazon = links.some((l) => l.isAmazon);
    const anyAffiliate = links.some((l) => l.isAffiliate);

    this.countEl.textContent = `Showing ${list.length} of ${this.total} paddles in the full catalog.`;

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
           <p>No paddles match those filters.</p>
           <button type="button" class="btn" data-action="reset-grid">Reset filters</button>
         </div>`;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
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
