// Mount watchdog — makes a failed JS mount say so instead of lying.
//
// The quiz and the browse catalog are ES modules that replace a placeholder
// ("Loading the quiz…") once they boot. If a module never boots, nothing
// replaces it and the visitor stares at "Loading…" forever, with no error and
// no way out. That is exactly what happened in production: a shared helper
// (`tiebreak`) moved into paddle-ratings.js and paddle-quiz.js began importing
// it, so any browser still holding the previous paddle-ratings.js from cache
// got "does not provide an export named 'tiebreak'", the module aborted, and
// the quiz — the revenue funnel — showed a permanent "Loading the quiz…".
//
// This is deliberately a PLAIN script, not a module: it has to survive the very
// failure it reports, and a module could be taken out by the same skew.
//
// Opt in by putting `data-mount-pending` on the placeholder. Any future mount
// gets the same safety net for free.
(function () {
  "use strict";

  // Long enough that a slow connection pulling paddles.json (~200KB) isn't
  // accused of being broken; short enough that nobody sits on a dead page.
  var GRACE_MS = 10000;
  var tripped = false;

  function fail() {
    if (tripped) return;
    var pending = document.querySelectorAll("[data-mount-pending]");
    if (!pending.length) return; // everything mounted — nothing to report
    tripped = true;

    for (var i = 0; i < pending.length; i++) {
      var el = pending[i];
      var host = el.parentNode;
      if (!host) continue;
      var what = el.getAttribute("data-mount-pending") || "this section";

      host.innerHTML =
        '<p class="pq-error">' + what + " didn't load — usually a stale cached " +
        "file after an update. Reloading normally fixes it.</p>";

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn";
      btn.textContent = "Reload";
      btn.addEventListener("click", function () {
        // A plain reload is enough: JS is served no-cache (see firebase.json),
        // so the browser revalidates every module rather than reusing the stale
        // one that caused this.
        window.location.reload();
      });
      host.appendChild(btn);
    }
  }

  // Fast path: a module that fails to parse/resolve raises an error on window.
  // Don't trip on unrelated errors from other scripts — only ours.
  window.addEventListener(
    "error",
    function (e) {
      var src = (e && e.filename) || (e && e.target && e.target.src) || "";
      if (/\/assets\/paddle-|\/assets\/affiliate-links|\/assets\/firebase-config/.test(src)) {
        // Give the DOM a tick in case another module still mounts successfully.
        setTimeout(fail, 250);
      }
    },
    true
  );

  // Backstop: covers silent failures the error event misses (an aborted fetch,
  // a module that resolves but never runs).
  setTimeout(fail, GRACE_MS);
})();
