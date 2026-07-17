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
    let href;
    if (brandCfg.template) {
      href = brandCfg.template
        .replaceAll("{url}", encodeURIComponent(base))
        .replaceAll("{query}", encodeURIComponent(paddle.name))
        .replaceAll("{name}", encodeURIComponent(paddle.name));
    } else {
      href = appendParams(base, brandCfg.params);
    }
    return { href, label: brandCfg.label || `Buy ${paddle.brand}`, isAffiliate: true, linkType: "brand-program" };
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
      return { href: appendParams(detailBase + encodeURIComponent(asin), { tag: az.tag }), label: "Buy on Amazon", isAffiliate: true, isAmazon: true, linkType: "amazon-deep" };
    }
    const searchBase = az.searchBase || "https://www.amazon.com/s?k=";
    const query = encodeURIComponent(`${paddle.brand} ${paddle.name} pickleball paddle`);
    return { href: appendParams(searchBase + query, { tag: az.tag }), label: "Search Amazon", isAffiliate: true, isAmazon: true, linkType: "amazon-search" };
  }

  // 3) No program yet — an honest, un-tagged link to the brand's own site.
  return { href: base, label: searchUrl ? `Search ${paddle.brand}` : `Visit ${paddle.brand}`, isAffiliate: false, linkType: "plain" };
}
