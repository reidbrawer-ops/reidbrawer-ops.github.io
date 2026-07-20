// Buy links + the pluggable affiliate model — the single source of truth.
//
// This lived inside paddle-quiz.js until the browsable paddle grid needed the
// same links. It was extracted rather than copied: the link chain encodes the
// Amazon allowlist, the ASIN deep-link upgrade, and the isAffiliate flag that
// drives both `rel="sponsored"` and the commission disclosure. A second copy
// would silently drift from assets/affiliate-map.json the first time a brand
// was added or dropped, and the failure mode is invisible — a link that still
// works but pays nothing, or discloses wrongly. Same reasoning the codebase
// already applied to escapeHtml (see dom-utils.js).
//
// Consumed by: assets/paddle-quiz.js (quiz results), assets/paddle-grid.js
// (the browsable grid). Both are ES modules, so this evaluates once.
//
// Every buy link is built from two inputs:
//   1. The paddle's own vendor fields (baked into paddles.json from
//      scripts/paddle-vendor-map.json at data-rebuild time): `vendorUrl` is
//      the brand's real site, and `vendorSearchBase` is a domain-root search
//      route that was directly verified to return real product results (for
//      the rest we don't guess a search URL that might 404).
//   2. An optional affiliate overlay (assets/affiliate-map.json, fetched at
//      runtime and passed in as `affiliateMap`) — the pluggable per-vendor
//      model: brand -> { template | params | label } plus a global
//      amazonFallback. It lives in assets/ rather than the build-time
//      scripts/paddle-vendor-map.json because Firebase Hosting ignores
//      scripts/** (see firebase.json), so only assets/ is actually served.
//
// The returned `isAffiliate` flag drives both the link's rel (sponsored vs.
// plain) and whether the commission disclosure is shown — so a plain vendor
// link is never dressed up as, or disclosed as, something that earns money.
//
// Two labels come back, not one. `label` names the vendor outright ("Search
// Six Zero") and suits the quiz's three wide result cards. `shortLabel` drops
// the brand and keeps only the verb + destination ("Search brand site"), for
// the browse grid's 254px cards, where "Search Honolulu Pickleball" rendered a
// 193px button that broke out of the card. Both say the same thing about what
// the click DOES — deep link vs. search vs. front door — which is the part
// that has to stay honest; the brand is the card's own eyebrow either way.

export function appendParams(url, params) {
  const keys = Object.keys(params || {});
  if (!keys.length) return url;
  const sep = url.includes("?") ? "&" : "?";
  const qs = keys.map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join("&");
  return url + sep + qs;
}

export function vendorLinkFor(paddle, affiliateMap) {
  // The best buyable target we have for this exact model: its brand's
  // verified on-site search, else the brand's own site.
  const searchUrl = paddle.vendorSearchBase ? paddle.vendorSearchBase + encodeURIComponent(paddle.name) : null;
  const base = searchUrl || paddle.vendorUrl || null;
  if (!base) return null;

  const brandCfg = affiliateMap && affiliateMap.brands ? affiliateMap.brands[paddle.brand] : null;

  // 1) A brand/DTC affiliate program is configured for this brand.
  if (brandCfg && (brandCfg.template || brandCfg.params)) {
    // A program may pin specific models to a product page instead of the
    // generic search base. One Shopify product URL already covers every
    // shape/thickness variant of a line, so we match by id-prefix rather than
    // listing each variant (a new variant then inherits its line's page for
    // free). Longest matching prefix wins; a model with no rule keeps `base`
    // (search, else brand home) so it still gets the affiliate ref applied —
    // just not a pinned product page. The ref itself lives in `params` and is
    // account-level, so every path below is tracked either way.
    let programBase = base;
    if (Array.isArray(brandCfg.products) && paddle.id) {
      let best = null;
      for (const p of brandCfg.products) {
        if (p && p.idPrefix && p.url && paddle.id.startsWith(p.idPrefix) && (!best || p.idPrefix.length > best.idPrefix.length)) {
          best = p;
        }
      }
      if (best) programBase = best.url;
    }
    let href;
    if (brandCfg.template) {
      href = brandCfg.template
        .replaceAll("{url}", encodeURIComponent(programBase))
        .replaceAll("{query}", encodeURIComponent(paddle.name))
        .replaceAll("{name}", encodeURIComponent(paddle.name));
    } else {
      href = appendParams(programBase, brandCfg.params);
    }
    return { href, label: brandCfg.label || `Buy ${paddle.brand}`, shortLabel: brandCfg.shortLabel || brandCfg.label || "Buy from brand", isAffiliate: true, linkType: "brand-program" };
  }

  // 2) Amazon Associates fallback — for brands with no program of their own
  //    that are actually sold on Amazon. The `brands` allowlist is required:
  //    most of the catalog is DTC-only brands with no Amazon listings at all,
  //    and a tagged search for those returns unrelated paddles. An honest
  //    un-tagged link to the brand's own site (case 3) beats a commissioned
  //    link to the wrong thing.
  const az = affiliateMap && affiliateMap.amazonFallback;
  const azBrands = az && Array.isArray(az.brands) ? az.brands : [];
  if (az && az.enabled && az.tag && azBrands.includes(paddle.brand)) {
    // A hand-verified ASIN deep-links to the exact model; without one we fall
    // back to a search, which is honest but converts worse. ASINs are added
    // incrementally (see affiliate-map.json), so both paths stay live.
    const asin = az.asins ? az.asins[paddle.id] : null;
    if (asin) {
      const detailBase = az.detailBase || "https://www.amazon.com/dp/";
      return { href: appendParams(detailBase + encodeURIComponent(asin), { tag: az.tag }), label: "Buy on Amazon", shortLabel: "Buy on Amazon", isAffiliate: true, isAmazon: true, linkType: "amazon-deep" };
    }
    const searchBase = az.searchBase || "https://www.amazon.com/s?k=";
    const query = encodeURIComponent(`${paddle.brand} ${paddle.name} pickleball paddle`);
    return { href: appendParams(searchBase + query, { tag: az.tag }), label: "Search Amazon", shortLabel: "Search Amazon", isAffiliate: true, isAmazon: true, linkType: "amazon-search" };
  }

  // 3) No program yet — an honest, un-tagged link to the brand's own site.
  return {
    href: base,
    label: searchUrl ? `Search ${paddle.brand}` : `Visit ${paddle.brand}`,
    shortLabel: searchUrl ? "Search brand site" : "Visit brand site",
    isAffiliate: false,
    linkType: "plain",
  };
}
// Outbound buy-link tracking.
//
// Amazon's Associates reporting stopped exposing order-level data on 2026-03-09:
// it gives a topline click count and an earnings figure, but will not say which
// paddle, which link type, or which result position earned them. This measures
// that ourselves, and covers brand-direct links too — which Amazon was never
// going to report on at all.
//
// Delegated on document (rather than bound per-render) because the results table
// is re-rendered on every retake; one listener outlives them all.
//
// It deliberately no-ops when gtag is missing. analytics.js does not define gtag
// AT ALL for visitors who send Global Privacy Control / Do Not Track, or who used
// the opt-out on /privacy — so an absent gtag means the visitor declined tracking,
// and an affiliate tracker must not be the thing that quietly reinstates it.
let vendorClicksBound = false;

export function trackVendorClicks() {
  // Idempotent: both paddle-quiz.js and paddle-grid.js call this, and after the
  // /paddles split they live on different pages — but a module is a singleton,
  // so if a page ever mounted both, a second listener would double-count every
  // affiliate_click and there is no way to tell the duplicates apart in GA4.
  if (vendorClicksBound) return;
  vendorClicksBound = true;
  document.addEventListener("click", (e) => {
    const t = e.target;
    if (!t || typeof t.closest !== "function") return;
    const a = t.closest("a[data-pq-paddle]");
    if (!a) return;
    if (typeof window.gtag !== "function") return; // opted out — see above
    window.gtag("event", "affiliate_click", {
      paddle_id: a.dataset.pqPaddle,
      brand: a.dataset.pqBrand,
      link_type: a.dataset.pqLinkType, // brand-program | amazon-deep | amazon-search | plain
      is_affiliate: a.dataset.pqAffiliate === "1",
      // "quiz" (1..3 of a scored shortlist) or "grid" (1..N of a filtered
      // catalog) — without this the two position scales average into nonsense.
      surface: a.dataset.pqSurface || "unknown",
      position: Number(a.dataset.pqPosition),
    });
  });
}
