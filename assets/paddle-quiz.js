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
import { clamp01, isSoftImpact, powerRating, controlRating, spinRatingOf, forgivenessRatingOf, tiebreak } from "/assets/paddle-ratings.js";

// The results-page comparison visualizations (Top 3 strip + axis explorer +
// value chart + priority stress-test). Its own module so the same components
// can serve the browse view once it has a selection model — see
// assets/paddle-charts.js and design_handoff_paddle_comparison/README.md.
import { renderPaddleCharts, seriesColorFor } from "/assets/paddle-charts.js";

// dom-utils.js (a plain script, loaded before this module on every page that
// mounts the quiz — see its header) owns the single escapeHtml definition.
// Reuse it rather than adding the N+1th copy this codebase already audited away.
const escapeAttr = (s) => window.PBUtils.escapeHtml(s);

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
  {
    key: "frequency",
    prompt: "How often do you get on the court?",
    options: [
      { value: "rarely", label: "A few times a year", hint: "Casual, social games here and there" },
      { value: "weekly", label: "Weekly", hint: "A regular game or two most weeks" },
      { value: "frequent", label: "A few times a week", hint: "Pickleball is a real part of your routine" },
      { value: "daily", label: "Daily / competitive", hint: "You train, drill, and play tournaments" },
    ],
  },
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
    prompt: "Do you need it tournament-legal?",
    options: [
      { value: "yes", label: "Yes — USAP approved", hint: "Required for USA Pickleball–sanctioned tournaments" },
      { value: "no", label: "No, just recreational play", hint: "" },
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

// Null (not a flat top score) when the visitor said price isn't a factor: a
// constraint they don't have shouldn't earn every paddle three dots of
// "budget fit" it did nothing to deserve. The row is dropped from the table
// and the term from the ranking instead — see dimRow and totalScore.
function budgetScore(paddle, budgetPref) {
  const r = BUDGET_RANGES[budgetPref];
  if (!r) return null;
  return trapezoid(paddle.price, r[0], r[1], 80);
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

function isTournamentLegal(paddle) {
  return paddle.approvalBody === "USAP" || paddle.approvalBody === "USAP/UPA-A";
}



// ---------- Comparison-table dimension ratings ----------
//
// Unlike the scoring below (which is conditioned on the visitor's answers,
// to rank paddles against each other), these are fixed, absolute per-paddle
// profiles — every result shows all 4 axes regardless of what the visitor
// picked, so the comparison table actually shows how the 3 picks differ
// rather than just confirming the one thing they asked for. Deliberately
// paraphrased into a dot rating rather than citing the exact proprietary
// lab-tested labels/percentiles those numbers come from.





function toDots(score) {
  if (score == null) return null; // A dimension the visitor's answers took out of play.
  if (score >= 0.7) return 3;
  if (score >= 0.4) return 2;
  return 1;
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

const SKILL_LEVELS = ["Beginner", "Intermediate", "Advanced"];

// An exact match to the visitor's stated level is worth more than the
// typical 1-2 point gap between skill tiers on raw dot totals (Advanced-
// tagged paddles trade away forgiveness dots for specialization, so without
// a large-enough bonus here, "Advanced" tags would never surface for
// advanced players — the raw stat sum would always favor the more
// forgiving, easier-rated paddle regardless of who's asking). "Pro" maps
// onto the same "Advanced" tier as "advanced" for matching purposes — the
// data doesn't tag a separate Pro tier, and pretending it does would be
// inventing precision the dataset can't back up. One step off (e.g. an
// Intermediate paddle for a Beginner) gets a small nod; the opposite end of
// the spectrum gets nothing.
function skillMatchScore(paddleSkillLevel, experience) {
  const userLevel = experience === "beginner" ? "Beginner" : experience === "intermediate" ? "Intermediate" : "Advanced";
  const distance = Math.abs(SKILL_LEVELS.indexOf(paddleSkillLevel) - SKILL_LEVELS.indexOf(userLevel));
  if (distance === 0) return 4;
  if (distance === 1) return 1;
  return 0;
}

const SHAPE_MAP = { widebody: "Widebody", elongated: "Elongated", hybrid: "Hybrid" };

// The rank is a plain sum of the exact dots/badges shown in the table — no
// hidden weighting formula a viewer couldn't reconstruct themselves by
// counting circles on screen — plus a small set of named bonuses for
// answers that aren't shown as their own row (style, current-paddle gripes,
// shape, arm sensitivity, play frequency). The visitor's stated style
// counts its one matching dimension double, since that's the thing they
// explicitly said matters most; a paddle tagged for the visitor's exact
// stated skill level gets its own (larger) bonus — see skillMatchScore for
// why it needs more than a simple double to actually move the needle.
// Every dot term is a non-negative integer, so a paddle that's
// equal-or-better on every shown dimension (and strictly better on at
// least one) always scores strictly higher, full stop. A null dim (only
// budgetFit today, on a "no budget" answer) contributes 0 to every paddle
// alike, so dropping it can't reorder anything.
function totalScore(dims, a) {
  let score =
    dims.power + dims.control + dims.spin + dims.forgiveness + dims.weightFit + dims.twistWeightFit + (dims.budgetFit || 0);

  if (a.style === "power") score += dims.power;
  else if (a.style === "spin") score += dims.spin;
  else if (a.style === "soft") score += dims.control;
  // "allround" adds nothing on purpose — no lean is the point.

  if (Array.isArray(a.current)) {
    if (a.current.includes("more_power")) score += dims.power;
    if (a.current.includes("more_spin")) score += dims.spin;
    if (a.current.includes("more_forgiveness")) score += dims.forgiveness;
    if (a.current.includes("less_weight")) score += dims.lightness;
    if (a.current.includes("less_arm_strain")) score += dims.forgiveness + (dims.softImpact ? 1 : 0);
  }

  if (a.shape && a.shape !== "notsure") {
    const want = SHAPE_MAP[a.shape];
    if (dims.shape === want) score += 3;
    // A Hybrid paddle is a reasonable middle-ground fallback when the
    // visitor wanted one of the two extremes (widebody/elongated) — but if
    // they asked for Hybrid specifically, a non-Hybrid paddle isn't a
    // meaningful "close enough," so this bonus shouldn't apply in that
    // direction (that would flatten every other shape to the same score).
    else if (dims.shape === "Hybrid" && want !== "Hybrid") score += 1;
    else if (a.shape === "elongated" && dims.shape === "Extra-elongated") score += 2;
  }

  if (a.sensitivity === "sensitive") {
    score += dims.forgiveness;
    score += dims.softImpact ? 2 : -1;
    if (dims.weightOz != null && dims.weightOz <= 7.6) score += 1;
  } else if (a.sensitivity === "mild") {
    score += dims.softImpact ? 1 : 0;
  }

  if ((a.frequency === "daily" || a.frequency === "frequent") && dims.skillLevel === "Advanced") score += 1;
  if (a.frequency === "rarely") score += dims.forgiveness;

  score += skillMatchScore(dims.skillLevel, a.experience);

  return score;
}

export function computeMatches(paddles, answers) {
  const fullAnswers = { ...answers };
  const pool = (answers.tournament === "yes" ? paddles.filter(isTournamentLegal) : paddles).filter((p) => p.price != null);

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
  const top = scored.slice(0, 3).map(({ paddle, dims }) => ({ paddle, dims }));

  return { fullAnswers, top };
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
        frequency: fullAnswers.frequency,
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

// The transparent overall score the value chart (assets/paddle-charts.js) uses:
// the mean of the four trait ratings on 0–100. Shown on each results pick card
// so the headline figure there matches the same paddle's dot on 2b below.
function overallScoreOf(paddle) {
  return ((powerRating(paddle) + controlRating(paddle) + spinRatingOf(paddle) + forgivenessRatingOf(paddle)) / 4) * 100;
}

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
        // The axis explorer (2a) now lives only on /paddles/browse; the results
        // page keeps the value chart and the stress-test.
        components: ["value", "stress"],
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
        <button type="submit" class="btn pq-submit" ${this.submitting ? "disabled" : ""}>
          ${this.submitting ? "Finding your matches…" : "See my top picks →"}
        </button>
        ${this.emailError ? `<p class="pq-error" id="pq-email-error" role="alert">${this.emailError}</p>` : ""}
      </form>
      <button type="button" class="pq-back" data-action="back">← Back</button>
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

    // Buy-first result cards — the call to action at the very TOP of the
    // results (the trait comparison table these replaced is gone). Each card's
    // accent is the paddle's series color, so it matches the same paddle's dot
    // on the value and stress-test charts below. Everything revenue- and
    // compliance-critical is carried over verbatim from the old table: the
    // data-pq-* click-attribution attributes (Amazon stopped exposing
    // order-level data in March 2026, so we measure clicks ourselves), the
    // conditional rel="sponsored", and the disclosure branches.
    //
    // The "list" suffix on the price is load-bearing. paddles.json's price is
    // the manufacturer's list price (PADDLE_DATA_SETUP.md treats it as a raw
    // manufacturer fact), and retailers routinely sell under it. Amazon's real
    // price can't be shown instead (the Operating Agreement only permits prices
    // from the Product Advertising API, which this site has no access to), so
    // label whose price it is rather than imply it's what the visitor will pay.
    const cards = top
      .map(({ paddle, dims }, i) => {
        const link = links[i];
        const rankBadge = i === 0 ? `<span class="rank-badge top">Best match</span>` : `<span class="rank-badge">#${i + 1}</span>`;
        let buy = "";
        if (link) {
          const rel = link.isAffiliate ? "sponsored nofollow noopener" : "nofollow noopener";
          const data = [
            `data-pq-paddle="${escapeAttr(paddle.id)}"`,
            `data-pq-brand="${escapeAttr(paddle.brand)}"`,
            `data-pq-link-type="${escapeAttr(link.linkType || "unknown")}"`,
            `data-pq-affiliate="${link.isAffiliate ? "1" : "0"}"`,
            `data-pq-surface="quiz"`,
            `data-pq-position="${i + 1}"`,
          ].join(" ");
          buy = `<a class="book-btn pq-pick-buy" href="${link.href}" target="_blank" rel="${rel}" ${data}>${link.label} →<span class="visually-hidden"> — ${escapeAttr(paddle.brand)} ${escapeAttr(paddle.name)} (opens in new tab)</span></a>`;
        }
        return `
        <div class="pq-pick" style="--pick:${seriesColorFor(i)}">
          <div class="pq-pick-top">
            ${rankBadge}
            <span class="pq-pick-overall">${overallScoreOf(paddle).toFixed(1)}<span class="pq-pick-overall-label">overall</span></span>
          </div>
          <h3 class="pq-pick-name">${paddle.name}</h3>
          <p class="pq-pick-sub">${paddle.brand}${paddle.price != null ? ` · $${paddle.price} list` : ""}</p>
          <p class="pq-pick-tag">${taglineFor(dims)}</p>
          ${buy}
        </div>`;
      })
      .join("");

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
        <h3 class="pq-prompt">Your top 3 picks</h3>
      </div>
      <div class="pq-picks">${cards}</div>
      ${disclosure}
      <div id="pq-charts"></div>
      <button type="button" class="clear-btn pq-retake" data-action="retake">Retake the quiz</button>
    `;
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

  onClick(e) {
    const opt = e.target.closest(".pq-option[data-key]");
    if (opt) {
      if (opt.dataset.multi === "1") {
        this.toggleMulti(opt.dataset.key, opt.dataset.value);
      } else {
        this.answers[opt.dataset.key] = opt.dataset.value;
        this.step += 1;
        this.render({ focus: true });
      }
      return;
    }
    const cont = e.target.closest('[data-action="continue"]');
    if (cont) {
      if (cont.disabled) return;
      this.step += 1;
      this.render({ focus: true });
      return;
    }
    const back = e.target.closest('[data-action="back"]');
    if (back) {
      this.step = Math.max(0, this.step - 1);
      this.emailError = null;
      this.render({ focus: true });
      return;
    }
    const retake = e.target.closest('[data-action="retake"]');
    if (retake) {
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
    await submitLead(email, this.matches.fullAnswers, recommendedPaddleIds);

    this.submitting = false;
    this.step += 1;
    this.render({ focus: true });
  }
}


document.addEventListener("DOMContentLoaded", async () => {
  // Bound before the mount guard, and delegated on document, so it covers every
  // buy link on the page — the quiz's results AND the browsable grid's cards
  // (assets/paddle-grid.js emits the same data-pq-* attributes). Binding it
  // after the guard would have tied the grid's revenue attribution to the quiz
  // mount happening to exist, which is an invisible way to go blind. One
  // listener, one event per click — the grid deliberately does not bind its own.
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
