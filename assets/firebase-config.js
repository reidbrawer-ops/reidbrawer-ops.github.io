// Firebase project config for the community voting/ratings feature.
//
// This file is safe to commit and safe to expose in client-side code —
// Firebase web config values are identifiers, not secrets. Access control
// lives in Firestore security rules (see /FIREBASE_SETUP.md), not here.
//
// HOW TO FILL THIS IN:
//   1. Follow /FIREBASE_SETUP.md to create a free Firebase project and a
//      Firestore database.
//   2. In the Firebase console: Project settings → General → Your apps →
//      add a "Web" app → copy the `firebaseConfig` object it gives you.
//   3. Paste the values below, replacing the placeholders.
//
// Until you do this, the site runs in local demo mode: voting and ratings
// work in your own browser (via localStorage) so you can see and test the
// feature, but votes are NOT shared across visitors. Nothing else on the
// site is affected — this file only powers the voting/ranking feature.

export const firebaseConfig = {
  apiKey: "AIzaSyDaIHifXRrkVcAC6vkI6iHK7IF1BfuRAxM",
  authDomain: "pickleball-bay-area.firebaseapp.com",
  projectId: "pickleball-bay-area",
  storageBucket: "pickleball-bay-area.firebasestorage.app",
  messagingSenderId: "613626696867",
  appId: "1:613626696867:web:c7b91559d0a3ac56769b16"
};

export const isFirebaseConfigured = firebaseConfig.apiKey !== "YOUR_API_KEY";


