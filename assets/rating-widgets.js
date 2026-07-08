// DOM widgets for the voting/ratings feature — favorite button, star
// picker, and the 6-factor rating form. Consumed by directory.js, the
// per-city venue-card injector, and rankings.html.
//
// Classic (non-module) script: reads window.PBRatings, which court-ratings.js
// sets after it finishes loading (Firestore or local demo mode). Call
// PBWidgets.whenReady(fn) instead of using window.PBRatings directly so
// widgets built before that module resolves still work.

(function () {
  function whenReady(fn) {
    if (window.PBRatings) {
      fn(window.PBRatings);
    } else {
      document.addEventListener("pbratings:ready", () => fn(window.PBRatings), { once: true });
    }
  }

  function starHtml(value, sizeClass) {
    const clamped = Math.max(0, Math.min(5, value || 0));
    const pct = (clamped / 5) * 100;
    let stars = "";
    for (let i = 0; i < 5; i++) {
      const starMin = i * 20;
      const starMax = (i + 1) * 20;
      const fillWithinStar = Math.max(0, Math.min(100, ((pct - starMin) / 20) * 100));
      stars += `<span class="star" style="--fill:${fillWithinStar}%"></span>`;
    }
    return `<span class="star-rating ${sizeClass || ""}">${stars}</span>`;
  }

  function overallRatingHtml(courtId) {
    return (
      `<span class="rating-summary" data-court-id="${courtId}" data-role="overall-rating">` +
      `<span data-role="stars"></span>` +
      `<span class="rating-value-label" data-role="value-label"></span>` +
      `</span>`
    );
  }

  function favoriteButtonHtml(courtId, label) {
    label = label || "Favorite";
    return (
      `<button type="button" class="favorite-btn" data-court-id="${courtId}" aria-pressed="false">` +
      `<span data-role="favorite-count">0</span> ${label}` +
      `</button>`
    );
  }

  function badgesHtml(courtId) {
    return `<span class="badges" data-court-id="${courtId}" data-role="top-badge"></span>`;
  }

  function ratingFormHtml(courtId) {
    let rows = "";
    (window.PBRatings ? window.PBRatings.FACTORS : []).forEach((f) => {
      rows +=
        `<div class="rating-form-row" data-factor="${f.key}">` +
        `<div><span class="rf-label">${f.label}</span><span class="rf-hint">${f.hint}</span></div>` +
        `<div class="rf-control">` +
        `<div class="star-picker" data-role="picker">` +
        [5, 4, 3, 2, 1]
          .map((v) => `<button type="button" data-value="${v}" aria-label="Rate ${v} star${v === 1 ? "" : "s"}"></button>`)
          .join("") +
        `</div>` +
        `<span class="rf-your-rating" data-role="your-rating"></span>` +
        `</div>` +
        `</div>`;
    });
    return (
      `<div class="rating-form" data-court-id="${courtId}">` +
      `<button type="button" class="rating-form-toggle" data-role="toggle">Rate this court →</button>` +
      `<div class="rating-form-body" data-role="body" hidden>${rows}</div>` +
      `</div>`
    );
  }

  function refreshOverallRatings(root) {
    (root || document).querySelectorAll('[data-role="overall-rating"][data-court-id]').forEach((el) => {
      const stats = window.PBRatings.getStats(el.dataset.courtId);
      const starsEl = el.querySelector('[data-role="stars"]');
      const labelEl = el.querySelector('[data-role="value-label"]');
      if (starsEl) starsEl.innerHTML = starHtml(stats.overallAvg);
      if (labelEl) {
        labelEl.textContent = stats.overallAvg > 0 ? `${stats.overallAvg.toFixed(1)} avg` : "Not yet rated";
      }
    });
  }

  function refreshFavoriteButtons(root) {
    (root || document).querySelectorAll(".favorite-btn[data-court-id]").forEach((btn) => {
      const stats = window.PBRatings.getStats(btn.dataset.courtId);
      const favorited = window.PBRatings.hasFavorited(btn.dataset.courtId);
      btn.classList.toggle("is-favorited", favorited);
      btn.setAttribute("aria-pressed", String(favorited));
      const countEl = btn.querySelector('[data-role="favorite-count"]');
      if (countEl) countEl.textContent = stats.favoriteVotes;
    });
  }

  function refreshTopBadges(root) {
    (root || document).querySelectorAll('[data-role="top-badge"][data-court-id]').forEach((el) => {
      const stats = window.PBRatings.getStats(el.dataset.courtId);
      el.innerHTML = stats.isTopRated
        ? '<span class="badge-top-rated">★ Top rated</span>'
        : "";
    });
  }

  function refreshRatingForms(root) {
    (root || document).querySelectorAll(".rating-form[data-court-id]").forEach((form) => {
      const courtId = form.dataset.courtId;
      form.querySelectorAll(".rating-form-row[data-factor]").forEach((row) => {
        const factor = row.dataset.factor;
        const yourValue = window.PBRatings.getUserRating(courtId, factor);
        const picker = row.querySelector('[data-role="picker"]');
        const yourRatingEl = row.querySelector('[data-role="your-rating"]');
        if (picker) {
          picker.querySelectorAll("button").forEach((b) => {
            b.classList.toggle("is-selected", yourValue != null && Number(b.dataset.value) <= yourValue);
          });
        }
        if (yourRatingEl) {
          const stats = window.PBRatings.getStats(courtId).factors[factor];
          const avgText = stats.count > 0 ? `avg ${stats.avg.toFixed(1)} (${stats.count})` : "no ratings yet";
          yourRatingEl.textContent = yourValue != null ? `You rated ${yourValue}★ · ${avgText}` : avgText;
        }
      });
    });
  }

  function refreshAll(root) {
    if (!window.PBRatings) return;
    refreshOverallRatings(root);
    refreshFavoriteButtons(root);
    refreshTopBadges(root);
    refreshRatingForms(root);
  }

  document.addEventListener("click", function (e) {
    const toggle = e.target.closest(".rating-form-toggle");
    if (toggle) {
      const body = toggle.closest(".rating-form").querySelector('[data-role="body"]');
      const wasHidden = body.hidden;
      body.hidden = !wasHidden;
      toggle.textContent = wasHidden ? "Hide rating form" : "Rate this court →";
      return;
    }

    const favBtn = e.target.closest(".favorite-btn[data-court-id]");
    if (favBtn && window.PBRatings) {
      favBtn.disabled = true;
      window.PBRatings.toggleFavorite(favBtn.dataset.courtId).finally(() => {
        favBtn.disabled = false;
      });
      return;
    }

    const starBtn = e.target.closest(".star-picker button");
    if (starBtn && window.PBRatings) {
      const row = starBtn.closest(".rating-form-row");
      const form = starBtn.closest(".rating-form");
      starBtn.disabled = true;
      window.PBRatings
        .rateFactor(form.dataset.courtId, row.dataset.factor, Number(starBtn.dataset.value))
        .finally(() => {
          starBtn.disabled = false;
        });
    }
  });

  document.addEventListener("pbratings:ready", () => refreshAll());
  document.addEventListener("pbratings:update", () => refreshAll());

  window.PBWidgets = {
    whenReady,
    starHtml,
    overallRatingHtml,
    favoriteButtonHtml,
    badgesHtml,
    ratingFormHtml,
    refreshAll,
  };
})();
