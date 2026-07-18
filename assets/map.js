// Find-courts hub: search + map + filter panel + results list + detail card.
//
// This is the single "find a court" surface — the standalone Directory page was
// folded in here. It loads one pre-joined feed, assets/map-data.json (built by
// scripts/generate-venues.mjs from courts-data.json + venues.json): the 181
// geocoded courts get a Leaflet pin, all 203 appear in the results list, and
// the directory's filter
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
  const clearFiltersEl = document.getElementById("finder-clear-filters");
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

  // Great-circle distance in miles between two lat/lon points — powers the
  // "Use my location" nearest-first sort on the finder list.
  function haversineMiles(aLat, aLon, bLat, bLon) {
    const toRad = (d) => (d * Math.PI) / 180;
    const R = 3958.8; // Earth radius, miles
    const dLat = toRad(bLat - aLat);
    const dLon = toRad(bLon - aLon);
    const s =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  }

  function formatMiles(mi) {
    if (mi == null) return "";
    return mi < 10 ? `${mi.toFixed(1)} mi` : `${Math.round(mi)} mi`;
  }

  // "2026-07" -> "Jul 2026" for the per-venue "verified" trust line.
  var VERIFIED_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function formatVerified(ym) {
    if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return "";
    var parts = ym.split("-");
    var label = VERIFIED_MONTHS[parseInt(parts[1], 10) - 1];
    return label ? label + " " + parts[0] : "";
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

    const newTab = '<span class="visually-hidden"> (opens in new tab)</span>';
    const actions = [];
    if (hasValue(record.googleMapsUrl)) {
      actions.push(
        `<a class="btn directions-link" href="${record.googleMapsUrl}" target="_blank" rel="noopener">Directions ↗${newTab}</a>`
      );
    }
    if (hasValue(record.bookingUrl)) {
      actions.push(
        `<a class="btn btn-ghost" href="${record.bookingUrl}" target="_blank" rel="noopener">Book a court ↗${newTab}</a>`
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
      (formatVerified(record.lastVerified)
        ? `<p class="fd-verified">Court info verified ${escapeHtml(formatVerified(record.lastVerified))}</p>`
        : "") +
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

  // ?skill= deep link. An inbound link shouldn't have to know the internal
  // bucket label — /learn's "Find a beginner court" CTA says ?skill=beginner
  // and lands on the map already filtered. Only the buckets worth linking to
  // are mapped; anything else is ignored rather than guessed at.
  const SKILL_PARAM = {
    beginner: "Beginner-friendly",
    "beginner-friendly": "Beginner-friendly",
    advanced: "Advanced / competitive",
    competitive: "Advanced / competitive",
    "all-levels": "All levels",
  };
  // The reverse, so the filter round-trips: pick "Beginner-friendly" in the UI
  // and the URL says ?skill=beginner, which is then a link worth sharing.
  const SKILL_SLUG = {
    "Beginner-friendly": "beginner",
    "Advanced / competitive": "advanced",
    "All levels": "all-levels",
  };

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

  // The map loads one pre-joined feed (assets/map-data.json), built at build
  // time by scripts/generate-venues.mjs from courts-data.json + venues.json —
  // so there's no second request and no client-side join on every load. Each
  // row already carries the court's facts plus its geocode; here we only derive
  // the runtime-only fields (the plottable flag + filter buckets).
  fetch("/assets/map-data.json")
    .then((r) => {
      if (!r.ok) throw new Error(`map-data.json request failed (${r.status})`);
      return r.json();
    })
    .then((data) => {
      const records = (Array.isArray(data) ? data : []).map((rec) => {
        rec.plottable = typeof rec.lat === "number" && typeof rec.lon === "number";
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

      // ---- "Near me" geolocation state ----------------------------------
      let userLoc = null; // {lat, lon} once the visitor shares their location
      let sortByDistance = false; // order the finder list by distance when true
      let youMarker = null;

      // If the nearest court is farther than this, treat the visitor as outside
      // the Bay Area — sorting hundreds of miles of courts as "near" is useless,
      // so we show a coverage note + trip-planning links instead.
      const BAY_AREA_RADIUS_MI = 60;

      function distanceMilesFor(record) {
        if (!userLoc || !record.plottable) return null;
        return haversineMiles(userLoc.lat, userLoc.lon, record.lat, record.lon);
      }

      function nearestVenueMiles() {
        let min = Infinity;
        plottableRecords.forEach((r) => {
          const d = distanceMilesFor(r);
          if (d != null && d < min) min = d;
        });
        return min;
      }

      function youIcon() {
        return L.divIcon({
          className: "pba-you-pin",
          html: '<span class="pba-you-dot"></span>',
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });
      }

      function recenterNearUser() {
        if (!userLoc) return;
        const nearest = plottableRecords
          .map((r) => ({ r, d: distanceMilesFor(r) }))
          .sort((a, b) => a.d - b.d)
          .slice(0, 5)
          .map((x) => [x.r.lat, x.r.lon]);
        map.invalidateSize();
        map.fitBounds(L.latLngBounds([[userLoc.lat, userLoc.lon], ...nearest]), {
          padding: [40, 40],
          maxZoom: 14,
        });
      }

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
        // title/alt give the pin an accessible name + hover tooltip; keyboard:
        // false removes it from the tab order, since every marker is already
        // reachable (and labelled) via the results list beside the map — so
        // keyboard/SR users aren't dragged through ~180 empty pin tab-stops.
        const label = record.name + " — " + indoorLabel(record.indoor);
        const marker = L.marker([record.lat, record.lon], {
          icon: pinIcon(record, false),
          title: label,
          alt: label,
          keyboard: false,
        });
        // autoPan off: every selection now centers the court itself, so the
        // popup always lands in view — and autoPan's panBy would fight the
        // in-flight flyTo (Leaflet runs the two animations concurrently).
        marker.bindPopup(popupHtml(record), { autoPan: false });
        marker.__record = record;
        marker.on("click", () => selectVenue(record.id));
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

      // Same shape as setCityFilter: seed the option if refreshFilterOptions
      // hasn't built it yet (this runs before the first applyFilters), then set
      // the value. The rebuild preserves a value that's still eligible, so the
      // filter survives first render.
      function setSkillFilter(slug) {
        const el = fieldEls.skillBucket;
        const bucket = SKILL_PARAM[String(slug).toLowerCase()];
        if (!el || !bucket) return false;
        if (![...el.options].some((o) => o.value === bucket)) {
          const opt = document.createElement("option");
          opt.value = bucket;
          opt.textContent = bucket;
          el.appendChild(opt);
        }
        el.value = bucket;
        return true;
      }

      function resolveCityName(cityHint, slug) {
        if (cityHint && records.some((r) => r.city === cityHint)) return cityHint;
        const rec = records.find((r) => citySlug(r.city) === slug);
        return rec ? rec.city : null;
      }

      // ---- Results list -------------------------------------------------

      function resultHtml(record) {
        const isPick = topPickIds.has(record.id);
        const dist = sortByDistance ? distanceMilesFor(record) : null;
        const distChip = dist != null ? `<span class="fr-distance">${formatMiles(dist)}</span>` : "";
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
          distChip +
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
      // The control (list row / marker) that opened the detail sheet, so focus
      // can be returned to it on close instead of dropping to <body>.
      let detailTrigger = null;

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
        // Remember what to return focus to (only if it's a real element, not
        // <body>), before the sheet steals focus.
        detailTrigger = document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
        detailEl.innerHTML = detailHtml(record);
        // On mobile the sheet is a scrim-backed modal; expose it as a dialog so
        // assistive tech treats the rest of the page as inert.
        detailEl.setAttribute("role", "dialog");
        detailEl.setAttribute("aria-modal", "true");
        detailEl.setAttribute("aria-label", record.name + " — court details");
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
        // Return focus to the control that opened the sheet.
        if (detailTrigger && document.contains(detailTrigger)) detailTrigger.focus();
        detailTrigger = null;
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
          flyToVenue(record, opts.animate !== false);
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

      // Selecting a court always pulls back before it swoops in, and always
      // lands with the court centered.
      //
      // Neither Leaflet primitive gives us that. flyTo only arcs out in
      // proportion to the ground it covers, so from the default Bay Area
      // overview it just zooms straight in — no pull-back at all. Chaining two
      // flyTos to force one stalls dead between the legs (the first has to
      // decelerate to fire moveend before the second accelerates) and makes the
      // second leg a degenerate zero-distance flight, since the first already
      // centered the court.
      //
      // So drive the whole move ourselves: the center eases toward the court
      // across the entire flight while the zoom eases out to PULLBACK levels
      // below the shallower end by the midpoint, then eases back in. Both zoom
      // halves are easeInOutQuad, so their slopes meet at zero and the reversal
      // has no kink — and because the center never stops gliding, the pull-back
      // reads as one continuous swoop rather than two legs.
      // This mirrors how flyTo animates itself (_moveStart / _move per frame /
      // _moveEnd) — private, but Leaflet is pinned by SRI hash in map.html.
      const PULLBACK = 2; // zoom levels to pull back mid-flight
      const FLIGHT_MS = 1500;
      let venueFlight = null;

      function flyToVenue(record, animate) {
        // Guard against a stale container size, which would offset the center
        // the flight settles on.
        map.invalidateSize();
        const center = L.latLng(record.lat, record.lon);
        // Close to street level, but never yank the user back out if they've
        // already zoomed in past it.
        const targetZoom = Math.max(map.getZoom() || 0, 14);

        const reduce =
          window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (animate === false || reduce) {
          map.setView(center, targetZoom);
          return;
        }

        const startZoom = map.getZoom();
        // Re-selecting mid-flight measures from a zoom that's already pulled
        // back, so pulling back again from it compounds into a much deeper dip
        // than intended. The user has already seen one, so this flight just
        // glides to the new court.
        const outZoom = venueFlight
          ? Math.min(startZoom, targetZoom)
          : Math.max(map.getMinZoom() || 0, Math.min(startZoom, targetZoom) - PULLBACK);
        // Interpolate in projected space, the way flyTo does, so the glide
        // tracks straight on screen rather than bending with the Mercator.
        const from = map.project(map.getCenter(), startZoom);
        const to = map.project(center, startZoom);

        // Cancel whatever is already in the air — a city fly-in, or an earlier
        // court selection still mid-curve.
        if (venueFlight) cancelAnimationFrame(venueFlight);
        map._stop();

        const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
        // Out to outZoom over the first half, back in over the second, so the
        // low point is exactly outZoom at the midpoint.
        const zoomAt = (t) =>
          t < 0.5
            ? startZoom + (outZoom - startZoom) * ease(t * 2)
            : outZoom + (targetZoom - outZoom) * ease((t - 0.5) * 2);
        const started = performance.now();

        const frame = () => {
          const t = Math.min(1, (performance.now() - started) / FLIGHT_MS);
          if (t < 1) {
            map._move(
              map.unproject(from.add(to.subtract(from).multiplyBy(ease(t))), startZoom),
              zoomAt(t),
              { flyTo: true }
            );
            venueFlight = requestAnimationFrame(frame);
          } else {
            venueFlight = null;
            map._move(center, targetZoom)._moveEnd(true);
          }
        };

        map._moveStart(true, false);
        venueFlight = requestAnimationFrame(frame);
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

        // Order by distance when "Use my location" is active; otherwise keep
        // the source order. Non-plottable courts (no coords) sort to the end.
        let ordered = matched;
        if (sortByDistance && userLoc) {
          ordered = matched.slice().sort((a, b) => {
            const da = distanceMilesFor(a);
            const db = distanceMilesFor(b);
            if (da == null && db == null) return 0;
            if (da == null) return 1;
            if (db == null) return -1;
            return da - db;
          });
        }
        renderResults(ordered);

        // Result count — a live filtered count, never a completeness total.
        const active = activeFilterCount(filters);
        countEl.textContent = active
          ? `${matched.length} court${matched.length === 1 ? "" : "s"} match${
              matched.length === 1 ? "es" : ""
            } your filters`
          : "";

        // Filters button badge, and the clear-filters escape hatch beside it.
        // Both are driven by the same `active` count: the way out of a filtered
        // view should appear exactly when there is something to get out of, and
        // the panel's own Clear button is behind the very panel you'd have to
        // open to reach it.
        if (filterBadgeEl) {
          filterBadgeEl.textContent = active ? String(active) : "";
          filterBadgeEl.hidden = active === 0;
        }
        if (clearFiltersEl) clearFiltersEl.hidden = active === 0;

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
          // City and skill both round-trip, so a filtered view stays a linkable
          // thing — /learn's CTA arrives as ?skill=beginner, and a reader who
          // narrows the map themselves gets a URL they can send on. The other
          // nine filters stay out of the URL deliberately: they're refinements,
          // not destinations, and encoding all of them makes an unreadable link.
          const parts = [];
          if (cityVal) parts.push(`city=${encodeURIComponent(citySlug(cityVal))}`);
          const skillSlug = SKILL_SLUG[fieldEls.skillBucket ? fieldEls.skillBucket.value : ""];
          if (skillSlug) parts.push(`skill=${skillSlug}`);
          history.replaceState(null, "", parts.length ? `/map?${parts.join("&")}` : "/map");
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
        // Screen readers otherwise announce the raw slider number (e.g. "720");
        // aria-valuetext makes them speak the clock time instead.
        hoursStartEl.setAttribute("aria-valuetext", formatClock(start));
        hoursEndEl.setAttribute("aria-valuetext", formatClock(end));
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
      // Seed the slider's visual label + aria-valuetext so a screen reader
      // hears a clock time, not the raw minute value, before any interaction.
      if (hoursStartEl && hoursEndEl) updateHoursVisual();

      const clearFilters = () => {
        FILTER_FIELDS.forEach((f) => {
          if (fieldEls[f.key]) fieldEls[f.key].value = "";
        });
        resetHoursSlider();
        applyFilters();
      };
      const fClear = document.getElementById("f-clear");
      if (fClear) fClear.addEventListener("click", clearFilters);
      // Same handler, not a second implementation — two buttons, one behaviour.
      if (clearFiltersEl) clearFiltersEl.addEventListener("click", clearFilters);

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

      // Keep Tab focus inside the open detail dialog (focus trap).
      detailEl.addEventListener("keydown", (e) => {
        if (e.key !== "Tab" || detailEl.hidden) return;
        const focusables = detailEl.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || active === detailEl)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      });
      // The scope pill's Clear resets just the city focus, not every filter.
      if (clearBtn)
        clearBtn.addEventListener("click", () => {
          setCityFilter("");
          applyFilters();
        });

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !detailEl.hidden) closeDetail();
      });

      // ---- "Use my location" (nearest-first) ----------------------------
      const locateBtn = document.getElementById("finder-locate");
      const locateLabelEl = locateBtn && locateBtn.querySelector(".finder-locate-label");
      const setLocateLabel = (t) => {
        if (locateLabelEl) locateLabelEl.textContent = t;
      };

      const outOfAreaEl = document.getElementById("finder-out-of-area");
      const outOfAreaDistEl = document.getElementById("finder-ooa-distance");
      const outOfAreaCloseEl = document.getElementById("finder-ooa-close");

      function showOutOfArea(miles) {
        if (!outOfAreaEl) return;
        if (outOfAreaDistEl) {
          const rounded = miles >= 100 ? Math.round(miles / 10) * 10 : Math.round(miles / 5) * 5;
          outOfAreaDistEl.textContent = `about ${rounded.toLocaleString()} miles`;
        }
        outOfAreaEl.hidden = false;
      }

      function hideOutOfArea() {
        if (outOfAreaEl) outOfAreaEl.hidden = true;
      }

      if (outOfAreaCloseEl) outOfAreaCloseEl.addEventListener("click", hideOutOfArea);

      function disableNearMe() {
        sortByDistance = false;
        if (youMarker) {
          map.removeLayer(youMarker);
          youMarker = null;
        }
        if (locateBtn) {
          locateBtn.classList.remove("is-active");
          locateBtn.setAttribute("aria-pressed", "false");
        }
        setLocateLabel("Use my location");
        applyFilters();
      }

      if (locateBtn) {
        locateBtn.addEventListener("click", () => {
          if (sortByDistance) {
            disableNearMe();
            return;
          }
          if (!navigator.geolocation) {
            setStatus(statusEl, "This browser can't share your location — search a city instead.", true);
            return;
          }
          locateBtn.disabled = true;
          locateBtn.classList.add("is-locating");
          setLocateLabel("Locating…");
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              userLoc = { lat: pos.coords.latitude, lon: pos.coords.longitude };
              locateBtn.disabled = false;
              locateBtn.classList.remove("is-locating");

              // Outside the Bay Area: don't pretend far-away courts are "near."
              const nearest = nearestVenueMiles();
              if (nearest > BAY_AREA_RADIUS_MI) {
                userLoc = null;
                sortByDistance = false;
                setLocateLabel("Use my location");
                showOutOfArea(nearest);
                setStatus(
                  statusEl,
                  "You're outside the SF Bay Area — this guide covers Bay Area courts only. See the top-rated courts or browse by city to plan a trip.",
                  true
                );
                return;
              }

              hideOutOfArea();
              sortByDistance = true;
              if (youMarker) map.removeLayer(youMarker);
              youMarker = L.marker([userLoc.lat, userLoc.lon], {
                icon: youIcon(),
                zIndexOffset: 1000,
                keyboard: false,
                title: "Your location",
              })
                .addTo(map)
                .bindPopup("You are here");
              locateBtn.classList.add("is-active");
              locateBtn.setAttribute("aria-pressed", "true");
              setLocateLabel("Nearest first");
              applyFilters();
              recenterNearUser();
              setStatus(statusEl, "Showing courts nearest to you first. Tap the button again to reset.");
            },
            (err) => {
              locateBtn.disabled = false;
              locateBtn.classList.remove("is-locating");
              setLocateLabel("Use my location");
              const denied = err && err.code === err.PERMISSION_DENIED;
              setStatus(
                statusEl,
                denied
                  ? "Location permission was blocked — search a city to focus the map instead."
                  : "Couldn't pin down your location — search a city instead.",
                true
              );
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
          );
        });
      }

      // Phase 2's search dispatches this on selection (see the contract in
      // global-search.js). preventDefault() keeps the component from navigating
      // (reloading) so we can recenter in place.
      document.addEventListener("pbsearch:select", (e) => {
        const d = (e && e.detail) || {};
        if (d.type === "venue" && d.id && recordsById[d.id]) {
          e.preventDefault();
          hideOutOfArea();
          setCityFilter(recordsById[d.id].city);
          applyFilters();
          selectVenue(d.id);
        } else if (d.slug || d.city) {
          const cityName = resolveCityName(d.city, d.slug);
          if (cityName) {
            e.preventDefault();
            hideOutOfArea();
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
      const skillParam = params.get("skill");
      if (cityParam) {
        const cityName = resolveCityName(null, citySlug(cityParam));
        if (cityName) setCityFilter(cityName);
        else setStatus(statusEl, `No courts found for "${cityParam}".`);
      }
      // Say the filter is on, and say how to turn it off — arriving at a
      // pre-filtered map with no explanation looks like a map missing 180 courts.
      if (skillParam && setSkillFilter(skillParam)) {
        const bucket = SKILL_PARAM[String(skillParam).toLowerCase()];
        setStatus(statusEl, `Filtered to ${bucket.toLowerCase()} courts — clear the Skill filter to see all ${records.length}.`);
      }

      // First render fits the map. We render synchronously first because some
      // automated / backgrounded environments never fire requestAnimationFrame.
      applyFilters();

      requestAnimationFrame(() => {
        if (markers.length && map.getSize().x < 50) fitTo(plottableRecords);
      });

      if (venueParam && recordsById[venueParam]) {
        selectVenue(venueParam, { animate: false });
      }

      // Keep tiles aligned on later window resizes without re-fitting bounds.
      window.addEventListener("resize", () => map.invalidateSize());
    })
    .catch((err) => {
      console.error(err);
      setStatus(statusEl, "Couldn't load court data for the map. Try refreshing the page.", true);
    });
})();
