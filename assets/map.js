// Find-courts hub (Phase 3): search + map + results list + detail card.
//
// Joins assets/venues.json (geocoded lat/lon + id) with
// assets/courts-data.json (rich per-venue fields) by `id`, plots every
// geocoded court on a Leaflet map, lists the same courts beside it, and opens
// a detail card (desktop side-panel / mobile bottom sheet) on selection —
// name, address, hours, surface, wait, indoor/outdoor, community + Google
// ratings, directions, and a book link where one exists.
//
// Search integration (contract owned by Phase 2, assets/global-search.js):
//   • URL param  ?city=<slug>   — focus the map on that city on load.
//   • DOM event  document → "pbsearch:select", detail { type, city, id, slug }
//       type "city"  → focus the map on that city.
//       type "venue" → open that venue's detail card.
// Both are optional: with neither present the hub just shows every court, and
// the page degrades cleanly if Phase 2's hero search hasn't mounted yet.

(function () {
  const statusEl = document.getElementById("map-status");
  const mapEl = document.getElementById("venue-map");
  if (!mapEl) return;

  const { escapeHtml, citySlug, setStatus } = window.PBUtils;

  const listEl = document.getElementById("finder-results");
  const detailEl = document.getElementById("finder-detail");
  const finderEl = document.getElementById("finder");
  const scrimEl = document.getElementById("finder-scrim");
  const scopeEl = document.getElementById("finder-scope");
  const scopeLabelEl = document.getElementById("finder-scope-label");
  const clearBtn = document.getElementById("finder-clear");

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

    const approxNote = record.approx
      ? `<p class="fd-approx">Approximate location — no precise street address is published for this venue; check the city page before you drive out.</p>`
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
      approxNote +
      `<a class="fd-city-link" href="${record.url}">See the full ${escapeHtml(record.city)} writeup →</a>` +
      `</div>`
    );
  }

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
      const courtsById = {};
      (Array.isArray(courts) ? courts : []).forEach((c) => {
        if (c && c.id) courtsById[c.id] = c;
      });

      // Only geocoded venues can be plotted or listed beside the map; the
      // detail fields come from the richer courts-data record when present.
      const records = venues
        .filter((v) => typeof v.lat === "number" && typeof v.lon === "number")
        .map((v) => {
          const c = courtsById[v.id] || {};
          return {
            id: v.id,
            name: c.name || v.name,
            city: c.city || v.city,
            neighborhood: c.neighborhood,
            address: c.address || v.address,
            url: c.url || v.url,
            lat: v.lat,
            lon: v.lon,
            indoor: v.indoor,
            indoorOutdoor: c.indoorOutdoor,
            approx: v.approx,
            confirmed: v.confirmed,
            price: c.price,
            hours: c.hours,
            courts: c.courts,
            waitTime: c.waitTime,
            surface: c.surface,
            skill: c.skill,
            reservable: c.reservable,
            bookingUrl: c.bookingUrl,
            googleMapsUrl: c.googleMapsUrl,
          };
        });

      const recordsById = {};
      records.forEach((r) => (recordsById[r.id] = r));

      const map = L.map(mapEl, { scrollWheelZoom: true });

      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);

      const markersById = {};
      const markers = records.map((record) => {
        const marker = L.marker([record.lat, record.lon], { icon: pinIcon(record, false) });
        marker.bindPopup(popupHtml(record));
        marker.__record = record;
        marker.on("click", () => selectVenue(record.id, { pan: false }));
        markersById[record.id] = marker;
        return marker;
      });

      const group = L.featureGroup(markers).addTo(map);

      let topPickIds = new Set();

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
        return (
          `<li class="finder-result${isPick ? " is-top-pick" : ""}" data-id="${escapeHtml(record.id)}">` +
          `<button type="button" class="finder-result-btn">` +
          `<span class="fr-top"><span class="fr-name">${escapeHtml(record.name)}</span>` +
          `<span class="fr-pick" title="Community top pick"${isPick ? "" : " hidden"}>★ Top pick</span></span>` +
          `<span class="fr-meta">${escapeHtml(metaParts.join(" · "))}</span>` +
          (subParts.length ? `<span class="fr-sub">${escapeHtml(subParts.join(" · "))}</span>` : "") +
          `</button></li>`
        );
      }

      function renderResults(list) {
        listEl.innerHTML = list.length
          ? list.map(resultHtml).join("")
          : `<li class="finder-empty">No mapped courts here yet.</li>`;
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

      // data-id values are venue slugs (a-z0-9 and hyphens), but guard the
      // selector anyway rather than trust the input.
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
        // after a city focus (e.g. ?city=…&venue=… or a venue search result)
        // isn't yanked back out to the city bounds.
        flyToken++;
        if (opts.pan !== false) {
          map.setView([record.lat, record.lon], Math.max(map.getZoom() || 0, 14), {
            animate: true,
          });
        }
        const marker = markersById[id];
        if (marker) marker.openPopup();
        openDetail(record);
      }

      // ---- City focus (search contract) --------------------------------

      let currentCity = null;
      let flyToken = 0;

      // Two-phase move when focusing a city: a quick zoom-out that glides
      // toward the city for context, then a slower zoom back in to its courts
      // — a Google-Maps-style "pull back, then swoop in." Falls back to an
      // instant fit when the user prefers reduced motion, and skips the
      // zoom-out beat when the map is already at/below the intermediate level.
      function flyToCity(matches) {
        map.invalidateSize();
        const single = matches.length === 1;
        const bounds = L.featureGroup(matches.map((r) => markersById[r.id])).getBounds();
        const center = single ? L.latLng(matches[0].lat, matches[0].lon) : bounds.getCenter();

        const reduce =
          window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduce) {
          if (single) map.setView(center, 14);
          else map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
          return;
        }

        // Phase 2 — a slow zoom in. From the phase-1 center this is a near-pure
        // zoom, so it reads as settling into the city rather than arcing again.
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
        // Pull back ~2 levels for context, but never wider than the whole
        // dataset's extent — no point zooming past "the entire Bay Area."
        const fullZoom = map.getBoundsZoom(group.getBounds());
        const outZoom = Math.max(fullZoom, Math.min(currentZoom, targetZoom) - 2);

        if (outZoom < currentZoom) {
          // Phase 1 — a quick zoom-out toward the city. Token-guard the handoff
          // so a rapid second selection can't trigger this flight's zoom-in.
          const token = ++flyToken;
          map.flyTo(center, outZoom, { duration: 0.7, easeLinearity: 0.25 });
          map.once("moveend", () => {
            if (token === flyToken) zoomIn();
          });
        } else {
          zoomIn();
        }
      }

      function focusCity(slug, cityNameHint) {
        const matches = records.filter((r) => citySlug(r.city) === slug);
        if (!matches.length) return false;
        currentCity = slug;
        closeDetail();
        renderResults(matches);
        const cityName = cityNameHint || matches[0].city;
        scopeLabelEl.textContent = `Showing courts in ${cityName}`;
        scopeEl.hidden = false;
        flyToCity(matches);
        try {
          history.replaceState(null, "", `/map?city=${encodeURIComponent(slug)}`);
        } catch (e) {
          /* replaceState can throw on file:// — non-fatal */
        }
        return true;
      }

      function clearCity() {
        currentCity = null;
        closeDetail();
        renderResults(records);
        scopeEl.hidden = true;
        scopeLabelEl.textContent = "";
        fit();
        try {
          history.replaceState(null, "", "/map");
        } catch (e) {
          /* non-fatal */
        }
      }

      // ---- Top-pick pins + list rows -----------------------------------

      // Top pick is computed live from community votes/ratings (see
      // assets/top-picks.js) — recolor pins and re-tag list rows in place
      // rather than rebuilding whenever the vote data (re)loads or changes.
      function refreshTopPicks() {
        if (!window.PBRatings || !window.PBTopPicks) return;
        // Ranked against every venue (not just plottable ones) so this agrees
        // with the directory and city pages even when a city's winner happens
        // to lack geocoded coordinates.
        topPickIds = window.PBTopPicks.computeTopPickIds(venues);
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

      // ---- Map fit ------------------------------------------------------

      function fit() {
        // Guard against a stale/zero container size (web fonts still swapping
        // in, a resize mid-flight) which would otherwise make fitBounds pick a
        // wildly wrong zoom.
        map.invalidateSize();
        if (markers.length) {
          map.fitBounds(group.getBounds(), { padding: [32, 32] });
        } else {
          map.setView([37.75, -122.2], 9);
        }
      }

      // ---- Wire it all up ----------------------------------------------

      renderResults(records);
      refreshTopPicks();

      listEl.addEventListener("click", (e) => {
        const btn = e.target.closest(".finder-result-btn");
        if (!btn) return;
        const li = btn.closest(".finder-result");
        if (li && li.dataset.id) selectVenue(li.dataset.id);
      });

      detailEl.addEventListener("click", (e) => {
        if (e.target.closest('[data-role="detail-back"]')) closeDetail();
      });
      scrimEl.addEventListener("click", closeDetail);
      if (clearBtn) clearBtn.addEventListener("click", clearCity);

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !detailEl.hidden) closeDetail();
      });

      // Phase 2's search dispatches this on selection (see the contract in
      // global-search.js). We call preventDefault() so the component recenters
      // the map in place instead of navigating (reloading) to detail.href.
      document.addEventListener("pbsearch:select", (e) => {
        const d = (e && e.detail) || {};
        if (d.type === "venue" && d.id && recordsById[d.id]) {
          e.preventDefault();
          const slug = citySlug(recordsById[d.id].city);
          if (slug !== currentCity) focusCity(slug);
          selectVenue(d.id);
        } else if (d.slug || d.city) {
          if (focusCity(d.slug || citySlug(d.city), d.city)) e.preventDefault();
        }
      });

      // Initial view: fit to everything now, then re-fit next frame once fonts
      // and layout settle. We fit synchronously first because some automated /
      // backgrounded environments never fire requestAnimationFrame, and the
      // map (and any ?city= deep-link below) must not depend on it.
      fit();
      requestAnimationFrame(() => {
        if (markers.length && map.getSize().x < 50) fit();
      });

      // Honor a ?city=<slug>[&venue=<id>] deep-link — Phase 2's navigation
      // target when a search result is picked from another page.
      const params = new URLSearchParams(window.location.search);
      const cityParam = params.get("city");
      const venueParam = params.get("venue");
      setStatus(statusEl, "Search a city to focus the map, or pick a court from the list.");
      if (cityParam && !focusCity(citySlug(cityParam))) {
        setStatus(statusEl, `No mapped courts found for "${cityParam}".`);
      }
      if (venueParam && recordsById[venueParam]) {
        selectVenue(venueParam);
      }

      // Keep tiles aligned on later window resizes without re-fitting bounds,
      // so it doesn't fight a user's own pan/zoom.
      window.addEventListener("resize", () => map.invalidateSize());
    })
    .catch((err) => {
      console.error(err);
      setStatus(statusEl, "Couldn't load court data for the map. Try refreshing the page.", true);
    });
})();
