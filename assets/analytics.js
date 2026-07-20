// Google Analytics 4 (GA4) page-view tracking.
//
// HOW TO FILL THIS IN:
//   1. Create a free GA4 property at https://analytics.google.com
//      (Admin -> Create Property -> add a Web data stream for this site).
//   2. Copy the Measurement ID it gives you (starts with "G-").
//   3. Replace the placeholder below with that ID.
//
// Until a real ID is pasted in, this file loads nothing -- GA4 stays off
// rather than sending events under a fake ID. See /SEARCH_CONSOLE_SETUP.md
// for how this connects to Search Console verification.

var GA_MEASUREMENT_ID = "G-DX4PVCWB8H";

// Privacy opt-out gate. We don't load GA at all when the visitor has signaled
// they don't want to be tracked, via any of:
//   - Global Privacy Control (navigator.globalPrivacyControl) — recognized as a
//     valid opt-out signal under California's CCPA/CPRA;
//   - legacy Do Not Track (navigator/window doNotTrack);
//   - the per-browser opt-out toggle on /privacy (localStorage flag).
// The /privacy "Do Not Sell or Share" control writes the same flag.
function pbaAnalyticsOptedOut() {
  try {
    if (navigator.globalPrivacyControl === true) return true;
    var dnt = navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack;
    if (dnt === "1" || dnt === "yes") return true;
    if (localStorage.getItem("pba-analytics-optout") === "1") return true;
  } catch (e) {
    /* signal unreadable — fall through and load normally */
  }
  return false;
}

// Our own traffic. The reports are only useful if they count strangers, and
// two large sources of non-stranger traffic were landing in them:
//
//   1. Non-production hosts. Every local dev reload (localhost, 127.0.0.1,
//      file://) and every Firebase preview channel (*.web.app,
//      *.firebaseapp.com) fired a page_view under the same measurement ID as
//      the live site. GA4 does not filter by hostname on its own.
//   2. Automated browsers. The Claude Code in-app browser is an Electron shell
//      — its UA carries "Claude/" and "Electron/", and notably its
//      navigator.webdriver is FALSE, so the usual automation check does not see
//      it. Headless Chrome and WebDriver-driven browsers are checked too.
//
// This is done in code rather than as a GA4 console filter because a code gate
// travels with the repo, needs no console state to re-create, and drops the hit
// before it is ever sent. It deliberately does NOT try to detect the site owner
// browsing normally in Safari/Chrome — that is what the /privacy opt-out toggle
// (per browser) and a GA4 internal-traffic IP filter (per network) are for.
function pbaOwnTraffic() {
  try {
    var host = location.hostname;
    if (host !== "pickleball-bay-area.com" && host !== "www.pickleball-bay-area.com") return true;
    if (navigator.webdriver === true) return true;
    if (/Headless|Electron|Claude\//i.test(navigator.userAgent || "")) return true;
  } catch (e) {
    /* signal unreadable — fall through and treat as a normal visit */
  }
  return false;
}

// Shared event helper. Defined unconditionally and OUTSIDE the load gate, so
// callers never have to know whether GA is on: when the visitor has opted out,
// or the ID is a placeholder, this is a no-op that still returns cleanly.
//
// It exists because until now the only custom event this site emitted was
// affiliate_click. Everything upstream of the click — how far people get
// through the quiz, which question loses them, whether the email gate is worth
// what it costs, what gets filtered and compared on browse — was invisible, so
// there was no data to analyse, only guesses. Events are the cheapest way to
// stop guessing, and none of them carry anything personal: no email, no query
// text, no paddle-level identity beyond ids already public in paddles.json.
window.pbaTrack = function (name, params) {
  try {
    if (typeof window.gtag !== "function") return;
    window.gtag("event", name, params || {});
  } catch (e) {
    /* analytics must never break the page it measures */
  }
};

if (GA_MEASUREMENT_ID.indexOf("XXXXXXXXXX") === -1 && !pbaAnalyticsOptedOut() && !pbaOwnTraffic()) {
  var gaScript = document.createElement("script");
  gaScript.async = true;
  gaScript.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_MEASUREMENT_ID;
  document.head.appendChild(gaScript);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };

  // Consent Mode v2: deny advertising/personalization signals by default so a
  // visit is never used for ad targeting or shared for cross-context behavioral
  // advertising. Aggregate analytics storage stays granted. Must run before
  // "config". This keeps us out of CCPA "sale/sharing" territory by design.
  window.gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "granted",
  });

  window.gtag("js", new Date());
  window.gtag("config", GA_MEASUREMENT_ID);

  // Lightweight client-error monitoring. A bad deploy (broken data file, a
  // widget regression, a Firestore/Leaflet failure) is otherwise invisible
  // unless a visitor reports it — surface uncaught errors as GA4 "exception"
  // events so they show up in Analytics. No extra vendor.
  function reportError(kind, message, source, lineno) {
    try {
      window.gtag("event", "exception", {
        description: (kind + ": " + (message || "unknown")).slice(0, 300),
        fatal: false,
        error_source: source ? String(source).slice(0, 200) : undefined,
        error_line: lineno || undefined,
        page_path: location.pathname,
      });
    } catch (e) {
      /* error reporting must never itself throw */
    }
  }

  window.addEventListener("error", function (e) {
    // Ignore resource (img/script) load errors — no message, too noisy.
    if (!e.message) return;
    reportError("error", e.message, e.filename, e.lineno);
  });

  window.addEventListener("unhandledrejection", function (e) {
    var reason = e && e.reason;
    var msg = reason && reason.message ? reason.message : String(reason);
    reportError("unhandledrejection", msg);
  });
}
