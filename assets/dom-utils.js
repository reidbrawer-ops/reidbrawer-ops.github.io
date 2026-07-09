// Shared string/DOM helpers. Extracted from directory.js, map.js, rankings.js,
// city-tags.js, and global-search.js, which each independently defined their
// own byte-identical (or near-identical) copies of escapeHtml/citySlug/
// setStatus — see audit/js-duplication.md §2a-2c. One definition here instead
// of N copies that can silently drift out of sync with each other.
//
// Plain script (not a module), like nav.js/regions.js — loaded first on every
// page (before any other same-origin script, deferred or not) so PBUtils is
// always ready by the time a consumer runs.

(function () {
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function citySlug(city) {
    return city.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-+|-+$)/g, "");
  }

  function setStatus(el, text, isError) {
    if (!el) return;
    el.textContent = text;
    el.classList.toggle("is-error", !!isError);
  }

  window.PBUtils = { escapeHtml, citySlug, setStatus };
})();
