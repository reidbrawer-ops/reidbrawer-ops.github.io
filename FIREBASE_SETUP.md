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
3. Give it any nickname (e.g. `pickleball-bay-area-web`). You don't need
   Firebase Hosting — this site already deploys via GitHub Pages.
4. Firebase will show a `firebaseConfig` object. Copy those values into
   [`assets/firebase-config.js`](assets/firebase-config.js), replacing the
   `YOUR_...` placeholders.

## 5. Seed starting values (recommended, one-time)

Without this, every court starts at 0 votes/0 ratings, which is a fine but
blank-feeling launch state. This step pre-populates each court with a
baseline score derived from data already on the site (e.g. courts already
described as having a dedicated, well-kept surface start with a higher
"Court surface" baseline) — so rankings look meaningful on day one, and get
overtaken by real votes as visitors weigh in. See `scripts/seed-firestore.mjs`
for exactly how each baseline was derived.

1. Get a service account key:
   - Project settings → **Service accounts** tab → **Generate new private key**.
   - Save the downloaded file as `scripts/serviceAccountKey.json`
     (this filename is already git-ignored — never commit it).
2. Install and run the seed script:
   ```sh
   cd scripts
   npm install
   node seed-firestore.mjs ./serviceAccountKey.json
   ```
3. You should see `Created 84 new documents, skipped 0 existing ones.`
   Re-running it later is safe — it only fills in courts that don't have a
   document yet, so it will never overwrite real votes.

## 6. Verify

Open `directory.html` or `rankings.html` in a browser, open the console, and
confirm you no longer see the `[PBRatings] Firebase isn't configured yet`
warning. Cast a test vote and check the Firestore console
(**Firestore Database → Data → courtVotes**) to see it land.

## Notes on abuse resistance

Voting is anonymous and client-side, which is normal for a site like this but
means the security rules (bounded, shape-checked increments) are the only
line of defense against ballot-stuffing — someone determined could still
script repeated legitimate-shaped votes. If that becomes a real problem,
the next step up is moving writes behind a Cloud Function with App Check and
rate limiting, which is out of scope for this initial version.
