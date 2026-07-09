// Keeps each city page's "Top pick" badge in sync with live rankings.
//
// Only confirmed courts get a full .venue-card (unconfirmed/"call ahead"
// venues render as compact .mini-venue-row entries with no rating UI), so
// scoping to .venue-card here already matches the "confirmed only"
// eligibility rule top-picks.js applies elsewhere — no need to fetch
// courts-data.json just to check a confirmed flag on this page.

(function () {
  const cards = Array.from(document.querySelectorAll(".venue-list > .venue-card[data-court-id]"));
  if (!cards.length) return;

  function refresh() {
    if (!window.PBRatings || !window.PBTopPicks) return;

    const courts = cards.map((card) => ({ id: card.dataset.courtId }));
    const winnerId = courts.slice().sort(window.PBTopPicks.compareForTopPick)[0].id;

    cards.forEach((card) => {
      const isWinner = card.dataset.courtId === winnerId;
      card.classList.toggle("top-pick", isWinner);
      const slot = card.querySelector('[data-role="top-pick-badge"]');
      if (slot) slot.innerHTML = isWinner ? '<span class="rank-badge top">Top pick</span>' : "";
    });
  }

  document.addEventListener("pbratings:ready", refresh);
  document.addEventListener("pbratings:update", refresh);
})();
