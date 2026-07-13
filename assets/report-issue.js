// Adds a per-venue "Report an issue" link to each city-page venue card,
// prefilling the corrections form with the venue + city
// (/corrections?venue=…&city=…, the same contract map.js uses). Keeps the
// "person standing at the court with wrong hours" one tap from telling us,
// instead of having to hunt down the corrections page from the nav.
//
// Runtime injection (rather than editing every card's static markup) matches
// how the rating summary / favorite button are already enhanced on these
// cards, and stays a no-op on pages without venue cards.

(function () {
  var cards = document.querySelectorAll(".venue-card[data-court-id]");
  if (!cards.length) return;

  // On a city page the single <h1> is the city's display name — the same
  // form the corrections city <select> uses, so it preselects cleanly.
  var h1 = document.querySelector("h1");
  var city = h1 ? h1.textContent.trim() : "";

  cards.forEach(function (card) {
    if (card.querySelector(".report-issue-link")) return; // idempotent
    var nameEl = card.querySelector(".name-row h3, h3");
    var name = nameEl ? nameEl.textContent.trim() : "";

    var params = new URLSearchParams({ venue: name, city: city });
    var link = document.createElement("a");
    link.className = "report-issue-link";
    link.href = "/corrections?" + params.toString();
    link.textContent = "Report an issue";

    // Prefer the existing vote-actions row so it sits with the other
    // per-venue actions; fall back to appending to the card.
    var host = card.querySelector(".vote-actions") || card;
    host.appendChild(link);
  });
})();
