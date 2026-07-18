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

// No measured control tier exists in the data, so this is the label plus the
// one physical signal that reliably tracks touch: a soft face dwells longer on
// the ball, a stiff one pops off it.
export function controlRating(paddle) {
  let base = paddle.paddleType === "Control" ? 0.85 : paddle.paddleType === "All-Court" ? 0.5 : paddle.paddleType === "Power" ? 0.2 : 0.5;
  if (isSoftImpact(paddle)) base = clamp01(base + 0.15);
  else if (isStiffImpact(paddle)) base = clamp01(base - 0.15);
  return base;
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
  if (key === "control") return paddle.paddleType != null;
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
// PRICE BREAKS FIRST. If two paddles fit the visitor equally well, the cheaper
// one is the better recommendation, full stop — and the alternative was
// indefensible once the results page started showing the fit score: a $169
// paddle could sit at #1 above an identically-fitting $109.99 one, with both
// cards reading "100 fit", and the only thing separating them was a spin tier
// the visitor could not see. Whatever ordered the podium has to be something
// the reader can act on, and price is the one tiebreaker that always is.
//
// After price come the traits the score didn't already decide — among equals,
// prefer the one that also bites (spin) and then forgives (sweet spot) —
// degrading to name order only when two paddles are genuinely indistinguishable
// on every axis we hold. Returns a value for Array.sort: negative if a sorts
// before b.
export function tiebreak(a, b) {
  // A paddle with no price sorts last rather than first: "price unknown" is not
  // a bargain, and one catalog entry has no price at all.
  const pa = typeof a.price === "number" ? a.price : Infinity;
  const pb = typeof b.price === "number" ? b.price : Infinity;
  if (pa !== pb) return pa - pb;
  const spin = spinRatingOf(b) - spinRatingOf(a);
  if (Math.abs(spin) > 1e-9) return spin;
  const forgive = forgivenessRatingOf(b) - forgivenessRatingOf(a);
  if (Math.abs(forgive) > 1e-9) return forgive;
  return `${a.brand} ${a.name}`.localeCompare(`${b.brand} ${b.name}`);
}
