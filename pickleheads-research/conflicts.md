# Pickleheads merge conflicts

Every row below is a venue where the existing baseline in `assets/courts-data.json` already has a real (non-"Not specified") value for a field, and Pickleheads' research disagrees with it. Per the merge rules, these records were **not** patched automatically -- a human needs to pick a side (or reconcile both) by hand.

## Cupertino (cupertino.json)

| Venue ID | Field | Existing value | Pickleheads value | Source |
|---|---|---|---|---|
| memorial-park | courts | 4 | 8 | [link](https://www.pickleheads.com/courts/us/california/cupertino/cupertino-memorial-park) |

## Fremont (fremont.json)

| Venue ID | Field | Existing value | Pickleheads value | Source |
|---|---|---|---|---|
| clubsport-fremont | courts | 4 | 8 | [link](https://www.pickleheads.com/courts/us/california/fremont/bay-club-fremont) |
| clubsport-fremont | name | ClubSport Fremont | Bay Club Fremont | [link](https://www.waze.com/live-map/directions/us/ca/fremont/bay-club-fremont?to=place.ChIJtx8ao07Gj4ARZfAg8FV7Jl0) |

## Mountain View (mountain-view.json)

| Venue ID | Field | Existing value | Pickleheads value | Source |
|---|---|---|---|---|
| rengstorff-park | courts | 3 | 9 | [link](https://www.pickleheads.com/courts/us/california/mountain-view/rengstorff-park-pickleball-courts) |

## Novato (novato.json)

| Venue ID | Field | Existing value | Pickleheads value | Source |
|---|---|---|---|---|
| hill-recreation-pickleball-courts | address | 500 Crescent Drive, Novato, CA 94949 | 1560 Hill Rd, Novato, CA 94947 | [link](https://www.pickleheads.com/courts/us/california/novato/hill-pickleball-courts) |

## Oakland (oakland.json)

| Venue ID | Field | Existing value | Pickleheads value | Source |
|---|---|---|---|---|
| montclair-pickleball-courts | price | ~$10/hr for residents | Free | [link](https://www.pickleheads.com/courts/us/california/oakland/montclair-pickleball-courts) |
| bushrod-park | price | $2 drop-in fee | Free | [link](https://www.pickleheads.com/courts/us/california/oakland/bushrod-park) |
| pickle-athletics | reservable | Reservable (bookingUrl: https://book.pickleathletics.com/) | "The courts cannot be reserved" (Walk-up) | [link](https://www.pickleheads.com/courts/us/california/oakland/pickle-athletics) |

## Palo Alto (palo-alto.json)

| Venue ID | Field | Existing value | Pickleheads value | Source |
|---|---|---|---|---|
| mitchell-park | courts | 8 | 15 | [link](https://www.pickleheads.com/courts/us/california/palo-alto/mitchell-park) |
| mitchell-park | hours | 8 permanent courts open 24/7; 7 multi-purpose courts open 8am-3pm daily | 6am-10pm daily (15 courts) | [link](https://www.pickleheads.com/courts/us/california/palo-alto/mitchell-park) |
| mitchell-park | surface | Hard court; 8 permanent (dedicated) + 7 multi-purpose | Outdoor hard court, all 15 courts with dedicated permanent lines and nets (no multi-purpose split mentioned) | [link](https://www.pickleheads.com/courts/us/california/palo-alto/mitchell-park) |

## Pleasanton (pleasanton.json)

| Venue ID | Field | Existing value | Pickleheads value | Source |
|---|---|---|---|---|
| bay-club-pleasanton | courts | 8 | 9 | [link](https://www.pickleheads.com/courts/us/california/pleasanton/bay-club-pleasanton) |
| pleasanton-tennis-and-community-park | surface | Medium — lines painted on existing tennis courts, bring your own net | Outdoor concrete — dedicated courts with permanent lines and nets | [link](https://www.pickleheads.com/courts/us/california/pleasanton/lifetime-activities) |
| pleasanton-tennis-and-community-park | reservable | Walk-up | Reservable — verified Pleasanton residents may book 8 days ahead, unverified residents/non-residents 7 days ahead, reservations open daily at 12:30pm | [link](https://www.lifetimeactivities.com/pleasanton/court-reservations-policies/) |
| pleasanton-middle-school-gym | price | $4.50 resident / $5.25 non-resident pass | $3.75 resident / $4.50 non-resident (single visit), plus 6-visit and 15-visit multi-passes | [link](https://www.pickleheads.com/courts/us/california/pleasanton/pleasanton-middle-school-gym) |

## Redwood City (redwood-city.json)

| Venue ID | Field | Existing value | Pickleheads value | Source |
|---|---|---|---|---|
| red-morton-park-outdoor-courts | hours | Dawn–dusk, lighted courts to 10pm | Not stated on pickleheads.com itself; a related pickleball-court-listing source states Mon–Sat 12–4pm (Courts A&B) / 4–8pm (Courts C&D), Sun 1–4pm — a much more specific schedule that may describe reservation windows rather than general park access, but conflicts on its face with the existing dawn-dusk value | [link](https://thepickleballdinks.com/courts/red-morton-park-redwood-city-ca) |
| red-morton-senior-center-indoor-courts | price | $1 | Free | [link](https://www.pickleheads.com/courts/us/california/redwood-city/red-morton-community-center) |
| sequoia-ymca | price | $10 monthly pass + $45 one-time program fee, or $15 drop-in | Membership required to play (blanket statement, no drop-in-without-membership option mentioned) | [link](https://www.pickleheads.com/courts/us/california/redwood-city/sequoia-ymca) |

## San Francisco (san-francisco.json)

| Venue ID | Field | Existing value | Pickleheads value | Source |
|---|---|---|---|---|
| goldman-tennis-center | price | $8-15/hour depending on time and residency | $10 per hour for residents / $16 for non-residents | [link](https://www.pickleheads.com/courts/us/california/san-francisco/lisa-and-douglas-goldman-tennis-center) |
| moscone-playground | courts | 6 | 7 | [link](https://www.pickleheads.com/courts/us/california/san-francisco/moscone-recreation-center) |
| moscone-playground | indoorOutdoor | Outdoor | Both (1 indoor, 6 outdoor) | [link](https://www.pickleheads.com/courts/us/california/san-francisco/moscone-recreation-center) |
| george-christopher-playground | courts | 1 | 2 | [link](https://www.pickleheads.com/courts/us/california/san-francisco/george-christopher-playground-park) |
| hamilton-rec-center | courts | 2 | 3 | [link](https://www.pickleheads.com/courts/us/california/san-francisco/hamilton-recreation-center) |
| rossi-playground | courts | 8 | 9 | [link](https://www.pickleheads.com/courts/us/california/san-francisco/angelo-j-rossi-playground) |
| presidio-wall-playground | hours | Dawn-dusk weekdays, Sat 9am-3pm | Drop-in access daily 10:30am-1:30pm | [link](https://www.pickleheads.com/courts/us/california/san-francisco/presidio-wall-playground) |
| upper-noe-rec-center | courts | 5 | 6 (2 outdoor, 4 indoor) | [link](https://www.pickleheads.com/courts/us/california/san-francisco/upper-noe-recreation-center) |
| upper-noe-rec-center | hours | Tue & Thu, 10am-1pm | 9am-10pm, 7 days a week (regular drop-in pickleball) | [link](https://www.pickleheads.com/courts/us/california/san-francisco/upper-noe-recreation-center) |
| buena-vista-park | reservable | Reservable | Mixed -- no drop-in schedule, walk-on rules apply, but reservations are recommended via SF Rec & Park (up to 2 days ahead) | [link](https://www.pickleheads.com/courts/us/california/san-francisco/buena-vista-park) |

## San Jose (san-jose.json)

| Venue ID | Field | Existing value | Pickleheads value | Source |
|---|---|---|---|---|
| branham-park | courts | 2 | 1 | [link](https://www.pickleheads.com/courts/us/california/san-jose/branham-park) |
| camden-community-center | price | $2.75–$5.50 sliding scale | $10 member / $18 non-member drop-in | [link](https://www.pickleheads.com/courts/us/california/san-jose/camden-community-center) |
| evergreen-valley-college | reservable | Mixed | Not reservable (walk-up only, with 4 of 8 courts held for a Tue/Thu 9–10:45am college class) | [link](https://www.pickleheads.com/courts/us/california/san-jose/evergreen-valley-college-pickleball-courts) |

## San Mateo (san-mateo.json)

| Venue ID | Field | Existing value | Pickleheads value | Source |
|---|---|---|---|---|
| central-park | hours | 8am–10pm | 6am-10pm daily | [link](https://www.pickleheads.com/courts/us/california/san-mateo/san-mateo-central-park) |
| beresford-park | hours | 8am–10pm | 6am-10pm daily | [link](https://www.pickleheads.com/courts/us/california/beresford-park) |
| san-mateo-high-school-gym | courts |  | 6 | [link](https://www.pickleheads.com/courts/us/california/san-mateo/san-mateo-high-school) |
| san-mateo-high-school-gym | price | $5.00 fee | $4.00 drop-in fee (covers ~3 hours of play) | [link](https://www.pickleheads.com/courts/us/california/san-mateo/san-mateo-high-school) |
| san-mateo-high-school-gym | hours | Sundays ~10am–3pm | Saturday 11am-1pm and Sunday 5:30pm-8:30pm | [link](https://www.pickleheads.com/courts/us/california/san-mateo/san-mateo-high-school) |
| san-mateo-high-school-gym | (researcher note) |  | listed as courts:null in existing baseline; not literally a 'conflict' in the contradiction sense since there was no prior value, but grouped with matchStatus existing-conflict per the schema because this venue also has two genuine field conflicts (price, hours) that block a clean existing-update classification. |  |

## San Rafael (san-rafael.json)

| Venue ID | Field | Existing value | Pickleheads value | Source |
|---|---|---|---|---|
| albert-park | price | $5 drop-in | Free | [link](https://www.pickleheads.com/courts/us/california/san-rafael/albert-park) |
| albert-park | address | 155 Anderson Dr, San Rafael, CA 94901 | 151 Andersen Dr, San Rafael, CA 94901 | [link](https://www.yelp.com/biz/the-lofts-at-albert-park-apartments-san-rafael-2) |
| flyte-racquet-club | price | $2,500 individual / $3,500 family initiation; monthly passes also available | $25 drop-in fee; monthly memberships from $199/individual | [link](https://www.yelp.com/biz/flyte-racquet-club-san-rafael-2) |
| flyte-racquet-club | bookingUrl | https://www.flyte-marin.com/book/flyte | https://app.playbypoint.com/f/flyte | [link](https://app.playbypoint.com/f/flyte) |

## Santa Clara (santa-clara.json)

| Venue ID | Field | Existing value | Pickleheads value | Source |
|---|---|---|---|---|
| community-recreation-center-at-central-park | hours | Mon/Wed 9am–9:30pm, Tue/Thu/Fri 9am–3:30pm, Sat 9am–7:30pm, Sun 9am–7pm | Open Play for Santa Clara City Residents: Mon–Fri 1pm–3pm, Sat–Sun 8pm–10pm | [link](https://www.pickleheads.com/courts/us/california/santa-clara/santa-clara-community-recreation-center-at-central-park) |
| bay-club-santa-clara | courts | 6 | 10 | [link](https://www.pickleheads.com/courts/us/california/santa-clara/bay-club-santa-clara) |

## Sunnyvale (sunnyvale.json)

| Venue ID | Field | Existing value | Pickleheads value | Source |
|---|---|---|---|---|
| sunnyvale-tennis-center | courts | 4 | 12 | [link](https://www.pickleheads.com/courts/us/california/sunnyvale/sunnyvale-tennis-center) |
| sunnyvale-tennis-center | price | $8–10/hr resident ($2/person w/ 4 players), $10–13/hr non-resident | $10/hr resident, $13/hr non-resident | [link](https://www.pickleheads.com/courts/us/california/sunnyvale/sunnyvale-tennis-center) |

## Walnut Creek (walnut-creek.json)

| Venue ID | Field | Existing value | Pickleheads value | Source |
|---|---|---|---|---|
| heather-farm-park-walnut-creek-tennis-center | reservable | Mixed | Walk-up — Pickleheads explicitly states courts cannot be reserved | [link](https://www.pickleheads.com/courts/us/california/walnut-creek/walnut-creek-tennis-center) |

**Total conflict rows: 46**

