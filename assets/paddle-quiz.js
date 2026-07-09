// Find your paddle — a short wizard that scores every paddle in
// assets/paddles.json against the visitor's answers, shows their top 3
// matches as a side-by-side comparison, and captures an email as a lead
// (Firestore, write-only — see firestore.rules `paddleQuizLeads`).
//
// Mounts into <div id="paddle-quiz-app"> on paddle-quiz.html. No framework —
// a small class re-renders its own root on each step, matching the rest of
// this site's hand-rolled JS (nav.js, global-search.js, directory.js).

import { firebaseConfig, isFirebaseConfigured } from "/assets/firebase-config.js";

const QUESTIONS = [
  {
    key: "experience",
    prompt: "How would you describe your level?",
    options: [
      { value: "beginner", label: "Beginner", hint: "New to the game, or under ~6 months in" },
      { value: "intermediate", label: "Intermediate", hint: "Comfortable rallying, working on strategy (roughly 3.0–3.5)" },
      { value: "advanced", label: "Advanced", hint: "Competitive league or tournament play (4.0+)" },
    ],
  },
  {
    key: "priority",
    prompt: "What do you want more of on the court?",
    options: [
      { value: "power", label: "Power", hint: "More pace on drives and put-aways" },
      { value: "control", label: "Control & touch", hint: "Soft hands at the kitchen — dinks, resets, placement" },
      { value: "spin", label: "Spin", hint: "Heavy topspin or slice to move the ball around" },
      { value: "allcourt", label: "A bit of everything", hint: "No strong preference — keep it balanced" },
    ],
  },
  {
    key: "weight",
    prompt: "Preferred paddle weight?",
    options: [
      { value: "light", label: "Lightweight", hint: "Quicker hands at the net, less arm fatigue (≈7.5oz or under)" },
      { value: "mid", label: "Middleweight", hint: "Balanced feel (≈7.6–8.2oz)" },
      { value: "heavy", label: "Heavier", hint: "More mass behind the ball (8.3oz+)" },
      { value: "nopref", label: "No preference", hint: "" },
    ],
  },
  {
    key: "budget",
    prompt: "What's your budget?",
    options: [
      { value: "budget", label: "Under $150", hint: "" },
      { value: "mid", label: "$150–220", hint: "" },
      { value: "premium", label: "$220+", hint: "" },
      { value: "nopref", label: "No preference", hint: "Just show me the top 3 overall" },
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
];

function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

// 1 inside [min, max], decaying linearly to 0 over `falloff` outside either edge.
function trapezoid(value, min, max, falloff) {
  if (value == null) return 0.5;
  if (value >= min && value <= max) return 1;
  if (value < min) return clamp01(1 - (min - value) / falloff);
  return clamp01(1 - (value - max) / falloff);
}

function weightPrefScore(paddle, weightPref) {
  const w = paddle.weightOz;
  if (weightPref === "nopref") return 1;
  if (weightPref === "light") return trapezoid(w, 0, 7.5, 0.6);
  if (weightPref === "mid") return trapezoid(w, 7.6, 8.2, 0.6);
  return trapezoid(w, 8.3, 20, 0.6); // heavy
}

function budgetScore(paddle, budgetPref) {
  const price = paddle.price;
  if (budgetPref === "nopref") return 1;
  if (budgetPref === "budget") return trapezoid(price, 0, 150, 80);
  if (budgetPref === "mid") return trapezoid(price, 150, 220, 60);
  return trapezoid(price, 220, 400, 80); // premium
}

function isTournamentLegal(paddle) {
  return paddle.approvalBody === "USAP" || paddle.approvalBody === "USAP/UPA-A";
}

// vendorSearchBase is only set for brands whose on-site search was directly
// verified to return real product results (see assets/paddles.json prep
// script) — for the rest, link to the vendor's site itself rather than
// guess at a search URL that might 404.
function vendorLinkFor(paddle) {
  if (paddle.vendorSearchBase) {
    return { href: paddle.vendorSearchBase + encodeURIComponent(paddle.name), label: `Search ${paddle.brand}` };
  }
  if (paddle.vendorUrl) {
    return { href: paddle.vendorUrl, label: `Visit ${paddle.brand}` };
  }
  return null;
}

// ---------- Comparison-table dimension ratings ----------
//
// Unlike the scoring above (which is conditioned on the user's stated
// priority, to rank paddles against each other), these are fixed, absolute
// per-paddle profiles — every result shows all 4 axes regardless of what
// the user picked, so the comparison table actually shows how the 3 picks
// differ rather than just confirming the one thing they asked for.
// Deliberately paraphrased into a dot rating rather than citing the exact
// proprietary lab-tested labels/percentiles those numbers come from.

function powerRating(paddle) {
  const base = paddle.paddleType === "Power" ? 0.85 : paddle.paddleType === "All-Court" ? 0.5 : paddle.paddleType === "Control" ? 0.2 : 0.5;
  return paddle.powerPercentile != null ? base * 0.4 + paddle.powerPercentile * 0.6 : base;
}

function controlRating(paddle) {
  let base = paddle.paddleType === "Control" ? 0.85 : paddle.paddleType === "All-Court" ? 0.5 : paddle.paddleType === "Power" ? 0.2 : 0.5;
  if (paddle.impactFeel === "Soft/Dense" || paddle.impactFeel === "Soft/Hollow") base = clamp01(base + 0.15);
  else if (paddle.impactFeel === "Stiff/Dense" || paddle.impactFeel === "Stiff/Hollow") base = clamp01(base - 0.15);
  return base;
}

function spinRatingOf(paddle) {
  return { "Very High": 1, High: 0.75, Medium: 0.45, Low: 0.15 }[paddle.spinRating] ?? 0.5;
}

function forgivenessRatingOf(paddle) {
  return paddle.twistWeightPercentile != null ? paddle.twistWeightPercentile : 0.5;
}

function toDots(score) {
  if (score >= 0.7) return 3;
  if (score >= 0.4) return 2;
  return 1;
}

function dimensionsFor(paddle, fullAnswers) {
  return {
    power: toDots(powerRating(paddle)),
    control: toDots(controlRating(paddle)),
    spin: toDots(spinRatingOf(paddle)),
    forgiveness: toDots(forgivenessRatingOf(paddle)),
    // Only meaningful when the user actually stated a preference — with
    // "no preference" these score 1 (3 dots) for every paddle by design, so
    // the row is hidden entirely in that case rather than shown as an
    // uninformative wall of identical dots (see renderResults).
    weightFit: toDots(weightPrefScore(paddle, fullAnswers.weight)),
    budgetFit: toDots(budgetScore(paddle, fullAnswers.budget)),
    // Tagged once in assets/paddles.json from forgiveness (twist weight
    // percentile), core thickness, and paddle type — see the prep script for
    // the exact rule. Shown directly in the table (as a level-badge, not
    // dots, since it's a category rather than an intensity) so the skill
    // bonus below is as visible/auditable as everything else in the score.
    skillLevel: paddle.skillLevel || "Intermediate",
  };
}

const SKILL_LEVELS = ["Beginner", "Intermediate", "Advanced"];

// An exact match to the user's stated level is worth more than the typical
// 1-2 point gap between skill tiers on raw dot totals (Advanced-tagged
// paddles trade away forgiveness dots for specialization, so without a
// large-enough bonus here, "Advanced" tags would never surface for
// advanced players — the raw stat sum would always favor the more
// forgiving, easier-rated paddle regardless of who's asking). One step off
// (e.g. an Intermediate paddle for a Beginner) gets a small nod; the
// opposite end of the spectrum gets nothing.
function skillMatchScore(paddleSkillLevel, experience) {
  const userLevel = experience === "beginner" ? "Beginner" : experience === "advanced" ? "Advanced" : "Intermediate";
  const distance = Math.abs(SKILL_LEVELS.indexOf(paddleSkillLevel) - SKILL_LEVELS.indexOf(userLevel));
  if (distance === 0) return 4;
  if (distance === 1) return 1;
  return 0;
}

// The rank is a plain sum of the exact dots/badges shown in the table — no
// hidden weighting formula a viewer couldn't reconstruct themselves by
// counting circles on screen. The user's stated priority (power/control/
// spin) counts double, since that's the one thing they explicitly said
// matters most; beginners get forgiveness counted double too, on the theory
// that a large sweet spot matters more early on; a paddle tagged for the
// user's exact stated skill level gets its own (larger) bonus — see
// skillMatchScore for why it needs more than a simple double to actually
// move the needle. Everything else — including weight-fit/budget-fit, only
// added when the user actually stated a preference — counts once. Every
// term is a non-negative integer, so a paddle that's equal-or-better on
// every shown dimension (and strictly better on at least one) always scores
// strictly
// higher, full stop.
function totalScore(dims, fullAnswers) {
  let score = dims.power + dims.control + dims.spin + dims.forgiveness;
  if (fullAnswers.priority === "power") score += dims.power;
  else if (fullAnswers.priority === "control") score += dims.control;
  else if (fullAnswers.priority === "spin") score += dims.spin;
  if (fullAnswers.experience === "beginner") score += dims.forgiveness;
  if (fullAnswers.weight !== "nopref") score += dims.weightFit;
  if (fullAnswers.budget !== "nopref") score += dims.budgetFit;
  score += skillMatchScore(dims.skillLevel, fullAnswers.experience);
  return score;
}

export function computeMatches(paddles, answers) {
  const fullAnswers = { ...answers };
  const pool = (answers.tournament === "yes" ? paddles.filter(isTournamentLegal) : paddles).filter((p) => p.price != null);

  const scored = pool.map((paddle) => {
    const dims = dimensionsFor(paddle, fullAnswers);
    return { paddle, dims, score: totalScore(dims, fullAnswers) };
  });

  scored.sort((a, b) => b.score - a.score);
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

export async function submitLead(email, fullAnswers, recommendedPaddleIds) {
  const handles = await getFirestoreHandles();
  if (!handles) return false;
  const { db, fs } = handles;
  try {
    await fs.addDoc(fs.collection(db, "paddleQuizLeads"), {
      email,
      answers: {
        experience: fullAnswers.experience,
        priority: fullAnswers.priority,
        weight: fullAnswers.weight,
        budget: fullAnswers.budget,
        tournament: fullAnswers.tournament,
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

function meterHtml(dots, label) {
  const cells = Array.from({ length: 3 }, (_, i) => `<span class="pq-meter-dot ${i < dots ? "is-filled" : ""}"></span>`).join("");
  return `<span class="pq-meter" role="img" aria-label="${label}: ${dots} of 3">${cells}</span>`;
}

class PaddleQuizApp {
  constructor(root, paddles) {
    this.root = root;
    this.paddles = paddles;
    this.step = 0; // 0..QUESTIONS.length-1 = questions, QUESTIONS.length = email, +1 = results
    this.answers = {};
    this.submitting = false;
    this.root.addEventListener("click", (e) => this.onClick(e));
    this.root.addEventListener("submit", (e) => this.onSubmit(e));
  }

  render() {
    const isResults = this.step > QUESTIONS.length;
    this.root.classList.toggle("pq-shell--wide", isResults);
    if (this.step < QUESTIONS.length) this.root.innerHTML = this.renderQuestion(QUESTIONS[this.step]);
    else if (this.step === QUESTIONS.length) this.root.innerHTML = this.renderEmailStep();
    else this.root.innerHTML = this.renderResults();
  }

  renderProgress(stepIndex, total) {
    const dots = Array.from({ length: total }, (_, i) => {
      const cls = i < stepIndex ? "is-done" : i === stepIndex ? "is-current" : "";
      return `<span class="pq-dot ${cls}"></span>`;
    }).join("");
    return `<div class="pq-progress"><span class="pq-progress-label">Step ${stepIndex + 1} of ${total}</span><span class="pq-dots">${dots}</span></div>`;
  }

  renderQuestion(q) {
    const options = q.options
      .map(
        (opt) => `
      <button type="button" class="pq-option" data-key="${q.key}" data-value="${opt.value}">
        <span class="pq-option-label">${opt.label}</span>
        ${opt.hint ? `<span class="pq-option-hint">${opt.hint}</span>` : ""}
      </button>`
      )
      .join("");

    return `
      ${this.renderProgress(this.step, QUESTIONS.length + 1)}
      <h3 class="pq-prompt">${q.prompt}</h3>
      <div class="pq-options">${options}</div>
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
        <input type="email" id="pq-email" name="email" placeholder="you@example.com" required autocomplete="email">
        <button type="submit" class="btn pq-submit" ${this.submitting ? "disabled" : ""}>
          ${this.submitting ? "Finding your matches…" : "See my top picks →"}
        </button>
        ${this.emailError ? `<p class="pq-error">${this.emailError}</p>` : ""}
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

    const cols = top
      .map(
        ({ paddle }, i) => `
      <th class="pq-compare-col">
        <div class="name-row">
          <h3>${paddle.name}</h3>
          ${i === 0 ? `<span class="rank-badge top">Best match</span>` : `<span class="rank-badge">#${i + 1}</span>`}
        </div>
        <span class="addr">${paddle.brand} · $${paddle.price}</span>
      </th>`
      )
      .join("");

    const dimRow = (label, key) => `
      <tr>
        <th class="pq-compare-label">${label}</th>
        ${top.map(({ dims }) => `<td>${meterHtml(dims[key], label)}</td>`).join("")}
      </tr>`;

    const weightRow = `
      <tr>
        <th class="pq-compare-label">Weight</th>
        ${top.map(({ paddle }) => `<td>${paddle.weightOz != null ? `${paddle.weightOz}oz` : "—"}</td>`).join("")}
      </tr>`;

    // Reuses the site's existing level-badge component (already used for
    // court skill levels) so paddles and courts share the same color
    // language: beginner = kitchen green, advanced = poppy, intermediate =
    // bay blue ("mixed" modifier).
    const SKILL_BADGE_CLASS = { Beginner: "beginner", Advanced: "competitive", Intermediate: "mixed" };
    const skillRow = `
      <tr>
        <th class="pq-compare-label">Best for</th>
        ${top
          .map(
            ({ dims }) =>
              `<td><span class="level-badge ${SKILL_BADGE_CLASS[dims.skillLevel]}">${dims.skillLevel}</span></td>`
          )
          .join("")}
      </tr>`;

    // Only shown when the user actually stated a preference — otherwise
    // every paddle scores the same on these by design, and the row would
    // just be a wall of identical dots. When shown, this is what makes the
    // rank fully explainable: literally every input to the score is now a
    // visible row, so a cheaper/lighter pick beating a "better" one on the
    // 4 dimensions above always has a visible reason in this table.
    const fitRow = (label, key, pref) =>
      pref !== "nopref"
        ? `<tr><th class="pq-compare-label">${label}</th>${top.map(({ dims }) => `<td>${meterHtml(dims[key], label)}</td>`).join("")}</tr>`
        : "";

    const linkRow = `
      <tr class="pq-compare-links">
        <th class="pq-compare-label"></th>
        ${top
          .map(({ paddle }) => {
            const link = vendorLinkFor(paddle);
            return `<td>${link ? `<a class="book-btn" href="${link.href}" target="_blank" rel="noopener nofollow">${link.label} →</a>` : ""}</td>`;
          })
          .join("")}
      </tr>`;

    return `
      <div class="pq-results-head">
        <p class="eyebrow">Your matches</p>
        <h3 class="pq-prompt">Your top 3 picks</h3>
      </div>
      <div class="pq-compare-wrap">
        <table class="pq-compare-table">
          <thead><tr><th></th>${cols}</tr></thead>
          <tbody>
            ${skillRow}
            ${dimRow("Put-away power", "power")}
            ${dimRow("Resets &amp; touch", "control")}
            ${dimRow("Spin", "spin")}
            ${dimRow("Forgiveness", "forgiveness")}
            ${weightRow}
            ${fitRow("Weight fit", "weightFit", this.matches.fullAnswers.weight)}
            ${fitRow("Budget fit", "budgetFit", this.matches.fullAnswers.budget)}
            ${linkRow}
          </tbody>
        </table>
      </div>
      <button type="button" class="clear-btn pq-retake" data-action="retake">Retake the quiz</button>
    `;
  }

  onClick(e) {
    const opt = e.target.closest(".pq-option[data-key]");
    if (opt) {
      this.answers[opt.dataset.key] = opt.dataset.value;
      this.step += 1;
      this.render();
      return;
    }
    const back = e.target.closest('[data-action="back"]');
    if (back) {
      this.step = Math.max(0, this.step - 1);
      this.emailError = null;
      this.render();
      return;
    }
    const retake = e.target.closest('[data-action="retake"]');
    if (retake) {
      this.step = 0;
      this.answers = {};
      this.emailError = null;
      this.render();
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
    this.render();
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const root = document.getElementById("paddle-quiz-app");
  if (!root) return;
  try {
    const res = await fetch("/assets/paddles.json");
    const paddles = await res.json();
    new PaddleQuizApp(root, paddles).render();
  } catch (err) {
    console.error("[PaddleQuiz] Failed to load paddle data.", err);
    root.innerHTML = `<p class="pq-error">Couldn't load the paddle database right now — try refreshing the page.</p>`;
  }
});
