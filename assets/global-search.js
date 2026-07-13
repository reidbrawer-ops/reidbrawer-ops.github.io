// Sitewide search widget. Mounts in two shapes from one implementation:
//   1. Nav pill  — self-appended as the last child of .main-nav on every page
//                  (compact, always-available fallback). Unchanged behavior.
//   2. Hero search — filled into any element carrying [data-search-scope], e.g.
//                  <div class="hero-search" data-search-scope="courts"></div>,
//                  rendered ~2–3× the nav pill. The page phases (Home, Cities
//                  index, Find-courts hub) drop that mount point into their body.
//
// Both shapes index assets/courts-data.json (venues) plus the city list from
// assets/regions.js's PB_CITY_REGION. Data is loaded once and shared across
// every mounted instance. Escape/outside-click handling mirrors nav.js's
// pattern for the "More" dropdown.
//
// ─── Search → map integration contract (consumed by Phase 3's map.js) ──────────
// Selecting a result (click or Enter) dispatches a *cancelable* CustomEvent on
// `document` BEFORE navigating:
//
//     document.addEventListener("pbsearch:select", function (e) {
//       // e.detail = {
//       //   type: "city" | "venue",        // what was selected
//       //   city: "Berkeley",              // human-readable city name
//       //   slug: "berkeley",              // citySlug(city) — the ?city= value
//       //   id:   "cedar-rose-park" | null,// venue id when type === "venue"
//       //   href: "/map?city=berkeley"     // the default navigation target
//       // }
//       e.preventDefault();  // handle it in place — component will NOT navigate
//       recenterMapOn(e.detail.slug, e.detail.id);
//     });
//
// If NO listener calls preventDefault(), the component navigates to detail.href.
// So on the Find-courts hub the map recenters in place; everywhere else the
// selection navigates into the hub. URL params the hub reads:
//     /map?city=<slug>[&venue=<id>]
//
// Mount-point snippet for the page phases (Phase 3/4/6) to paste into a body:
//     <div class="hero-search" data-search-scope="courts">
//       <input hidden />  <!-- component fills this container; leave it empty -->
//     </div>
// (Just an empty <div class="hero-search" data-search-scope="courts"></div> is
// enough — the component builds the input + results dropdown inside it.)
(function () {
  var citySlug = window.PBUtils.citySlug;
  var escapeHtml = window.PBUtils.escapeHtml;

  // ─── Shared data, loaded once for every instance ────────────────────────────
  var venues = [];
  var venuesLoaded = false;
  var cityNames = [];
  var instances = [];

  function refreshActiveInstance() {
    for (var i = 0; i < instances.length; i++) {
      var inst = instances[i];
      if (document.activeElement === inst.input && inst.input.value.trim()) {
        inst.run(inst.input.value);
      }
    }
  }

  // Lazy-load the ~192 KB venue index on first search interaction rather than
  // on every page load — the widget ships on all 53 pages but most page views
  // never search. City-name matches (from regions.js) work immediately; venue
  // matches fill in once this resolves (refreshActiveInstance re-runs the
  // focused input, and renderResults shows "Searching…" until then).
  var venuesLoadStarted = false;
  function loadVenues() {
    if (venuesLoadStarted) return;
    venuesLoadStarted = true;
    fetch("/assets/courts-data.json")
      .then(function (res) {
        return res.ok ? res.json() : [];
      })
      .then(function (data) {
        venues = Array.isArray(data) ? data : [];
        venuesLoaded = true;
        refreshActiveInstance();
      })
      .catch(function () {
        venuesLoaded = true; // fail open: city-only matches still work
      });
  }

  // Most pages don't load regions.js (only index.html, cities/index.html,
  // rankings.html, and directory.html do) — pull it in ourselves so city-name
  // matching works from every page.
  if (window.PB_CITY_REGION) {
    cityNames = Object.keys(window.PB_CITY_REGION);
  } else {
    var regionsScript = document.createElement("script");
    regionsScript.src = "/assets/regions.js";
    regionsScript.onload = function () {
      cityNames = window.PB_CITY_REGION ? Object.keys(window.PB_CITY_REGION) : [];
      refreshActiveInstance();
    };
    document.head.appendChild(regionsScript);
  }

  // ─── Match building (shared) ────────────────────────────────────────────────
  function regionLabel(city) {
    var region = window.PB_CITY_REGION && window.PB_CITY_REGION[city];
    return region ? region + " · region" : "Region";
  }

  function cityMatch(city) {
    var slug = citySlug(city);
    return {
      type: "city",
      city: city,
      slug: slug,
      id: null,
      label: city,
      sublabel: regionLabel(city),
      href: "/map?city=" + slug,
      isSub: false,
    };
  }

  function venueMatch(v, isSub) {
    var slug = citySlug(v.city || "");
    var hasNeighborhood = v.neighborhood && v.neighborhood !== "Not specified";
    return {
      type: "venue",
      city: v.city,
      slug: slug,
      id: v.id,
      label: v.name,
      sublabel: hasNeighborhood ? v.city + " · " + v.neighborhood : v.city,
      href: "/map?city=" + slug + "&venue=" + encodeURIComponent(v.id),
      isSub: !!isSub,
    };
  }

  // Top courts for a city: most-courts first, so "Berkeley" surfaces its biggest
  // sites right under the city row (the P1 "here are courts in Berkeley" view).
  function topCourtsForCity(city, seen, limit) {
    var slug = citySlug(city);
    return venues
      .filter(function (v) {
        return v.city && citySlug(v.city) === slug && !seen[v.id];
      })
      .sort(function (a, b) {
        return (b.courts || 0) - (a.courts || 0) || String(a.name).localeCompare(b.name);
      })
      .slice(0, limit);
  }

  var CAP = 8;

  function buildMatches(query) {
    var q = query.trim().toLowerCase();
    if (!q) return [];

    var results = [];
    var seen = {};

    // City name matches, each followed by its top couple of courts.
    var matchedCities = cityNames.filter(function (c) {
      return c.toLowerCase().indexOf(q) !== -1;
    });
    matchedCities.slice(0, 4).forEach(function (city) {
      results.push(cityMatch(city));
      topCourtsForCity(city, seen, 2).forEach(function (v) {
        seen[v.id] = true;
        results.push(venueMatch(v, true));
      });
    });

    // Direct venue matches (name / city / neighborhood) not already shown.
    venues.forEach(function (v) {
      if (seen[v.id]) return;
      var hit =
        (v.name && v.name.toLowerCase().indexOf(q) !== -1) ||
        (v.city && v.city.toLowerCase().indexOf(q) !== -1) ||
        (v.neighborhood && v.neighborhood.toLowerCase().indexOf(q) !== -1);
      if (hit) {
        seen[v.id] = true;
        results.push(venueMatch(v, false));
      }
    });

    return results.slice(0, CAP);
  }

  // ─── Per-instance widget factory ────────────────────────────────────────────
  function createSearch(container, variant) {
    var isHero = variant === "hero";
    var scope = container.getAttribute("data-search-scope"); // reserved; "courts" today
    void scope;

    var wrap = document.createElement("div");
    wrap.className = "global-search" + (isHero ? " global-search--hero" : "");
    wrap.innerHTML =
      '<span class="global-search-icon" aria-hidden="true"></span>' +
      '<input type="search" class="global-search-input" ' +
      'placeholder="' +
      (isHero ? "Search a city or court — e.g. Berkeley" : "Search a city or venue…") +
      '" aria-label="Search cities and courts" autocomplete="off" />' +
      '<div class="global-search-results" role="listbox" hidden></div>';

    container.appendChild(wrap);

    var input = wrap.querySelector(".global-search-input");
    var resultsEl = wrap.querySelector(".global-search-results");
    var activeIndex = -1;
    var currentMatches = [];

    function renderResults(matches, query) {
      activeIndex = -1;
      currentMatches = matches;

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
            '<a class="global-search-result' +
            (m.isSub ? " gsr--sub" : "") +
            '" href="' +
            m.href +
            '" role="option" data-index="' +
            i +
            '">' +
            '<span class="gsr-label">' +
            escapeHtml(m.label) +
            "</span>" +
            '<span class="gsr-sublabel">' +
            escapeHtml(m.sublabel || "") +
            "</span>" +
            "</a>"
          );
        })
        .join("");
    }

    function run(query) {
      renderResults(buildMatches(query), query);
    }

    // Route every selection through the map-focus contract (see header comment).
    function select(match) {
      if (!match) return;
      var ev = new CustomEvent("pbsearch:select", {
        bubbles: true,
        cancelable: true,
        detail: {
          type: match.type,
          city: match.city,
          slug: match.slug,
          id: match.id,
          href: match.href,
        },
      });
      var proceed = document.dispatchEvent(ev);
      if (proceed) {
        window.location.href = match.href;
      } else {
        // Handled in place (e.g. the Find-courts hub recentered its map). A
        // navigation would normally have torn down this dropdown for us; since
        // it was prevented, collapse our own results so they don't linger over
        // the page. Reflect the picked value and drop focus.
        input.value = match.label;
        resultsEl.hidden = true;
        resultsEl.innerHTML = "";
        activeIndex = -1;
        currentMatches = [];
        input.blur();
      }
    }

    var debounceTimer = null;
    input.addEventListener("input", function () {
      loadVenues();
      clearTimeout(debounceTimer);
      var query = input.value;
      debounceTimer = setTimeout(function () {
        run(query);
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
        var idx = activeIndex >= 0 ? activeIndex : currentMatches.length === 1 ? 0 : -1;
        if (idx >= 0 && currentMatches[idx]) {
          e.preventDefault();
          select(currentMatches[idx]);
        }
      } else if (e.key === "Escape") {
        input.value = "";
        resultsEl.hidden = true;
        resultsEl.innerHTML = "";
        input.blur();
      }
    });

    // Real <a href> stays so cmd/ctrl/middle-click open the hub in a new tab;
    // plain left-clicks route through the contract instead.
    resultsEl.addEventListener("click", function (e) {
      var a = e.target.closest ? e.target.closest(".global-search-result") : null;
      if (!a) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
      e.preventDefault();
      var idx = parseInt(a.getAttribute("data-index"), 10);
      select(currentMatches[idx]);
    });

    input.addEventListener("focus", function () {
      loadVenues();
      if (input.value.trim()) run(input.value);
    });

    document.addEventListener("click", function (e) {
      if (!wrap.contains(e.target)) resultsEl.hidden = true;
    });

    instances.push({ input: input, run: run });
  }

  // ─── Mount: nav pill everywhere, hero search wherever a mount point exists ───
  var nav = document.querySelector(".main-nav");
  if (nav) createSearch(nav, "nav");

  var heroMounts = document.querySelectorAll("[data-search-scope]");
  Array.prototype.forEach.call(heroMounts, function (el) {
    createSearch(el, "hero");
  });
})();
