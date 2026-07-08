# Showing Google ratings alongside community ratings

Directory, Rankings, and every city page can show each venue's public Google
rating next to (never blended with) this site's own community rating — e.g.
"Google 4.3★ (128)" shown right beside the site's own star average.

Until you complete this setup, that badge just doesn't appear anywhere.
Nothing else on the site depends on it.

**Design note:** this deliberately does *not* call the Google API from
visitors' browsers. A script you run yourself (occasionally, from your own
machine) looks up each venue and writes the results to a static
`assets/google-ratings.json` file, which the site fetches the same way it
fetches `courts-data.json`. That means no API key is ever exposed client-side,
no visitor data reaches Google just from viewing the site, and re-running it
costs nothing meaningful (see pricing note below).

Total time: about 10 minutes.

## 1. Create a Google Cloud project and enable the Places API

1. Go to https://console.cloud.google.com and create a new project (or reuse
   an existing one) — call it whatever you like, e.g. `pickleball-bay-area`.
2. In the search bar, find **Places API (New)** and click **Enable**.
3. You'll be prompted to enable billing on the project (a credit card is
   required even though there's a free monthly allowance — see pricing note).

## 2. Create an API key

1. Go to **APIs & Services → Credentials → Create Credentials → API key**.
2. Click **Restrict key** and:
   - Under **API restrictions**, choose **Restrict key** and select
     **Places API (New)** only.
   - Under **Application restrictions**, you can leave this as "None" since
     the key is only ever used from your own machine running the script
     below, never shipped to a browser. (If you're cautious, restrict it to
     your own IP address instead.)
3. Copy the key.

## 3. Run the fetch script

```sh
export GOOGLE_PLACES_API_KEY=your-key-here
node scripts/fetch-google-ratings.mjs
```

No `npm install` needed (Node 18+ has `fetch` built in). It looks up all 84
venues by name + address, prints each match it finds so you can eyeball
whether it grabbed the right place, and writes `assets/google-ratings.json`.

**Spot-check the output** before trusting it — text search occasionally
matches a nearby but wrong place (e.g. a tennis club instead of the park next
to it). If a match looks wrong, you can hand-edit that entry in
`assets/google-ratings.json` or delete it so the badge just doesn't show for
that venue.

## 4. Re-running it later

Ratings drift over time, so re-run the same command whenever you want fresh
numbers (there's no automatic schedule — this is a manual, occasional
refresh, not a live sync). Commit the updated `assets/google-ratings.json`
and redeploy for the new numbers to go live.

## Pricing note

Because the badge needs the `rating` and `userRatingCount` fields, each
lookup bills at the "Enterprise" SKU tier (~$35 per 1,000 requests as of this
writing) rather than the cheaper tiers. Google gives **1,000 Enterprise-tier
requests free per month**, and this script makes 84 requests per run — so
even running it several times a month costs $0 in practice. Check
[Google's current pricing](https://developers.google.com/maps/billing-and-pricing/pricing)
if you want to confirm before enabling billing.
