// Self-mounting city quick-jump tag row. Reads the same city -> region map
// used by rankings.js/directory.js (assets/regions.js) so this list can't
// drift out of sync with the site's canonical city list. Mount points are
// any element with class "city-quick-jump"; set data-href-prefix on one to
// point tags at another page's anchors (e.g. "/cities/index.html") instead
// of the current page's own.
(function () {
  const { citySlug } = window.PBUtils;

  function render(container) {
    const order = window.PB_REGION_ORDER;
    const cityRegion = window.PB_CITY_REGION;
    if (!order || !cityRegion) return;

    const hrefPrefix = container.dataset.hrefPrefix || "";
    const byRegion = {};
    Object.keys(cityRegion).forEach((city) => {
      const region = cityRegion[city];
      (byRegion[region] = byRegion[region] || []).push(city);
    });

    container.innerHTML = order
      .map((region) => {
        const cities = byRegion[region] || [];
        if (!cities.length) return "";
        const tags = cities
          .map((city) => `<a class="city-tag" href="${hrefPrefix}#${citySlug(city)}">${city}</a>`)
          .join("");
        return `<div class="city-tag-group"><span class="city-tag-region">${region}</span>${tags}</div>`;
      })
      .join("");
  }

  document.querySelectorAll(".city-quick-jump").forEach(render);
})();
