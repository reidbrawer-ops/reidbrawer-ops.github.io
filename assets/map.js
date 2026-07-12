// Find-courts hub: search + map + filter panel + results list + detail card.
//
// This is the single "find a court" surface — the standalone Directory page was
// folded in here. It joins assets/courts-data.json (all 203 rich records) with
// assets/venues.json (geocoded lat/lon by id): the 181 geocoded courts get a
// Leaflet pin, all 203 appear in the results list, and the directory's filter
// set (region/city/neighborhood/indoor-outdoor/surface/reservable/skill/price/
// courts/wait/weather + an "open during" hours slider) lives behind a show/hide
// Filters panel that narrows both the map and the list at once.
//
// The 22 courts without published coordinates can't be pinned, so they show in
// the list flagged "not on the map yet" with a link to submit their location on
// the corrections page (the Google-Maps "add a missing place" idea).
//
// Search integration (contract owned by assets/global-search.js):
//   • URL param  ?city=<slug>[&venue=<id>]  — focus a city / open a court on load.
//   • DOM event  document → "pbsearch:select", detail { type, city, id, slug }
//       type "city"  → set the city filter and fly the map to that city.
//       type "venue" → focus that venue's city, then open its detail card.
// Selecting a city just drives the city filter, so search and the filter panel
// are one source of truth rather than two competing notions of "which city."

(function () {
  const statusEl = document.getElementById("map-status");
  const mapEl = document.getElementById("venue-map");
  if (!mapEl) return;

  const { escapeHtml, citySlug, setStatus } = window.PBUtils;
  const CITY_REGION = window.PB_CITY_REGION || {};

  const listEl = document.getElementById("finder-results");
  const detailEl = document.getElementById("finder-detail");
  const finderEl = document.getElementById("finder");
  const scrimEl = document.getElementById("finder-scrim");
  const scopeEl = document.getElementById("finder-scope");
  const scopeLabelEl = document.getElementById("finder-scope-label");
  const clearBtn = document.getElementById("finder-clear");
  const countEl = document.getElementById("finder-count");

  // Filter panel
  const formEl = document.getElementById("finder-filters");
  const filtersToggle = document.getElementById("finder-filters-toggle");
  const filterBadgeEl = document.getElementById("finder-filter-count");
  const hoursStartEl = document.getElementById("f-hours-start");
  const hoursEndEl = document.getElementById("f-hours-end");
  const hoursLabelEl = document.getElementById("hours-slider-label");
  const hoursRangeFillEl = document.getElementById("hours-slider-range");

  // ---- Pin + popup + detail helpers --------------------------------------

  function indoorClass(indoor) {
    return ["indoor", "outdoor", "both"].includes(indoor)
      ? `pba-pin--${indoor}`
      : "pba-pin--unknown";
  }

  function indoorLabel(indoor) {
    switch (indoor) {
      case "indoor":
        return "Indoor courts";
      case "outdoor":
        return "Outdoor courts";
      case "both":
        return "Indoor & outdoor courts";
      default:
        return "Indoor/outdoor: not specified";
    }
  }

  function pinIcon(record, isTopPick) {
    const classes = ["pba-pin", indoorClass(record.indoor)];
    if (isTopPick) classes.push("top-pick");
    return L.divIcon({
      className: "",
      html: `<span class="${classes.join(" ")}"></span>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
      popupAnchor: [0, -8],
    });
  }

  function popupHtml(record) {
    const approxNote = record.approx
      ? `<span class="p-approx">Approximate location — no precise street address published</span>`
      : "";
    return `
      <div class="pba-popup">
        <div class="p-name">${escapeHtml(record.name)}</div>
        <span class="p-addr">${escapeHtml(record.address || "")}</span>
        <span class="p-indoor"><span class="p-indoor-dot ${indoorClass(record.indoor)}"></span>${indoorLabel(record.indoor)}</span>
        <a class="p-link" href="${record.url}">View ${escapeHtml(record.city)} page →</a>
        ${approxNote}
      </div>
    `;
  }

  // A value is "present" only if it's a real, checkable fact — the dataset
  // uses "Not specified" / null / "" as placeholders we shouldn't surface.
  function hasValue(v) {
    return v != null && v !== "" && v !== "Not specified";
  }

  // Prefilled corrections link for a court missing its map location — mirrors
  // the "add a missing place" prompt, dropping the user onto the report form
  // with the venue, city, and issue type already filled in (corrections.html
  // reads these query params).
  function correctionsUrl(record) {
    const params = new URLSearchParams({
      issue: "address",
      venue: record.name || "",
      city: record.city || "",
    });
    return `/corrections?${params.toString()}`;
  }

  function detailHtml(record) {
    const eyebrowParts = [record.city];
    if (hasValue(record.neighborhood)) eyebrowParts.push(record.neighborhood);

    const facts = [];
    const pushFact = (label, value) => {
      if (hasValue(value)) facts.push({ label, value: String(value) });
    };
    pushFact("Hours", record.hours);
    if (typeof record.courts === "number" && record.courts > 0) {
      pushFact("Courts", `${record.courts} court${record.courts === 1 ? "" : "s"}`);
    }
    pushFact("Surface", record.surface);
    pushFact("Wait", record.waitTime);
    pushFact(
      "Indoor / outdoor",
      hasValue(record.indoorOutdoor) ? record.indoorOutdoor : indoorLabel(record.indoor)
    );
    pushFact("Price", record.price);
    pushFact("Skill", record.skill);
    pushFact("Reservable", record.reservable);

    const factsHtml = facts.length
      ? `<dl class="fd-facts">${facts
          .map(
            (f) =>
              `<div class="fd-fact"><dt>${escapeHtml(f.label)}</dt><dd>${escapeHtml(
                f.value
              )}</dd></div>`
          )
          .join("")}</dl>`
      : "";

    const actions = [];
    if (hasValue(record.googleMapsUrl)) {
      actions.push(
        `<a class="btn directions-link" href="${record.googleMapsUrl}" target="_blank" rel="noopener">Directions ↗</a>`
      );
    }
    if (hasValue(record.bookingUrl)) {
      actions.push(
        `<a class="btn btn-ghost" href="${record.bookingUrl}" target="_blank" rel="noopener">Book a court ↗</a>`
      );
    }
    const actionsHtml = actions.length ? `<div class="fd-actions">${actions.join("")}</div>` : "";

    // Geocoded-but-approximate vs. not-on-the-map-at-all are different notes.
    const approxNote =
      record.plottable && record.approx
        ? `<p class="fd-approx">Approximate location — no precise street address is published for this venue; check the city page before you drive out.</p>`
        : "";
    const noPinNote = !record.plottable
      ? `<div class="fd-nopin">` +
        `<p class="fd-nopin-text">Not on the map yet — we don't have precise coordinates for this court.</p>` +
        `<a class="fd-nopin-link" href="${correctionsUrl(record)}">📍 Help add its location →</a>` +
        `</div>`
      : "";

    return (
      `<button type="button" class="finder-detail-back" data-role="detail-back">← All courts</button>` +
      `<div class="fd-body" data-court-id="${escapeHtml(record.id)}">` +
      `<p class="fd-eyebrow">${escapeHtml(eyebrowParts.join(" · "))}</p>` +
      `<h2 class="fd-name">${escapeHtml(record.name)}</h2>` +
      (hasValue(record.address) ? `<p class="fd-addr">${escapeHtml(record.address)}</p>` : "") +
      factsHtml +
      `<div class="fd-ratings" data-role="ratings"></div>` +
      actionsHtml +
      noPinNote +
      approxNote +
      `<a class="fd-city-link" href="${record.url}">See the full ${escapeHtml(record.city)} writeup →</a>` +
      `</div>`
    );
  }

  // ---- Filter buckets (ported from the former directory.js) --------------

  const HOURS_MIN = 0;
  const HOURS_MAX = 1440;
  let hoursRange = [HOURS_MIN, HOURS_MAX];

  function regionFor(record) {
    return CITY_REGION[record.city] || "Not specified";
  }

  function priceBucket(record) {
    const raw = record.price || "Not specified";
    if (/not specified/i.test(raw)) return "Not specified";
    if (/free/i.test(raw)) return "Free";
    if (/membership/i.test(raw)) return "Membership required";
    const match = raw.match(/\$(\d+(?:\.\d+)?)/);
    if (match) {
      const amount = parseFloat(match[1]);
      return amount < 10 ? "Under $10/hr" : "$10+/hr";
    }
    return "Other";
  }

  function skillBucket(record) {
    const raw = record.skill || "Not specified";
    if (/not specified/i.test(raw)) return "Not specified";
    if (/all level/i.test(raw)) return "All levels";
    if (/beginner/i.test(raw)) return "Beginner-friendly";
    if (/competitive|advanced/i.test(raw)) return "Advanced / competitive";
    return "Other";
  }

  function courtsBucket(record) {
    const n = record.courts;
    if (typeof n !== "number") return "Not specified";
    if (n <= 2) return "1-2 courts";
    if (n <= 5) return "3-5 courts";
    return "6+ courts";
  }

  function weatherBucket(record) {
    const raw = record.weather || "Not specified";
    if (/not specified/i.test(raw)) return "Not specified";
    if (/fog/i.test(raw)) return "Foggy / cool";
    if (/warm|dry|sunny|hot/i.test(raw)) return "Warm / dry";
    if (/mild/i.test(raw)) return "Mild";
    return "Other";
  }

  // Standardized surface categories — the raw "surface" text is free prose and
  // is almost never unique-comparable, so filtering uses this bucket while the
  // list/detail display still shows the raw text.
  function surfaceBucket(record) {
    const raw = (record.surface || "Not specified").toLowerCase();
    if (raw === "not specified") return "Not specified";
    if (/indoor|wood floor|\bgym\b/.test(raw)) return "Indoor court";
    if (/tennis|dual-striped|dual-purpose|blended|shared|basketball|volleyball|mixed/.test(raw)) return "Converted / shared courts";
    if (/dedicated|permanent net|permanent line|acrylic/.test(raw)) return "Dedicated pickleball courts";
    if (/portable|byo|bring your own/.test(raw)) return "Portable nets / BYO";
    return "Other / unclear";
  }

  function toMinutes(hour, minute, meridiem) {
    let h = parseInt(hour, 10) % 12;
    if (meridiem === "pm") h += 12;
    return h * 60 + (minute ? parseInt(minute, 10) : 0);
  }

  // Best-effort [open, close] window (minutes since midnight) from free-text
  // hours. null when the text gives nothing concrete — callers treat null as
  // "unknown, don't hide it."
  function parseHoursRange(text) {
    if (!text || /not specified/i.test(text)) return null;
    if (/24\/7|24 hours?/i.test(text)) return [HOURS_MIN, HOURS_MAX];

    const times = [];
    const rangeRe = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[-–—]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/gi;
    let m;
    while ((m = rangeRe.exec(text))) {
      const endMeridiem = m[6].toLowerCase();
      const startMeridiem = (m[3] || endMeridiem).toLowerCase();
      times.push(toMinutes(m[1], m[2], startMeridiem));
      times.push(toMinutes(m[4], m[5], endMeridiem));
    }
    if (times.length < 2) {
      const singleRe = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)/gi;
      while ((m = singleRe.exec(text))) {
        times.push(toMinutes(m[1], m[2], m[3].toLowerCase()));
      }
    }
    if (times.length < 2) return null;
    return [Math.min.apply(null, times), Math.max.apply(null, times)];
  }

  function formatClock(min) {
    min = min % 1440;
    let h = Math.floor(min / 60);
    const m = min % 60;
    const ampm = h < 12 ? "AM" : "PM";
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
  }

  function passesHours(record) {
    if (hoursRange[0] === HOURS_MIN && hoursRange[1] === HOURS_MAX) return true;
    if (!record.hoursRange) return true; // hours unknown — can't confirm, don't hide
    return record.hoursRange[0] <= hoursRange[1] && record.hoursRange[1] >= hoursRange[0];
  }

  function uniqueSorted(values) {
    return Array.from(new Set(values.filter((v) => v && v !== "Not specified"))).sort((a, b) =>
      a.localeCompare(b)
    );
  }

  // Fields driving the <select> filters. `withNotSpecified` mirrors the former
  // directory: location fields never offer "Not specified", everything else does.
  const FILTER_FIELDS = [
    { key: "region", elId: "f-region", allLabel: "All regions", withNotSpecified: false },
    { key: "city", elId: "f-city", allLabel: "All cities", withNotSpecified: false },
    { key: "neighborhood", elId: "f-neighborhood", allLabel: "All neighborhoods", withNotSpecified: false },
    { key: "indoorOutdoor", elId: "f-indoor", allLabel: "All", withNotSpecified: true },
    { key: "surfaceBucket", elId: "f-surface", allLabel: "All surfaces", withNotSpecified: true },
    { key: "reservable", elId: "f-reservable", allLabel: "All", withNotSpecified: true },
    { key: "skillBucket", elId: "f-skill", allLabel: "All skill levels", withNotSpecified: true },
    { key: "priceBucket", elId: "f-price", allLabel: "All prices", withNotSpecified: true },
    { key: "courtsBucket", elId: "f-courts", allLabel: "Any", withNotSpecified: true },
    { key: "waitTime", elId: "f-wait", allLabel: "All", withNotSpecified: true },
    { key: "weatherBucket", elId: "f-weather", allLabel: "All", withNotSpecified: true },
  ];

  Promise.all([
    fetch("/assets/venues.json").then((r) => {
      if (!r.ok) throw new Error(`venues.json request failed (${r.status})`);
      return r.json();
    }),
    fetch("/assets/courts-data.json")
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []),
  ])
    .then(([venues, courts]) => {
      const venuesById = {};
      (Array.isArray(venues) ? venues : []).forEach((v) => {
        if (v && v.id) venuesById[v.id] = v;
      });

      // Every court in courts-data becomes a record; the geocoded ones also get
      // coordinates (and a pin). Non-geocoded courts stay in the list but can't
      // be plotted.
      const records = (Array.isArray(courts) ? courts : []).map((c) => {
        const v = venuesById[c.id] || {};
        const plottable = typeof v.lat === "number" && typeof v.lon === "number";
        const rec = {
          id: c.id,
          name: c.name || v.name,
          city: c.city || v.city,
          neighborhood: c.neighborhood,
          address: c.address || v.address,
          url: c.url || v.url,
          lat: v.lat,
          lon: v.lon,
          plottable,
          indoor: v.indoor,
          approx: v.approx,
          indoorOutdoor: c.indoorOutdoor,
          price: c.price,
          hours: c.hours,
          courts: c.courts,
          waitTime: c.waitTime,
          surface: c.surface,
          skill: c.skill,
          reservable: c.reservable,
          weather: c.weather,
          bookingUrl: c.bookingUrl,
          googleMapsUrl: c.googleMapsUrl,
        };
        rec.region = regionFor(rec);
        rec.priceBucket = priceBucket(rec);
        rec.skillBucket = skillBucket(rec);
        rec.courtsBucket = courtsBucket(rec);
        rec.weatherBucket = weatherBucket(rec);
        rec.surfaceBucket = surfaceBucket(rec);
        rec.hoursRange = parseHoursRange(rec.hours);
        return rec;
      });

      const recordsById = {};
      records.forEach((r) => (recordsById[r.id] = r));
      const plottableRecords = records.filter((r) => r.plottable);

      const map = L.map(mapEl, { scrollWheelZoom: true });

      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);

      // Markers exist for every plottable record; which are actually on the map
      // is driven by the active filters (see updateMarkerVisibility).
      const markersById = {};
      const markerShown = {};
      const markers = plottableRecords.map((record) => {
        const marker = L.marker([record.lat, record.lon], { icon: pinIcon(record, false) });
        marker.bindPopup(popupHtml(record));
        marker.__record = record;
        marker.on("click", () => selectVenue(record.id, { pan: false }));
        markersById[record.id] = marker;
        markerShown[record.id] = false;
        return marker;
      });

      let topPickIds = new Set();

      // ---- Filter field elements ----------------------------------------

      const fieldEls = {};
      FILTER_FIELDS.forEach((f) => {
        fieldEls[f.key] = document.getElementById(f.elId);
      });

      function currentFilters() {
        const filters = {};
        FILTER_FIELDS.forEach((f) => {
          filters[f.key] = fieldEls[f.key] ? fieldEls[f.key].value : "";
        });
        return filters;
      }

      function rowMatchesFilters(row, filters, excludeKey) {
        return FILTER_FIELDS.every((f) => {
          if (f.key === excludeKey) return true;
          const wanted = filters[f.key];
          if (!wanted) return true;
          return row[f.key] === wanted;
        });
      }

      // Records compatible with every active filter except `excludeKey` (and,
      // always, the hours slider) — the "leave-one-out" set used to decide which
      // options a dropdown should offer, so no listed option yields zero results.
      function rowsMatchingAllExcept(filters, excludeKey) {
        return records.filter(
          (r) => rowMatchesFilters(r, filters, excludeKey) && passesHours(r)
        );
      }

      function refreshFilterOptions() {
        const snapshot = currentFilters();
        FILTER_FIELDS.forEach((f) => {
          const el = fieldEls[f.key];
          if (!el) return;
          const currentValue = el.value;
          const eligible = rowsMatchingAllExcept(snapshot, f.key);
          const values = eligible.map((r) => r[f.key]);
          const opts = uniqueSorted(values);
          if (f.withNotSpecified && values.includes("Not specified")) opts.push("Not specified");

          el.innerHTML =
            `<option value="">${escapeHtml(f.allLabel)}</option>` +
            opts.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");

          el.value = opts.includes(currentValue) ? currentValue : "";
        });
      }

      function activeFilterCount(filters) {
        let n = FILTER_FIELDS.reduce((acc, f) => acc + (filters[f.key] ? 1 : 0), 0);
        if (hoursRange[0] !== HOURS_MIN || hoursRange[1] !== HOURS_MAX) n += 1;
        return n;
      }

      // Search may target a city that isn't currently an option (another filter
      // excludes it) — add it so setting the value takes; refreshFilterOptions
      // then keeps or drops it based on the leave-one-out set.
      function setCityFilter(cityName) {
        const el = fieldEls.city;
        if (!el) return;
        if (!cityName) {
          el.value = "";
          return;
        }
        if (![...el.options].some((o) => o.value === cityName)) {
          const opt = document.createElement("option");
          opt.value = cityName;
          opt.textContent = cityName;
          el.appendChild(opt);
        }
        el.value = cityName;
      }

      function resolveCityName(cityHint, slug) {
        if (cityHint && records.some((r) => r.city === cityHint)) return cityHint;
        const rec = records.find((r) => citySlug(r.city) === slug);
        return rec ? rec.city : null;
      }

      // ---- Results list -------------------------------------------------

      function resultHtml(record) {
        const isPick = topPickIds.has(record.id);
        const metaParts = [record.city];
        if (hasValue(record.neighborhood)) metaParts.push(record.neighborhood);
        const subParts = [];
        if (typeof record.courts === "number" && record.courts > 0) {
          subParts.push(`${record.courts} court${record.courts === 1 ? "" : "s"}`);
        }
        if (hasValue(record.price)) subParts.push(record.price);
        else if (hasValue(record.indoorOutdoor)) subParts.push(record.indoorOutdoor);
        const nopin = record.plottable
          ? ""
          : `<span class="fr-nopin">Not on the map yet · tap to add its location</span>`;
        return (
          `<li class="finder-result${isPick ? " is-top-pick" : ""}${record.plottable ? "" : " finder-result--nopin"}" data-id="${escapeHtml(record.id)}">` +
          `<button type="button" class="finder-result-btn">` +
          `<span class="fr-top"><span class="fr-name">${escapeHtml(record.name)}</span>` +
          `<span class="fr-pick" title="Community top pick"${isPick ? "" : " hidden"}>★ Top pick</span></span>` +
          `<span class="fr-meta">${escapeHtml(metaParts.join(" · "))}</span>` +
          (subParts.length ? `<span class="fr-sub">${escapeHtml(subParts.join(" · "))}</span>` : "") +
          nopin +
          `</button></li>`
        );
      }

      function renderResults(list) {
        listEl.innerHTML = list.length
          ? list.map(resultHtml).join("")
          : `<li class="finder-empty">No courts match these filters. <button type="button" class="finder-empty-clear" data-role="empty-clear">Clear filters</button></li>`;
        if (activeId && recordsById[activeId]) highlightRow(activeId);
      }

      function highlightRow(id) {
        listEl.querySelectorAll(".finder-result.is-active").forEach((el) =>
          el.classList.remove("is-active")
        );
        const row = listEl.querySelector(`.finder-result[data-id="${cssEscape(id)}"]`);
        if (row) {
          row.classList.add("is-active");
          row.scrollIntoView({ block: "nearest" });
        }
      }

      function cssEscape(s) {
        return window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/[^\w-]/g, "\\$&");
      }

      // ---- Detail card --------------------------------------------------

      let activeId = null;

      function fillRatings(id) {
        const slot = detailEl.querySelector('[data-role="ratings"]');
        if (!slot || !window.PBWidgets) return;
        window.PBWidgets.whenReady(function () {
          // The detail card can be reopened for a different court before this
          // resolves — only fill if it's still showing the same one.
          if (activeId !== id || detailEl.hidden) return;
          slot.innerHTML =
            window.PBWidgets.overallRatingHtml(id) +
            window.PBWidgets.favoriteButtonHtml(id, "Favorite") +
            window.PBWidgets.ratingFormHtml(id);
          window.PBWidgets.refreshAll(detailEl);
          if (window.PBGoogleRatings) window.PBGoogleRatings.rewriteDirectionsLinks(detailEl);
        });
      }

      function openDetail(record) {
        detailEl.innerHTML = detailHtml(record);
        detailEl.hidden = false;
        scrimEl.hidden = false;
        finderEl.classList.add("finder--detail-open");
        detailEl.scrollTop = 0;
        fillRatings(record.id);
        detailEl.focus({ preventScroll: true });
      }

      function closeDetail() {
        detailEl.hidden = true;
        detailEl.innerHTML = "";
        scrimEl.hidden = true;
        finderEl.classList.remove("finder--detail-open");
        if (activeId) {
          const row = listEl.querySelector(`.finder-result[data-id="${cssEscape(activeId)}"]`);
          if (row) row.classList.remove("is-active");
        }
        activeId = null;
      }

      function selectVenue(id, opts) {
        const record = recordsById[id];
        if (!record) return;
        opts = opts || {};
        activeId = id;
        highlightRow(id);
        // Cancel any pending city fly-in handoff so selecting a venue right
        // after a city focus isn't yanked back out to the city bounds.
        flyToken++;
        if (record.plottable && opts.pan !== false) {
          map.setView([record.lat, record.lon], Math.max(map.getZoom() || 0, 14), {
            animate: true,
          });
        }
        const marker = markersById[id];
        if (marker && markerShown[id]) marker.openPopup();
        openDetail(record);
      }

      // ---- Map fit / city fly-in ----------------------------------------

      let flyToken = 0;

      function boundsFor(recs) {
        return L.latLngBounds(recs.map((r) => [r.lat, r.lon]));
      }

      function fitTo(recs) {
        // Guard against a stale/zero container size (web fonts still swapping in,
        // a resize mid-flight) which would make fitBounds pick a wild zoom.
        map.invalidateSize();
        if (recs.length) {
          map.fitBounds(boundsFor(recs), { padding: [32, 32], maxZoom: recs.length === 1 ? 14 : 16 });
        } else {
          map.setView([37.75, -122.2], 9);
        }
      }

      // Two-phase move when focusing a city: a quick zoom-out that glides toward
      // the city, then a slower zoom back in to its courts — a Google-Maps-style
      // "pull back, then swoop in." Instant fit under reduced-motion.
      function flyToCity(matches) {
        map.invalidateSize();
        if (!matches.length) return;
        const single = matches.length === 1;
        const bounds = boundsFor(matches);
        const center = single ? L.latLng(matches[0].lat, matches[0].lon) : bounds.getCenter();

        const reduce =
          window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduce) {
          if (single) map.setView(center, 14);
          else map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
          return;
        }

        const zoomIn = () => {
          if (single) map.flyTo(center, 14, { duration: 1.6, easeLinearity: 0.2 });
          else
            map.flyToBounds(bounds, {
              duration: 1.6,
              easeLinearity: 0.2,
              padding: [40, 40],
              maxZoom: 15,
            });
        };

        const currentZoom = map.getZoom();
        const targetZoom = single ? 14 : map.getBoundsZoom(bounds);
        const outZoom = Math.max(map.getMinZoom() || 0, Math.min(currentZoom, targetZoom) - 2);

        if (outZoom < currentZoom) {
          // Token-guard the handoff so a rapid second selection can't trigger
          // this flight's zoom-in.
          const token = ++flyToken;
          map.flyTo(center, outZoom, { duration: 0.7, easeLinearity: 0.25 });
          map.once("moveend", () => {
            if (token === flyToken) zoomIn();
          });
        } else {
          zoomIn();
        }
      }

      // ---- Apply filters (the single render path) -----------------------

      function updateMarkerVisibility(matchedIds) {
        markers.forEach((m) => {
          const id = m.__record.id;
          const show = matchedIds.has(id);
          if (show && !markerShown[id]) {
            m.addTo(map);
            markerShown[id] = true;
          } else if (!show && markerShown[id]) {
            map.removeLayer(m);
            markerShown[id] = false;
          }
        });
      }

      let lastCity = null;
      let firstRender = true;

      function applyFilters() {
        refreshFilterOptions();
        const filters = currentFilters();
        const matched = records.filter((r) => rowMatchesFilters(r, filters) && passesHours(r));
        const matchedPlottable = matched.filter((r) => r.plottable);
        const matchedIds = new Set(matchedPlottable.map((r) => r.id));

        updateMarkerVisibility(matchedIds);
        renderResults(matched);

        // Result count — a live filtered count, never a completeness total.
        const active = activeFilterCount(filters);
        countEl.textContent = active
          ? `${matched.length} court${matched.length === 1 ? "" : "s"} match${
              matched.length === 1 ? "es" : ""
            } your filters`
          : "";

        // Filters button badge
        if (filterBadgeEl) {
          filterBadgeEl.textContent = active ? String(active) : "";
          filterBadgeEl.hidden = active === 0;
        }

        // City scope pill (driven by the city filter — one source of truth)
        const cityVal = filters.city;
        if (cityVal) {
          scopeLabelEl.textContent = `Showing courts in ${cityVal}`;
          scopeEl.hidden = false;
        } else {
          scopeEl.hidden = true;
          scopeLabelEl.textContent = "";
        }

        try {
          history.replaceState(
            null,
            "",
            cityVal ? `/map?city=${encodeURIComponent(citySlug(cityVal))}` : "/map"
          );
        } catch (e) {
          /* replaceState can throw on file:// — non-fatal */
        }

        // Move the map only when the city focus changes (or on first render).
        // Other filters just hide/show pins without yanking the viewport.
        if (firstRender) {
          firstRender = false;
          lastCity = cityVal;
          fitTo(matchedPlottable);
        } else if (cityVal !== lastCity) {
          lastCity = cityVal;
          if (cityVal) flyToCity(matchedPlottable);
          else fitTo(matchedPlottable);
        }
      }

      // ---- Top-pick pins + list rows ------------------------------------

      // Top pick is computed live from community votes/ratings (see
      // assets/top-picks.js) — recolor pins and re-tag list rows in place.
      function refreshTopPicks() {
        if (!window.PBRatings || !window.PBTopPicks) return;
        topPickIds = window.PBTopPicks.computeTopPickIds(records);
        markers.forEach((marker) => {
          marker.setIcon(pinIcon(marker.__record, topPickIds.has(marker.__record.id)));
        });
        listEl.querySelectorAll(".finder-result").forEach((row) => {
          const isPick = topPickIds.has(row.dataset.id);
          row.classList.toggle("is-top-pick", isPick);
          const pick = row.querySelector(".fr-pick");
          if (pick) pick.hidden = !isPick;
        });
      }
      document.addEventListener("pbratings:ready", refreshTopPicks);
      document.addEventListener("pbratings:update", refreshTopPicks);

      // ---- Filter panel wiring ------------------------------------------

      function updateHoursVisual() {
        const start = parseInt(hoursStartEl.value, 10);
        const end = parseInt(hoursEndEl.value, 10);
        hoursLabelEl.textContent =
          start === HOURS_MIN && end === HOURS_MAX
            ? "Any time"
            : `${formatClock(start)} – ${formatClock(end)}`;
        const pct = (v) => ((v - HOURS_MIN) / (HOURS_MAX - HOURS_MIN)) * 100;
        hoursRangeFillEl.style.left = pct(start) + "%";
        hoursRangeFillEl.style.right = 100 - pct(end) + "%";
      }

      function resetHoursSlider() {
        hoursRange = [HOURS_MIN, HOURS_MAX];
        hoursStartEl.value = HOURS_MIN;
        hoursEndEl.value = HOURS_MAX;
        updateHoursVisual();
      }

      function handleHoursInput(e) {
        let start = parseInt(hoursStartEl.value, 10);
        let end = parseInt(hoursEndEl.value, 10);
        if (start > end) {
          if (e.target === hoursStartEl) {
            end = start;
            hoursEndEl.value = String(end);
          } else {
            start = end;
            hoursStartEl.value = String(start);
          }
        }
        hoursRange = [start, end];
        updateHoursVisual();
        applyFilters();
      }

      if (formEl) formEl.addEventListener("change", applyFilters);
      if (hoursStartEl) hoursStartEl.addEventListener("input", handleHoursInput);
      if (hoursEndEl) hoursEndEl.addEventListener("input", handleHoursInput);

      const clearFilters = () => {
        FILTER_FIELDS.forEach((f) => {
          if (fieldEls[f.key]) fieldEls[f.key].value = "";
        });
        resetHoursSlider();
        applyFilters();
      };
      const fClear = document.getElementById("f-clear");
      if (fClear) fClear.addEventListener("click", clearFilters);

      if (filtersToggle && formEl) {
        filtersToggle.addEventListener("click", () => {
          const willOpen = formEl.hidden;
          formEl.hidden = !willOpen;
          filtersToggle.setAttribute("aria-expanded", String(willOpen));
          filtersToggle.classList.toggle("is-open", willOpen);
        });
      }

      // ---- List / detail / scope interactions ---------------------------

      listEl.addEventListener("click", (e) => {
        if (e.target.closest('[data-role="empty-clear"]')) {
          setCityFilter("");
          clearFilters();
          return;
        }
        const btn = e.target.closest(".finder-result-btn");
        if (!btn) return;
        const li = btn.closest(".finder-result");
        if (li && li.dataset.id) selectVenue(li.dataset.id);
      });

      detailEl.addEventListener("click", (e) => {
        if (e.target.closest('[data-role="detail-back"]')) closeDetail();
      });
      scrimEl.addEventListener("click", closeDetail);
      // The scope pill's Clear resets just the city focus, not every filter.
      if (clearBtn)
        clearBtn.addEventListener("click", () => {
          setCityFilter("");
          applyFilters();
        });

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !detailEl.hidden) closeDetail();
      });

      // Phase 2's search dispatches this on selection (see the contract in
      // global-search.js). preventDefault() keeps the component from navigating
      // (reloading) so we can recenter in place.
      document.addEventListener("pbsearch:select", (e) => {
        const d = (e && e.detail) || {};
        if (d.type === "venue" && d.id && recordsById[d.id]) {
          e.preventDefault();
          setCityFilter(recordsById[d.id].city);
          applyFilters();
          selectVenue(d.id);
        } else if (d.slug || d.city) {
          const cityName = resolveCityName(d.city, d.slug);
          if (cityName) {
            e.preventDefault();
            setCityFilter(cityName);
            applyFilters();
          }
        }
      });

      // ---- First render + deep-link -------------------------------------

      refreshTopPicks();
      setStatus(statusEl, "Search a city to focus the map, or open Filters to narrow the list.");

      const params = new URLSearchParams(window.location.search);
      const cityParam = params.get("city");
      const venueParam = params.get("venue");
      if (cityParam) {
        const cityName = resolveCityName(null, citySlug(cityParam));
        if (cityName) setCityFilter(cityName);
        else setStatus(statusEl, `No courts found for "${cityParam}".`);
      }

      // First render fits the map. We render synchronously first because some
      // automated / backgrounded environments never fire requestAnimationFrame.
      applyFilters();

      requestAnimationFrame(() => {
        if (markers.length && map.getSize().x < 50) fitTo(plottableRecords);
      });

      if (venueParam && recordsById[venueParam]) {
        selectVenue(venueParam);
      }

      // Keep tiles aligned on later window resizes without re-fitting bounds.
      window.addEventListener("resize", () => map.invalidateSize());
    })
    .catch((err) => {
      console.error(err);
      setStatus(statusEl, "Couldn't load court data for the map. Try refreshing the page.", true);
    });
})();
