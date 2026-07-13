(function () {
  const statusEl = document.getElementById("rankings-status");
  const top10El = document.getElementById("top10-list");
  const top10EmptyEl = document.getElementById("top10-empty");
  const citiesEl = document.getElementById("rankings-cities");
  if (!citiesEl) return;

  const { escapeHtml, citySlug, setStatus } = window.PBUtils;

  const searchEl = document.getElementById("rankings-search");
  const cityFilterEl = document.getElementById("rankings-city");
  const top10SectionEl = document.getElementById("top-10");

  // Built from the static region/city map, not the async courts-data fetch —
  // the city list itself never changes, so there's no reason to wait on it.
  function renderCityFilterOptions() {
    if (!cityFilterEl || !window.PB_REGION_ORDER || !window.PB_CITY_REGION) return;
    const citiesByRegion = {};
    Object.keys(window.PB_CITY_REGION).forEach((city) => {
      const region = window.PB_CITY_REGION[city];
      (citiesByRegion[region] = citiesByRegion[region] || []).push(city);
    });

    let html = '<option value="">All cities</option>';
    window.PB_REGION_ORDER.forEach((region) => {
      const cities = (citiesByRegion[region] || []).slice().sort();
      if (!cities.length) return;
      html += `<optgroup label="${escapeHtml(region)}">`;
      html += cities
        .map((city) => `<option value="${citySlug(city)}">${escapeHtml(city)}</option>`)
        .join("");
      html += "</optgroup>";
    });
    cityFilterEl.innerHTML = html;
  }

  renderCityFilterOptions();

  const noResultsEl = document.getElementById("rankings-no-results");

  // Filter the already-rendered leaderboard rows in place by court name
  // (search) and city (dropdown). Called both on user input and at the end of
  // every render(), since render() rebuilds the DOM from scratch on each live
  // vote/rating update and would otherwise drop the active filter.
  function applyFilters() {
    const query = (searchEl && searchEl.value || "").trim().toLowerCase();
    const city = (cityFilterEl && cityFilterEl.value) || "";

    const rowMatches = (row) => {
      const name = row.dataset.name || "";
      const rowCity = row.dataset.city || "";
      return (!query || name.includes(query)) && (!city || rowCity === city);
    };

    // Top 10: filter rows by name/city; hide the whole section if none survive.
    let top10Visible = 0;
    if (top10El) {
      top10El.querySelectorAll(".leaderboard-row").forEach((row) => {
        const show = rowMatches(row);
        row.hidden = !show;
        if (show) top10Visible++;
      });
    }
    // Keep the Top-10 section visible when it's showing the zero-data
    // invitation (top10-empty), even though it has no ranked rows.
    if (top10SectionEl) {
      top10SectionEl.hidden = top10Visible === 0 && (!top10EmptyEl || top10EmptyEl.hidden);
    }

    // City leaderboards: hide a city section entirely if the city filter
    // excludes it, otherwise filter its rows and hide it if none match.
    let cityVisible = 0;
    citiesEl.querySelectorAll(".city-leaderboard").forEach((section) => {
      if (city && section.id !== city) {
        section.hidden = true;
        return;
      }
      let visible = 0;
      section.querySelectorAll(".leaderboard-row").forEach((row) => {
        const show = rowMatches(row);
        row.hidden = !show;
        if (show) visible++;
      });
      section.hidden = visible === 0;
      cityVisible += visible;
    });

    // Region subheads: hide any that no longer have a visible city below them.
    let currentHead = null;
    let headHasVisible = false;
    Array.from(citiesEl.children).forEach((el) => {
      if (el.classList.contains("region-subhead")) {
        if (currentHead) currentHead.hidden = !headHasVisible;
        currentHead = el;
        headHasVisible = false;
      } else if (el.classList.contains("city-leaderboard") && !el.hidden) {
        headHasVisible = true;
      }
    });
    if (currentHead) currentHead.hidden = !headHasVisible;

    if (noResultsEl) noResultsEl.hidden = !(top10Visible === 0 && cityVisible === 0);
  }

  if (searchEl) searchEl.addEventListener("input", applyFilters);
  if (cityFilterEl) cityFilterEl.addEventListener("change", applyFilters);

  function rankClass(index) {
    if (index === 0) return "rank-1";
    if (index === 1) return "rank-2";
    if (index === 2) return "rank-3";
    return "";
  }

  // A court "has data" once it carries any community signal (a rating on any
  // factor, or a favorite vote). Only these are ranked; everything else is
  // shown as an explicitly-unranked "be the first to rate" row so it stays
  // rateable and its /rankings#id anchor still resolves.
  function hasData(court) {
    const s = window.PBRatings.getStats(court.id);
    return s.overallAvg > 0 || s.favoriteVotes > 0;
  }

  function sortCourts(courts) {
    return courts.slice().sort((a, b) => {
      const sa = window.PBRatings.getStats(a.id);
      const sb = window.PBRatings.getStats(b.id);
      if (sb.favoriteVotes !== sa.favoriteVotes) return sb.favoriteVotes - sa.favoriteVotes;
      return sb.overallAvg - sa.overallAvg;
    });
  }

  function rowHtml(court, index, { showCity, isMostLoved, rowId, compact, unranked, headingLevel = 3 }) {
    const stats = window.PBRatings.getStats(court.id);
    const badges = [];
    if (stats.isTopRated) badges.push('<span class="badge-top-rated">★ Top rated</span>');
    if (isMostLoved) badges.push('<span class="badge-most-loved">♥ Most loved</span>');

    const rankCell = unranked
      ? '<div class="rank-number rank-unranked" aria-hidden="true">–</div>'
      : `<div class="rank-number ${rankClass(index)}">#${index + 1}</div>`;

    return `
      <div class="leaderboard-row${compact ? " is-compact" : ""}${unranked ? " is-unranked" : ""}"${rowId ? ` id="${rowId}"` : ""} data-name="${escapeHtml(court.name.toLowerCase())}" data-city="${citySlug(court.city)}">
        ${rankCell}
        <div class="leaderboard-main">
          <div class="leaderboard-name-row">
            <h${headingLevel}><a href="${court.url}#${court.id}">${escapeHtml(court.name)}</a></h${headingLevel}>
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

  // render() rebuilds every row's HTML from scratch on every rating/favorite
  // update (needed since a new vote can change sort order) — which would
  // otherwise silently re-collapse any rating form the visitor had open
  // mid-click, since ratingFormHtml() always renders it hidden by default.
  // Snapshot which court ids are currently expanded and re-apply that after
  // the rebuild.
  function expandedRatingFormIds() {
    const ids = new Set();
    citiesEl.querySelectorAll(".rating-form[data-court-id]").forEach((form) => {
      const body = form.querySelector('[data-role="body"]');
      if (body && !body.hidden) ids.add(form.dataset.courtId);
    });
    return ids;
  }

  function restoreExpandedRatingForms(ids) {
    ids.forEach((courtId) => {
      const form = citiesEl.querySelector(`.rating-form[data-court-id="${courtId}"]`);
      if (!form) return;
      const body = form.querySelector('[data-role="body"]');
      const toggle = form.querySelector(".rating-form-toggle");
      if (body) body.hidden = false;
      if (toggle) toggle.textContent = "Hide rating form";
    });
  }

  function render(courts) {
    const expandedIds = expandedRatingFormIds();
    const ratedAll = sortCourts(courts.filter(hasData));

    // Bay Area Top 10 — only courts with real community data. Until the first
    // ratings land, show an invitation instead of a fake ranked list of ties.
    if (ratedAll.length) {
      top10El.innerHTML = ratedAll
        .slice(0, 10)
        .map((c, i) => rowHtml(c, i, { showCity: true, isMostLoved: false, rowId: `top10-${c.id}`, compact: true }))
        .join("");
      top10El.hidden = false;
      if (top10EmptyEl) top10EmptyEl.hidden = true;
    } else {
      top10El.innerHTML = "";
      top10El.hidden = true;
      if (top10EmptyEl) top10EmptyEl.hidden = false;
    }

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
        // Rank only courts with data; keep the rest as a "be the first" group
        // so every court is still rateable and its #id anchor resolves.
        const rated = sortCourts(byCity[city].filter(hasData));
        const unrated = byCity[city]
          .filter((c) => !hasData(c))
          .sort((a, b) => a.name.localeCompare(b.name));
        const mostLovedId =
          rated.length && window.PBRatings.getStats(rated[0].id).favoriteVotes > 0 ? rated[0].id : null;

        const rankedRows = rated
          .map((c, i) => rowHtml(c, i, { showCity: false, isMostLoved: c.id === mostLovedId, rowId: c.id, headingLevel: 5 }))
          .join("");
        const unratedRows = unrated
          .map((c) => rowHtml(c, null, { showCity: false, isMostLoved: false, rowId: c.id, unranked: true, headingLevel: 5 }))
          .join("");
        const unratedHead = unrated.length
          ? `<p class="unranked-head">${
              rated.length ? "Not yet rated — be the first" : "No ratings here yet — be the first to rate a court"
            }</p>`
          : "";

        html += `
          <div class="city-leaderboard" id="${citySlug(city)}">
            <div class="region-head">
              <div><h4>${escapeHtml(city)}</h4></div>
              <a class="overview-link" href="/cities/${citySlug(city)}">City guide →</a>
            </div>
            ${rankedRows ? `<div class="leaderboard">${rankedRows}</div>` : ""}
            ${unratedHead}
            ${unratedRows ? `<div class="leaderboard leaderboard--unranked">${unratedRows}</div>` : ""}
          </div>`;
      });
    });
    citiesEl.innerHTML = html;
    restoreExpandedRatingForms(expandedIds);

    window.PBWidgets.refreshAll();
    applyFilters();
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
      setStatus(statusEl, "Couldn't load court data for rankings. Try refreshing the page.", true);
    });
})();
