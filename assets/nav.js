// Mobile nav (hamburger) toggle. The header collapses .main-nav into a
// full-width panel below ~720px; this opens/closes it. --header-h stays
// correct automatically via the ResizeObserver at the bottom of this file.
(function () {
  var navToggle = document.getElementById("nav-toggle");
  var mainNav = document.getElementById("main-nav");
  if (!navToggle || !mainNav) return;
  function closeNav() {
    mainNav.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
  }
  navToggle.addEventListener("click", function () {
    var open = mainNav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", open ? "true" : "false");
  });
  mainNav.addEventListener("click", function (e) {
    // A real nav link closes the panel; the "More" <summary> doesn't.
    if (e.target.closest("a")) closeNav();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeNav();
  });
})();

document.querySelectorAll(".nav-dropdown").forEach(function (d) {
  d.addEventListener("click", function (e) {
    if (e.target.closest("a")) d.removeAttribute("open");
  });
});

// Desktop-only hover flyout, additive to the click/keyboard behavior above.
// <details> only renders its non-summary content once the `open` attribute
// is actually set (CSS alone can't reveal it), so the enhancement has to
// toggle that attribute rather than just showing the menu via CSS :hover.
var hoverMQ = window.matchMedia("(hover: hover) and (pointer: fine)");
document.querySelectorAll(".nav-dropdown").forEach(function (d) {
  d.addEventListener("mouseenter", function () {
    if (hoverMQ.matches) d.setAttribute("open", "");
  });
  d.addEventListener("mouseleave", function () {
    if (hoverMQ.matches) d.removeAttribute("open");
  });
  var summary = d.querySelector("summary");
  summary.addEventListener("click", function () {
    // A click while still hovering (e.g. habitually clicking "More" even
    // though it's already open) would otherwise toggle it closed via the
    // native <details> behavior. Resync with hover state on the next tick
    // so it snaps back open instead of collapsing under the pointer.
    if (hoverMQ.matches) {
      setTimeout(function () {
        if (d.matches(":hover")) d.setAttribute("open", "");
      }, 0);
    }
  });
});
document.addEventListener("click", function (e) {
  document.querySelectorAll(".nav-dropdown[open]").forEach(function (d) {
    if (!d.contains(e.target)) d.removeAttribute("open");
  });
});
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") {
    document.querySelectorAll(".nav-dropdown[open]").forEach(function (d) {
      d.removeAttribute("open");
    });
  }
});

// Keep --header-h in sync with the sticky header's real height so
// scroll-padding-top (style.css) can stop anchor jumps (venue cards, city
// cards, rankings rows) from landing under the header and hiding the
// target's title. A ResizeObserver, not a one-time measurement, because the
// header's height changes for reasons outside this file's control: text
// wrapping at narrow widths, and global-search.js appending a search box
// into .main-nav after this script has already run.
var siteHeader = document.querySelector(".site-header");
if (siteHeader) {
  var syncHeaderHeight = function () {
    document.documentElement.style.setProperty("--header-h", siteHeader.offsetHeight + "px");
  };
  syncHeaderHeight();
  if ("ResizeObserver" in window) {
    new ResizeObserver(syncHeaderHeight).observe(siteHeader);
  } else {
    window.addEventListener("resize", syncHeaderHeight);
  }
}
