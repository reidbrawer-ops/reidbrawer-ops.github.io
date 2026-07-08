// Displays each venue's public Google rating alongside (never blended with)
// the site's own community rating. Data comes from a static JSON file
// produced offline by scripts/fetch-google-ratings.mjs — nothing here ever
// calls the Google API directly, so no key is exposed and no visitor data
// reaches Google just from viewing this site.
//
// Non-invasive by design: rather than requiring every page to hand-author a
// slot for this, it finds every element PBWidgets already renders for the
// community rating (`[data-role="overall-rating"][data-court-id]`) and
// inserts a Google badge right after it — so it works on directory.html,
// rankings.html, and every city page's hand-authored venue cards with zero
// changes to their markup.

(function () {
  let data = {};
  let loaded = false;

  async function ensureLoaded() {
    if (loaded) return;
    try {
      const res = await fetch("/assets/google-ratings.json");
      if (res.ok) data = await res.json();
    } catch {
      /* offline, blocked, or the file hasn't been generated yet — badges just won't show */
    }
    loaded = true;
  }

  function get(courtId) {
    return data[courtId] || null;
  }

  function mapsUrl(entry) {
    return entry.placeId
      ? `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(entry.placeId)}`
      : null;
  }

  function badgeHtml(courtId) {
    const entry = get(courtId);
    if (!entry || typeof entry.rating !== "number") return "";
    const label = `<span class="google-rating-label">Google ${entry.rating.toFixed(1)}★ (${entry.userRatingCount || 0})</span>`;
    const url = mapsUrl(entry);
    return url
      ? `<a class="google-rating-badge" href="${url}" target="_blank" rel="noopener">${label}</a>`
      : `<span class="google-rating-badge">${label}</span>`;
  }

  // Rewrites "Get directions"-style links from a free-text address search to
  // a verified Google Place once one is known for that venue. Only touches
  // anchors whose venue has a resolved placeId — every other Directions link
  // is left exactly as-is (a text search can match the wrong nearby place,
  // so we never guess).
  function rewriteDirectionsLinks(root) {
    (root || document).querySelectorAll(".directions-link, .mv-directions").forEach((a) => {
      const card = a.closest("[data-court-id]");
      if (!card) return;
      const entry = get(card.dataset.courtId);
      const url = entry && mapsUrl(entry);
      if (url) a.href = url;
    });
  }

  function injectAll(root) {
    (root || document).querySelectorAll('[data-role="overall-rating"][data-court-id]').forEach((el) => {
      const html = badgeHtml(el.dataset.courtId);
      let slot = el.nextElementSibling;
      if (!slot || !slot.classList || !slot.classList.contains("google-rating-slot")) {
        if (!html) return;
        slot = document.createElement("span");
        slot.className = "google-rating-slot";
        el.insertAdjacentElement("afterend", slot);
      }
      slot.innerHTML = html;
    });
  }

  // Piggyback on PBWidgets.refreshAll rather than requiring every page/script
  // to also call us explicitly — directory.js, rankings.js, and
  // rating-widgets.js's own event listeners all already call it after every
  // (re)render.
  function hookIntoWidgetRefresh() {
    if (!window.PBWidgets || window.PBWidgets.__googleHooked) return;
    const original = window.PBWidgets.refreshAll;
    window.PBWidgets.refreshAll = function (root) {
      original(root);
      injectAll(root);
    };
    window.PBWidgets.__googleHooked = true;
  }

  async function init() {
    await ensureLoaded();
    hookIntoWidgetRefresh();
    injectAll();
    rewriteDirectionsLinks();
  }

  document.addEventListener("pbratings:ready", () => {
    hookIntoWidgetRefresh();
    injectAll();
    rewriteDirectionsLinks();
  });

  window.PBGoogleRatings = { get, badgeHtml, injectAll, rewriteDirectionsLinks };
  init();
})();
