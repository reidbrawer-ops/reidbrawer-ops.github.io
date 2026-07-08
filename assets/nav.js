document.querySelectorAll(".nav-dropdown").forEach(function (d) {
  d.addEventListener("click", function (e) {
    if (e.target.closest("a")) d.removeAttribute("open");
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
