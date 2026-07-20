// Find your paddle — a 10-question wizard that scores every paddle in
// assets/paddles.json against the visitor's answers, shows their top 3
// matches as a side-by-side comparison, and captures an email as a lead
// (Firestore, write-only — see firestore.rules `paddleQuizLeads`).
//
// Mounts into <div id="paddle-quiz-app"> on paddle-quiz.html. No framework —
// a small class re-renders its own root on each step, matching the rest of
// this site's hand-rolled JS (nav.js, global-search.js, directory.js).

import { firebaseConfig, isFirebaseConfigured } from "/assets/firebase-config.js";
// Buy-link construction is shared with the browsable paddle grid — see
// assets/affiliate-links.js for why it is imported rather than duplicated.
import { vendorLinkFor, trackVendorClicks } from "/assets/affiliate-links.js";

// The four trait ratings are shared with the browsable catalog so the site has
// one opinion about how powerful a paddle is — see assets/paddle-ratings.js.
import { clamp01, isSoftImpact, powerRating, controlRating, spinRatingOf, forgivenessRatingOf, allCourtFit, approvalPoolFor, tiebreak } from "/assets/paddle-ratings.js";

// The results-page comparison visualizations (Top 3 strip + axis explorer +
// value chart + priority stress-test). Its own module so the same components
// can serve the browse view once it has a selection model — see
// assets/paddle-charts.js and design_handoff_paddle_comparison/README.md.
import { renderPaddleCharts, seriesColorFor } from "/assets/paddle-charts.js";

// The compliant at-a-glance panel on the #1 hero reuses the browse grid's bar
// renderer so the two surfaces show a paddle's traits identically: miniBars
// returns a position (banded percentile) plus a tier WORD, never the
// proprietary number — see PADDLE_DATA_SETUP.md's data-licensing section. hasLab
// gates it: 130-odd paddles have no bench numbers and get an honest line rather
// than four empty tracks.
import { miniBars, hasLab } from "/assets/paddle-model.js";

// dom-utils.js (a plain script, loaded before this module on every page that
// mounts the quiz — see its header) owns the single escapeHtml definition.
// Reuse it rather than adding the N+1th copy this codebase already audited away.
const escapeAttr = (s) => window.PBUtils.escapeHtml(s);

// assets/analytics.js defines window.pbaTrack and no-ops it when the visitor
// has opted out. Guarded anyway: this module also loads on pages where a
// blocked analytics.js means the global never appears.
const track = (name, params) => {
  if (typeof window.pbaTrack === "function") window.pbaTrack(name, params);
};

const QUESTIONS = [
  {
    key: "experience",
    prompt: "How would you describe your level?",
    options: [
      { value: "beginner", label: "Beginner", hint: "New to the game, or under ~6 months in" },
      { value: "intermediate", label: "Intermediate", hint: "Comfortable rallying, working on strategy (roughly 3.0–3.5)" },
      { value: "advanced", label: "Advanced", hint: "Competitive league play (4.0+)" },
      { value: "pro", label: "Pro / tournament", hint: "Dialed-in technique, playing to win (4.5+)" },
    ],
  },
  // "How often do you get on the court?" was removed on 2026-07-18. It looked
  // like a real question and wasn't: of its four options, "A few times a week"
  // and "Daily / competitive" scored IDENTICALLY (0% difference across 240
  // sampled answer sets), and "Weekly" produced no scoring term at all — so it
  // was a four-way control with two settings. The one that worked, "A few times
  // a year", simply added the paddle's forgiveness, which is now what the level
  // question does (see levelForgivenessBonus), and its other bonus was gated on
  // the Advanced skill tag that the same change stopped matching on.
  //
  // Ten questions is a long run-up to an email gate that is already the biggest
  // drop-off on the page; a question that duplicates another one isn't worth
  // the step.
  {
    key: "style",
    prompt: "What best describes your game?",
    options: [
      { value: "power", label: "Power banger", hint: "You want pace — hard drives and big put-away shots" },
      { value: "allround", label: "All-around", hint: "A bit of everything — no strong lean" },
      { value: "spin", label: "Spin & control", hint: "You place the ball and generate heavy topspin" },
      { value: "soft", label: "Soft game & resets", hint: "You live at the kitchen line — dinks, resets, touch" },
    ],
  },
  {
    key: "current",
    type: "multi",
    prompt: "What would you change about your current paddle?",
    hint: "Pick all that apply — or tell us it's your first paddle.",
    options: [
      { value: "more_power", label: "More power", hint: "Drives and put-aways need more mustard" },
      { value: "more_spin", label: "More spin", hint: "Want more bite on topspin and serves" },
      { value: "more_forgiveness", label: "A bigger sweet spot", hint: "Off-center hits punish you too much" },
      { value: "less_weight", label: "Lighter swing weight", hint: "Current paddle feels heavy late in matches" },
      { value: "less_arm_strain", label: "Less arm strain", hint: "You feel it in your elbow or wrist after playing" },
      { value: "first_paddle", label: "Nothing — it's my first paddle", hint: "", exclusive: true },
    ],
  },
  {
    key: "shape",
    prompt: "Widebody, elongated, or hybrid?",
    hint: "Shape trades reach and spin for sweet spot size.",
    options: [
      { value: "widebody", label: "Widebody", hint: "Wider face, bigger sweet spot, more forgiving" },
      { value: "elongated", label: "Elongated", hint: "More reach and swing speed, smaller sweet spot" },
      { value: "hybrid", label: "Hybrid", hint: "A middle ground between the two" },
      { value: "notsure", label: "Not sure", hint: "Recommend what fits my other answers" },
    ],
  },
  {
    key: "sensitivity",
    prompt: "Any elbow, wrist, or shoulder sensitivity?",
    hint: "We'll favor lighter, more forgiving paddles if so.",
    options: [
      { value: "none", label: "None", hint: "No issues — optimize for performance" },
      { value: "mild", label: "Occasional soreness", hint: "Nothing serious, but worth some caution" },
      { value: "sensitive", label: "Yes, ongoing issues", hint: "Prioritize a light, arm-friendly paddle" },
    ],
  },
  {
    key: "weight",
    prompt: "Quick and light, or heavy and stable?",
    hint: "This covers both what the paddle weighs on a scale and how heavy it feels in motion (its swing weight). There's no one right answer — only what your arm and swing prefer.",
    options: [
      { value: "light", label: "Quick and maneuverable", hint: "Faster hands at the net and less fatigue late in matches" },
      { value: "neutral", label: "Balanced", hint: "No strong preference — happy to split the difference" },
      { value: "heavy", label: "Heavy and stable", hint: "More plow-through and stability on contact, slower hands" },
    ],
  },
  {
    key: "twistWeight",
    prompt: "How much should off-center hits punish you?",
    hint: "Twist weight is how much the paddle resists turning on a mishit.",
    options: [
      { value: "high", label: "Bigger sweet spot", hint: "More stability and a larger effective sweet spot" },
      { value: "mid", label: "No strong preference", hint: "Somewhere in between" },
      { value: "low", label: "Precise & lively", hint: "Less forgiving on mishits, but a crisper, more direct feel" },
    ],
  },
  {
    key: "tournament",
    prompt: "Do you need it tournament-approved?",
    hint: "The two sanctioning bodies certify separately, and some paddles carry both.",
    options: [
      { value: "usap", label: "USAP approved", hint: "USA Pickleball — most club, league and community tournaments" },
      { value: "upa", label: "UPA-A approved", hint: "United Pickleball Association — the PPA and APP pro tours" },
      { value: "either", label: "Either is fine", hint: "Any approved paddle, just not an unapproved one" },
      { value: "no", label: "No — recreational play", hint: "Show me everything, approved or not" },
    ],
  },
  {
    key: "budget",
    prompt: "What's your budget?",
    hint: "We'll prioritize your range, but still surface the best overall fit.",
    options: [
      { value: "under100", label: "Under $100", hint: "Great value, entry-level builds" },
      { value: "100to200", label: "$100–$200", hint: "The sweet spot for most players" },
      { value: "nobudget", label: "No budget", hint: "Price isn't a factor — show me the best fit at any price" },
    ],
  },
];


// 1 inside [min, max], decaying linearly to 0 over `falloff` outside either edge.
function trapezoid(value, min, max, falloff) {
  if (value == null) return 0.5;
  if (value >= min && value <= max) return 1;
  if (value < min) return clamp01(1 - (min - value) / falloff);
  return clamp01(1 - (value - max) / falloff);
}

function weightPrefScore(paddle, weightPref) {
  const w = paddle.weightOz;
  if (weightPref === "light") return trapezoid(w, 0, 7.5, 0.6);
  if (weightPref === "neutral") return trapezoid(w, 7.6, 8.2, 0.6);
  return trapezoid(w, 8.3, 20, 0.6); // heavy
}

// "nobudget" deliberately has no range — see budgetScore.
const BUDGET_RANGES = { under100: [0, 100], "100to200": [100, 200] };

// How far past the stated range the budget score decays to nothing.
//
// Was 80, which made budget a CLIFF rather than a gradient: "under $100" hit
// zero at $180 and "$100-$200" at $280, so every paddle beyond those points
// scored identically no matter how far beyond. In a catalog running $69-$333
// that flattened a large slice of it — a visitor who said "under $100" was
// given no reason at all to prefer a $190 paddle over a $333 one, and the
// stress-test's "Budget first" lens could not reorder three expensive picks
// because it was handing all of them the same floor.
//
// Sized to the catalog's own price span (~$264) so the score is still falling
// at the most expensive paddle in the file rather than having bottomed out
// long before. Revisit if a future export widens that range a lot.
const BUDGET_FALLOFF = 250;

// A stated budget is a firmer constraint than a taste preference, so its term
// carries more than a single dimension's worth — but deliberately not enough to
// decide the ranking on its own. At 1.5x the budget term spans 15-45 points
// against a trait block of 40-120, so a genuinely better-fitting paddle can
// still win while costing more; it just has to be better by a real margin
// rather than by a rounding error.
const BUDGET_WEIGHT = 1.5;

// Null (not a flat top score) when the visitor said price isn't a factor: a
// constraint they don't have shouldn't earn every paddle three dots of
// "budget fit" it did nothing to deserve. The row is dropped from the table
// and the term from the ranking instead — see dimRow and totalScore.
function budgetScore(paddle, budgetPref) {
  const r = BUDGET_RANGES[budgetPref];
  if (!r) return null;
  return trapezoid(paddle.price, r[0], r[1], BUDGET_FALLOFF);
}

// Swing weight — how heavy a paddle feels in motion — isn't a field in the
// source data, so it's approximated from where the balance point sits
// (farther from the handle = more head-heavy = swings heavier) blended with
// static weight, both normalized against the dataset's observed range
// (see assets/paddles.json prep script). Shown only as a relative "fit" dot
// against the visitor's stated preference, never as a fabricated absolute
// number — the underlying data doesn't support that level of precision.
const BALANCE_MM_RANGE = [203, 256];
const WEIGHT_OZ_RANGE = [7.25, 8.9];

function swingWeightIndex(paddle) {
  // The July 18 2026 export carries a real Swing Weight measurement, banded to
  // swingWeightPercentile. Prefer it: everything below is an APPROXIMATION of
  // exactly this number, built when the column didn't exist, and it guessed —
  // a light paddle can still swing heavy, which balance point alone only
  // partly captures. Kept as the fallback for any paddle without the field.
  if (typeof paddle.swingWeightPercentile === "number") return paddle.swingWeightPercentile;
  if (paddle.balancePointMm == null) return 0.5;
  const balNorm = clamp01((paddle.balancePointMm - BALANCE_MM_RANGE[0]) / (BALANCE_MM_RANGE[1] - BALANCE_MM_RANGE[0]));
  const wtNorm = clamp01((paddle.weightOz - WEIGHT_OZ_RANGE[0]) / (WEIGHT_OZ_RANGE[1] - WEIGHT_OZ_RANGE[0]));
  return balNorm * 0.65 + wtNorm * 0.35;
}

function swingWeightPrefScore(paddle, pref) {
  const idx = swingWeightIndex(paddle);
  if (pref === "low") return trapezoid(idx, 0, 0.35, 0.2);
  if (pref === "mid") return trapezoid(idx, 0.35, 0.65, 0.2);
  return trapezoid(idx, 0.65, 1, 0.2); // high
}

// Static weight and swing weight are genuinely different properties (a light
// paddle can still swing heavy), but they're the same question to a visitor —
// "how heavy do you want this thing to feel" — so the quiz asks once and scores
// both halves against that one answer, averaged into a single "weight fit" dot.
const SWING_WEIGHT_PREF = { light: "low", neutral: "mid", heavy: "high" };

function weightFitScore(paddle, weightPref) {
  const swingPref = SWING_WEIGHT_PREF[weightPref] || "mid";
  return (weightPrefScore(paddle, weightPref) + swingWeightPrefScore(paddle, swingPref)) / 2;
}

// Twist weight percentile is a real per-paddle field (see dimensionsFor's
// `forgiveness` dimension, which reads the same value) — this just scores it
// against the visitor's stated preference rather than showing it absolute.
function twistWeightPrefScore(paddle, pref) {
  const t = paddle.twistWeightPercentile;
  if (pref === "high") return trapezoid(t, 0.65, 1, 0.25); // bigger sweet spot
  if (pref === "mid") return trapezoid(t, 0.35, 0.65, 0.25);
  return trapezoid(t, 0, 0.35, 0.25); // low = precise & lively
}

// approvalPoolFor lives in paddle-ratings.js — the browse grid filters on the
// same four states, and one definition means the two surfaces can never
// disagree about whether a dual-certified paddle counts as USAP.

// The same four answers in words, for the charts' scopeLabel. Reads as a clause
// inside both of the panel's sentences ("Every other paddle THAT'S USAP-
// APPROVED, compared against…" / "Nothing THAT'S USAP-APPROVED costs less
// than…"). "no" has no entry: that answer excludes nothing, so the panel's
// default "in the catalog" is already accurate.
const APPROVAL_SCOPE = {
  usap: "that's USAP-approved",
  upa: "that's UPA-A approved",
  either: "that's approved by either body",
};



// ---------- Comparison-table dimension ratings ----------
//
// Unlike the scoring below (which is conditioned on the visitor's answers,
// to rank paddles against each other), these are fixed, absolute per-paddle
// profiles — every result shows all 4 axes regardless of what the visitor
// picked, so the comparison table actually shows how the 3 picks differ
// rather than just confirming the one thing they asked for. Deliberately
// paraphrased into a dot rating rather than citing the exact proprietary
// lab-tested labels/percentiles those numbers come from.





// Every scored term, on a 10–30 scale.
//
// This WAS a 1/2/3 bucket, and it was the ceiling on how distinct the quiz
// could ever be: three values per dimension meant the whole 486-paddle catalog
// produced about 17 distinct total scores, so podiums tied constantly and the
// tiebreak — not the visitor's answers — decided most results. Widening the
// underlying data to 20 bands (see rebuild_paddle_data.py) changed nothing on
// its own, because the ratings were still being funnelled through three values.
//
// The old comment here warned that widening this would "silently multiply every
// dimension's weight against those constants and re-rank the whole quiz". That
// was correct, and it is why every hand-tuned bonus in scoreTerms was scaled by
// the same factor of 10 in the same change: 3 points for a shape match became
// 30, the skill match 40, the ±1 arm-feel nudges ±10. Relative weighting is
// therefore identical to the tuned model — one "dot" is still 10 — while the
// traits themselves now vary continuously instead of snapping to three steps.
//
// 10–30 rather than 0–30 keeps the old floor: the weakest paddle on a dimension
// still contributes something, so a dimension can never zero out a paddle that
// was merely rated low on it.
function toDots(score) {
  if (score == null) return null; // A dimension the visitor's answers took out of play.
  return Math.round(10 + clamp01(score) * 20);
}

// DISPLAY ONLY. totalScore() adds the 1-3 toDots values straight into a sum
// alongside hand-tuned integer bonuses (+3 for a shape match, +1 for a light
// paddle, -1 for a stiff one). Widening toDots to 0-10 would silently multiply
// every dimension's weight against those constants and re-rank the whole quiz —
// so the finer scale the comparison table shows is computed separately from the
// same raw 0-1 rating, and never reaches the scorer.
// Floor of 1: a rendered row with zero filled dots reads as "no data" rather
// than "lowest", and every paddle here rated on something.
function toDots10(score) {
  if (score == null) return null;
  return Math.min(10, Math.max(1, Math.round(score * 10)));
}

function dimensionsFor(paddle, fullAnswers) {
  // Rated once, read twice: toDots() feeds the scorer, toDots10() feeds the
  // table. Same source of truth, two resolutions.
  const raw = {
    power: powerRating(paddle),
    control: controlRating(paddle),
    spin: spinRatingOf(paddle),
    forgiveness: forgivenessRatingOf(paddle),
  };
  return {
    power: toDots(raw.power),
    control: toDots(raw.control),
    spin: toDots(raw.spin),
    forgiveness: toDots(raw.forgiveness),
    // How even the power/control split is — what "All-around" actually asks
    // for. Scored on the same 10-30 scale as the four traits so the style
    // bonus below weighs the same whichever style was chosen.
    balance: toDots(allCourtFit(paddle)),
    weightFit: toDots(weightFitScore(paddle, fullAnswers.weight)),
    twistWeightFit: toDots(twistWeightPrefScore(paddle, fullAnswers.twistWeight)),
    budgetFit: toDots(budgetScore(paddle, fullAnswers.budget)),
    // The 0-10 scale the comparison table renders. Only the four traits that
    // describe the PADDLE get one — the *Fit rows measure the visitor's own
    // answers, and since all three picks were selected to fit those answers,
    // they land nearly identical and differentiate nothing. They stay above,
    // where the scorer still uses them.
    display: {
      power: toDots10(raw.power),
      control: toDots10(raw.control),
      spin: toDots10(raw.spin),
      forgiveness: toDots10(raw.forgiveness),
    },
    // Tagged once in assets/paddles.json from forgiveness (twist weight
    // percentile), core thickness, and paddle type — see the prep script for
    // the exact rule. Shown directly in the table (as a level-badge, not
    // dots, since it's a category rather than an intensity) so the skill
    // bonus below is as visible/auditable as everything else in the score.
    skillLevel: paddle.skillLevel || "Intermediate",
    // Internal-only signals used by totalScore/taglineFor below but not
    // rendered as their own comparison-table row — shape and arm-friendliness
    // feed the score, but adding two more rows would push the table past
    // what a visitor can usefully scan in one glance.
    shape: paddle.shape,
    softImpact: isSoftImpact(paddle),
    weightOz: paddle.weightOz,
    lightness: toDots(1 - swingWeightIndex(paddle)),
  };
}

// One-line "at a glance" summary, built entirely from the same dot values
// shown in the table below it — never a claim this data can't back up
// (no fabricated review quotes, no invented awards). Compares power vs.
// control vs. spin to describe the paddle's actual lean, in plain language.
const LEAN_LABEL = { power: "power", control: "control", spin: "spin" };
const LEAN_COPY = {
  power: "more pop on drives and put-aways",
  control: "extra touch for dinks and resets",
  spin: "more bite on topspin and slice",
};

function taglineFor(dims) {
  const { power, control, spin } = dims;
  const max = Math.max(power, control, spin);
  const min = Math.min(power, control, spin);
  const leaders = ["power", "control", "spin"].filter((k) => dims[k] === max);

  if (max - min === 0) return "A true all-court paddle — no strong lean toward power, control, or spin";
  if (leaders.length > 1) return `Balanced between ${leaders.map((k) => LEAN_LABEL[k]).join(" and ")}`;

  const lead = leaders[0];
  return max - min >= 2
    ? `Specializes in ${LEAN_LABEL[lead]} — ${LEAN_COPY[lead]}`
    : `Balanced paddle with a bit more ${LEAN_LABEL[lead]} — ${LEAN_COPY[lead]}`;
}

// How much EXTRA the paddle's forgiveness is worth, given the visitor's level.
//
// This replaced a skill-TAG MATCH worth +40 — the largest single term in the
// model — and it was the wrong shape twice over.
//
// It wasn't independent information. skillLevel is derived by
// rebuild_paddle_data.py from twist weight, core thickness and paddle type, two
// of which the scorer already counts directly, so the tag is a re-encoding of
// traits already scored: Beginner-tagged paddles average .76 forgiveness / .34
// power, Advanced-tagged .27 / .64. Matching it added those traits a second
// time with a 40-point amplifier.
//
// And it acted as a filter rather than a preference. Answering "Advanced" put
// +40 on 196 paddles of which only FOUR are forgiving, so an advanced player
// asking for touch and a big sweet spot was steered into 0.85-power paddles,
// while the forgiving ones they asked for sat two tag-steps away earning
// nothing. In the other direction no Beginner-tagged paddle is high-power at
// all, so a beginner who wanted pace — or an intermediate with a tennis
// background wanting plow-through — could not reach one.
//
// A weight, not a match: a newer player benefits from a bigger sweet spot, so
// forgiveness counts for more, and nothing is fenced off. An advanced player
// gets forgiveness weighted exactly as they asked for it, no more and no less.
const LEVEL_FORGIVENESS_BOOST = { beginner: 1, intermediate: 0.3, advanced: 0, pro: 0 };

function levelForgivenessBonus(forgivenessPoints, experience) {
  const mult = LEVEL_FORGIVENESS_BOOST[experience] ?? 0;
  return Math.round(forgivenessPoints * mult);
}

const SHAPE_MAP = { widebody: "Widebody", elongated: "Elongated", hybrid: "Hybrid" };

// The rank is a plain sum of the exact dots/badges shown in the table — no
// hidden weighting formula a viewer couldn't reconstruct themselves by
// counting circles on screen — plus a small set of named bonuses for
// answers that aren't shown as their own row (style, current-paddle gripes,
// shape, arm sensitivity, play frequency). The visitor's stated style
// counts its one matching dimension double, since that's the thing they
// explicitly said matters most; their stated level weights forgiveness up
// rather than matching a tag — see levelForgivenessBonus for why the tag
// match it replaced was both redundant and exclusionary.
// Every dot term is a non-negative integer, so a paddle that's
// equal-or-better on every shown dimension (and strictly better on at
// least one) always scores strictly higher, full stop. A null dim (only
// budgetFit today, on a "no budget" answer) contributes 0 to every paddle
// alike, so dropping it can't reorder anything.
//
// The score is expressed as a LIST OF NAMED TERMS rather than a running
// total, because the results page has to show its work: "Why these three"
// (assets/paddle-charts.js) renders exactly these terms, and totalScore is
// nothing but their sum. One implementation, so the explanation cannot drift
// from the ranking it explains.
//
// It drifted before. The stress-test used to re-derive the visitor's answers
// as a five-factor weight vector (power/control/spin/forgiveness/value) and
// caption the result "This is the ranking your quiz produced" — but that
// approximation dropped skill match, shape, weight fit, twist-weight fit,
// sensitivity and frequency entirely. Simulated across 3,000 answer sets it
// disagreed with the real podium 71% of the time and displaced the actual #1
// pick 57% of the time, directly above the buy links. Terms that don't reach
// the scorer don't get to describe it.
//
// `note` is the plain-language reason shown to the visitor; it must describe
// what the term actually rewards, never restate the score.
export function scoreTerms(dims, a) {
  const terms = [];
  // Zero-point terms are dropped: a reason worth nothing isn't a reason. The
  // trait term is pushed unconditionally — every paddle is rated on it.
  const push = (key, label, points, note) => {
    if (points) terms.push({ key, label, points, note });
  };

  terms.push({
    key: "traits",
    label: "What the paddle is",
    points: dims.power + dims.control + dims.spin + dims.forgiveness,
    note: "Its own power, control, spin and forgiveness — 1 to 3 points each, before anything you told us.",
  });

  push("feel", "The feel you asked for", dims.weightFit + dims.twistWeightFit,
    "How close it lands to your answers on weight in the hand and how much a mishit should punish you.");
  push("budget", "Your budget", Math.round((dims.budgetFit || 0) * BUDGET_WEIGHT),
    "How comfortably the list price sits inside the range you gave.");

  if (a.style === "power") push("style", "You play a power game", dims.power, "You said power banger, so its power counts twice.");
  else if (a.style === "spin") push("style", "You play a spin game", dims.spin, "You said spin & control, so its spin counts twice.");
  else if (a.style === "soft") push("style", "You play a soft game", dims.control, "You said soft game and resets, so its control counts twice.");
  // "allround" used to add nothing, on the theory that no lean meant no thumb
  // on the scale. In practice that wasn't neutral — with no bonus the raw trait
  // sum decided, and it returned a top 3 that was 43% Power-type against 31%
  // All-Court, so the one answer meaning "a bit of everything" delivered
  // specialists. Rewarding an even power/control split is the actual neutral
  // position, and it's how the browse grid has always ranked All-Court.
  else if (a.style === "allround") push("style", "You play an all-court game", dims.balance, "You said a bit of everything, so an even power/control split counts extra.");

  if (Array.isArray(a.current)) {
    if (a.current.includes("more_power")) push("want_power", "You wanted more power", dims.power, "You asked for more mustard on drives, so its power counts again.");
    if (a.current.includes("more_spin")) push("want_spin", "You wanted more spin", dims.spin, "You asked for more bite, so its spin counts again.");
    if (a.current.includes("more_forgiveness")) push("want_sweet", "You wanted a bigger sweet spot", dims.forgiveness, "You said off-centre hits punish you, so its forgiveness counts again.");
    if (a.current.includes("less_weight")) push("want_light", "You wanted a lighter swing", dims.lightness, "You said your current paddle feels heavy late in matches.");
    if (a.current.includes("less_arm_strain")) {
      push("want_arm", "You wanted less arm strain", dims.forgiveness + (dims.softImpact ? 1 : 0),
        dims.softImpact
          ? "A forgiving head plus a soft face, which dwells on the ball instead of jarring off it."
          : "Scored on forgiveness alone — this one's face isn't soft.");
    }
  }

  if (a.shape && a.shape !== "notsure") {
    const want = SHAPE_MAP[a.shape];
    if (dims.shape === want) push("shape", "The shape you asked for", 30, `You asked for ${want.toLowerCase()} and this is one.`);
    // A Hybrid paddle is a reasonable middle-ground fallback when the
    // visitor wanted one of the two extremes (widebody/elongated) — but if
    // they asked for Hybrid specifically, a non-Hybrid paddle isn't a
    // meaningful "close enough," so this bonus shouldn't apply in that
    // direction (that would flatten every other shape to the same score).
    else if (dims.shape === "Hybrid" && want !== "Hybrid") push("shape", "Close on shape", 10, `You asked for ${want.toLowerCase()}; a hybrid splits the difference.`);
    else if (a.shape === "elongated" && dims.shape === "Extra-elongated") push("shape", "Close on shape", 20, "You asked for elongated; this one goes further still.");
  }

  if (a.sensitivity === "sensitive") {
    push("arm_forgive", "Ongoing arm issues", dims.forgiveness, "You told us about ongoing elbow, wrist or shoulder trouble, so forgiveness counts again.");
    push("arm_feel", dims.softImpact ? "A soft, arm-friendly face" : "A firm face", dims.softImpact ? 20 : -10,
      dims.softImpact
        ? "A soft face cushions contact, which is what a sore arm wants."
        : "Marked down: with ongoing arm trouble, a firm face is the wrong direction.");
    if (dims.weightOz != null && dims.weightOz <= 7.6) push("arm_light", "Light enough to spare your arm", 10, `${dims.weightOz}oz — under the 7.6oz line we treat as arm-friendly.`);
  } else if (a.sensitivity === "mild") {
    push("arm_feel", "A soft, arm-friendly face", dims.softImpact ? 10 : 0, "You mentioned occasional soreness; a soft face is gentler on contact.");
  }

  push("level", "Room to grow into", levelForgivenessBonus(dims.forgiveness, a.experience),
    a.experience === "beginner"
      ? "Newer players gain most from a big sweet spot, so its forgiveness counts double for you."
      : "Still building consistency, so its forgiveness counts for a little extra.");

  return terms;
}

function totalScore(dims, a) {
  return scoreTerms(dims, a).reduce((sum, t) => sum + t.points, 0);
}

// Score one paddle against one set of answers, using the real ranking model.
//
// Exported so the stress-test can ask "what would this paddle score if you had
// answered differently?" instead of re-scoring it on a parallel five-factor
// trait model. That parallel model is why the card could rank the quiz's own #1
// last in 21% of answer sets — and never first under any lens in 28% — even on
// the preset that should flatter it. Two of its five factors actively
// contradicted the visitor: it treated forgiveness as a universal good when
// they may have asked for a precise, low-twist paddle, and cheapness as a
// universal good when they may have said price was no object. A $280 pick that
// won on fit had no way to win a contest scored on cheapness.
//
// Charts can't import this module (paddle-quiz.js imports paddle-charts.js, so
// it would be circular) — it's handed over as a function on the render options.
export function scorePaddle(paddle, answers) {
  const dims = dimensionsFor(paddle, answers);
  const terms = scoreTerms(dims, answers);
  return { score: terms.reduce((sum, t) => sum + t.points, 0), terms };
}

export function computeMatches(paddles, answers) {
  const fullAnswers = { ...answers };
  const pool = paddles.filter(approvalPoolFor(answers.tournament)).filter((p) => p.price != null);

  const scored = pool.map((paddle) => {
    const dims = dimensionsFor(paddle, fullAnswers);
    return { paddle, dims, score: totalScore(dims, fullAnswers) };
  });

  // Ties are the norm, not an edge case, because the ratings are coarsened to
  // four tiers (see paddle-ratings.js tiebreak). Without the tiebreak, equal
  // scores fall to catalog order — alphabetical by brand — so a great fit from
  // a late-alphabet brand ("Six Zero") loses the last podium slot for no reason
  // but its name. This is the same tiebreak the browse grid uses, so both
  // surfaces order equal-scoring paddles identically.
  scored.sort((a, b) => (b.score !== a.score ? b.score - a.score : tiebreak(a.paddle, b.paddle)));
  // Terms are re-derived for the podium only (three arrays, not 486) so the
  // results page can show why each one placed. Same function the scorer summed,
  // so "why" and "which" can never disagree — see scoreTerms.
  const top = scored.slice(0, 3).map(({ paddle, dims, score }) => ({ paddle, dims, score, terms: scoreTerms(dims, fullAnswers) }));

  // Every scored paddle's fit, keyed by id. The value chart plots price against
  // THIS rather than the catalog-wide trait average: "best performance for my
  // money" is a question about the visitor's own definition of performance, and
  // a flat mean of four traits marks down exactly the specialist a power player
  // came for. Handing over the real scores means the chart re-uses the ranking
  // instead of approximating it — the mistake scoreTerms exists to prevent.
  const fitScores = new Map(scored.map((s) => [s.paddle.id, s.score]));

  // The raw score is unreadable on its own — "29" is 29 of nothing in
  // particular, and its ceiling moves with the answers (a visitor who ticks
  // five current-paddle gripes has more terms available than one who ticks
  // none, so their scores aren't on the same scale either). fitScale carries
  // the achieved range so the surfaces can show a 0–100 instead.
  //
  // Anchored on scores paddles ACTUALLY got, not on a theoretical maximum.
  // The theoretical max is unreachable — it would need a paddle that is at once
  // maximally powerful and maximally controlled, soft-faced and stiff, light
  // and heavy — so dividing by it would rate a perfect match somewhere in the
  // sixties. Dividing by the top score instead puts the catalog's WORST paddle
  // at 29–52 depending on the answers, which reads as "average" when it means
  // "worst available". Min-max over the real range is the one that doesn't lie
  // at either end: 100 is the best fit found, 0 is the worst.
  const allScores = scored.map((s) => s.score);
  const fitScale = { min: Math.min(...allScores), max: Math.max(...allScores) };

  return { fullAnswers, top, fitScores, fitScale, poolSize: pool.length };
}

// ---------- Lead capture (Firestore, write-only) ----------

let firestoreHandlesPromise = null;

async function getFirestoreHandles() {
  if (!isFirebaseConfigured) return null;
  if (!firestoreHandlesPromise) {
    firestoreHandlesPromise = Promise.all([
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js"),
    ])
      .then(([{ initializeApp }, fs]) => {
        const app = initializeApp(firebaseConfig);
        return { db: fs.getFirestore(app), fs };
      })
      .catch((err) => {
        console.error("[PaddleQuiz] Firebase failed to load — lead was not saved.", err);
        return null;
      });
  }
  return firestoreHandlesPromise;
}

// Keys here must match firestore.rules' isWellFormedLead() answers allowlist
// exactly, or every lead write gets rejected by security rules.
export async function submitLead(email, fullAnswers, recommendedPaddleIds) {
  const handles = await getFirestoreHandles();
  if (!handles) return false;
  const { db, fs } = handles;
  try {
    await fs.addDoc(fs.collection(db, "paddleQuizLeads"), {
      email,
      answers: {
        experience: fullAnswers.experience,
        style: fullAnswers.style,
        current: fullAnswers.current || [],
        shape: fullAnswers.shape,
        sensitivity: fullAnswers.sensitivity,
        weight: fullAnswers.weight,
        twistWeight: fullAnswers.twistWeight,
        tournament: fullAnswers.tournament,
        budget: fullAnswers.budget,
      },
      recommendedPaddleIds,
      createdAt: fs.serverTimestamp(),
    });
    return true;
  } catch (err) {
    console.error("[PaddleQuiz] Failed to save lead.", err);
    return false;
  }
}

// ---------- Wizard UI ----------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// A raw fit score placed on 0–100 against the range this visitor's answers
// actually produced. See computeMatches' fitScale for why the anchors are the
// achieved min/max rather than a theoretical maximum.
//
// This REPLACED an "overall" figure on the pick cards — the mean of the four
// trait ratings — which was a property of the paddle alone and took no account
// of the visitor at all. It contradicted the ranking it sat next to: a balanced
// paddle could show 73.7 "overall" at #3 above a specialist showing 63.7 at #1,
// because the specialist fit the answers better and the headline number wasn't
// measuring fit. Whatever number tops a pick card has to be the number that
// ordered the cards.
export function fitOutOf100(score, scale) {
  if (!scale || typeof score !== "number") return null;
  const span = scale.max - scale.min;
  // Every paddle tied (possible on a narrow pool): they all fit equally, and
  // the honest rendering of that is a full bar, not a divide-by-zero.
  if (span <= 0) return 100;
  return ((score - scale.min) / span) * 100;
}

// Play-style tag modifier, same mapping the browse grid uses (paddle-finder.js)
// so a "Power" chip tints identically on both surfaces. "All-Court" can't go
// into a class name as-is, and the paddles with no paddleType get the "Unrated"
// chip rather than a silently missing row.
const TYPE_MOD = { Power: "power", Control: "control", "All-Court": "allcourt" };

// The "Refine your matches" chips. Each row maps to a quiz answer that already
// feeds the scorer, so toggling a chip re-runs the SAME ranking model against a
// changed answer — never a second, parallel notion of fit. Only the three axes
// a visitor most often wants to nudge after seeing the picks are exposed here;
// tournament/budget/etc. stay as answered (retake to change those). The neutral
// value is what a chip toggles back to, dropping that preference from the rank.
const REFINE = [
  {
    key: "shape",
    label: "Shape",
    neutral: "notsure",
    options: [
      { value: "widebody", label: "Widebody" },
      { value: "elongated", label: "Elongated" },
      { value: "hybrid", label: "Hybrid" },
    ],
  },
  {
    key: "weight",
    label: "Weight",
    neutral: "neutral",
    options: [
      { value: "light", label: "Light" },
      { value: "neutral", label: "Balanced" },
      { value: "heavy", label: "Heavy" },
    ],
  },
  {
    key: "twistWeight",
    label: "Sweet spot",
    neutral: "mid",
    options: [
      { value: "high", label: "Bigger" },
      { value: "mid", label: "Balanced" },
      { value: "low", label: "Precise" },
    ],
  },
];

class PaddleQuizApp {
  constructor(root, paddles, affiliateMap) {
    this.root = root;
    this.paddles = paddles;
    // Optional affiliate overlay (assets/affiliate-map.json). May be null if
    // the fetch failed — vendorLinkFor degrades to plain vendor links.
    this.affiliateMap = affiliateMap || null;
    this.step = 0; // 0..QUESTIONS.length-1 = questions, QUESTIONS.length = email, +1 = results
    this.answers = {};
    this.submitting = false;
    this.root.addEventListener("click", (e) => this.onClick(e));
    this.root.addEventListener("submit", (e) => this.onSubmit(e));
  }

  // opts.focus: after re-rendering, move keyboard focus to the new step's
  // heading so screen-reader and keyboard users land on (and hear) the new
  // question instead of having focus silently reset to the top of the page.
  // Only set on genuine step transitions — never on the initial mount, the
  // multi-select toggle, or the "submitting…" busy re-render.
  render(opts) {
    const isResults = this.step > QUESTIONS.length;
    // The email gate is the site's single biggest conversion cliff — ten
    // questions of effort sunk, then a wall — and nothing measured how many
    // people reach it versus clear it. Fired once per session, not per
    // re-render (a failed validation re-renders this same step).
    if (this.step === QUESTIONS.length && !this.gateSeen) {
      this.gateSeen = true;
      track("quiz_email_gate_reached");
    }
    this.root.classList.toggle("pq-shell--wide", isResults);
    if (this.step < QUESTIONS.length) this.root.innerHTML = this.renderQuestion(QUESTIONS[this.step]);
    else if (this.step === QUESTIONS.length) this.root.innerHTML = this.renderEmailStep();
    else {
      this.root.innerHTML = this.renderResults();
      this.mountCharts();
    }
    if (opts && opts.focus) this.focusHeading();
  }

  // Mount the comparison charts into the results view. Wrapped so a chart
  // failure can never take down the results table below it — the buy links,
  // affiliate disclosure and outbound-click tracking are revenue-critical and
  // must render regardless of whether the (decorative) charts do.
  mountCharts() {
    const el = this.root.querySelector("#pq-charts");
    if (!el || !this.matches || !this.matches.top || !this.matches.top.length) return;
    try {
      renderPaddleCharts(el, {
        paddles: this.paddles,
        featured: this.matches.top.map((m) => m.paddle),
        mode: "quiz",
        answers: this.matches.fullAnswers,
        // The recommendation panel draws from the paddles this quiz actually
        // scored, which the tournament answer narrows. Name that set, so
        // "every other paddle …" and "nothing … costs less" read as claims
        // about the visitor's pool and not about the whole catalog.
        scopeLabel: APPROVAL_SCOPE[this.matches.fullAnswers.tournament === "yes" ? "usap" : this.matches.fullAnswers.tournament] || null,
        // The real scorer's output, handed over rather than re-derived: the
        // per-paddle fit scores the value chart plots against price, on the
        // same 0–100 scale as the pick cards above.
        fitScores: this.matches.fitScores,
        fitScale: this.matches.fitScale,
        // The real ranking model, so the stress-test can re-score these three
        // under altered answers rather than on a parallel trait model.
        scoreWith: scorePaddle,
        // Ordered as the questions get asked: what they cost, then how much of
        // that survives a change of priorities. The "why" is a single sentence
        // under the pick cards (fitScaleNote) rather than a component — the
        // full per-term ledger it used to render repeated the same notes for
        // every pick and buried the two rows that separated them.
        //
        // The axis explorer ("Pick your axes") is deliberately NOT here. It was
        // tried on the results page and taken back off: this page answers "here
        // are your three", and a free-form catalog scatter invites the visitor
        // to re-litigate that from scratch at the moment they should be
        // choosing between the three. /paddles/browse is the surface for going
        // looking yourself — though it no longer carries a chart panel either;
        // comparing two paddles there is now /paddles/browse/compare.
        // Buy links for the recommendations, built with the same vendorLinkFor
        // + affiliate map the pick cards use, so a recommended paddle links
        // exactly as it would anywhere else on the site.
        linkFor: (paddle) => vendorLinkFor(paddle, this.affiliateMap),
        components: ["recommend", "stress"],
      });
    } catch (err) {
      console.error("[PaddleQuiz] Comparison charts failed to render.", err);
      el.remove();
    }
  }

  focusHeading() {
    const h = this.root.querySelector("h2, h3");
    if (!h) return;
    h.setAttribute("tabindex", "-1");
    h.focus({ preventScroll: false });
  }

  renderProgress(stepIndex, total) {
    const dots = Array.from({ length: total }, (_, i) => {
      const cls = i < stepIndex ? "is-done" : i === stepIndex ? "is-current" : "";
      return `<span class="pq-dot ${cls}"></span>`;
    }).join("");
    // The last step is the email/reveal, not a question — so number the
    // questions out of the real question count (matches the "ten quick
    // questions" copy) and call the final step "Last step" rather than "11 of 11".
    const questionCount = total - 1;
    const label = stepIndex < questionCount ? `Question ${stepIndex + 1} of ${questionCount}` : "Last step";
    return `<div class="pq-progress"><span class="pq-progress-label">${label}</span><span class="pq-dots">${dots}</span></div>`;
  }

  renderQuestion(q) {
    const isMulti = q.type === "multi";
    const selectedValues = isMulti ? this.answers[q.key] || [] : null;

    const options = q.options
      .map((opt) => {
        // Single-select questions still need a persisted selected state, not
        // just multi-select ones — otherwise going Back to review or change
        // an earlier answer shows no indication of what was picked, and a
        // careless re-click can silently overwrite it.
        const isSelected = isMulti ? selectedValues.includes(opt.value) : this.answers[q.key] === opt.value;
        const cls = "pq-option" + (isMulti ? " pq-option--multi" : "") + (isSelected ? " is-selected" : "");
        return `
      <button type="button" class="${cls}" data-key="${q.key}" data-value="${opt.value}" data-multi="${isMulti ? "1" : "0"}" aria-pressed="${isSelected}">
        ${isMulti ? `<span class="pq-check ${isSelected ? "is-selected" : ""}">${isSelected ? "✓" : ""}</span>` : ""}
        <span class="pq-option-text">
          <span class="pq-option-label">${opt.label}</span>
          ${opt.hint ? `<span class="pq-option-hint">${opt.hint}</span>` : ""}
        </span>
      </button>`;
      })
      .join("");

    const continueEnabled = !isMulti || selectedValues.length > 0;

    return `
      ${this.renderProgress(this.step, QUESTIONS.length + 1)}
      <h3 class="pq-prompt">${q.prompt}</h3>
      ${q.hint ? `<p class="pq-question-hint">${q.hint}</p>` : ""}
      <div class="pq-options">${options}</div>
      ${isMulti ? `<button type="button" class="btn pq-continue" data-action="continue" ${continueEnabled ? "" : "disabled"}>Continue →</button>` : ""}
      ${this.step > 0 ? `<button type="button" class="pq-back" data-action="back">← Back</button>` : ""}
    `;
  }

  renderEmailStep() {
    return `
      ${this.renderProgress(QUESTIONS.length, QUESTIONS.length + 1)}
      <h3 class="pq-prompt">Where should we send your matches?</h3>
      <p class="pq-email-hint">Enter your email to reveal your top 3 picks. We'll also occasionally send new paddle drops and deals — unsubscribe anytime. See the <a href="/privacy">privacy policy</a>.</p>
      <form class="pq-email-form" data-role="email-form">
        <div class="pq-honeypot" aria-hidden="true">
          <label for="pq-hp">Leave this field blank</label>
          <input type="text" id="pq-hp" name="company" tabindex="-1" autocomplete="off">
        </div>
        <label for="pq-email" class="pq-email-label">Email address</label>
        <input type="email" id="pq-email" name="email" placeholder="you@example.com" required autocomplete="email"${this.emailError ? ' aria-invalid="true" aria-describedby="pq-email-error"' : ""}>
        ${this.emailError ? `<p class="pq-error" id="pq-email-error" role="alert">${this.emailError}</p>` : ""}
        <!-- Back and submit share one row: back left, submit right. The Back
             button lives INSIDE the form here (unlike every other step, where
             it follows the options) so the two can sit on one line — it is
             type="button", so it still cannot submit. -->
        <div class="pq-form-actions">
          <button type="button" class="pq-back" data-action="back">← Back</button>
          <button type="submit" class="btn pq-submit" ${this.submitting ? "disabled" : ""}>
            ${this.submitting ? "Finding your matches…" : "See my top picks →"}
          </button>
        </div>
      </form>
    `;
  }

  renderResults() {
    const top = this.matches.top;

    if (!top.length) {
      return `
        <div class="pq-results-head">
          <p class="eyebrow">Your matches</p>
          <h3 class="pq-prompt">No matches found</h3>
        </div>
        <p class="pq-empty">Try loosening your budget or tournament-legal answer and retake the quiz.</p>
        <button type="button" class="clear-btn pq-retake" data-action="retake">Retake the quiz</button>
      `;
    }

    const links = top.map(({ paddle }) => vendorLinkFor(paddle, this.affiliateMap));
    const anyAffiliate = links.some((l) => l && l.isAffiliate);
    const anyAmazon = links.some((l) => l && l.isAmazon);

    // #1 gets the hero treatment; #2 and #3 the compact "other strong matches"
    // cards below the refine chips. Everything revenue- and compliance-critical
    // is carried over verbatim into buyButton(): the data-pq-* click-attribution
    // attributes (Amazon stopped exposing order-level data in March 2026, so we
    // measure clicks ourselves), the conditional rel="sponsored", and the
    // position on the 1..3 scale GA4 has always collected.
    const hero = this.heroCard(top[0], links[0], 1);
    const others = top.slice(1);
    const othersHtml = others.length
      ? `<h4 class="pq-others-title">Other strong matches</h4>
         <div class="pq-others">${others.map((m, i) => this.otherCard(m, links[i + 1], i + 2)).join("")}</div>`
      : "";

    // Disclosure sits with the buy links and tells the truth for the current
    // state: only claim a commission when at least one pick actually links
    // through an affiliate program. Amazon's Operating Agreement requires the
    // Associates sentence verbatim wherever its links appear; gated on anyAmazon
    // so an all-brand-DTC result set doesn't claim an Amazon tie it doesn't have.
    const amazonNotice = anyAmazon ? " As an Amazon Associate I earn from qualifying purchases." : "";
    const disclosure = anyAffiliate
      ? `<p class="affiliate-disclosure" id="buy">Some paddle links above are affiliate links — we may earn a commission if you buy, at no extra cost to you. It never changes which paddles we recommend or our court data.${amazonNotice} <a href="/affiliate-disclosure">How this works</a>.</p>`
      : `<p class="affiliate-disclosure" id="buy">These links go straight to each brand's own site — we don't earn a commission from them today. If that changes, we'll say so right here and on our <a href="/affiliate-disclosure">disclosure page</a>.</p>`;

    return `
      <div class="pq-results-head">
        <p class="eyebrow">Your matches</p>
        <h3 class="pq-prompt">Your top ${top.length === 1 ? "match" : `${top.length} picks`}</h3>
      </div>
      ${hero}
      ${this.refineBar()}
      ${othersHtml}
      ${this.fitScaleNote(top)}
      ${disclosure}
      <div id="pq-charts"></div>
      <button type="button" class="clear-btn pq-retake" data-action="retake">Retake the quiz</button>
    `;
  }

  // The outbound buy link, with every attribute the click tracker and the
  // affiliate disclosure depend on. Shared by the hero (twice — top and foot)
  // and the other-match cards so the rel, the data-pq-* payload and the "list"
  // price framing can never drift between them. `position` is on the 1..3 scale,
  // not a per-section index — see cardHtml's note in paddle-finder.js.
  buyButton(paddle, link, position, cls) {
    if (!link) return "";
    const rel = link.isAffiliate ? "sponsored nofollow noopener" : "nofollow noopener";
    const data = [
      `data-pq-paddle="${escapeAttr(paddle.id)}"`,
      `data-pq-brand="${escapeAttr(paddle.brand)}"`,
      `data-pq-link-type="${escapeAttr(link.linkType || "unknown")}"`,
      `data-pq-affiliate="${link.isAffiliate ? "1" : "0"}"`,
      `data-pq-surface="quiz"`,
      `data-pq-position="${position}"`,
    ].join(" ");
    return `<a class="${cls}" href="${link.href}" target="_blank" rel="${rel}" ${data}>${link.label} →<span class="visually-hidden"> — ${escapeAttr(paddle.brand)} ${escapeAttr(paddle.name)} (opens in new tab)</span></a>`;
  }

  // Play-style / shape / skill chips, mirroring the browse grid's tag row.
  tagsFor(paddle) {
    const type = paddle.paddleType || "Unrated";
    return [
      `<span class="pq-tag pq-tag--${TYPE_MOD[type] || "unrated"}">${escapeAttr(type)}</span>`,
      paddle.shape ? `<span class="pq-tag">${escapeAttr(paddle.shape)}</span>` : "",
      paddle.skillLevel ? `<span class="pq-tag">${escapeAttr(paddle.skillLevel)}</span>` : "",
    ].join("");
  }

  // "Why this is your match" — the two highest-scoring answer-driven terms for
  // THIS pick, printed as their own notes. Reads off the same scoreTerms the
  // ranking summed, so the explanation can't drift from the order. The generic
  // "traits" term is dropped: it's the largest on every paddle and says nothing
  // specific to the visitor, so leading with it would bury the real reasons.
  whyList(pick) {
    const specific = pick.terms
      .filter((t) => t.key !== "traits" && t.points > 0)
      .sort((a, b) => b.points - a.points)
      .slice(0, 2);
    if (!specific.length) return "";
    return `<ul class="pq-why-list">${specific
      .map((t) => `<li><span class="pq-why-term">${escapeAttr(t.label)}.</span> ${escapeAttr(t.note)}</li>`)
      .join("")}</ul>`;
  }

  // The compliant at-a-glance panel: bars positioned by the banded percentile
  // plus a tier word, NEVER the proprietary number (PADDLE_DATA_SETUP.md). Only
  // the real manufacturer specs below it — weight, core, grip — are printed as
  // figures. miniBars is the same renderer the browse cards use.
  statPanel(paddle) {
    if (!hasLab(paddle)) {
      return `<p class="pq-nolab">Not lab-tested yet — showing manufacturer specs only.</p>`;
    }
    const rows = miniBars(paddle, { control: controlRating })
      .map(
        (b) => `<div class="pq-stat">
          <span class="pq-stat-label">${escapeAttr(b.label)}</span>
          <span class="pq-stat-track"><span class="pq-stat-fill pq-stat-fill--${escapeAttr(b.key)}" style="width:${Math.round(b.v * 100)}%"></span></span>
          <span class="pq-stat-word">${escapeAttr(b.word)}</span>
        </div>`
      )
      .join("");
    return `<div class="pq-stats">${rows}</div>`;
  }

  specsRow(paddle) {
    const specs = [
      paddle.coreThicknessMm != null ? `${paddle.coreThicknessMm}mm core` : null,
      paddle.weightOz != null ? `${paddle.weightOz} oz` : null,
      paddle.gripLengthIn != null ? `${paddle.gripLengthIn}" handle` : null,
      paddle.gripSizeIn != null ? `${paddle.gripSizeIn}" grip` : null,
    ].filter(Boolean);
    return specs.length ? `<p class="pq-hero-specs">${escapeAttr(specs.join(" · "))}</p>` : "";
  }

  // The #1 pick — a full-width card with the primary CTA repeated top and foot,
  // the fit figure paired with the list price, the honest "why", and the
  // at-a-glance panel. Its top rule is --bay rather than the series color the
  // other cards carry: the hero is THE match, not one series among three.
  heroCard(pick, link, position) {
    const { paddle, dims, score } = pick;
    const fit = fitOutOf100(score, this.matches.fitScale);
    return `
      <article class="pq-hero-pick">
        <p class="pq-hero-ribbon"><span aria-hidden="true">🏆</span> Your #1 match</p>
        <p class="pq-hero-brand">${escapeAttr(paddle.brand)}</p>
        <h4 class="pq-hero-name">${escapeAttr(paddle.name)}</h4>
        <div class="pq-hero-tags">${this.tagsFor(paddle)}</div>
        <div class="pq-hero-meta">
          <span class="pq-hero-price">${paddle.price != null ? `$${paddle.price}` : "—"}<span class="pq-hero-price-note">list</span></span>
          <span class="pq-hero-fit">${fit == null ? "—" : Math.round(fit)}<span class="pq-hero-fit-note">fit</span></span>
        </div>
        ${this.buyButton(paddle, link, position, "book-btn pq-hero-buy")}
        <div class="pq-hero-why">
          <h5 class="pq-hero-sub">Why this is your match</h5>
          <p class="pq-hero-lead">${escapeAttr(taglineFor(dims))}.</p>
          ${this.whyList(pick)}
        </div>
        <div class="pq-hero-glance">
          <h5 class="pq-hero-sub">The paddle at a glance</h5>
          ${this.statPanel(paddle)}
          ${this.specsRow(paddle)}
        </div>
        ${this.buyButton(paddle, link, position, "book-btn pq-hero-buy pq-hero-buy--foot")}
      </article>`;
  }

  // #2 and #3 — the compact card that carries over the old pick styling, plus a
  // tag row and the paddle's one-line lean. Keeps the series-color top rule so
  // it reads as the same paddle as its dot on the charts below. `position` is
  // its true rank (2 or 3); the 0-based series index is position-1.
  otherCard(pick, link, position) {
    const { paddle, dims, score } = pick;
    const fit = fitOutOf100(score, this.matches.fitScale);
    return `
      <div class="pq-pick" style="--pick:${seriesColorFor(position - 1)}">
        <div class="pq-pick-top">
          <span class="rank-badge">#${position}</span>
          <span class="pq-pick-overall">${fit == null ? "—" : Math.round(fit)}<span class="pq-pick-overall-label">fit</span></span>
        </div>
        <h4 class="pq-pick-name">${escapeAttr(paddle.name)}</h4>
        <p class="pq-pick-sub">${escapeAttr(paddle.brand)}${paddle.price != null ? ` · $${paddle.price} list` : ""}</p>
        <div class="pq-hero-tags pq-pick-tags">${this.tagsFor(paddle)}</div>
        <p class="pq-pick-tag">${escapeAttr(taglineFor(dims))}</p>
        ${this.buyButton(paddle, link, position, "book-btn pq-pick-buy")}
      </div>`;
  }

  // "Refine your matches" — the reference design's live re-rank, mapped onto the
  // quiz answers that already feed the scorer. Each chip shows whether its value
  // is the current answer; clicking one is handled by refine() below.
  refineBar() {
    const groups = REFINE.map((g) => {
      const cur = this.answers[g.key];
      const chips = g.options
        .map((o) => {
          const on = cur === o.value;
          return `<button type="button" class="pq-refine-chip${on ? " is-on" : ""}" data-refine-key="${escapeAttr(g.key)}" data-refine-value="${escapeAttr(o.value)}" aria-pressed="${on}">${escapeAttr(o.label)}</button>`;
        })
        .join("");
      return `<div class="pq-refine-row">
          <span class="pq-refine-label">${escapeAttr(g.label)}</span>
          <div class="pq-refine-chips">${chips}</div>
        </div>`;
    }).join("");
    return `<section class="pq-refine" aria-label="Refine your matches">
        <h4 class="pq-refine-title">Refine your matches</h4>
        <p class="pq-refine-note">Nudge a preference and your picks re-rank instantly — no retake, same email.</p>
        ${groups}
      </section>`;
  }

  // Re-score the whole catalog against the changed answer and re-paint the
  // results. Clicking the already-active chip toggles the axis back to its
  // neutral value, dropping that preference from the rank. computeMatches is the
  // exact model the quiz submitted with, so a refine is a real re-ranking, not a
  // second opinion. No new lead is written — the email was captured at submit,
  // and refining is exploration on top of it.
  refine(key, value) {
    const group = REFINE.find((g) => g.key === key);
    if (!group) return;
    const next = this.answers[key] === value ? group.neutral : value;
    this.answers[key] = next;
    this.matches = computeMatches(this.paddles, this.answers);
    track("quiz_refine", { axis: key, value: next, top_paddle: this.matches.top[0] ? this.matches.top[0].paddle.id : "none" });
    this.render();
    // The re-render destroyed the chip that was clicked, so keyboard focus would
    // otherwise fall to <body> and the next Tab restart the document. Land on the
    // chip that now reflects this axis (the newly-active one), or the clicked one
    // when the axis went neutral and has no chip to light.
    const sel = `.pq-refine-chip[data-refine-key="${key}"]`;
    const chip =
      this.root.querySelector(`${sel}[data-refine-value="${next}"]`) ||
      this.root.querySelector(`${sel}[data-refine-value="${value}"]`);
    if (chip) chip.focus();
  }

  // Plain-language names for the score terms, for the one-line explanation
  // below. The term labels themselves read fine as headings but not mid-
  // sentence ("ahead on what the paddle is").
  static TERM_PHRASE = {
    traits: "all-round traits",
    feel: "the feel you asked for",
    budget: "your budget",
    style: "your style of play",
    want_power: "the power you wanted",
    want_spin: "the spin you wanted",
    want_sweet: "sweet-spot size",
    want_light: "swing weight",
    want_arm: "arm-friendliness",
    shape: "the shape you asked for",
    arm_forgive: "forgiveness",
    arm_feel: "how soft the face is",
    arm_light: "being light enough to spare your arm",
    level: "sweet-spot size for your level",
  };

  // One sentence naming what actually decided the order, derived from the same
  // scoreTerms the ranking summed.
  //
  // This replaced a full per-pick ledger — every term, with an explanatory note,
  // for all three picks. It was unusable: the notes for shared terms are
  // identical by construction, so on a typical result four fifths of the card
  // was the same three paragraphs printed three times, and picks tied on score
  // rendered as two byte-identical breakdowns. Showing the whole calculation
  // buried the two or three rows that actually separated anything.
  differenceSentence(top) {
    const lead = top[0];
    // The first pick that did NOT tie the leader — comparing against a tied
    // pick would produce a sentence about a difference of zero.
    const other = top.find((t) => t.score !== lead.score);
    if (!other) return "";
    const gap = lead.score - other.score;
    const mapOf = (t) => new Map(t.terms.map((x) => [x.key, x]));
    const a = mapOf(lead);
    const b = mapOf(other);
    const diffs = [];
    for (const key of new Set([...a.keys(), ...b.keys()])) {
      const pa = a.get(key) ? a.get(key).points : 0;
      const pb = b.get(key) ? b.get(key).points : 0;
      if (pa !== pb) diffs.push({ key, delta: pb - pa }); // from the runner-up's side
    }
    if (!diffs.length) return "";
    diffs.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
    const ahead = diffs.find((d) => d.delta > 0);
    const behind = diffs.find((d) => d.delta < 0);
    const phrase = (d) => PaddleQuizApp.TERM_PHRASE[d.key] || "its other scores";

    // Quoted in FIT points, not raw score points. The raw scale is internal and
    // arbitrary (it was multiplied by 10 when the traits went continuous — see
    // toDots), so "finished 10 points back" would be a number the visitor can't
    // reconcile with anything on the page. Fit is the 0–100 the cards show.
    const scale = this.matches && this.matches.fitScale;
    const gapFit = Math.round(fitOutOf100(lead.score, scale) - fitOutOf100(other.score, scale));
    let s = gapFit <= 0
      ? `${other.paddle.name} came in just behind`
      : `${other.paddle.name} finished ${gapFit} fit ${gapFit === 1 ? "point" : "points"} back`;
    if (ahead) s += `, ahead on ${phrase(ahead)}`;
    if (behind) {
      // The old skill-tag special case ("tagged intermediate rather than
      // advanced") went with the tag match it described — there is no tag
      // comparison left to name, only a smaller sweet spot.
      s += `${ahead ? " but" : ","} behind on ${phrase(behind)}`;
    }
    return s + ".";
  }

  // Says what the number on the cards means, and — when the picks tie — says so
  // out loud. Ties are the norm here rather than an edge case, because the
  // ratings were bucketed into three values, so all three picks landed on an
  // identical raw score in about 39% of sampled answer sets, ordered only by
  // the tiebreak. Three cards reading 100 / 100 / 100 under ranks #1 / #2 / #3
  // looks broken unless the page admits the ranking between them is arbitrary.
  //
  // The 2026-07-18 refresh (20-band data plus a continuous scorer) cut that to
  // about 1%, so this is now genuinely the edge case its name suggests — but it
  // still fires, and it is still the useful thing to say when it does: stop
  // optimising and choose on feel or price.
  fitScaleNote(top) {
    const scaleSentence =
      "<strong>Fit</strong> is out of 100, where 100 is the best-fitting paddle in the catalog for your answers and 0 the worst.";
    // Count the LEADING tie group, not just an all-three tie. Two picks sharing
    // the top score is the case that most changes what the visitor should do —
    // it means the "best match" badge was awarded by tiebreak — and it happens
    // far more often than a clean sweep.
    let tied = 1;
    while (tied < top.length && top[tied].score === top[0].score) tied++;
    const parts = [];
    if (tied > 1) {
      const words = { 2: "two", 3: "three" };
      const which = tied === top.length ? `All ${words[top.length] || top.length}` : `The top ${words[tied] || tied}`;
      parts.push(`${which} scored <strong>identically</strong> against your answers — the order between them is only a tiebreak, so treat them as equals and choose on feel, price or looks.`);
    }
    const diff = this.differenceSentence(top);
    if (diff) parts.push(escapeAttr(diff));
    parts.push(scaleSentence);
    return `<p class="pq-fit-note">${parts.join(" ")}</p>`;
  }

  toggleMulti(key, value) {
    const q = QUESTIONS[this.step];
    const cur = this.answers[key] || [];
    const optDef = q.options.find((o) => o.value === value);
    let next;
    if (optDef && optDef.exclusive) {
      next = cur.includes(value) ? [] : [value];
    } else if (cur.includes(value)) {
      next = cur.filter((v) => v !== value);
    } else {
      const withoutExclusive = cur.filter((v) => {
        const d = q.options.find((o) => o.value === v);
        return !(d && d.exclusive);
      });
      next = withoutExclusive.concat([value]);
    }
    this.answers[key] = next;
    this.render();
  }

  // One event per answered question, carrying the step index and the question
  // key — enough to build a drop-off curve and see WHICH question loses people,
  // which is the thing worth knowing. The answer value goes along because it's
  // a fixed enum from QUESTIONS, not free text.
  trackAnswer(key, value) {
    if (!this.started) {
      this.started = true;
      track("quiz_start");
    }
    track("quiz_answer", { question_key: key, question_index: this.step + 1, answer: String(value).slice(0, 60) });
  }

  onClick(e) {
    const opt = e.target.closest(".pq-option[data-key]");
    if (opt) {
      if (opt.dataset.multi === "1") {
        this.toggleMulti(opt.dataset.key, opt.dataset.value);
      } else {
        this.answers[opt.dataset.key] = opt.dataset.value;
        this.trackAnswer(opt.dataset.key, opt.dataset.value);
        this.step += 1;
        this.render({ focus: true });
      }
      return;
    }
    const cont = e.target.closest('[data-action="continue"]');
    if (cont) {
      if (cont.disabled) return;
      const q = QUESTIONS[this.step];
      if (q) this.trackAnswer(q.key, (this.answers[q.key] || []).join(","));
      this.step += 1;
      this.render({ focus: true });
      return;
    }
    const back = e.target.closest('[data-action="back"]');
    if (back) {
      track("quiz_back", { from_index: this.step + 1 });
      this.step = Math.max(0, this.step - 1);
      this.emailError = null;
      this.render({ focus: true });
      return;
    }
    const refineChip = e.target.closest("[data-refine-key]");
    if (refineChip) {
      this.refine(refineChip.dataset.refineKey, refineChip.dataset.refineValue);
      return;
    }
    const retake = e.target.closest('[data-action="retake"]');
    if (retake) {
      track("quiz_retake");
      this.step = 0;
      this.answers = {};
      this.emailError = null;
      this.render({ focus: true });
    }
  }

  async onSubmit(e) {
    const form = e.target.closest('[data-role="email-form"]');
    if (!form) return;
    e.preventDefault();
    if (this.submitting) return;

    if (form.company.value) return; // honeypot tripped — silently drop

    const email = form.email.value.trim();
    if (!EMAIL_RE.test(email)) {
      // Never the address itself — only that one bounced. A validation loop
      // people can't escape looks identical to disinterest in the funnel.
      track("quiz_email_invalid");
      this.emailError = "That doesn't look like a valid email — mind double-checking it?";
      this.render();
      // Send focus back to the field so the (role="alert") error is heard and
      // the user can correct it without hunting for the input.
      const field = this.root.querySelector("#pq-email");
      if (field) field.focus();
      return;
    }

    this.submitting = true;
    this.emailError = null;
    this.render();

    this.matches = computeMatches(this.paddles, this.answers);
    const recommendedPaddleIds = this.matches.top.map((m) => m.paddle.id);
    const saved = await submitLead(email, this.matches.fullAnswers, recommendedPaddleIds);

    // A silently failing lead write is the worst outcome the quiz has: the
    // visitor sees their results and we lose the only thing we asked them for.
    // It was console.error-only, which nobody reads on a production site.
    track("quiz_completed", {
      lead_saved: saved ? 1 : 0,
      top_paddle: recommendedPaddleIds[0] || "none",
      result_count: this.matches.top.length,
    });

    this.submitting = false;
    this.step += 1;
    this.render({ focus: true });
  }
}


document.addEventListener("DOMContentLoaded", async () => {
  // Bound before the mount guard, and delegated on document, so it covers every
  // buy link on the page. Binding it after the guard would tie revenue
  // attribution to the quiz mount happening to exist, which is an invisible way
  // to go blind.
  //
  // It used to also cover assets/paddle-grid.js, which this page loaded as a
  // second module; the grid was replaced by assets/paddle-finder.js on
  // /paddles/browse and nothing mounts it any more, so that script tag is gone
  // and this page is the quiz alone. trackVendorClicks() is idempotent, and
  // every surface now binds its own (finder, detail, compare, quiz).
  trackVendorClicks();
  const root = document.getElementById("paddle-quiz-app");
  if (!root) return;
  try {
    // The affiliate overlay is optional chrome on top of the required paddle
    // data — a missing/broken map must not break the quiz, so it's fetched
    // alongside but swallowed independently (falls back to plain links).
    const [paddles, affiliateMap] = await Promise.all([
      fetch("/assets/paddles.json").then((r) => r.json()),
      // Revalidate the affiliate overlay rather than serve a stale copy — it's
      // a tiny file, and a stale one would keep showing old (or missing) buy
      // links after the vendor map is updated and redeployed.
      fetch("/assets/affiliate-map.json", { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    new PaddleQuizApp(root, paddles, affiliateMap).render();
  } catch (err) {
    console.error("[PaddleQuiz] Failed to load paddle data.", err);
    root.innerHTML = `<p class="pq-error">Couldn't load the paddle database right now — try refreshing the page.</p>`;
  }
});
