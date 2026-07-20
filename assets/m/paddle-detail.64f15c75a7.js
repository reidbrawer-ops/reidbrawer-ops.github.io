// The 486 paddle detail pages' only script, and deliberately the smallest module
// on the site.
//
// Everything a detail page says — the bars, the spec table, the picks, the buy
// link — is already in the HTML, stamped there by
// scripts/generate-paddle-pages.mjs. So this file does exactly the two jobs that
// cannot be answered at build time and nothing else:
//
//   1. the compare tray, whose contents live in sessionStorage;
//   2. buy-click attribution, which is the only revenue reporting we have.
//
// If it ever grows a renderer, the page has stopped being static-complete and
// the generator is the thing that should have changed instead.

import { mountCompareTray, toggleCompare, isComparing } from "/assets/paddle-tray.js";
import { trackVendorClicks } from "/assets/affiliate-links.js";

// Bound first and unconditionally, before anything that can throw. The buy CTA
// is prerendered and clickable whether or not this module finishes booting, so
// a failure below must not be able to take the attribution down with it —
// paddle-quiz.js and paddle-grid.js order themselves the same way.
trackVendorClicks();

const btn = document.querySelector("[data-pd-compare]");

// Reads the paddle off the button's own data-* rather than a global: the tray
// stores {id, name, brand} so its chips can render on any page without fetching
// the 257KB catalog, and those three strings are all this page needs to hand it.
const paddleOf = (el) => ({ id: el.dataset.id, name: el.dataset.name, brand: el.dataset.brand });

function sync() {
  if (!btn) return;
  const on = isComparing(btn.dataset.id);
  // No at-capacity state to render. toggleCompare() evicts the oldest instead
  // of refusing, so this button is never disabled and "Compare full" describes
  // a condition that can no longer occur — pressing it always ends with this
  // paddle in the tray.
  btn.classList.toggle("is-on", on);
  btn.setAttribute("aria-pressed", on ? "true" : "false");
  btn.textContent = on ? "✓ Comparing" : "+ Compare";
}

if (btn) {
  btn.addEventListener("click", () => {
    toggleCompare(paddleOf(btn));
    sync();
  });
}

// onChange fires when the tray itself changes — removing this paddle via the
// tray's ✕ has to put the button back to "+ Compare", or the page and the tray
// disagree about what is selected.
mountCompareTray({ onChange: sync });
sync();
