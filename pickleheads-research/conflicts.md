# Pickleheads merge conflicts — resolved

All 34 venues / 46 fields originally flagged here have been resolved by human review. For each venue below: the resolution source, what changed in `assets/courts-data.json` / `assets/venues.json`, and the reasoning. The original per-field existing-vs-Pickleheads-vs-source detail is preserved in each `pickleheads-research/<city>.json` file's `conflicts` array (unchanged, per the "don't rewrite the inputs" rule) for anyone who wants the full citation trail.

## Cupertino

### memorial-park — *Accepted Pickleheads*

Court count updated to Pickleheads' figure (8).

| Field | Before | After |
|---|---|---|
| courts | 4 | 8 |

## Fremont

### clubsport-fremont — *Accepted Pickleheads*

Renamed to Bay Club Fremont and court count/price/surface/reservable/booking link updated to Pickleheads' figures — same physical address and Google Place ID as the existing ClubSport Fremont record, consistent with a rebrand.

| Field | Before | After |
|---|---|---|
| name | ClubSport Fremont | Bay Club Fremont |
| courts | 4 | 8 |
| price | Not specified | Membership required |
| surface | Not specified | Hard |
| reservable | Not specified | Reservable |
| bookingUrl | *(none)* | https://www.bayclubs.com/clubs/fremont |

## Mountain View

### rengstorff-park — *Accepted Pickleheads*

Court count updated to Pickleheads' figure (9).

| Field | Before | After |
|---|---|---|
| courts | 3 | 9 |

## Novato

### hill-recreation-pickleball-courts — *Accepted Pickleheads*

Address updated to Pickleheads' figure (1560 Hill Rd). Note: the research file itself flagged this as needing human verification — it found evidence the old baseline address (500 Crescent Drive) may actually belong to a different, unrelated venue (Thigpen Courts). lat/lon nulled out (map pin removed) rather than left pointing at the old address's coordinates, since no geocode was available for the new address either.

| Field | Before | After |
|---|---|---|
| address | 500 Crescent Drive, Novato, CA 94949 | 1560 Hill Rd, Novato, CA 94947 |

## Oakland

### bushrod-park — *User-provided*

Price corrected per user to $2–4 drop-in fee (a range, rather than picking either the old $2 or Pickleheads' "Free").

| Field | Before | After |
|---|---|---|
| price | $2 drop-in fee | $2–4 drop-in fee |
| courts | *(none)* | 4 |

### montclair-pickleball-courts — *User-provided*

Price and hours corrected per user: $10/hr resident, $12/hr non-resident; open 7am–10pm, 7 days a week.

| Field | Before | After |
|---|---|---|
| price | ~$10/hr for residents | $10/hr for residents, $12/hr for non-residents |
| hours | Lighted, all-day play | 7am–10pm, 7 days a week |

### pickle-athletics — *User-provided*

Confirmed reservable (rejecting Pickleheads' "cannot be reserved" claim); booking URL updated to the courtreserve.com link the user provided.

| Field | Before | After |
|---|---|---|
| bookingUrl | https://book.pickleathletics.com/ | https://app.courtreserve.com/Online/Reservations/Bookings/13285?sId=21718 |
| price | Not specified | One-time fee required to play |

## Palo Alto

### mitchell-park — *Accepted Pickleheads*

Court count, hours, and surface updated to Pickleheads' figures (15 courts, 6am–10pm, no multi-purpose split).

| Field | Before | After |
|---|---|---|
| courts | 8 | 15 |
| hours | 8 permanent courts open 24/7; 7 multi-purpose courts open 8am–3pm daily | 6am–10pm daily |
| surface | Hard court; 8 permanent (dedicated) + 7 multi-purpose | Outdoor hard court, all 15 courts with dedicated permanent lines and nets |

## Pleasanton

### bay-club-pleasanton — *Accepted Pickleheads*

Court count updated to 9; price/reservable/booking link gap-filled from the same research record.

| Field | Before | After |
|---|---|---|
| courts | 8 | 9 |
| price | Not specified | Membership required |
| reservable | Not specified | Reservable |
| bookingUrl | *(none)* | https://www.bayclubs.com/clubs/pleasanton |

### pleasanton-middle-school-gym — *Accepted Pickleheads*

Price updated to Pickleheads' figure; hours/booking link gap-filled.

| Field | Before | After |
|---|---|---|
| price | $4.50 resident / $5.25 non-resident pass | $3.75 resident / $4.50 non-resident (single visit), plus 6-visit and 15-visit multi-passes |
| hours | Not specified | Saturday mornings, 9am–12pm (Sundays not used) |
| bookingUrl | *(none)* | https://www.pleasantonfun.com/ |

### pleasanton-tennis-and-community-park — *Accepted Pickleheads*

Surface and reservable updated to Pickleheads' figures (dedicated permanent courts, reservable up to 8 days ahead); court count/hours/booking link gap-filled.

| Field | Before | After |
|---|---|---|
| surface | Medium — lines painted on existing tennis courts, bring your own net | Outdoor concrete — dedicated courts with permanent lines and nets |
| reservable | Walk-up | Reservable — verified residents may book 8 days ahead, others 7 days ahead, reservations open daily at 12:30pm |
| courts | *(none)* | 4 |
| hours | Not specified | Mon–Fri 8am–10pm, Sat & Sun 8am–8pm; reservations open daily at 12:30pm |
| bookingUrl | *(none)* | https://www.lifetimeactivities.com/pleasanton/pickleball/ |

## Redwood City

### red-morton-park-outdoor-courts — *User-provided*

Hours replaced with the detailed schedule from the user's screenshot ("Red Morton Outdoor Court Schedule").

| Field | Before | After |
|---|---|---|
| hours | Dawn–dusk, lighted courts to 10pm | General pickleball open play (until game ends or 15-min limit): Mon–Sat 8am–12pm, Sun 9am–1pm, Courts A–D; every day 4pm–8pm, Courts A & B only. Mixed pickleball/tennis (1-hr limit if others waiting): Mon–Sat 12pm–4pm, Sun 1pm–4pm, all pickleball courts + Tennis Courts 1 & 2; every day 4pm–8pm, Courts C & D. Tennis Courts 3 & 4 are tennis-only every day. |
| reservable | Not specified | Mixed |
| bookingUrl | *(none)* | https://anc.apm.activecommunities.com/rwcpark/activity/search?onlineSiteId=0&locale=en-US&activity_select_param=2&activity_category_ids=13&viewMode=list |

### red-morton-senior-center-indoor-courts — *Accepted Pickleheads*

Price updated to Free. (The user's schedule image was for the outdoor courts specifically, not this indoor gym record.)

| Field | Before | After |
|---|---|---|
| price | $1 | Free |

### sequoia-ymca — *Accepted Pickleheads*

Price updated to Pickleheads' "membership required" framing.

| Field | Before | After |
|---|---|---|
| price | $10 monthly pass + $45 one-time program fee, or $15 drop-in | Membership required to play |

## San Francisco

### buena-vista-park — *Accepted Pickleheads*

Reservable updated to Pickleheads' "Mixed" framing; price/surface gap-filled.

| Field | Before | After |
|---|---|---|
| reservable | Reservable | Mixed — walk-on allowed, reservations recommended via SF Rec & Park (up to 2 days ahead) |
| price | Not specified | Free |
| surface | Not specified | Hard court |

### george-christopher-playground — *Accepted Pickleheads*

Court count updated to 2; price gap-filled to Free.

| Field | Before | After |
|---|---|---|
| courts | 1 | 2 |
| price | Not specified | Free |

### goldman-tennis-center — *Accepted Pickleheads*

Price updated to Pickleheads' figure ($10/$16 per hour).

| Field | Before | After |
|---|---|---|
| price | $8–15/hour depending on time and residency | $10/hour for residents, $16/hour for non-residents |

### hamilton-rec-center — *Accepted Pickleheads*

Court count updated to 3; price gap-filled to Free.

| Field | Before | After |
|---|---|---|
| courts | 2 | 3 |
| price | Not specified | Free |

### moscone-playground — *Accepted Pickleheads*

Court count updated to 7; indoor/outdoor updated to Both, with the 1-indoor/6-outdoor split recorded in surface; price gap-filled.

| Field | Before | After |
|---|---|---|
| courts | 6 | 7 |
| indoorOutdoor | Outdoor | Both |
| surface | Not specified | 1 indoor court, 6 outdoor courts |
| price | Not specified | Free |

### presidio-wall-playground — *Accepted Pickleheads*

Hours updated to Pickleheads' figure; price gap-filled to Free.

| Field | Before | After |
|---|---|---|
| hours | Dawn–dusk weekdays, Sat 9am–3pm | Drop-in access daily 10:30am–1:30pm |
| price | Not specified | Free |

### rossi-playground — *Accepted Pickleheads*

Court count updated to 9; price gap-filled to Free.

| Field | Before | After |
|---|---|---|
| courts | 8 | 9 |
| price | Not specified | Free |

### upper-noe-rec-center — *User-provided + Pickleheads*

Hours corrected per user (Tue–Fri 9am–9pm, Sat 9am–5pm); court count accepted from Pickleheads (6, split 2 outdoor/4 indoor recorded in surface); price/reservable gap-filled.

| Field | Before | After |
|---|---|---|
| courts | 5 | 6 |
| hours | Tue & Thu, 10am–1pm | Tue–Fri 9am–9pm, Sat 9am–5pm |
| price | Not specified | Free |
| surface | Not specified | 2 outdoor courts, 4 indoor courts |
| reservable | Not specified | Reservable |

## San Jose

### branham-park — *Accepted Pickleheads*

Court count updated to Pickleheads' figure (1). Surface text updated too since the old "1 dedicated + 1 lined on shared basketball court" description no longer matched a 1-court total; hours gap-filled.

| Field | Before | After |
|---|---|---|
| courts | 2 | 1 |
| surface | 1 dedicated + 1 lined on shared basketball court | Outdoor hard court, dedicated, permanent net and lines |
| hours | Not specified | Daily 6:30am–9pm |

### camden-community-center — *User-provided*

Price replaced with the exact day-pass/monthly/annual structure the user gave.

| Field | Before | After |
|---|---|---|
| price | $2.75–$5.50 sliding scale | Day passes: $2.75 (14–17, Senior, or Disabled), $5.50 Adults; $10 monthly or $100 annually |

### evergreen-valley-college — *User-provided*

Reservable set to "Not reservable" per user (matching Pickleheads' conclusion); hours replaced with the detailed open-play/class schedule the user gave.

| Field | Before | After |
|---|---|---|
| reservable | Mixed | Not reservable |
| hours | Approx. M–F 6–9pm, Sat–Sun 8am–9pm (sources differ slightly) | Open play Mon–Fri 9am–12pm & 4pm–10pm, weekends 8am–10pm. Tue/Thu 9–10:45am reserved for a college pickleball class (4 of 8 courts held for class, 4 open to the public). Beginner-friendly weekday mornings; traffic and skill level ramp up starting at 4pm on weekdays. |

## San Mateo

### beresford-park — *User-provided (kept existing)*

Same as Central Park — user confirmed existing 8am–10pm hours; Pickleheads' 6am start was not applied.

*(no field changes — existing value confirmed correct as-is)*

### central-park — *User-provided (kept existing)*

User confirmed the existing 8am–10pm hours are correct; Pickleheads' 6am start was not applied.

*(no field changes — existing value confirmed correct as-is)*

### san-mateo-high-school-gym — *User-provided + Pickleheads*

Price and hours confirmed per user ($5 drop-in, Sundays 10am–3pm — Pickleheads' Saturday session and $4 fee were not applied). Court count accepted from Pickleheads (6), since the user didn't address it and the baseline had no prior value there.

| Field | Before | After |
|---|---|---|
| price | $5.00 fee | $5 drop-in fee |
| hours | Sundays ~10am–3pm | Sundays 10am–3pm |
| courts | *(none)* | 6 |

## San Rafael

### albert-park — *User-provided*

Address corrected per user to 76 Albert Park Lane (a third, different address from both the old baseline and Pickleheads/Yelp) — user is a firsthand source and separately confirmed the existing price/hours were already correct. lat/lon left as-is; this is very likely the same well-known park, just a more precise street address, unlike the Hill Recreation Courts case.

| Field | Before | After |
|---|---|---|
| address | 155 Anderson Dr, San Rafael, CA 94901 | 76 Albert Park Lane, San Rafael, CA 94901 |

### flyte-racquet-club — *User-provided (kept existing)*

User confirmed both the existing price and existing booking URL are correct; Pickleheads' cheaper drop-in pricing and alternate booking link were not applied. Hours gap-filled from the research record since that wasn't previously in dispute.

| Field | Before | After |
|---|---|---|
| hours | Not specified | Mon–Fri 9:00am–9:00pm; Sat–Sun 9:00am–7:00pm |

## Santa Clara

### bay-club-santa-clara — *Accepted Pickleheads*

Court count updated to 10; price gap-filled.

| Field | Before | After |
|---|---|---|
| courts | 6 | 10 |
| price | Not specified | Membership required (guest membership available); court rental packages from $2,000 (2+ hrs reserved time, equipment, and coach included) |

### community-recreation-center-at-central-park — *Accepted Pickleheads*

Hours updated to Pickleheads' resident open-play window.

| Field | Before | After |
|---|---|---|
| hours | Mon/Wed 9am–9:30pm, Tue/Thu/Fri 9am–3:30pm, Sat 9am–7:30pm, Sun 9am–7pm | Open Play for Santa Clara City Residents: Mon–Fri 1pm–3pm, Sat–Sun 8pm–10pm |

## Sunnyvale

### sunnyvale-tennis-center — *Accepted Pickleheads*

Court count and price updated to Pickleheads' figures (12 courts, $10/$13 per hour); indoor/outdoor gap-filled to Outdoor.

| Field | Before | After |
|---|---|---|
| courts | 4 | 12 |
| price | $8–10/hr resident ($2/person w/ 4 players), $10–13/hr non-resident | $10/hr resident, $13/hr non-resident |
| indoorOutdoor | Not specified | Outdoor |

## Walnut Creek

### heather-farm-park-walnut-creek-tennis-center — *User-provided (kept existing)*

User confirmed it is reservable, rejecting Pickleheads' "walk-up only" claim — kept the existing "Mixed" value rather than overwriting it. Court count gap-filled from the research record.

| Field | Before | After |
|---|---|---|
| courts | *(none)* | 2 |

**Total venues resolved: 34**

