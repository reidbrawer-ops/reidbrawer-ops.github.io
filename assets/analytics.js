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

var GA_MEASUREMENT_ID = "G-XXXXXXXXXX";

if (GA_MEASUREMENT_ID.indexOf("XXXXXXXXXX") === -1) {
  var gaScript = document.createElement("script");
  gaScript.async = true;
  gaScript.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_MEASUREMENT_ID;
  document.head.appendChild(gaScript);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", GA_MEASUREMENT_ID);
}
