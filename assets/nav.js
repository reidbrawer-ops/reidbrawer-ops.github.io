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
