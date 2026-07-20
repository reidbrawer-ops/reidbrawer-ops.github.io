// The compare tray — one selection, shared by every paddle surface.
//
// This exists because compare is now reachable from two places that are no
// longer the same page: the catalog at /paddles/browse and each of the 486
// prerendered detail pages at /paddles/browse/p/<id>. Before, compare state was
// a field on the PaddleGrid instance, which was fine while the grid was the only
// surface and died the moment a detail page needed to add to it.
//
// sessionStorage rather than localStorage: a shortlist is a shopping session,
// not a preference. Coming back next week to a tray still holding two paddles
// you have already bought or rejected is worse than starting empty.
//
// The cap is TWO, because head-to-head at /paddles/browse/compare is now the
// only compare surface and it takes exactly two paddles. The cap used to be
// three to feed the browse page's chart panel, which plotted up to three
// series; that panel is gone, so a third slot could only ever hold a paddle
// with nowhere to go.
//
// Selecting a third EVICTS THE OLDEST (FIFO) rather than being refused. The
// refuse-at-cap version disabled every unselected "+ Compare" button the
// moment two were picked, which reads as the catalog breaking: 484 buttons go
// grey and the only way out is to find the tray and remove something. With two
// slots that state is reachable almost immediately, so it stops being a rare
// edge and becomes the normal experience of browsing. FIFO means the button
// under the cursor always does the obvious thing — the paddle you just clicked
// is in the comparison — and the cost is one paddle silently leaving, which is
// what the live-region announcement in mountCompareTray() exists to say out
// loud. A three-slot cap could justify a disabled button because you rarely
// hit it; a two-slot cap cannot.

const KEY = "pba-compare";
const MAX = 2;

// Storage may be present but unwritable — private-mode Safari lets getItem
// succeed and throws on setItem. Swallowing that throw and carrying on made
// compare a SILENT no-op: write() notified the subscribers, every subscriber
// re-read through read(), read() got the untouched (empty) store back, and the
// "+ Compare" button flipped straight back to its unselected state with no
// message anywhere. That contradicts syncCompareButtons' own rule that "a
// button that silently does nothing is a bug report".
//
// So: the first failed access latches `storageOk = false` and everything after
// that runs off `memory`. The tray then works for the whole session and only
// loses the shortlist on reload, which is a far smaller failure than a dead
// button. The flag also means we stop paying for a throw on every keystroke-
// speed call — one failure is enough to know.
let storageOk = true;
let memory = [];

// slice(-MAX), not slice(0, MAX): the only way an over-long list reaches here
// is a session that was stored while the cap was three, and keeping the FIRST
// two would contradict the eviction rule everywhere else in this file — the
// visitor would reload and find their two most recent picks replaced by their
// two oldest.
const sane = (list) => (Array.isArray(list) ? list.filter((x) => x && typeof x.id === "string").slice(-MAX) : []);

// Stored as {id, name, brand} rather than bare ids so a detail page can render
// the tray chips without fetching the 257KB catalog just to look up two names.
function read() {
  if (!storageOk) return memory.slice();
  try {
    const raw = sessionStorage.getItem(KEY);
    return sane(raw ? JSON.parse(raw) : []);
  } catch {
    // An unusable tray must not take the page down with it — but from here on
    // the in-memory list is the truth, because the store can no longer be
    // trusted to hold what we last wrote.
    storageOk = false;
    return memory.slice();
  }
}

function write(list) {
  const next = sane(list);
  if (storageOk) {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      storageOk = false;
    }
  }
  // Written unconditionally, not just in the failure branch: when storage dies
  // mid-session the fallback has to already know about every paddle added
  // before the failure, or the tray visibly empties itself at the exact moment
  // it switches over.
  memory = next;
  subs.forEach((fn) => fn(next));
}

const subs = new Set();

export function getCompare() {
  return read();
}

export function isComparing(id) {
  return read().some((x) => x.id === id);
}

export function subscribe(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

// Set for the duration of one write() when an add pushed a paddle out, so the
// tray's live region can name what left. It has to be a module-level handoff
// rather than a return value: write() fans out to subscribers synchronously and
// the announcement happens inside one of them, several frames of call stack
// away from the caller that could have been told.
//
// Cleared immediately after the write so a later add that evicts nothing cannot
// inherit a stale name and announce a removal that did not happen.
let evicted = null;

export function takeEvicted() {
  return evicted;
}

// Returns the new selected state so a caller can update its own button without
// re-reading storage. An add ALWAYS returns true now — at the cap it evicts the
// oldest instead of refusing, so "did my click select this paddle?" has a single
// answer regardless of how full the tray was.
export function toggleCompare(paddle) {
  const list = read();
  const at = list.findIndex((x) => x.id === paddle.id);
  if (at >= 0) {
    list.splice(at, 1);
    write(list);
    return false;
  }
  // shift() before push(), so the list never momentarily holds MAX + 1 and
  // sane()'s trim never gets to decide which end to drop.
  evicted = list.length >= MAX ? list.shift() : null;
  list.push({ id: paddle.id, name: paddle.name, brand: paddle.brand });
  write(list);
  evicted = null;
  return true;
}

export function clearCompare() {
  write([]);
}

// ?vs=a,b is the compare page's canonical form (it also still reads the legacy
// ?a=&b= these links used to emit, so old bookmarks keep working).
export const compareHref = (list) =>
  list.length === 2 ? `/paddles/browse/compare?vs=${encodeURIComponent(list[0].id)},${encodeURIComponent(list[1].id)}` : null;

const esc = (s) =>
  String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ------------------------------------------------------------ focus rescue */

// Every chip list in this feature — the tray chips below, the finder's
// active-filter chips — is redrawn by assigning innerHTML. That DESTROYS the
// button the user just pressed, and the browser does not hand focus to whatever
// replaced it: activeElement silently becomes <body>, so the next Tab restarts
// at the top of the document and a screen reader loses its place completely.
// The pager in paddle-finder.js has always worked around this by hand; this is
// that fix, generalised, so the other rebuild sites stop reintroducing the same
// bug.
//
// Lives here rather than in dom-utils.js because dom-utils is a plain script
// (window.PBUtils) and these are ES modules; paddle-finder.js already imports
// from this file, so there is no new edge in the module graph.
//
// Call BEFORE the rebuild, call the returned function AFTER it. The returned
// function lands focus on whatever now occupies the slot the pressed item held
// — i.e. the NEXT surviving item, since the pressed one is gone — clamping to
// the last item when the removed one was last. It returns:
//   an element  focus was moved there, nothing else to do
//   null        focus WAS on an item and the list is now empty; the caller has
//               to name its own destination or focus falls to <body>
//   false       focus was never on one of these items, so leave it alone —
//               stealing it from wherever it actually is would be its own bug
export function captureListFocus(container, selector) {
  const active = document.activeElement;
  const item = container && active && container.contains(active) ? active.closest(selector) : null;
  const at = item ? Array.from(container.querySelectorAll(selector)).indexOf(item) : -1;
  return () => {
    if (at < 0) return false;
    const next = Array.from(container.querySelectorAll(selector));
    if (!next.length) return null;
    const target = next[Math.min(at, next.length - 1)];
    target.focus();
    return target;
  };
}

// Mounts the fixed bottom bar. Idempotent — both the catalog module and the
// detail module call it, and on the catalog page only one of them exists.
let mounted = false;

export function mountCompareTray(opts = {}) {
  if (mounted) return;
  mounted = true;

  const el = document.createElement("div");
  el.className = "pt-tray";
  el.id = "pt-tray";
  el.hidden = true;
  // A landmark, so a screen-reader user can navigate TO the tray on purpose.
  // role="region" + aria-label is all this is — it announces nothing on its
  // own, which is what the comment here used to claim it did.
  el.setAttribute("role", "region");
  el.setAttribute("aria-label", "Paddle comparison tray");
  document.body.appendChild(el);

  // The actual announcement, and it has to be a SEPARATE node outside `el`.
  // render() rebuilds el.innerHTML wholesale, and a live region whose node is
  // replaced — or which is inserted with its text already in it — is never
  // announced: the assistive tech diffs the region it is watching, and a brand
  // new element is not that region. So this one is created empty, once, parked
  // on <body> where no rebuild can reach it, and only ever has its textContent
  // updated. Same rule as PBUtils.setStatus / the finder's .pn-count.
  const live = document.createElement("p");
  live.className = "visually-hidden";
  live.setAttribute("role", "status");
  live.setAttribute("aria-live", "polite");
  document.body.appendChild(live);

  // Pressing "Compare" is what should speak. A session restored with two
  // paddles already in it must not, or every page load in a shopping session
  // opens by reading the shortlist back at you.
  let announced = false;

  // The tray is fixed to the bottom and overlaps the end of the page. Without
  // this the last row of cards and the footer's final link sit underneath it,
  // unreachable by mouse.
  const pad = () => {
    document.body.style.setProperty("--pt-tray-h", el.hidden ? "0px" : `${el.offsetHeight}px`);
  };

  // The hint is the difference between a disabled button that looks broken and
  // one that has told you what it wants. Hoisted out of render() because the
  // announcement needs the same sentence — a screen-reader user cannot see the
  // greyed CTA at all, so without this they get "1 paddle selected" and no idea
  // why nothing is clickable.
  //
  // One is the only count that needs a hint. Zero hides the tray outright, and
  // two is the cap, so the CTA is live and there is nothing to explain. There
  // is deliberately no branch above two: the cap is MAX and toggleCompare()
  // evicts rather than overflowing, so a third selection is unreachable state.
  const hintFor = (list) => (list.length === 1 ? "Pick one more to compare head to head" : "");

  function announce(list) {
    // Nothing on the very first render — see `announced`. Set the flag even
    // though we skip, so the next real change does speak.
    if (!announced) {
      announced = true;
      return;
    }
    if (!list.length) {
      live.textContent = "Comparison tray empty.";
      return;
    }
    const names = list.map((p) => `${p.brand} ${p.name}`).join(", ");
    const hint = hintFor(list);
    // The eviction sentence is the whole reason FIFO is safe to ship. A sighted
    // visitor sees the chip vanish from the tray; without this a screen-reader
    // user hears "2 paddles selected" both before and after the third click and
    // has no way to tell that one of their picks was dropped to make room.
    const out = takeEvicted();
    const dropped = out ? ` Replaced ${out.brand} ${out.name}.` : "";
    live.textContent = `${list.length === 1 ? "1 paddle" : `${list.length} paddles`} selected: ${names}.${dropped}${hint ? ` ${hint}.` : ""}`;
  }

  function render() {
    const list = read();
    announce(list);
    el.hidden = list.length === 0;
    if (el.hidden) {
      el.innerHTML = "";
      pad();
      return;
    }
    const chips = list
      .map(
        (p) =>
          `<span class="pt-chip"><span class="pt-chip-name">${esc(p.brand)} ${esc(p.name)}</span>` +
          `<button type="button" class="pt-chip-x" data-pt-remove="${esc(p.id)}" aria-label="Remove ${esc(p.brand)} ${esc(p.name)} from comparison">&times;</button></span>`
      )
      .join("");

    const href = compareHref(list);
    const hint = hintFor(list);

    // A real <button disabled>, not a <span aria-disabled="true">. A <span>
    // carries no implicit role, and aria-disabled on a roleless element is
    // dropped outright — the CTA was announced as loose text with no hint that
    // it was a control at all, let alone an unavailable one.
    const cta = href
      ? `<a class="btn pt-go" href="${href}">Head to head &rarr;</a>`
      : `<button type="button" class="btn pt-go is-off" disabled>Head to head &rarr;</button>`;

    el.innerHTML = `<div class="pt-inner">
      <span class="pt-label">Compare</span>
      <div class="pt-chips">${chips}</div>
      ${hint ? `<span class="pt-hint">${hint}</span>` : ""}
      <div class="pt-actions">
        <button type="button" class="pt-clear" data-pt-clear>Clear</button>
        ${cta}
      </div>
    </div>`;
    pad();
  }

  el.addEventListener("click", (e) => {
    const rm = e.target.closest("[data-pt-remove]");
    if (rm) {
      const id = rm.getAttribute("data-pt-remove");
      // write() -> subscribers -> render() runs synchronously and replaces this
      // very button, so capture first and restore straight after.
      const restore = captureListFocus(el, ".pt-chip-x");
      write(read().filter((x) => x.id !== id));
      // null = that was the last chip, so there is no next × to move to. The
      // whole tray has just been hidden with it, and focus() on a hidden
      // element is a silent no-op, so the only honest destination left on the
      // page is the control that put the paddle in the tray in the first place
      // — the card's "+ Compare" on the catalog, the detail page's own button.
      if (restore() === null) {
        const back = document.querySelector(`[data-act="compare"][data-id="${CSS.escape(id)}"], [data-pd-compare]`);
        if (back) back.focus();
      }
      return;
    }
    if (e.target.closest("[data-pt-clear]")) clearCompare();
  });

  subscribe(render);
  render();
  window.addEventListener("resize", pad);

  if (opts.onChange) subscribe(opts.onChange);
}
