(function () {
  const statusEl = document.getElementById("directory-status");
  const countEl = document.getElementById("directory-count");
  const emptyEl = document.getElementById("directory-empty");
  const tableEl = document.getElementById("directory-table");
  const tbodyEl = document.getElementById("directory-tbody");
  const cardsEl = document.getElementById("directory-cards");
  const formEl = document.getElementById("directory-filters");
  if (!formEl) return;

  const CITY_REGION = {
    "San Francisco": "San Francisco",
    "Palo Alto": "Peninsula",
    "Menlo Park": "Peninsula",
    "Redwood City": "Peninsula",
    "San Mateo": "Peninsula",
    "San Jose": "South Bay",
    "Santa Clara": "South Bay",
    "Sunnyvale": "South Bay",
    "Cupertino": "South Bay",
    "Mountain View": "South Bay",
    "Oakland": "East Bay",
    "Berkeley": "East Bay",
    "Walnut Creek": "East Bay",
    "Fremont": "East Bay",
    "Pleasanton": "East Bay",
    "San Rafael": "North Bay",
    "Novato": "North Bay",
  };

  const WAIT_ORDER = { Low: 0, Medium: 1, High: 2, "Not specified": 3 };

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

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

  function hoursBucket(venue) {
    const raw = venue.hours || "Not specified";
    if (/not specified/i.test(raw)) return "Not specified";
    if (/24\/7|24 hours/i.test(raw)) return "Open 24/7";
    return "Set hours";
  }

  function weatherBucket(venue) {
    const raw = venue.weather || "Not specified";
    if (/not specified/i.test(raw)) return "Not specified";
    if (/fog/i.test(raw)) return "Foggy / cool";
    if (/warm|dry|sunny|hot/i.test(raw)) return "Warm / dry";
    if (/mild/i.test(raw)) return "Mild";
    return "Other";
  }

  function uniqueSorted(values) {
    return Array.from(new Set(values.filter((v) => v && v !== "Not specified"))).sort((a, b) =>
      a.localeCompare(b)
    );
  }

  function populateSelect(select, values, { withNotSpecified } = {}) {
    const opts = uniqueSorted(values);
    if (withNotSpecified && values.includes("Not specified")) opts.push("Not specified");
    opts.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      select.appendChild(opt);
    });
  }

  function rowMatchesFilters(row, filters) {
    return Object.keys(filters).every((key) => {
      const wanted = filters[key];
      if (!wanted) return true;
      return row[key] === wanted;
    });
  }

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
      hoursBucket: hoursBucket(v),
      weatherBucket: weatherBucket(v),
    }));

    populateSelect(document.getElementById("f-region"), rows.map((r) => r.region));
    populateSelect(document.getElementById("f-city"), rows.map((r) => r.city));
    populateSelect(document.getElementById("f-neighborhood"), rows.map((r) => r.neighborhood));
    populateSelect(document.getElementById("f-indoor"), rows.map((r) => r.indoorOutdoor), { withNotSpecified: true });
    populateSelect(document.getElementById("f-surface"), rows.map((r) => r.surface), { withNotSpecified: true });
    populateSelect(document.getElementById("f-reservable"), rows.map((r) => r.reservable), { withNotSpecified: true });
    populateSelect(document.getElementById("f-skill"), rows.map((r) => r.skillBucket), { withNotSpecified: true });
    populateSelect(document.getElementById("f-price"), rows.map((r) => r.priceBucket), { withNotSpecified: true });
    populateSelect(document.getElementById("f-courts"), rows.map((r) => r.courtsBucket), { withNotSpecified: true });
    populateSelect(document.getElementById("f-wait"), rows.map((r) => r.waitTime), { withNotSpecified: true });
    populateSelect(document.getElementById("f-hours"), rows.map((r) => r.hoursBucket), { withNotSpecified: true });
    populateSelect(document.getElementById("f-weather"), rows.map((r) => r.weatherBucket), { withNotSpecified: true });

    const filterMap = {
      region: "f-region",
      city: "f-city",
      neighborhood: "f-neighborhood",
      indoorOutdoor: "f-indoor",
      surface: "f-surface",
      reservable: "f-reservable",
      skillBucket: "f-skill",
      priceBucket: "f-price",
      courtsBucket: "f-courts",
      waitTime: "f-wait",
      hoursBucket: "f-hours",
      weatherBucket: "f-weather",
    };

    let sortKey = "name";
    let sortDir = 1;

    function currentFilters() {
      const filters = {};
      Object.keys(filterMap).forEach((key) => {
        filters[key] = document.getElementById(filterMap[key]).value;
      });
      return filters;
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
      const filters = currentFilters();
      let filtered = rows.filter((r) => rowMatchesFilters(r, filters));

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
          <td><a href="${row.url}">${escapeHtml(row.name)}</a>${row.topPick ? ' <span class="rank-badge top">Top pick</span>' : ""}</td>
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
        </tr>`
        )
        .join("");

      cardsEl.innerHTML = filtered
        .map(
          (row) => `
        <article class="venue-card directory-card${row.topPick ? " top-pick" : ""}">
          <div class="name-row">
            <h3><a href="${row.url}">${escapeHtml(row.name)}</a></h3>
            ${row.topPick ? '<span class="rank-badge top">Top pick</span>' : ""}
          </div>
          <span class="addr">${escapeHtml(row.neighborhood)}</span>
          <div class="facts">${rowHtmlFacts(row)}</div>
        </article>`
        )
        .join("");
    }

    formEl.addEventListener("change", render);

    document.getElementById("f-clear").addEventListener("click", () => {
      formEl.reset();
      render();
    });
    document.getElementById("empty-clear").addEventListener("click", () => {
      formEl.reset();
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

    tableEl.hidden = false;
    render();
    setStatus(`Showing all ${rows.length} venues.`);
  }

  function setStatus(text, isError) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.classList.toggle("is-error", !!isError);
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
      setStatus("Couldn't load venue data for the directory. Try refreshing the page.", true);
    });
})();
