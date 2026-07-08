(function () {
  const statusEl = document.getElementById("map-status");
  const mapEl = document.getElementById("venue-map");
  if (!mapEl) return;

  function setStatus(text, isError) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.classList.toggle("is-error", !!isError);
  }

  function pinIcon(topPick) {
    return L.divIcon({
      className: "",
      html: `<span class="pba-pin${topPick ? " top-pick" : ""}"></span>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
      popupAnchor: [0, -8],
    });
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function popupHtml(venue) {
    const approxNote = venue.approx
      ? `<span class="p-approx">Approximate location — no precise street address published</span>`
      : "";
    return `
      <div class="pba-popup">
        <div class="p-name">${escapeHtml(venue.name)}</div>
        <span class="p-addr">${escapeHtml(venue.address)}</span>
        <a class="p-link" href="${venue.url}">View ${escapeHtml(venue.city)} page →</a>
        ${approxNote}
      </div>
    `;
  }

  fetch("/assets/venues.json")
    .then((res) => {
      if (!res.ok) throw new Error(`venues.json request failed (${res.status})`);
      return res.json();
    })
    .then((venues) => {
      const plottable = venues.filter((v) => typeof v.lat === "number" && typeof v.lon === "number");

      const map = L.map(mapEl, { scrollWheelZoom: true });

      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);

      const markers = plottable.map((venue) => {
        const marker = L.marker([venue.lat, venue.lon], { icon: pinIcon(venue.topPick) });
        marker.bindPopup(popupHtml(venue));
        return marker;
      });

      const group = L.featureGroup(markers).addTo(map);

      function fit() {
        // Guard against a stale/zero container size (web fonts still
        // swapping in, a resize mid-flight) which would otherwise make
        // fitBounds pick a wildly wrong zoom.
        map.invalidateSize();
        if (markers.length) {
          map.fitBounds(group.getBounds(), { padding: [32, 32] });
        } else {
          map.setView([37.75, -122.2], 9);
        }
      }

      // Give layout a frame to settle before the first fit, and redo it if
      // the container was still mid-resize when that frame ran.
      requestAnimationFrame(() => {
        fit();
        if (markers.length && map.getSize().x < 50) {
          requestAnimationFrame(fit);
        }
      });
      // Keep tiles aligned on later window resizes without re-fitting
      // bounds, so it doesn't fight a user's own pan/zoom.
      window.addEventListener("resize", () => map.invalidateSize());

      const skipped = venues.length - plottable.length;
      setStatus(
        skipped
          ? `Showing ${plottable.length} of ${venues.length} venues (${skipped} could not be geocoded).`
          : `Showing all ${plottable.length} venues.`
      );
    })
    .catch((err) => {
      console.error(err);
      setStatus("Couldn't load venue data for the map. Try refreshing the page.", true);
    });
})();
