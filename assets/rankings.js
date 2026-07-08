(function () {
  const statusEl = document.getElementById("rankings-status");
  const top10El = document.getElementById("top10-list");
  const citiesEl = document.getElementById("rankings-cities");
  if (!citiesEl) return;

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function citySlug(city) {
    return city.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-+|-+$)/g, "");
  }

  const cityJumpEl = document.getElementById("city-jump-groups");

  // Built from the static region/city map, not the async courts-data fetch —
  // the city list itself never changes, so there's no reason to wait on it.
  function renderCityJumpTags() {
    if (!cityJumpEl || !window.PB_REGION_ORDER || !window.PB_CITY_REGION) return;
    const citiesByRegion = {};
    Object.keys(window.PB_CITY_REGION).forEach((city) => {
      const region = window.PB_CITY_REGION[city];
      (citiesByRegion[region] = citiesByRegion[region] || []).push(city);
    });

    cityJumpEl.innerHTML = window.PB_REGION_ORDER.map((region) => {
      const cities = (citiesByRegion[region] || []).slice().sort();
      if (!cities.length) return "";
      const tags = cities
        .map((city) => `<a class="city-jump-tag" href="#${citySlug(city)}">${escapeHtml(city)}</a>`)
        .join("");
      return `
        <div class="city-jump-group">
          <span class="city-jump-region">${escapeHtml(region)}</span>
          ${tags}
        </div>`;
    }).join("");
  }

  renderCityJumpTags();

  // The browser's native "scroll to #hash" doesn't reliably fire for a
  // same-page click here (same underlying issue jumpToHashTarget below
  // works around for the initial-load case) — so drive the scroll
  // ourselves rather than trust the anchor's default behavior.
  if (cityJumpEl) {
    cityJumpEl.addEventListener("click", (e) => {
      const link = e.target.closest(".city-jump-tag");
      if (!link) return;
      const id = link.getAttribute("href").slice(1);
      const target = document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      window.location.hash = id;
      // "instant", not "smooth" — this page's rows can re-render mid-animation
      // (live vote/rating updates), which stalls a smooth scrollIntoView the
      // same way jumpToHashTarget's comment below describes. Instant avoids it.
      target.scrollIntoView({ behavior: "instant", block: "start" });
    });
  }

  function rankClass(index) {
    if (index === 0) return "rank-1";
    if (index === 1) return "rank-2";
    if (index === 2) return "rank-3";
    return "";
  }

  function sortCourts(courts) {
    return courts.slice().sort((a, b) => {
      const sa = window.PBRatings.getStats(a.id);
      const sb = window.PBRatings.getStats(b.id);
      if (sb.favoriteVotes !== sa.favoriteVotes) return sb.favoriteVotes - sa.favoriteVotes;
      return sb.overallAvg - sa.overallAvg;
    });
  }

  function rowHtml(court, index, { showCity, isMostLoved, rowId, compact }) {
    const stats = window.PBRatings.getStats(court.id);
    const badges = [];
    if (stats.isTopRated) badges.push('<span class="badge-top-rated">★ Top rated</span>');
    if (isMostLoved) badges.push('<span class="badge-most-loved">♥ Most loved</span>');

    return `
      <div class="leaderboard-row${compact ? " is-compact" : ""}"${rowId ? ` id="${rowId}"` : ""}>
        <div class="rank-number ${rankClass(index)}">#${index + 1}</div>
        <div class="leaderboard-main">
          <div class="leaderboard-name-row">
            <h3><a href="${court.url}#${court.id}">${escapeHtml(court.name)}</a></h3>
            ${showCity ? `<span class="leaderboard-city-tag">${escapeHtml(court.city)}</span>` : ""}
            ${badges.join("")}
          </div>
          <div class="leaderboard-rating-row">
            ${window.PBWidgets.overallRatingHtml(court.id)}
          </div>
          ${compact ? "" : window.PBWidgets.ratingFormHtml(court.id)}
        </div>
        <div class="leaderboard-side">
          ${compact ? `<a class="review-link" href="${court.url}#${court.id}">Review →</a>` : ""}
          ${window.PBWidgets.favoriteButtonHtml(court.id, "favorites")}
        </div>
      </div>`;
  }

  function render(courts) {
    const sortedAll = sortCourts(courts);

    top10El.innerHTML = sortedAll
      .slice(0, 10)
      .map((c, i) => rowHtml(c, i, { showCity: true, isMostLoved: false, rowId: `top10-${c.id}`, compact: true }))
      .join("");

    const byCity = {};
    courts.forEach((c) => {
      (byCity[c.city] = byCity[c.city] || []).push(c);
    });

    const citiesByRegion = {};
    Object.keys(byCity).forEach((city) => {
      const region = window.PB_CITY_REGION[city] || "Other";
      (citiesByRegion[region] = citiesByRegion[region] || []).push(city);
    });

    let html = "";
    window.PB_REGION_ORDER.forEach((region) => {
      const cities = (citiesByRegion[region] || []).slice().sort();
      if (!cities.length) return;
      html += `<h3 class="region-subhead">${escapeHtml(region)}</h3>`;
      cities.forEach((city) => {
        const cityCourts = sortCourts(byCity[city]);
        const leaderStats = window.PBRatings.getStats(cityCourts[0].id);
        const mostLovedId = leaderStats.favoriteVotes > 0 ? cityCourts[0].id : null;
        html += `
          <div class="city-leaderboard" id="${citySlug(city)}">
            <div class="region-head">
              <div><h3>${escapeHtml(city)}</h3></div>
              <a class="overview-link" href="/cities/${citySlug(city)}">City guide →</a>
            </div>
            <div class="leaderboard">
              ${cityCourts
                .map((c, i) => rowHtml(c, i, { showCity: false, isMostLoved: c.id === mostLovedId, rowId: c.id }))
                .join("")}
            </div>
          </div>`;
      });
    });
    citiesEl.innerHTML = html;

    window.PBWidgets.refreshAll();
  }

  let courtsData = null;
  let jumpedToHash = false;

  // Rows render async (after the courts-data fetch resolves), so the
  // browser's native "scroll to #hash on load" never fires — it only
  // triggers once, before this content exists. Do it ourselves, once,
  // after the first real render.
  function jumpToHashTarget() {
    if (jumpedToHash) return;
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const target = document.getElementById(hash);
    if (!target) return;
    jumpedToHash = true;

    const body = target.querySelector('[data-role="body"]');
    const toggle = target.querySelector(".rating-form-toggle");
    if (body && body.hidden) {
      body.hidden = false;
      if (toggle) toggle.textContent = "Hide rating form";
    }

    target.classList.add("is-jump-target");
    setTimeout(() => target.classList.remove("is-jump-target"), 2600);

    // Explicitly "instant", not "auto" — this site sets html{scroll-behavior:
    // smooth} globally, and "auto" defers to that CSS value, so it was quietly
    // resolving to the same smooth animation that doesn't reliably complete
    // right after a large synchronous DOM rebuild. "instant" bypasses the CSS
    // entirely and always jumps immediately.
    target.scrollIntoView({ behavior: "instant", block: "center" });
  }

  function tryRender() {
    if (courtsData && window.PBRatings) {
      render(courtsData);
      if (statusEl) statusEl.hidden = true;
      jumpToHashTarget();
    }
  }

  document.addEventListener("pbratings:ready", tryRender);
  document.addEventListener("pbratings:update", tryRender);

  fetch("/assets/courts-data.json")
    .then((res) => {
      if (!res.ok) throw new Error(`courts-data.json request failed (${res.status})`);
      return res.json();
    })
    .then((courts) => {
      courtsData = courts;
      tryRender();
    })
    .catch((err) => {
      console.error(err);
      if (statusEl) {
        statusEl.textContent = "Couldn't load court data for rankings. Try refreshing the page.";
        statusEl.classList.add("is-error");
      }
    });
})();
