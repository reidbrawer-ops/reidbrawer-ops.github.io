// Community voting + star-rating engine for Pickleball Bay Area.
//
// Shared by directory.html, rankings.html, and the city pages. Reads/writes
// a Firestore collection (`courtVotes/{courtId}`) when Firebase is
// configured (see firebase-config.js). When it isn't configured yet, falls
// back to a per-browser localStorage store with the same shape, so the UI
// is fully testable before Firebase is set up — it just won't be shared
// across visitors until then.
//
// Exposes everything on window.PBRatings so plain (non-module) scripts —
// directory.js, nav.js-style page scripts, inline rankings.html script —
// can use it after listening for the "pbratings:ready" event on document.

import { firebaseConfig, isFirebaseConfigured } from "/assets/firebase-config.js";

export const FACTORS = [
  { key: "beginnerFriendly", label: "Beginner friendly", hint: "Welcoming for new players" },
  { key: "courtSurface", label: "Court surface", hint: "Dedicated lines & surface quality" },
  { key: "waitTimeScore", label: "Wait time", hint: "5 = rarely a wait, 1 = long lines" },
  { key: "advancedPlay", label: "Advanced play", hint: "Good for competitive/4.0+ games" },
  { key: "amenities", label: "Amenities", hint: "Parking, restrooms, shade" },
  { key: "atmosphere", label: "Atmosphere", hint: "Community & fun factor" },
];

const SEED_COUNT_PER_FACTOR = 3; // matches scripts that generated the Firestore seed
// 3.9 sits just above the seeded baseline's natural cluster (most courts land
// 3.6-3.8; only a couple of standout venues clear 3.9 on seed data alone) —
// picked from the actual distribution, not an arbitrary round number, so the
// tag is selective from day one instead of requiring real votes to ever fire.
const TOP_RATED_MIN_AVG = 3.9;
const TOP_RATED_MIN_VOTES = SEED_COUNT_PER_FACTOR; // at least the seed baseline present

const LS_FAVORITES = "pba_favorites_v1";
const LS_USER_RATINGS = "pba_user_ratings_v1";
const LS_DEMO_STATS = "pba_demo_stats_v1";

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* localStorage unavailable (private mode, quota) — voting still works this session */
  }
}

function emptyDoc() {
  const doc = { favoriteVotes: 0 };
  FACTORS.forEach((f) => {
    doc[f.key + "Sum"] = 0;
    doc[f.key + "Count"] = 0;
  });
  return doc;
}

function computeStats(rawDoc) {
  const doc = rawDoc || emptyDoc();
  const factors = {};
  let avgTotal = 0;
  let avgCount = 0;
  FACTORS.forEach((f) => {
    const sum = doc[f.key + "Sum"] || 0;
    const count = doc[f.key + "Count"] || 0;
    const avg = count > 0 ? sum / count : 0;
    factors[f.key] = { avg, count };
    if (count > 0) {
      avgTotal += avg;
      avgCount += 1;
    }
  });
  const overallAvg = avgCount > 0 ? avgTotal / avgCount : 0;
  const minCount = Math.min(...FACTORS.map((f) => factors[f.key].count));
  return {
    favoriteVotes: doc.favoriteVotes || 0,
    factors,
    overallAvg,
    isTopRated: overallAvg >= TOP_RATED_MIN_AVG && minCount >= TOP_RATED_MIN_VOTES,
  };
}

class LocalDemoBackend {
  constructor() {
    this.mode = "demo";
  }

  async loadAll() {
    let store = readJson(LS_DEMO_STATS, null);
    if (store) return store;

    // First run in this browser: bootstrap from the same baseline values the
    // real Firestore seed script uses, so demo mode isn't a blank slate.
    store = {};
    try {
      const res = await fetch("/assets/rating-seed-data.json");
      if (res.ok) store = await res.json();
    } catch {
      /* offline or blocked — fall back to an empty store, courts start at 0 */
    }
    writeJson(LS_DEMO_STATS, store);
    return store;
  }

  async ensureDoc(store, courtId) {
    if (!store[courtId]) store[courtId] = emptyDoc();
    return store[courtId];
  }

  async incrementFavorite(courtId, delta) {
    const store = readJson(LS_DEMO_STATS, {});
    const doc = await this.ensureDoc(store, courtId);
    doc.favoriteVotes = Math.max(0, (doc.favoriteVotes || 0) + delta);
    writeJson(LS_DEMO_STATS, store);
    return store[courtId];
  }

  async applyRatingDelta(courtId, factorKey, sumDelta, countDelta) {
    const store = readJson(LS_DEMO_STATS, {});
    const doc = await this.ensureDoc(store, courtId);
    doc[factorKey + "Sum"] = Math.max(0, (doc[factorKey + "Sum"] || 0) + sumDelta);
    doc[factorKey + "Count"] = Math.max(0, (doc[factorKey + "Count"] || 0) + countDelta);
    writeJson(LS_DEMO_STATS, store);
    return store[courtId];
  }
}

class FirebaseBackend {
  constructor(app, db, fs) {
    this.mode = "firebase";
    this.db = db;
    this.fs = fs; // firestore module functions
  }

  async loadAll() {
    const { collection, getDocs } = this.fs;
    const snap = await getDocs(collection(this.db, "courtVotes"));
    const out = {};
    snap.forEach((d) => {
      out[d.id] = d.data();
    });
    return out;
  }

  async incrementFavorite(courtId, delta) {
    const { doc, runTransaction, increment } = this.fs;
    const ref = doc(this.db, "courtVotes", courtId);
    return runTransaction(this.db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) {
        const fresh = emptyDoc();
        fresh.favoriteVotes = Math.max(0, delta);
        tx.set(ref, fresh);
        return fresh;
      }
      tx.update(ref, { favoriteVotes: increment(delta) });
      const data = snap.data();
      return { ...data, favoriteVotes: Math.max(0, (data.favoriteVotes || 0) + delta) };
    });
  }

  async applyRatingDelta(courtId, factorKey, sumDelta, countDelta) {
    const { doc, runTransaction, increment } = this.fs;
    const ref = doc(this.db, "courtVotes", courtId);
    return runTransaction(this.db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) {
        const fresh = emptyDoc();
        fresh[factorKey + "Sum"] = Math.max(0, sumDelta);
        fresh[factorKey + "Count"] = Math.max(0, countDelta);
        tx.set(ref, fresh);
        return fresh;
      }
      const data = snap.data();
      tx.update(ref, {
        [factorKey + "Sum"]: increment(sumDelta),
        [factorKey + "Count"]: increment(countDelta),
      });
      return {
        ...data,
        [factorKey + "Sum"]: Math.max(0, (data[factorKey + "Sum"] || 0) + sumDelta),
        [factorKey + "Count"]: Math.max(0, (data[factorKey + "Count"] || 0) + countDelta),
      };
    });
  }
}

async function createBackend() {
  if (!isFirebaseConfigured) {
    console.warn(
      "[PBRatings] Firebase isn't configured yet (see assets/firebase-config.js) — " +
        "running in local demo mode. Votes only affect this browser."
    );
    return new LocalDemoBackend();
  }
  try {
    const [{ initializeApp }, fsModule] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js"),
    ]);
    const app = initializeApp(firebaseConfig);
    const db = fsModule.getFirestore(app);
    return new FirebaseBackend(app, db, fsModule);
  } catch (err) {
    console.error("[PBRatings] Firebase failed to load, falling back to local demo mode.", err);
    return new LocalDemoBackend();
  }
}

const backendPromise = createBackend();

let cache = {}; // courtId -> raw doc
let cacheLoaded = false;

async function ensureLoaded() {
  if (cacheLoaded) return;
  const backend = await backendPromise;
  cache = await backend.loadAll();
  cacheLoaded = true;
}

function notify() {
  document.dispatchEvent(new CustomEvent("pbratings:update"));
}

function userFavorites() {
  return readJson(LS_FAVORITES, {});
}

function userRatings() {
  return readJson(LS_USER_RATINGS, {});
}

const PBRatings = {
  FACTORS,

  async init() {
    await ensureLoaded();
    return this;
  },

  backendMode() {
    return backendPromise.then((b) => b.mode);
  },

  getStats(courtId) {
    return computeStats(cache[courtId]);
  },

  getAllStats() {
    const out = {};
    Object.keys(cache).forEach((id) => {
      out[id] = computeStats(cache[id]);
    });
    return out;
  },

  hasFavorited(courtId) {
    return !!userFavorites()[courtId];
  },

  getUserRating(courtId, factorKey) {
    const ratings = userRatings();
    return (ratings[courtId] && ratings[courtId][factorKey]) || null;
  },

  async toggleFavorite(courtId) {
    const favorites = userFavorites();
    const already = !!favorites[courtId];
    const backend = await backendPromise;
    const updatedDoc = await backend.incrementFavorite(courtId, already ? -1 : 1);
    cache[courtId] = updatedDoc;
    favorites[courtId] = !already;
    if (!favorites[courtId]) delete favorites[courtId];
    writeJson(LS_FAVORITES, favorites);
    notify();
    return this.getStats(courtId);
  },

  async rateFactor(courtId, factorKey, stars) {
    stars = Math.max(1, Math.min(5, Math.round(stars)));
    const ratings = userRatings();
    const existing = ratings[courtId] && ratings[courtId][factorKey];
    const backend = await backendPromise;

    let sumDelta;
    let countDelta;
    if (existing) {
      sumDelta = stars - existing;
      countDelta = 0;
    } else {
      sumDelta = stars;
      countDelta = 1;
    }

    const updatedDoc = await backend.applyRatingDelta(courtId, factorKey, sumDelta, countDelta);
    cache[courtId] = updatedDoc;

    if (!ratings[courtId]) ratings[courtId] = {};
    ratings[courtId][factorKey] = stars;
    writeJson(LS_USER_RATINGS, ratings);
    notify();
    return this.getStats(courtId);
  },

  starIcons(value, { size = "1em" } = {}) {
    const rounded = Math.round(value * 2) / 2; // nearest half star
    let html = "";
    for (let i = 1; i <= 5; i++) {
      let cls = "star-empty";
      if (rounded >= i) cls = "star-full";
      else if (rounded >= i - 0.5) cls = "star-half";
      html += `<span class="star ${cls}" style="font-size:${size}"></span>`;
    }
    return html;
  },
};

ensureLoaded().then(() => {
  window.PBRatings = PBRatings;
  document.dispatchEvent(new CustomEvent("pbratings:ready"));
});
