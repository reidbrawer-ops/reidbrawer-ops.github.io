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

  function rowHtml(court, index, { showCity, isMostLoved }) {
    const stats = window.PBRatings.getStats(court.id);
    const badges = [];
    if (stats.isTopRated) badges.push('<span class="badge-top-rated">★ Top rated</span>');
    if (isMostLoved) badges.push('<span class="badge-most-loved">♥ Most loved</span>');

    return `
      <div class="leaderboard-row">
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
          ${window.PBWidgets.ratingFormHtml(court.id)}
        </div>
        <div class="leaderboard-side">
          ${window.PBWidgets.favoriteButtonHtml(court.id, "favorites")}
        </div>
      </div>`;
  }

  function render(courts) {
    const sortedAll = sortCourts(courts);

    top10El.innerHTML = sortedAll
      .slice(0, 10)
      .map((c, i) => rowHtml(c, i, { showCity: true, isMostLoved: false }))
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
              <a class="overview-link" href="/cities/${citySlug(city)}.html">City guide →</a>
            </div>
            <div class="leaderboard">
              ${cityCourts
                .map((c, i) => rowHtml(c, i, { showCity: false, isMostLoved: c.id === mostLovedId }))
                .join("")}
            </div>
          </div>`;
      });
    });
    citiesEl.innerHTML = html;

    window.PBWidgets.refreshAll();
  }

  let courtsData = null;

  function tryRender() {
    if (courtsData && window.PBRatings) {
      render(courtsData);
      if (statusEl) statusEl.hidden = true;
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
