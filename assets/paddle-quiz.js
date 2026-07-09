// Find your paddle — a short wizard that scores every paddle in
// assets/paddles.json against the visitor's answers, shows their top 3
// matches at each of 3 budget tiers, and captures an email as a lead
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
    key: "tournament",
    prompt: "Do you need it tournament-legal?",
    options: [
      { value: "yes", label: "Yes — USAP approved", hint: "Required for USA Pickleball–sanctioned tournaments" },
      { value: "no", label: "No, just recreational play", hint: "" },
    ],
  },
];

// Beginners get a forgiving, large-sweet-spot paddle by default; advanced
// players are assumed to trade some forgiveness for a more specialized feel.
// This keeps the quiz to 4 questions instead of asking forgiveness directly.
const FORGIVENESS_BY_EXPERIENCE = {
  beginner: "high",
  intermediate: "medium",
  advanced: "low",
};

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

function styleScore(paddle, priority) {
  const pt = paddle.paddleType;
  if (priority === "power") {
    const base = pt === "Power" ? 1 : pt === "All-Court" ? 0.55 : pt === "Control" ? 0.15 : 0.5;
    return paddle.powerPercentile != null ? base * 0.4 + paddle.powerPercentile * 0.6 : base;
  }
  if (priority === "control") {
    let base = pt === "Control" ? 1 : pt === "All-Court" ? 0.55 : pt === "Power" ? 0.15 : 0.5;
    if (paddle.impactFeel === "Soft/Dense" || paddle.impactFeel === "Soft/Hollow") base = clamp01(base + 0.15);
    else if (paddle.impactFeel === "Stiff/Dense" || paddle.impactFeel === "Stiff/Hollow") base = clamp01(base - 0.1);
    return base;
  }
  if (priority === "spin") {
    const bySpinRating = { "Very High": 1, High: 0.75, Medium: 0.45, Low: 0.15 };
    return bySpinRating[paddle.spinRating] ?? 0.5;
  }
  // allcourt
  return pt === "All-Court" ? 1 : pt ? 0.55 : 0.5;
}

function forgivenessScore(paddle, forgivenessPref) {
  const twp = paddle.twistWeightPercentile;
  if (forgivenessPref === "low") return 1; // "doesn't matter" — contributes equally to every paddle
  if (forgivenessPref === "medium") return trapezoid(twp, 0.45, 0.75, 0.35);
  return twp == null ? 0.5 : twp; // "high" — reward stability/forgiveness directly
}

function weightPrefScore(paddle, weightPref) {
  const w = paddle.weightOz;
  if (weightPref === "nopref") return 1;
  if (weightPref === "light") return trapezoid(w, 0, 7.5, 0.6);
  if (weightPref === "mid") return trapezoid(w, 7.6, 8.2, 0.6);
  return trapezoid(w, 8.3, 20, 0.6); // heavy
}

const WEIGHTS = { style: 0.45, forgiveness: 0.35, weight: 0.2 };

function isTournamentLegal(paddle) {
  return paddle.approvalBody === "USAP" || paddle.approvalBody === "USAP/UPA-A";
}

// Results are grouped by price instead of asked as a question — everyone
// sees their top 3 at each budget tier rather than picking one upfront.
const PRICE_BUCKETS = [
  { key: "budget", label: "Best under $150", inRange: (p) => p < 150 },
  { key: "mid", label: "Best $150–220", inRange: (p) => p >= 150 && p <= 220 },
  { key: "premium", label: "Best $220+", inRange: (p) => p > 220 },
];

// Deliberately generic/paraphrased — never cites the exact proprietary
// lab-tested labels (spin rating, percentiles, "Firepower" tier) those
// numbers come from, even though they inform the ranking internally.
function reasonsFor(paddle, fullAnswers) {
  const reasons = [];

  if (fullAnswers.priority === "power" && paddle.paddleType === "Power") {
    reasons.push("Built to add pace to your drives and put-aways");
  } else if (fullAnswers.priority === "control" && paddle.paddleType === "Control") {
    reasons.push("Soft, control-first feel for dinks and resets at the kitchen");
  } else if (fullAnswers.priority === "allcourt" && paddle.paddleType === "All-Court") {
    reasons.push("A well-rounded, all-court feel");
  } else if (fullAnswers.priority === "spin" && (paddle.spinRating === "Very High" || paddle.spinRating === "High")) {
    reasons.push("Strong spin potential for topspin and slice");
  }

  if (fullAnswers.forgiveness === "high" && paddle.twistWeightPercentile != null && paddle.twistWeightPercentile >= 0.6) {
    reasons.push("Forgiving on off-center hits — good while you're still grooving your swing");
  }

  if (fullAnswers.weight !== "nopref" && paddle.weightOz != null) {
    reasons.push(`${paddle.weightOz}oz, matching your weight preference`);
  }

  if (fullAnswers.tournament === "yes" && isTournamentLegal(paddle)) {
    reasons.push("Tournament-legal");
  }

  return reasons.slice(0, 3);
}

export function computeMatches(paddles, answers) {
  const fullAnswers = { ...answers, forgiveness: FORGIVENESS_BY_EXPERIENCE[answers.experience] || "medium" };
  const pool = (answers.tournament === "yes" ? paddles.filter(isTournamentLegal) : paddles).filter((p) => p.price != null);

  const scored = pool.map((paddle) => ({
    paddle,
    score:
      styleScore(paddle, fullAnswers.priority) * WEIGHTS.style +
      forgivenessScore(paddle, fullAnswers.forgiveness) * WEIGHTS.forgiveness +
      weightPrefScore(paddle, fullAnswers.weight) * WEIGHTS.weight,
  }));

  const buckets = PRICE_BUCKETS.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    top: scored
      .filter((s) => bucket.inRange(s.paddle.price))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((s) => ({ paddle: s.paddle, reasons: reasonsFor(s.paddle, fullAnswers) })),
  }));

  return { fullAnswers, buckets };
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
        forgiveness: fullAnswers.forgiveness,
        weight: fullAnswers.weight,
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
      <p class="pq-email-hint">Enter your email to reveal your top picks — 3 paddles at each budget tier. We'll also occasionally send new paddle drops and deals — unsubscribe anytime. See the <a href="/privacy">privacy policy</a>.</p>
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
    const sections = this.matches.buckets
      .map((bucket) => {
        const cards = bucket.top
          .map(
            ({ paddle, reasons }, i) => `
          <div class="venue-card pq-paddle-card ${i === 0 ? "top-pick" : ""}">
            <div class="name-row">
              <h3>${paddle.name}</h3>
              ${i === 0 ? `<span class="rank-badge top">Best match</span>` : `<span class="rank-badge">#${i + 1}</span>`}
            </div>
            <span class="addr">${paddle.brand} · $${paddle.price}</span>
            ${reasons.length ? `<ul class="know-list">${reasons.map((r) => `<li>${r}</li>`).join("")}</ul>` : ""}
            ${paddle.vendorUrl ? `<a class="book-btn" href="${paddle.vendorUrl}" target="_blank" rel="noopener nofollow">Visit ${paddle.brand} →</a>` : ""}
          </div>`
          )
          .join("");
        return `
        <div class="pq-bucket">
          <h3 class="pq-bucket-title">${bucket.label}</h3>
          <div class="pq-results-grid">${cards || `<p class="pq-empty">No matches in this range — try adjusting your other answers.</p>`}</div>
        </div>`;
      })
      .join("");

    return `
      <div class="pq-results-head">
        <p class="eyebrow">Your matches</p>
        <h3 class="pq-prompt">Your top picks, by budget</h3>
      </div>
      ${sections}
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
    const recommendedPaddleIds = this.matches.buckets.flatMap((b) => b.top.map((m) => m.paddle.id));
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
