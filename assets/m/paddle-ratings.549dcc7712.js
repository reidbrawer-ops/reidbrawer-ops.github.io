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

export function spinRatingOf(paddle) {
  return { "Very High": 1, High: 0.75, Medium: 0.45, Low: 0.15 }[paddle.spinRating] ?? 0.5;
}

// Twist weight is forgiveness: how little the paddle turns in your hand on an
// off-centre hit. The percentile is already the whole story here.
export function forgivenessRatingOf(paddle) {
  return paddle.twistWeightPercentile != null ? paddle.twistWeightPercentile : 0.5;
}

// Tie-break comparator, shared by the quiz's ranking (paddle-quiz.js) and the
// browse grid's (paddle-grid.js) so both surfaces order equal-scoring paddles
// the same way. Ties are the NORM, not an edge case: the percentiles are
// coarsened to four quartile tiers (a data-licensing firewall — see
// rebuild_paddle_data.py), so dozens of paddles routinely share one score.
// Without this, a tie falls to the array's original order — alphabetical by
// brand — so a late-alphabet brand like "Six Zero" loses the last podium slot
// for no reason but its name. So ties fall instead to the traits the score
// didn't already decide: among equals, prefer the one that also bites (spin)
// and then forgives (sweet spot), degrading to name order only when two paddles
// are genuinely indistinguishable on every axis we hold. Returns a value for
// Array.sort: negative if a should sort before b.
export function tiebreak(a, b) {
  const spin = spinRatingOf(b) - spinRatingOf(a);
  if (Math.abs(spin) > 1e-9) return spin;
  const forgive = forgivenessRatingOf(b) - forgivenessRatingOf(a);
  if (Math.abs(forgive) > 1e-9) return forgive;
  return `${a.brand} ${a.name}`.localeCompare(`${b.brand} ${b.name}`);
}
