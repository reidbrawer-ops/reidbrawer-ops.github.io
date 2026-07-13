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

if (GA_MEASUREMENT_ID.indexOf("XXXXXXXXXX") === -1) {
  var gaScript = document.createElement("script");
  gaScript.async = true;
  gaScript.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_MEASUREMENT_ID;
  document.head.appendChild(gaScript);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
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
