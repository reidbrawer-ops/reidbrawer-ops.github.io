// One-time seed script: populates the `courtVotes` collection with starting
// values derived from the site's existing verified court data (see
// FIREBASE_SETUP.md for the full walkthrough).
//
// Safe to re-run: it only writes a document if that court doesn't already
// have one, so it will never overwrite real votes once the site is live.
//
// Usage (from the scripts/ directory):
//   npm install
//   node seed-firestore.mjs ./serviceAccountKey.json
//
// The service account key is downloaded from:
//   Firebase console → Project settings → Service accounts → Generate new private key

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import admin from "firebase-admin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const keyPathArg = process.argv[2];
if (!keyPathArg) {
  console.error("Usage: node seed-firestore.mjs <path-to-service-account-key.json>");
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(path.resolve(keyPathArg), "utf8"));
const seedData = JSON.parse(readFileSync(path.join(__dirname, "../assets/rating-seed-data.json"), "utf8"));

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
  const courtIds = Object.keys(seedData);
  console.log(`Seeding ${courtIds.length} courts into courtVotes...`);

  let created = 0;
  let skipped = 0;

  for (const courtId of courtIds) {
    const ref = db.collection("courtVotes").doc(courtId);
    const snap = await ref.get();
    if (snap.exists) {
      skipped++;
      continue;
    }
    await ref.set(seedData[courtId]);
    created++;
  }

  console.log(`Done. Created ${created} new documents, skipped ${skipped} existing ones.`);
}

run().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
