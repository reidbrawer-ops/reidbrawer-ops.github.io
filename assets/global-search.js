// Self-mounting sitewide search widget. Appends a search icon + input as the
// last child of .main-nav on every page, indexes assets/courts-data.json
// (venues) plus the 17-city list from assets/regions.js's PB_CITY_REGION,
// and jumps straight to the matching city page (or venue card, once Group
// A's id fix has run) on selection. Escape/outside-click handling mirrors
// nav.js's existing pattern for the "More" dropdown.
(function () {
  function citySlug(city) {
    return city.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-+|-+$)/g, "");
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var nav = document.querySelector(".main-nav");
  if (!nav) return;

  if (!document.querySelector('link[href="/assets/global-search.css"]')) {
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/assets/global-search.css";
    document.head.appendChild(link);
  }

  var wrap = document.createElement("div");
  wrap.className = "global-search";
  wrap.innerHTML =
    '<span class="global-search-icon" aria-hidden="true"></span>' +
    '<input type="search" class="global-search-input" placeholder="Search a city or venue…" ' +
    'aria-label="Search cities and venues" autocomplete="off" />' +
    '<div class="global-search-results" role="listbox" hidden></div>';
  nav.appendChild(wrap);

  var input = wrap.querySelector(".global-search-input");
  var resultsEl = wrap.querySelector(".global-search-results");

  var venues = [];
  var venuesLoaded = false;

  fetch("/assets/courts-data.json")
    .then(function (res) {
      return res.ok ? res.json() : [];
    })
    .then(function (data) {
      venues = Array.isArray(data) ? data : [];
      venuesLoaded = true;
      if (document.activeElement === input && input.value.trim()) runSearch(input.value);
    })
    .catch(function () {
      venuesLoaded = true; // fail open: city-only matches still work
    });

  // Most pages don't load regions.js (only index.html, cities/index.html,
  // rankings.html, and directory.html do) — pull it in ourselves so city-name
  // matching works from every page, not just those four.
  var cityNames = [];
  if (window.PB_CITY_REGION) {
    cityNames = Object.keys(window.PB_CITY_REGION);
  } else {
    var regionsScript = document.createElement("script");
    regionsScript.src = "/assets/regions.js";
    regionsScript.onload = function () {
      cityNames = window.PB_CITY_REGION ? Object.keys(window.PB_CITY_REGION) : [];
      if (document.activeElement === input && input.value.trim()) runSearch(input.value);
    };
    document.head.appendChild(regionsScript);
  }

  var activeIndex = -1;

  function buildMatches(query) {
    var q = query.trim().toLowerCase();
    if (!q) return [];

    var cityMatches = cityNames
      .filter(function (city) {
        return city.toLowerCase().indexOf(q) !== -1;
      })
      .map(function (city) {
        return {
          type: "city",
          label: city,
          sublabel: (window.PB_CITY_REGION[city] || "") + " · region",
          href: "/cities/index.html#" + citySlug(city),
        };
      });

    var venueMatches = venues
      .filter(function (v) {
        return (
          (v.name && v.name.toLowerCase().indexOf(q) !== -1) ||
          (v.city && v.city.toLowerCase().indexOf(q) !== -1) ||
          (v.neighborhood && v.neighborhood.toLowerCase().indexOf(q) !== -1)
        );
      })
      .map(function (v) {
        return {
          type: "venue",
          label: v.name,
          sublabel: v.city,
          href: v.url + "#" + v.id,
        };
      });

    return cityMatches.concat(venueMatches).slice(0, 8);
  }

  function renderResults(matches, query) {
    activeIndex = -1;

    if (!query.trim()) {
      resultsEl.hidden = true;
      resultsEl.innerHTML = "";
      return;
    }

    if (!matches.length) {
      resultsEl.hidden = false;
      resultsEl.innerHTML =
        '<div class="global-search-empty">' +
        (venuesLoaded ? 'No matches for "' + escapeHtml(query) + '"' : "Searching…") +
        "</div>";
      return;
    }

    resultsEl.hidden = false;
    resultsEl.innerHTML = matches
      .map(function (m, i) {
        return (
          '<a class="global-search-result" href="' + m.href + '" role="option" data-index="' + i + '">' +
          '<span class="gsr-label">' + escapeHtml(m.label) + "</span>" +
          '<span class="gsr-sublabel">' + escapeHtml(m.sublabel || "") + "</span>" +
          "</a>"
        );
      })
      .join("");
  }

  function runSearch(query) {
    renderResults(buildMatches(query), query);
  }

  var debounceTimer = null;
  input.addEventListener("input", function () {
    clearTimeout(debounceTimer);
    var query = input.value;
    debounceTimer = setTimeout(function () {
      runSearch(query);
    }, 120);
  });

  function setActive(index, items) {
    for (var i = 0; i < items.length; i++) items[i].classList.remove("is-active");
    if (index >= 0 && items[index]) {
      items[index].classList.add("is-active");
      items[index].scrollIntoView({ block: "nearest" });
    }
    activeIndex = index;
  }

  input.addEventListener("keydown", function (e) {
    var items = resultsEl.querySelectorAll(".global-search-result");
    if (e.key === "ArrowDown") {
      if (items.length) {
        e.preventDefault();
        setActive((activeIndex + 1) % items.length, items);
      }
    } else if (e.key === "ArrowUp") {
      if (items.length) {
        e.preventDefault();
        setActive((activeIndex - 1 + items.length) % items.length, items);
      }
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && items[activeIndex]) {
        e.preventDefault();
        window.location.href = items[activeIndex].getAttribute("href");
      } else if (items.length === 1) {
        e.preventDefault();
        window.location.href = items[0].getAttribute("href");
      }
    } else if (e.key === "Escape") {
      input.value = "";
      resultsEl.hidden = true;
      resultsEl.innerHTML = "";
      input.blur();
    }
  });

  input.addEventListener("focus", function () {
    if (input.value.trim()) runSearch(input.value);
  });

  document.addEventListener("click", function (e) {
    if (!wrap.contains(e.target)) resultsEl.hidden = true;
  });
})();
