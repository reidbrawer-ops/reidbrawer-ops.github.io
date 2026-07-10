# Pickleheads research merge report

Merged all 17 `pickleheads-research/*.json` files into `assets/courts-data.json` and `assets/venues.json`. Source files were left untouched (audit trail).

## Summary

- **courts-data.json entries:** 83 -> 117
- **venues.json entries:** 83 -> 117
- **Lockstep check:** PASS (courts-data.json and venues.json both have 117 entries)
- **New venues added:** 34
- **Existing venues patched (gap-filled) with `confirmed: true`:** 21
- **Existing venues confirmed with no field changes needed (`existing-no-change`, `confirmed` flipped to true):** 7
- **Total records where `confirmed` flipped false -> true:** 21
- **Existing venues left as unresolved conflicts:** 34 venues, 46 conflicting fields (see `pickleheads-research/conflicts.md`)
- **New venues excluded from auto-merge (flagged as likely data errors):** 3
- **New venues merged despite a caveat note (not a data-correctness issue):** 2
- **New venues added with no geocoded lat/lon (map pin will not render until filled in):** 21
- **`notOnPickleheads` flags compiled for review:** 11
- **New cities needing a `cities/<slug>.html` page:** 0 (every venue's city already has one)

## New venues added

| City | Venue | ID | Source file | Missing lat/lon |
|---|---|---|---|---|
| Berkeley | Claremont Club and Spa | claremont-club-and-spa | berkeley.json | yes |
| Berkeley | Neighborhood Pickleball - Rooftop - Level 6 | neighborhood-pickleball-rooftop-level-6 | berkeley.json | yes |
| Fremont | Bintang Badminton | bintang-badminton | fremont.json |  |
| Fremont | Mission Hills Racquet and Swim Club | mission-hills-racquet-and-swim-club | fremont.json |  |
| Fremont | Vallejo Mill Historical Park | vallejo-mill-historical-park | fremont.json |  |
| Mountain View | Google Athletic Recreation Field Park | google-athletic-recreation-field-park | mountain-view.json |  |
| Novato | Bay Club Rolling Hills | bay-club-rolling-hills | novato.json |  |
| Oakland | Hampton Tennis Court - Piedmont | hampton-tennis-court-piedmont | oakland.json |  |
| Oakland | Meyer Tennis Courts | meyer-tennis-courts | oakland.json | yes |
| Oakland | Sheffield Village Tennis Court | sheffield-village-tennis-court | oakland.json | yes |
| Redwood City | Andrew Spinas Park | andrew-spinas-park | redwood-city.json |  |
| Redwood City | Stanford Redwood City Recreation & Wellness Center | stanford-redwood-city-recreation-and-wellness-center | redwood-city.json | yes |
| San Francisco | Alta Plaza Park | alta-plaza-park | san-francisco.json |  |
| San Francisco | Bay Club Gateway | bay-club-gateway | san-francisco.json |  |
| San Francisco | Bay Padel Dogpatch Indoor Padel and Pickleball Courts in San Francisco | bay-padel-dogpatch | san-francisco.json | yes |
| San Francisco | Bay Padel Indoor Padel and Pickleball Courts in San Francisco | bay-padel-treasure-island | san-francisco.json | yes |
| San Francisco | Church of Pickleball | church-of-pickleball | san-francisco.json | yes |
| San Francisco | Crocker Amazon Park | crocker-amazon-park | san-francisco.json |  |
| San Francisco | Mission Bay | mission-bay | san-francisco.json | yes |
| San Francisco | Palace of Fine Arts | palace-of-fine-arts | san-francisco.json |  |
| San Jose | Ace Pickleball Club San Jose | ace-pickleball-club-san-jose | san-jose.json | yes |
| San Jose | Canoas Park | canoas-park | san-jose.json | yes |
| San Jose | Central YMCA | central-ymca | san-jose.json | yes |
| San Jose | De Anza Park | de-anza-park | san-jose.json | yes |
| San Jose | Doerr Park | doerr-park | san-jose.json | yes |
| San Jose | Little Italy/Arena Green East | little-italy-arena-green-east | san-jose.json | yes |
| San Jose | San Jose Swim & Racquet Club | san-jose-swim-and-racquet-club | san-jose.json | yes |
| San Jose | Silver Creek Valley Country Club | silver-creek-valley-country-club | san-jose.json | yes |
| San Jose | Willow Street Frank Bramhall Park | willow-street-frank-bramhall-park | san-jose.json | yes |
| San Rafael | Albert J. Boro Community Center | albert-j-boro-community-center | san-rafael.json |  |
| Santa Clara | Santa Clara Adult Education | santa-clara-adult-education | santa-clara.json | yes |
| Walnut Creek | Bay Club Walnut Creek | bay-club-walnut-creek | walnut-creek.json | yes |
| Walnut Creek | Rossmoor | rossmoor | walnut-creek.json | yes |
| Walnut Creek | Tice Valley Gym | tice-valley-gym | walnut-creek.json |  |

## Existing venues patched (gaps filled, no conflicts)

| City file | Venue ID | Fields patched |
|---|---|---|
| berkeley.json | james-kenney-park | price, reservable, bookingUrl |
| cupertino.json | de-anza-college | reservable |
| fremont.json | fremont-tennis-center | hours |
| fremont.json | raindance-pickleball | price, hours |
| menlo-park.json | nealon-park | price, hours |
| oakland.json | de-fremery-park | courts, surface, reservable, bookingUrl |
| oakland.json | oakland-hills-tennis-club | reservable |
| pleasanton.json | clubsport-of-pleasanton | price, surface, reservable |
| san-francisco.json | eureka-valley-rec-center | price |
| san-francisco.json | minnie-lovie-ward-rec-center | price, surface |
| san-francisco.json | parkside-square | price |
| san-francisco.json | rec-fillmore | hours, surface |
| san-francisco.json | richmond-rec-center | price, surface |
| san-francisco.json | stern-grove-playground | price, reservable |
| san-francisco.json | the-crossing-at-east-cut | price |
| san-jose.json | almaden-valley-athletic-club | courts |
| san-jose.json | edenvale-gardens-regional-park | hours |
| san-jose.json | john-mise-park | hours, reservable |
| san-rafael.json | mcinnis-park | hours, bookingUrl |
| san-rafael.json | mcnears-beach-park | hours, reservable |
| san-rafael.json | osher-marin-jcc | surface |

The following existing venues had `existing-no-change` status (Pickleheads corroborated every field, nothing to patch) -- only `confirmed` was touched, flipped to `true` where it wasn't already:

- mountain-view.json: mountain-view-sports-pavilion
- pleasanton.json: muirwood-community-park
- san-francisco.json: larsen-playground
- san-jose.json: bascom-community-center
- san-jose.json: lone-hill-park
- san-jose.json: river-glen-park
- walnut-creek.json: rudgear-park

## Unresolved conflicts

34 existing venues have at least one field where Pickleheads disagrees with an already-populated baseline value. These records were **not** modified. Full detail (existing value, Pickleheads value, source) is in [`pickleheads-research/conflicts.md`](conflicts.md).

- **albert-park**: address, price
- **bay-club-pleasanton**: courts
- **bay-club-santa-clara**: courts
- **beresford-park**: hours
- **branham-park**: courts
- **buena-vista-park**: reservable
- **bushrod-park**: price
- **camden-community-center**: price
- **central-park**: hours
- **clubsport-fremont**: courts, name
- **community-recreation-center-at-central-park**: hours
- **evergreen-valley-college**: reservable
- **flyte-racquet-club**: bookingUrl, price
- **george-christopher-playground**: courts
- **goldman-tennis-center**: price
- **hamilton-rec-center**: courts
- **heather-farm-park-walnut-creek-tennis-center**: reservable
- **hill-recreation-pickleball-courts**: address
- **memorial-park**: courts
- **mitchell-park**: courts, hours, surface
- **montclair-pickleball-courts**: price
- **moscone-playground**: courts, indoorOutdoor
- **pickle-athletics**: reservable
- **pleasanton-middle-school-gym**: price
- **pleasanton-tennis-and-community-park**: reservable, surface
- **presidio-wall-playground**: hours
- **red-morton-park-outdoor-courts**: hours
- **red-morton-senior-center-indoor-courts**: price
- **rengstorff-park**: courts
- **rossi-playground**: courts
- **san-mateo-high-school-gym**: (note), courts, hours, price
- **sequoia-ymca**: price
- **sunnyvale-tennis-center**: courts, price
- **upper-noe-rec-center**: courts, hours

## New venues NOT merged (flagged as likely data errors)

These appeared with `matchStatus: "new"`, but each venue's own research notes explicitly flagged it as a probable Pickleheads data error and told the merge step not to add it as-is. Excluded from both files pending human review; re-check the source JSON's `notes` field and the venue's `pickleheadsUrl` before deciding whether/how to add it.

### Ocean View Park (`ocean-view-park`, berkeley.json)

Notes state this is 'LIKELY MISCATEGORIZED BY PICKLEHEADS -- flag for human review before merging'. Real street address (900 Buchanan St) is in Albany, CA, not Berkeley; Pickleheads lists the same venue under both the berkeley and albany city slugs. City/address assignment is unresolved.

### Athletic Club San Carlos (`athletic-club-san-carlos`, menlo-park.json)

Notes state this is a likely Pickleheads data error: name/description/phone number match a different venue in San Carlos, Sonora, MEXICO, and the stated address '3 Callie Ln, Menlo Park, CA 94025' does not appear to exist. Notes explicitly say 'do not merge as-is' / 'flag for human review'.

### Totonaka RV (`totonaka-rv`, san-mateo.json)

Notes state 'A human should visit the Pickleheads page directly to clarify what this listing actually refers to before treating it as a fully independent venue in courts-data.json.' Same street address as San Mateo Central Park; unclear if this is a genuinely separate venue or a data artifact.

## New venues merged despite a caveat note

These were merged normally (the caveat was not about data correctness), but are worth a quick human sanity check:

### Google Athletic Recreation Field Park (`google-athletic-recreation-field-park`, mountain-view.json)

Notes flag uncertain public accessibility (Google's own campus recreation facility, code-required access) -- not a data-correctness issue, so merged normally with price 'Membership required'. Worth a human sanity check on whether this belongs in a public-courts directory.

### Canoas Park (`canoas-park`, san-jose.json)

Notes flag that Pickleheads lists this venue twice under two different URLs (one independently labeled a duplicate by a third-party mirror). Researcher already deduplicated to a single record here, so merged normally.

## New venues missing coordinates

Added to both files with `lat: null, lon: null` per the "don't fabricate, don't guess" convention used throughout the research files. `assets/map.js` already filters these out of map rendering (`typeof v.lat === "number"`), so nothing is broken, but these venues won't show a map pin until someone geocodes them:

- Berkeley: Neighborhood Pickleball - Rooftop - Level 6 (`neighborhood-pickleball-rooftop-level-6`, berkeley.json)
- Berkeley: Claremont Club and Spa (`claremont-club-and-spa`, berkeley.json)
- Oakland: Meyer Tennis Courts (`meyer-tennis-courts`, oakland.json)
- Oakland: Sheffield Village Tennis Court (`sheffield-village-tennis-court`, oakland.json)
- Redwood City: Stanford Redwood City Recreation & Wellness Center (`stanford-redwood-city-recreation-and-wellness-center`, redwood-city.json)
- San Francisco: Bay Padel Dogpatch Indoor Padel and Pickleball Courts in San Francisco (`bay-padel-dogpatch`, san-francisco.json)
- San Francisco: Mission Bay (`mission-bay`, san-francisco.json)
- San Francisco: Church of Pickleball (`church-of-pickleball`, san-francisco.json)
- San Francisco: Bay Padel Indoor Padel and Pickleball Courts in San Francisco (`bay-padel-treasure-island`, san-francisco.json)
- San Jose: Little Italy/Arena Green East (`little-italy-arena-green-east`, san-jose.json)
- San Jose: Doerr Park (`doerr-park`, san-jose.json)
- San Jose: Ace Pickleball Club San Jose (`ace-pickleball-club-san-jose`, san-jose.json)
- San Jose: Willow Street Frank Bramhall Park (`willow-street-frank-bramhall-park`, san-jose.json)
- San Jose: Canoas Park (`canoas-park`, san-jose.json)
- San Jose: Central YMCA (`central-ymca`, san-jose.json)
- San Jose: De Anza Park (`de-anza-park`, san-jose.json)
- San Jose: Silver Creek Valley Country Club (`silver-creek-valley-country-club`, san-jose.json)
- San Jose: San Jose Swim & Racquet Club (`san-jose-swim-and-racquet-club`, san-jose.json)
- Santa Clara: Santa Clara Adult Education (`santa-clara-adult-education`, santa-clara.json)
- Walnut Creek: Bay Club Walnut Creek (`bay-club-walnut-creek`, walnut-creek.json)
- Walnut Creek: Rossmoor (`rossmoor`, walnut-creek.json)

## `notOnPickleheads` -- existing entries Pickleheads doesn't list

These are baseline venues that the corresponding research file could not find anywhere on Pickleheads' city page or venue search. Not acted on automatically -- re-verify each one still exists / is still open, or consider removing if it no longer operates:

| City file | Venue ID | Name |
|---|---|---|
| berkeley.json | grove-park | Grove Park |
| berkeley.json | san-pablo-park | San Pablo Park |
| cupertino.json | cupertino-sports-center | Cupertino Sports Center |
| menlo-park.json | kelly-park | Kelly Park |
| novato.json | pioneer-park | Pioneer Park |
| oakland.json | laney-college | Laney College |
| san-francisco.json | glen-park-rec-center | Glen Park Rec Center |
| san-francisco.json | mission-ymca | Mission YMCA |
| san-mateo.json | joinville-bayside-park | Joinville/Bayside Park |
| san-mateo.json | los-prados | Los Prados |
| san-mateo.json | shoreview-park-recreation-center | Shoreview Park & Recreation Center |

## New cities needing a page

None -- every venue's `city` field across all 17 research files matched one of the 17 existing `cities/<slug>.html` pages.

