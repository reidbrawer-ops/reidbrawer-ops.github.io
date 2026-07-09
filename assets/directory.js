(function () {
  const statusEl = document.getElementById("directory-status");
  const countEl = document.getElementById("directory-count");
  const emptyEl = document.getElementById("directory-empty");
  const tableEl = document.getElementById("directory-table");
  const tbodyEl = document.getElementById("directory-tbody");
  const cardsEl = document.getElementById("directory-cards");
  const formEl = document.getElementById("directory-filters");
  const hoursStartEl = document.getElementById("f-hours-start");
  const hoursEndEl = document.getElementById("f-hours-end");
  const hoursLabelEl = document.getElementById("hours-slider-label");
  const hoursRangeFillEl = document.getElementById("hours-slider-range");
  if (!formEl) return;

  const CITY_REGION = window.PB_CITY_REGION;
  const { escapeHtml, setStatus } = window.PBUtils;

  const WAIT_ORDER = { Low: 0, Medium: 1, High: 2, "Not specified": 3 };

  const HOURS_MIN = 0;
  const HOURS_MAX = 1440;
  let hoursRange = [HOURS_MIN, HOURS_MAX];

  function regionFor(venue) {
    return CITY_REGION[venue.city] || "Not specified";
  }

  function priceBucket(venue) {
    const raw = venue.price || "Not specified";
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

  function skillBucket(venue) {
    const raw = venue.skill || "Not specified";
    if (/not specified/i.test(raw)) return "Not specified";
    if (/all level/i.test(raw)) return "All levels";
    if (/beginner/i.test(raw)) return "Beginner-friendly";
    if (/competitive|advanced/i.test(raw)) return "Advanced / competitive";
    return "Other";
  }

  function courtsBucket(venue) {
    const n = venue.courts;
    if (typeof n !== "number") return "Not specified";
    if (n <= 2) return "1-2 courts";
    if (n <= 5) return "3-5 courts";
    return "6+ courts";
  }

  function weatherBucket(venue) {
    const raw = venue.weather || "Not specified";
    if (/not specified/i.test(raw)) return "Not specified";
    if (/fog/i.test(raw)) return "Foggy / cool";
    if (/warm|dry|sunny|hot/i.test(raw)) return "Warm / dry";
    if (/mild/i.test(raw)) return "Mild";
    return "Other";
  }

  // Standardized surface categories — the raw "surface" text is free prose
  // extracted per-venue and is almost never unique-comparable, so filtering
  // uses this bucket while the table/card display still shows the raw text.
  function surfaceBucket(venue) {
    const raw = (venue.surface || "Not specified").toLowerCase();
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

  // Best-effort extraction of an overall [open, close] window (in minutes
  // since midnight) from free-text hours. Returns null when the text gives
  // us nothing concrete to go on (e.g. "Not specified", "Dawn-dusk") —
  // callers treat null as "unknown, don't claim it's open in a given window."
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

  function passesHours(row) {
    if (hoursRange[0] === HOURS_MIN && hoursRange[1] === HOURS_MAX) return true;
    if (!row.hoursRange) return true; // hours not specified — don't hide it, we just can't confirm the window
    return row.hoursRange[0] <= hoursRange[1] && row.hoursRange[1] >= hoursRange[0];
  }

  function directionsUrl(row) {
    if (row.googleMapsUrl) return row.googleMapsUrl;
    const query = row.address && row.address !== "Not specified"
      ? `${row.name}, ${row.address}`
      : `${row.name}, ${row.city}`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }

  function actionLinksHtml(row) {
    const links = [
      `<a class="row-action" href="${escapeHtml(directionsUrl(row))}" target="_blank" rel="noopener">Directions ↗</a>`,
    ];
    if (row.bookingUrl) {
      links.push(
        `<a class="row-action row-action-book" href="${escapeHtml(row.bookingUrl)}" target="_blank" rel="noopener">Book →</a>`
      );
    }
    return `<div class="row-actions">${links.join("")}</div>`;
  }

  function uniqueSorted(values) {
    return Array.from(new Set(values.filter((v) => v && v !== "Not specified"))).sort((a, b) =>
      a.localeCompare(b)
    );
  }

  // Fields driving the standard <select> filters. `withNotSpecified` mirrors
  // the previous behavior: location fields never offer "Not specified" as a
  // choice, everything else does.
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

  function sortValue(row, key) {
    if (key === "courts") return typeof row.courts === "number" ? row.courts : -1;
    if (key === "waitTime") return WAIT_ORDER[row.waitTime] ?? 4;
    return String(row[key] || "").toLowerCase();
  }

  function init(venues) {
    const rows = venues.map((v) => ({
      ...v,
      region: regionFor(v),
      priceBucket: priceBucket(v),
      skillBucket: skillBucket(v),
      courtsBucket: courtsBucket(v),
      weatherBucket: weatherBucket(v),
      surfaceBucket: surfaceBucket(v),
      hoursRange: parseHoursRange(v.hours),
    }));

    // Recomputed from live rankings (see assets/top-picks.js) rather than a
    // stored field, so it stays in sync with /rankings and the map without
    // anyone hand-editing courts-data.json.
    let topPickIds = new Set();
    function refreshTopPicks() {
      if (!window.PBRatings || !window.PBTopPicks) return;
      topPickIds = window.PBTopPicks.computeTopPickIds(rows);
    }
    refreshTopPicks();

    const fieldEls = {};
    FILTER_FIELDS.forEach((f) => {
      fieldEls[f.key] = document.getElementById(f.elId);
    });

    let sortKey = "name";
    let sortDir = 1;

    function currentFilters() {
      const filters = {};
      FILTER_FIELDS.forEach((f) => {
        filters[f.key] = fieldEls[f.key].value;
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

    // Rows compatible with every active filter except `excludeKey` (and,
    // always, the hours slider) — this is the "leave-one-out" set used to
    // decide which options a given dropdown should even offer, so picking
    // any listed option can never produce zero results.
    function rowsMatchingAllExcept(filters, excludeKey) {
      return rows.filter((r) => rowMatchesFilters(r, filters, excludeKey) && passesHours(r));
    }

    function refreshFilterOptions() {
      const snapshot = currentFilters();
      FILTER_FIELDS.forEach((f) => {
        const el = fieldEls[f.key];
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

    function rowHtmlFacts(row) {
      return [
        `<span class="stat-chip">${escapeHtml(row.city)}</span>`,
        `<span class="stat-chip">${escapeHtml(row.price)}</span>`,
        `<span class="stat-chip">${escapeHtml(row.skill)}</span>`,
        `<span class="stat-chip">${escapeHtml(row.hours)}</span>`,
        `<span class="stat-chip">${row.courts != null ? row.courts + " courts" : "Courts: Not specified"}</span>`,
        `<span class="stat-chip">Wait: ${escapeHtml(row.waitTime)}</span>`,
        `<span class="stat-chip">${escapeHtml(row.weather)}</span>`,
        `<span class="stat-chip">${escapeHtml(row.indoorOutdoor)}</span>`,
        `<span class="stat-chip">${escapeHtml(row.surface)}</span>`,
        `<span class="stat-chip">${escapeHtml(row.reservable)}</span>`,
      ].join("");
    }

    function render() {
      refreshFilterOptions();
      const filters = currentFilters();
      let filtered = rows.filter((r) => rowMatchesFilters(r, filters) && passesHours(r));

      filtered = filtered.slice().sort((a, b) => {
        const av = sortValue(a, sortKey);
        const bv = sortValue(b, sortKey);
        if (av < bv) return -1 * sortDir;
        if (av > bv) return 1 * sortDir;
        return 0;
      });

      countEl.textContent = `Showing ${filtered.length} of ${rows.length} venues`;

      const noResults = filtered.length === 0;
      emptyEl.hidden = !noResults;
      tableEl.hidden = noResults;
      cardsEl.hidden = noResults;

      tbodyEl.innerHTML = filtered
        .map(
          (row) => `
        <tr>
          <td><a href="${row.url}">${escapeHtml(row.name)}</a>${topPickIds.has(row.id) ? ' <span class="rank-badge top">Top pick</span>' : ""} ${window.PBWidgets.badgesHtml(row.id)}${actionLinksHtml(row)}</td>
          <td>${escapeHtml(row.city)}</td>
          <td>${escapeHtml(row.neighborhood)}</td>
          <td>${escapeHtml(row.price)}</td>
          <td>${escapeHtml(row.skill)}</td>
          <td>${escapeHtml(row.hours)}</td>
          <td>${row.courts != null ? row.courts : "Not specified"}</td>
          <td>${escapeHtml(row.waitTime)}</td>
          <td>${escapeHtml(row.weather)}</td>
          <td>${escapeHtml(row.indoorOutdoor)}</td>
          <td>${escapeHtml(row.surface)}</td>
          <td>${escapeHtml(row.reservable)}</td>
          <td><a href="/rankings#${row.id}">${window.PBWidgets.overallRatingHtml(row.id)}</a></td>
          <td>${window.PBWidgets.favoriteButtonHtml(row.id)}</td>
        </tr>`
        )
        .join("");

      cardsEl.innerHTML = filtered
        .map(
          (row) => `
        <article class="venue-card directory-card${topPickIds.has(row.id) ? " top-pick" : ""}">
          <div class="name-row">
            <h3><a href="${row.url}">${escapeHtml(row.name)}</a></h3>
            ${topPickIds.has(row.id) ? '<span class="rank-badge top">Top pick</span>' : ""}
            ${window.PBWidgets.badgesHtml(row.id)}
          </div>
          <span class="addr">${escapeHtml(row.neighborhood)}</span>
          ${actionLinksHtml(row)}
          <div class="facts">${rowHtmlFacts(row)}</div>
          <div class="vote-actions">
            <a href="/rankings#${row.id}">${window.PBWidgets.overallRatingHtml(row.id)}</a>
            ${window.PBWidgets.favoriteButtonHtml(row.id)}
          </div>
        </article>`
        )
        .join("");

      if (window.PBWidgets) window.PBWidgets.refreshAll();
    }

    formEl.addEventListener("change", render);

    // Top pick badges depend on live vote/rating data, which loads async and
    // can change after any vote — recompute and re-render whenever it does.
    document.addEventListener("pbratings:ready", () => {
      refreshTopPicks();
      render();
    });
    document.addEventListener("pbratings:update", () => {
      refreshTopPicks();
      render();
    });

    function resetHoursSlider() {
      hoursRange = [HOURS_MIN, HOURS_MAX];
      hoursStartEl.value = HOURS_MIN;
      hoursEndEl.value = HOURS_MAX;
      updateHoursVisual();
    }

    document.getElementById("f-clear").addEventListener("click", () => {
      formEl.reset();
      resetHoursSlider();
      render();
    });
    document.getElementById("empty-clear").addEventListener("click", () => {
      formEl.reset();
      resetHoursSlider();
      render();
    });

    document.querySelectorAll("#directory-table th[data-sort]").forEach((th) => {
      function activate() {
        const key = th.dataset.sort;
        if (sortKey === key) {
          sortDir = -sortDir;
        } else {
          sortKey = key;
          sortDir = 1;
        }
        document.querySelectorAll("#directory-table th[data-sort]").forEach((other) => {
          other.setAttribute("aria-sort", "none");
          other.classList.remove("sort-asc", "sort-desc");
        });
        th.setAttribute("aria-sort", sortDir === 1 ? "ascending" : "descending");
        th.classList.add(sortDir === 1 ? "sort-asc" : "sort-desc");
        render();
      }
      th.addEventListener("click", activate);
      th.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate();
        }
      });
    });

    function updateHoursVisual() {
      const start = parseInt(hoursStartEl.value, 10);
      const end = parseInt(hoursEndEl.value, 10);
      hoursLabelEl.textContent =
        start === HOURS_MIN && end === HOURS_MAX ? "Any time" : `${formatClock(start)} – ${formatClock(end)}`;
      const pct = (v) => ((v - HOURS_MIN) / (HOURS_MAX - HOURS_MIN)) * 100;
      hoursRangeFillEl.style.left = pct(start) + "%";
      hoursRangeFillEl.style.right = 100 - pct(end) + "%";
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
      render();
    }

    hoursStartEl.addEventListener("input", handleHoursInput);
    hoursEndEl.addEventListener("input", handleHoursInput);

    updateHoursVisual();
    tableEl.hidden = false;
    render();
    setStatus(statusEl, `Showing all ${rows.length} venues.`);
  }

  fetch("/assets/courts-data.json")
    .then((res) => {
      if (!res.ok) throw new Error(`courts-data.json request failed (${res.status})`);
      return res.json();
    })
    .then((venues) => {
      init(venues);
    })
    .catch((err) => {
      console.error(err);
      setStatus(statusEl, "Couldn't load venue data for the directory. Try refreshing the page.", true);
    });
})();
