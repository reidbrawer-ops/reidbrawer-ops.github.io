# Setting up shared voting (Firebase)

The Rankings page and the "vote for your favorite" / star-rating widgets on
Directory and city pages need somewhere to store votes so every visitor sees
the same numbers. This site uses Firebase Firestore's free tier for that.

Until you complete this setup, the site still works — voting runs in a local
demo mode (see `assets/court-ratings.js`), where your votes only show up in
your own browser. Nothing else on the site depends on Firebase.

Total time: about 10–15 minutes. No credit card required (Spark/free plan).

## 1. Create the Firebase project

1. Go to https://console.firebase.google.com and sign in with a Google account.
2. Click **Add project**, name it (e.g. `pickleball-bay-area`), and finish the
   wizard. You can disable Google Analytics for this project — not needed.

## 2. Create a Firestore database

1. In the left sidebar, go to **Build → Firestore Database**.
2. Click **Create database**.
3. Choose **Start in production mode** (we'll paste our own rules next).
4. Pick a location close to your users (e.g. `us-west1` or `nam5`) — this
   can't be changed later, but it doesn't need to be exact.

## 3. Paste the security rules

1. In Firestore, go to the **Rules** tab.
2. Replace the contents with everything in [`firestore.rules`](firestore.rules)
   from this repo.
3. Click **Publish**.

These rules let anyone read court stats (for public rankings) but only allow
writes that look like a single valid vote or rating — see the comments in
that file for the full reasoning.

## 4. Register a web app and get your config

1. In the Firebase console, click the gear icon → **Project settings**.
2. Under **Your apps**, click the **</>** (web) icon to add a web app.
3. Give it any nickname (e.g. `pickleball-bay-area-web`). Firebase Hosting is
   optional — see the section below if you also want Firebase to serve the
   site itself, alongside GitHub Pages.
4. Firebase will show a `firebaseConfig` object. Copy those values into
   [`assets/firebase-config.js`](assets/firebase-config.js), replacing the
   `YOUR_...` placeholders.

## 5. Verify

Open `directory.html` or `rankings.html` in a browser, open the console, and
confirm you no longer see the `[PBRatings] Firebase isn't configured yet`
warning. Cast a test vote and check the Firestore console
(**Firestore Database → Data → courtVotes**) to see it land.

## 6. (Optional) Also host the site on Firebase Hosting

This keeps GitHub Pages as the canonical, live URL (reidbrawer-ops.github.io —
the canonical/og:url tags on every page still point there) and adds Firebase
Hosting as a second copy of the same static site, served from the same
Firebase project as your Firestore database. Useful for previewing changes
on a Firebase URL, or as a stepping stone if you ever want to move canonical
hosting there later.

1. Install the Firebase CLI: `npm install -g firebase-tools` (or prefix every
   command below with `npx` instead of installing globally).
2. `firebase login` — opens a browser to authenticate with the same Google
   account that owns the Firebase project.
3. Open [`.firebaserc`](.firebaserc) and replace `YOUR_FIREBASE_PROJECT_ID`
   with the project ID from step 1 (find it in the Firebase console under
   **Project settings → General → Project ID**).
4. From the repo root: `firebase deploy --only hosting`.
5. The CLI prints a **Hosting URL** — something like
   `https://YOUR_PROJECT_ID.web.app`. That's the Firebase-hosted mirror.

[`firebase.json`](firebase.json) is already configured to serve every file at
the repo root except `scripts/`, dotfiles, and markdown docs — `scripts/` is
excluded specifically so a local `scripts/serviceAccountKey.json`, if you've
created one for the seed/admin scripts, never gets uploaded to public
hosting.

To publish future changes, just re-run `firebase deploy --only hosting`
(GitHub Pages updates on its own whenever you push to the repo — the two
deploy independently and can drift out of sync between deploys, which is
fine for a preview mirror but worth knowing).

## Notes on abuse resistance

Voting is anonymous and client-side, which is normal for a site like this but
means the security rules (bounded, shape-checked increments) are the only
line of defense against ballot-stuffing — someone determined could still
script repeated legitimate-shaped votes. If that becomes a real problem,
the next step up is moving writes behind a Cloud Function with App Check and
rate limiting, which is out of scope for this initial version.
