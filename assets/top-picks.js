// Computes the live "Top pick" per city — one confirmed court per city,
// re-derived from community votes/ratings so it moves as real data comes in
// instead of staying a fixed editorial choice. Shared by the map, directory,
// and every city page so they always agree on the same winner.
//
// Score = community overall rating average, plus half a point per favorite
// vote (favorites nudge the result but don't dominate it the way they do on
// /rankings, which sorts favorites first). Before a court has any community
// data at all, its public Google rating (assets/google-ratings.json, via
// window.PBGoogleRatings) breaks the tie instead of falling back to an
// arbitrary order — most courts start at 0/0, so this is what actually
// decides day-one picks until real votes arrive.
//
// Depends on window.PBRatings (court-ratings.js) being ready, and optionally
// window.PBGoogleRatings (google-ratings.js) for the zero-data tiebreak.

(function () {
  const FAVORITE_WEIGHT = 0.5;

  function topPickScore(stats) {
    return stats.overallAvg + stats.favoriteVotes * FAVORITE_WEIGHT;
  }

  // Sort a city's confirmed courts with this and the winner is index 0. Ties
  // with zero community data fall through to Google rating, then Google
  // review count, then court id alphabetically. That last step is a plain
  // value comparison (not "whatever order the caller passed in") on purpose
  // — the directory/map read courts in JSON order while a city page reads
  // its own DOM order, so relying on input order to break a tie would let
  // the same tie resolve to a different court on different pages.
  function compareForTopPick(a, b) {
    const sa = window.PBRatings.getStats(a.id);
    const sb = window.PBRatings.getStats(b.id);
    const scoreA = topPickScore(sa);
    const scoreB = topPickScore(sb);
    if (scoreA !== scoreB) return scoreB - scoreA;

    const noDataA = sa.overallAvg === 0 && sa.favoriteVotes === 0;
    const noDataB = sb.overallAvg === 0 && sb.favoriteVotes === 0;
    if (noDataA && noDataB && window.PBGoogleRatings) {
      const ga = window.PBGoogleRatings.get(a.id);
      const gb = window.PBGoogleRatings.get(b.id);
      const ratingA = ga && typeof ga.rating === "number" ? ga.rating : 0;
      const ratingB = gb && typeof gb.rating === "number" ? gb.rating : 0;
      if (ratingA !== ratingB) return ratingB - ratingA;

      const countA = (ga && ga.userRatingCount) || 0;
      const countB = (gb && gb.userRatingCount) || 0;
      if (countA !== countB) return countB - countA;
    }
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  }

  // courts: array of { id, city, confirmed }. Unconfirmed venues (no
  // verified pickleball listing — see the "call ahead" entries on city
  // pages) are never eligible; every city has at least one confirmed court,
  // so this always returns exactly one winner per city.
  function computeTopPickIds(courts) {
    const byCity = {};
    courts.forEach((c) => {
      if (c.confirmed === false) return;
      (byCity[c.city] = byCity[c.city] || []).push(c);
    });

    const ids = new Set();
    Object.values(byCity).forEach((cityCourts) => {
      if (!cityCourts.length) return;
      const winner = cityCourts.slice().sort(compareForTopPick)[0];
      ids.add(winner.id);
    });
    return ids;
  }

  window.PBTopPicks = { computeTopPickIds, compareForTopPick, topPickScore };
})();
