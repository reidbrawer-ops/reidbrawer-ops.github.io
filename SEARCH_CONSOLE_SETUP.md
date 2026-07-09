# Getting found: GA4 analytics + Google Search Console

This site currently isn't indexed anywhere (a `site:` search for its live
GitHub Pages URL returns nothing) and has no traffic measurement. This doc
covers wiring up both, in the order that actually matters given one open
piece of infrastructure: **`pickleball-bay-area.com` is owned and being
connected to Firebase Hosting** (the canonical host — see the note below),
but DNS isn't fully live yet, and every page's canonical/OG tag already
assumes that domain is the real one.

Until you complete the steps below, the site works exactly as it does today
— GA4 stays off (see `assets/analytics.js`), and nothing gets submitted to
Google. Nothing else on the site depends on this.

**Note on which host is canonical:** [FIREBASE_SETUP.md](FIREBASE_SETUP.md)
states Firebase Hosting is the canonical, live home for this site, and
that's confirmed by the site itself — every canonical tag is extensionless
(`https://pickleball-bay-area.com/about`, not `/about.html`), which only
resolves via Firebase's `cleanUrls: true` rewrite in `firebase.json`; plain
GitHub Pages has no such rewrite and would 404 on those exact URLs. GitHub
Pages, if still deploying from this repo, should be treated as a stale
mirror at its own `reidbrawer-ops.github.io` URL — don't point the custom
domain at it (an earlier version of this doc and a `CNAME` file did that by
mistake; both have been corrected/removed). `sitemap.xml` and `robots.txt`
already point at `pickleball-bay-area.com`, not the GitHub Pages mirror.

## 1. Finish connecting the custom domain to Firebase Hosting

This should happen *before* Search Console verification, so you verify and
submit a sitemap once, against the real final domain.

1. In the Firebase console, **Hosting → Add custom domain**, enter the bare
   hostname `pickleball-bay-area.com` (no `https://`, no trailing slash —
   the field rejects full URLs).
2. Firebase will either auto-verify ownership (if this Google account
   already verified the domain elsewhere) or show a DNS **TXT record** to
   add at your registrar first.
3. Once verified, Firebase shows the actual DNS records to add (typically
   A records for the apex, plus a prompt to also connect `www`). Use
   exactly what the Firebase console displays — don't reuse IPs from
   memory or old docs, these can vary.
4. Add those records at your registrar. Firebase auto-provisions SSL once
   DNS propagates — status moves from Needs setup → Pending → Connected
   (minutes to ~24h).
5. Confirm it resolves: `curl -I https://pickleball-bay-area.com` should
   return a `200`, not a connection failure.
6. Make sure the latest content is actually deployed:
   `firebase deploy --only hosting` (re-run this any time you want the
   live domain to reflect new changes — it doesn't happen automatically
   from a git commit).

**`sitemap.xml` and `robots.txt` already point at `pickleball-bay-area.com`**,
matching the canonical tags in every page's `<head>` — no further action
needed on that front once the domain is live.

## 2. Add a real GA4 Measurement ID

1. Go to https://analytics.google.com and create a property for this site
   (Admin → Create Property → add a **Web** data stream, using
   `pickleball-bay-area.com` as the stream URL even if it's not resolving
   yet — GA4 doesn't require the domain to already be live).
2. Copy the **Measurement ID** (starts with `G-`).
3. Open `assets/analytics.js` and replace the placeholder:
   ```js
   var GA_MEASUREMENT_ID = "G-XXXXXXXXXX"; // <- paste your real ID here
   ```
4. Redeploy (`firebase deploy --only hosting`). Every page already includes
   `assets/analytics.js` — no other file needs to change.

`privacy.html` has already been updated to disclose this honestly (it
previously said "no analytics" — that's no longer true and the copy now
reflects GA4's use).

## 3. Verify Search Console

Use a **Domain property** (covers `http`/`https`/`www`/non-`www` in one
verification, and — unlike a URL-prefix property — can be verified via DNS
even before the site fully resolves there):

1. Go to https://search.google.com/search-console and add a property of
   type **Domain**, entering `pickleball-bay-area.com`.
2. Google gives you a DNS **TXT record** to add at your registrar. Add it
   the same place you added the A records in step 1 — this can be done in
   parallel with DNS propagation, it doesn't need to wait.
3. Once verified, go to **Sitemaps** in the left nav and submit
   `sitemap.xml` (it already points at the `pickleball-bay-area.com` domain).
4. Use **URL Inspection → Request Indexing** on the homepage and a couple
   of city pages to nudge the first crawl instead of waiting for Google to
   discover the sitemap on its own schedule.

If you'd rather not touch DNS again right now, GA4 can also verify Search
Console automatically (Settings → property → **Google Analytics**
verification method) once step 2 is done and you're an Owner on both — no
extra DNS record needed, but it only works after GA4 has been live on the
site for a bit.

## 4. What to check after a week or two

- **Search Console → Performance**: which queries and pages are getting
  impressions — this tells you which city pages are catching organic
  interest versus which are invisible.
- **Search Console → Coverage/Indexing**: confirms pages are actually
  indexed, not just submitted.
- **GA4 → Reports → Acquisition**: which channel (organic search, direct,
  referral from Reddit/Nextdoor/wherever you posted) is actually sending
  people, so you can double down on what's working instead of guessing.
