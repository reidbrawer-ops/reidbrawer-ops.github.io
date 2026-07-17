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
