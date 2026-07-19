// How this site rates a paddle — the single source of truth, shared by the
// quiz (assets/paddle-quiz.js) and the browsable catalog (assets/paddle-grid.js).
//
// These four ratings answer "what is this paddle like?" on a 0-1 scale, from
// nothing but the paddle's own fields. They are deliberately NOT the same thing
// as the quiz's score, which answers "how well does this paddle suit YOU" and
// lives in paddle-quiz.js where the visitor's answers are.
//
// Extracted rather than copied for the same reason vendorLinkFor was (see
// affiliate-links.js): the site should have exactly one opinion about how
// powerful a paddle is. Two scorers drifting apart would show a paddle ranked
// #1 for Power in the grid while the quiz calls it a control paddle, and
// nothing would fail — it would just quietly stop making sense.
//
// Everything here reads only assets/paddles.json fields, so it is pure and
// testable: same paddle in, same number out.

export const clamp01 = (n) => Math.max(0, Math.min(1, n));

export function isSoftImpact(paddle) {
  return paddle.impactFeel === "Soft/Dense" || paddle.impactFeel === "Soft/Hollow";
}

export function isStiffImpact(paddle) {
  return paddle.impactFeel === "Stiff/Dense" || paddle.impactFeel === "Stiff/Hollow";
}

// paddleType is the manufacturer's own label; powerPercentile is the measured
// tier. Weighted 40/60 toward the measurement, because the label is marketing
// and the tier isn't — but the label still carries the design intent, so it
// isn't discarded. A paddle with no percentile falls back to its label alone.
export function powerRating(paddle) {
  const base = paddle.paddleType === "Power" ? 0.85 : paddle.paddleType === "All-Court" ? 0.5 : paddle.paddleType === "Control" ? 0.2 : 0.5;
  return paddle.powerPercentile != null ? base * 0.4 + paddle.powerPercentile * 0.6 : base;
}

// No measured CONTROL tier exists in the data, so this rating is assembled from
// the signals that do exist. It used to be the label plus a soft/stiff nudge,
// and that produced exactly two values across the 91 Control-type paddles: 84
// at 1.00 and 7 at 0.85. An 84-way tie is not a ranking — it handed the whole
// podium to the tiebreak, so "the most control-oriented paddles" silently meant
// "the cheapest ones with a soft face". Hence the measured terms below.
//
// The three signals, in order of how much they actually discriminate:
//
//   powerPercentile (357/486) — inverted, this is by far the strongest control
//     proxy in the catalog. Mean powerPercentile by label is Control 0.174,
//     All-Court 0.418, Power 0.696: a clean monotonic split. Weighted highest.
//
//   swingWeightPercentile (486/486) — a low swingweight is a paddle you can
//     reposition at the kitchen, which is most of what touch is. It leans the
//     right way (Control 0.414 vs Power 0.501) but only weakly, and it barely
//     tracks power at all (r = 0.117), so it earns a real but minority weight.
//     Its job is as much structural as predictive: it is the one term present
//     on EVERY paddle, so no paddle can fall back to a flat label constant.
//     That matters — with a label-only fallback the 32 Control paddles missing
//     powerPercentile all landed on the ceiling and beat every measured paddle,
//     which makes "we have no data on this one" the winning strategy.
//
//   the label + impact feel — design intent and the one bit of face physics we
//     hold: a soft face dwells on the ball, a stiff one pops off it. Kept for
//     the same reason powerRating keeps its label, but no longer decisive.
export function controlRating(paddle) {
  let label = paddle.paddleType === "Control" ? 0.85 : paddle.paddleType === "All-Court" ? 0.5 : paddle.paddleType === "Power" ? 0.2 : 0.5;
  if (isSoftImpact(paddle)) label = clamp01(label + 0.15);
  else if (isStiffImpact(paddle)) label = clamp01(label - 0.15);

  const maneuver = paddle.swingWeightPercentile != null ? 1 - paddle.swingWeightPercentile : 0.5;
  // Inverted powerRating rather than inverted powerPercentile, deliberately.
  // Reaching for the raw percentile means branching on whether it exists, and
  // the branch that skips it has to hand its weight to the label — which sends
  // every unmeasured paddle to the top, because the label is exactly what says
  // "Control". powerRating already owns that fallback and degrades to the label
  // base (0.2 for a Control paddle) instead of a bonus, so a paddle we measured
  // as genuinely low-power still outranks one we simply never measured.
  //
  // It also keeps this function the exact mirror of powerRating, which is what
  // lets allCourtFit() read the gap between them as a meaningful number.
  return clamp01((1 - powerRating(paddle)) * 0.5 + maneuver * 0.25 + label * 0.25);
}

// spinPercentile is the banded rank of the paddle's measured spin RPM and is
// the better signal by a distance: the four-word spinRating column gives the
// whole catalog four spin values, so 349 paddles shared four scores and the
// charts stacked them on four lines. Prefer it, fall back to the word for the
// paddles that carry a rating but no RPM reading.
export function spinRatingOf(paddle) {
  if (typeof paddle.spinPercentile === "number") return paddle.spinPercentile;
  return { "Very High": 1, High: 0.75, Medium: 0.45, Low: 0.15 }[paddle.spinRating] ?? 0.5;
}

// Twist weight is forgiveness: how little the paddle turns in your hand on an
// off-centre hit. The percentile is already the whole story here.
export function forgivenessRatingOf(paddle) {
  return paddle.twistWeightPercentile != null ? paddle.twistWeightPercentile : 0.5;
}

// Which paddles satisfy each answer to "do you need it tournament-approved?".
//
// Not a rating, but it belongs in this module for the reason the module exists:
// it is a fact about a paddle that BOTH the quiz and the browsable catalog have
// to agree on. The quiz filters its scoring pool with it and the grid filters
// its list with it, and two copies would eventually disagree about whether a
// dual-certified paddle counts as USAP — which is the drift this file was
// created to prevent (see the header).
//
// The two sanctioning bodies certify SEPARATELY, and the catalog carries four
// states: USAP (392), USAP/UPA-A (66), UPA-A (23), Unapproved (5). The 66
// dual-certified paddles satisfy either requirement, so they appear in both
// pools — the thing a yes/no question could never express.
export const APPROVAL_POOLS = {
  usap: (p) => p.approvalBody === "USAP" || p.approvalBody === "USAP/UPA-A",
  upa: (p) => p.approvalBody === "UPA-A" || p.approvalBody === "USAP/UPA-A",
  either: (p) => Boolean(p.approvalBody) && p.approvalBody !== "Unapproved",
  unapproved: (p) => p.approvalBody === "Unapproved",
  no: () => true,
};

// Resolve an answer to a predicate. "yes" is the old binary value and meant
// USAP; it is mapped rather than dropped so a stale answer can never widen the
// pool to paddles the visitor can't use — failing open on a legality filter is
// the wrong direction to fail.
export function approvalPoolFor(answer) {
  const key = answer === "yes" ? "usap" : answer;
  return APPROVAL_POOLS[key] || APPROVAL_POOLS.no;
}

// How well a paddle plays the all-court game: balance, not mediocrity. A paddle
// scores 1 when its power and control are equal and falls away as either
// dominates, so a genuine do-everything paddle beats both a power specialist
// and a control specialist — which is the whole point of asking for one.
//
// Lives here because BOTH surfaces need the same answer. paddle-grid.js has
// ranked its "All-Court" filter this way for a while; the quiz's "All-around"
// style answer added no bonus at all, so it fell through to the raw trait sum
// and returned a top 3 that was 43% Power-type against 31% All-Court. Two
// surfaces disagreeing about what all-court means is exactly the drift this
// module exists to prevent (see the header) — so the formula moved here and
// both call it.
export function allCourtFit(paddle) {
  return 1 - Math.abs(powerRating(paddle) - controlRating(paddle));
}

// Which of the four ratings a given paddle actually has evidence for.
//
// Every rating function above degrades to a middle value when its source field
// is missing, so a paddle with no data still gets a number. That is right for
// RANKING (a missing field shouldn't fling a paddle to the top or bottom) and
// wrong for DISPLAY: 137 of 486 paddles have no spinRating at all, and plotting
// them at "spin 50" states a measurement the catalog never made. The grid cards
// already omit a spec rather than fake it (see paddle-grid.js); the charts need
// the same fact to do the same thing, and to keep unrated paddles out of any
// "Nth of M" claim.
//
// power/control fall back to paddleType, which IS real data — just coarser — so
// they count as known whenever the label exists. Spin has no such fallback: with
// no spinRating there is no signal, only the 0.5.
export function ratingKnown(paddle, key) {
  if (key === "spin") return paddle.spinPercentile != null || paddle.spinRating != null;
  if (key === "forgiveness") return paddle.twistWeightPercentile != null;
  if (key === "power") return paddle.paddleType != null || paddle.powerPercentile != null;
  // swingWeightPercentile is on every paddle, so control would be "known" for
  // all 486 if it counted — but a swingweight alone is too thin to claim we
  // measured a paddle's touch (it barely tracks power at all). Same judgement
  // as spin below: a weak signal on its own is not evidence.
  if (key === "control") return paddle.paddleType != null || paddle.powerPercentile != null;
  return true; // price, and anything else that isn't a derived rating
}

// Tie-break comparator, shared by the quiz's ranking (paddle-quiz.js) and the
// browse grid's (paddle-grid.js) so both surfaces order equal-scoring paddles
// the same way. Ties are the NORM, not an edge case: the percentiles are
// banded to twenty steps (a data-licensing firewall — see
// rebuild_paddle_data.py), so dozens of paddles routinely share one score.
// Without this, a tie falls to the array's original order — alphabetical by
// brand — so a late-alphabet brand like "Six Zero" loses the last podium slot
// for no reason but its name.
//
// There are TWO tiebreaks, because the two surfaces are answering different
// questions and price belongs in exactly one of them.
//
// tiebreakByTrait — "which paddle is most X?" (the browse grid). Price is not
// an answer to that question. A cheap paddle is not more control-oriented than
// an expensive one, and letting price order the podium is what made the Control
// filter return the four cheapest soft-faced paddles. Among paddles that embody
// the filter equally, prefer the one that also bites (spin) and then forgives
// (sweet spot), degrading to name order only when two are genuinely
// indistinguishable on every axis we hold.
//
// tiebreak — "which paddle should YOU buy?" (the quiz). Here price leads, and
// has to: the results page shows the fit score, so without it a $169 paddle
// could sit at #1 above an identically-fitting $109.99 one, both cards reading
// "100 fit", separated only by a spin tier the visitor cannot see. Whatever
// orders that podium has to be something the reader can act on.
//
// Both return a value for Array.sort: negative if a sorts before b.
export function tiebreakByTrait(a, b) {
  const spin = spinRatingOf(b) - spinRatingOf(a);
  if (Math.abs(spin) > 1e-9) return spin;
  const forgive = forgivenessRatingOf(b) - forgivenessRatingOf(a);
  if (Math.abs(forgive) > 1e-9) return forgive;
  return `${a.brand} ${a.name}`.localeCompare(`${b.brand} ${b.name}`);
}

export function tiebreak(a, b) {
  // A paddle with no price sorts last rather than first: "price unknown" is not
  // a bargain, and one catalog entry has no price at all.
  const pa = typeof a.price === "number" ? a.price : Infinity;
  const pb = typeof b.price === "number" ? b.price : Infinity;
  if (pa !== pb) return pa - pb;
  return tiebreakByTrait(a, b);
}
