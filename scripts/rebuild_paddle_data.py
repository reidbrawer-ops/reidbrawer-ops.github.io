#!/usr/bin/env python3
"""Rebuild assets/paddles.json from a fresh PickleballEffect.com paddle
database export. See PADDLE_DATA_SETUP.md for the full walkthrough,
including what to do when this script warns about a brand it doesn't
recognize.

Requires: pip install numbers-parser (only needed to actually run this
against a .numbers file — the helper functions below can be imported and
unit-tested without it, since the import is deferred until load_rows()
is called).

Usage:
    python3 scripts/rebuild_paddle_data.py "/path/to/Paddle Database.numbers"
"""

import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

SCRIPT_DIR = Path(__file__).parent
OUTPUT_PATH = SCRIPT_DIR.parent / "assets" / "paddles.json"
VENDOR_MAP_PATH = SCRIPT_DIR / "paddle-vendor-map.json"
# Manufacturer-sourced paddles for prominent brands the PickleballEffect export
# does NOT carry (Onix, Yonex, Legacy, etc.). Merged back in on every rebuild so
# a data refresh doesn't silently drop them. See "Manually-added paddles" in
# PADDLE_DATA_SETUP.md and load_manual_paddles() / build_manual_records() below.
MANUAL_PADDLES_PATH = SCRIPT_DIR / "manual-paddles.json"

# ---------------------------------------------------------------------------
# Step 1 — parse the .numbers export.
#
# The source file is an Apple Numbers document (a zip of Snappy-compressed
# protobufs) — numbers_parser is the only library that reads this reliably.
#
# `doc.sheets[0].tables[0]` is POSITIONAL, not a name-based lookup — it has
# always resolved to the sheet/table with the paddle data ("Sheet 1" / "Grid
# view" in every export so far), but nothing here actually checks those
# names. If PickleballEffect reorders or adds a sheet/table ahead of the
# data one, this will NOT raise a clean "not found" error — it will silently
# hand back the wrong table, and you'll either get a confusing KeyError deep
# in main() (see REQUIRED_COLUMNS below) or, worse, a run that completes but
# writes garbage. If a refresh ever produces obviously-wrong output (paddle
# count far from ~486, mostly-empty fields), check this line first.
# ---------------------------------------------------------------------------

# Exact column names main() reads via row[...]. If PickleballEffect renames
# or removes any of these, you'll get a bare KeyError with no context unless
# load_rows() validates the header first — which it does, below.
REQUIRED_COLUMNS = [
    "Paddle Name", "Brand", "Price", "Approval Body", "Shape", "Paddle Type",
    "Impact Feel", "Core Thickness (mm)", "Weight (oz)",
    "Twist Weight Percentile", "Balance Point (mm)", "Spin Rating",
    "Power Percentile",
    # Added with the July 18 2026 export, which widened from 13 columns to 30.
    # "Spin (RPM)" is what finally gives spin real resolution: the "Spin Rating"
    # word column has only four values, so 349 paddles shared four spin scores.
    # "Swing Weight Percentile" replaces an approximation the quiz used to make
    # from balance point and static weight — the real measurement now exists.
    "Spin (RPM)", "Swing Weight Percentile",
    # Raw manufacturer specs, safe to store and display (see PADDLE_DATA_SETUP.md
    # "Data licensing" — these are facts about the product, not PickleballEffect's
    # lab work product).
    #
    # Only the three that something on the site actually reads. "Grit Type" and
    # "Build Type" were carried briefly and dropped: nothing consumed them and
    # they cost ~26KB in a file fetched on every quiz and browse page load. Add
    # them back when there's a filter or chip that needs them, not before.
    "Grip Length (in)", "Grip Size (in)", "Year Released",
]


def load_rows(numbers_path):
    try:
        import numbers_parser
    except ImportError:
        sys.exit("Missing dependency. Run: pip install numbers-parser")

    doc = numbers_parser.Document(numbers_path)
    table = doc.sheets[0].tables[0]
    rows = table.rows(values_only=True)
    header = rows[0]

    missing = [c for c in REQUIRED_COLUMNS if c not in header]
    if missing:
        sys.exit(
            f"This export's columns don't match what this script expects — "
            f"missing: {missing}. PickleballEffect likely renamed a column; "
            f"update REQUIRED_COLUMNS and the corresponding row[...] lookups "
            f"in main() to match the new name. (See PADDLE_DATA_SETUP.md.)"
        )

    return [dict(zip(header, r)) for r in rows[1:]]


# ---------------------------------------------------------------------------
# Step 2 — clean paddle names.
#
# A handful of rows have the specific unit's colorway or a "no weights" kit
# note baked into the name itself, e.g. "Metalbone EVA 16mm (red no
# weights)". Strip only those two patterns — leave thickness/version/shape
# markers like "(14mm)", "(Lite)", "(2024 version)" alone, since those
# distinguish genuinely different products, not just a colorway of the same
# one. Confirmed against the July 2026 export: exactly 4 names had a
# color/no-weights annotation removed; the same regex pass also normalized
# incidental double-spaces/trailing whitespace on a few other names (that's
# expected — re.sub(r"\s+", " ", ...) runs on every name, not just the 4).
# ---------------------------------------------------------------------------

COLOR_WORDS = [
    "red", "blue", "black", "white", "green", "yellow", "orange", "purple",
    "pink", "silver", "gold", "grey", "gray", "teal", "navy", "maroon",
]
COLOR_PAREN_RE = re.compile(r"\s*\((?:" + "|".join(COLOR_WORDS) + r")\)", re.IGNORECASE)
NO_WEIGHT_PAREN_RE = re.compile(r"\s*\([^)]*no weights?[^)]*\)", re.IGNORECASE)


def clean_name(name):
    if not name:
        return name
    name = NO_WEIGHT_PAREN_RE.sub("", name)
    name = COLOR_PAREN_RE.sub("", name)
    return re.sub(r"\s+", " ", name).strip()


# ---------------------------------------------------------------------------
# Step 3 — fix known brand-name typos in the source spreadsheet.
#
# Found by diffing brand counts against near-duplicate spellings in the July
# 2026 export. If a future export introduces new inconsistent spellings,
# add them here (compare `sorted(set(brand for each row))` before and after
# to spot them) rather than letting the site treat two spellings of one
# brand as different brands.
# ---------------------------------------------------------------------------

BRAND_FIXES = {
    "Element 6": "Element6",
    "Enhnace": "Enhance",
    "GRUVN": "Gruvn",
}


def clean_brand(brand):
    if not brand:
        return "Unknown"
    return BRAND_FIXES.get(brand, brand)


# ---------------------------------------------------------------------------
# Step 4 — slugify a stable-ish id.
#
# Duplicate slugs (two rows that produce the same brand+name — usually
# colorway variants of the same paddle that Step 2 intentionally collapses
# to one name) get a "--dupN" suffix rather than "-N". This matters: a
# single dash is exactly what slugify() itself produces between words, so a
# real product whose name already ends in a number (e.g. Friday's "Fever 2",
# id friday-fever-2) can collide with an auto-generated "-2" suffix on an
# unrelated duplicate of a differently-named product (Friday's "Fever",
# id friday-fever). slugify() collapses every run of non-alphanumeric
# characters to a SINGLE dash, so it can never itself produce a double
# dash — making "--dupN" a suffix no real product name can ever coincide
# with, unlike a bare "-N".
# ---------------------------------------------------------------------------


def slugify(s):
    s = s.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def dedupe_id(base_id, seen_ids):
    seen_ids[base_id] = seen_ids.get(base_id, 0) + 1
    n = seen_ids[base_id]
    return base_id if n == 1 else f"{base_id}--dup{n}"


def num(value, decimals=None):
    if value is None or value == "":
        return None
    return round(float(value), decimals) if decimals is not None else value


def whole(value):
    """Integer-valued fields (a year). Numbers stores everything as a float, so
    without this "Year Released" ships as 2024.0."""
    v = num(value)
    return None if v is None else int(float(v))


# ---------------------------------------------------------------------------
# Percentile coarsening — see PADDLE_DATA_SETUP.md "Data licensing".
#
# PickleballEffect's exact lab-tested percentiles are proprietary. The quiz
# only ever uses them to compute ratings / preference scores (it never displays
# the raw number), so we don't need — and shouldn't ship — the precise value in
# the public, fetchable assets/paddles.json. We store a BAND MIDPOINT instead:
# a value that is one of PERCENTILE_BANDS fixed steps, not their measurement.
#
# Widened from 4 bands to 20 on 2026-07-18. Four quartile tiers left the whole
# 486-paddle catalog occupying twenty distinct positions on a two-axis scatter,
# so the charts drew dense stacks of "identical" paddles and the quiz produced
# podiums that were routinely tied on every term. Twenty bands recovers 253 of
# the 403 positions the raw numbers would give — most of the benefit — while
# keeping the firewall the same in kind: what ships is still a band, never the
# measurement. Going all the way to raw would publish their exact lab-derived
# percentiles from a commercial site, which the licensing section rules out.
#
# Keep in sync with:
#   - scripts/validate.mjs, which fails the build on any value that is not a
#     legal band midpoint (this is the guard that stops a raw percentile
#     reaching the public file by accident).
#   - assets/paddle-grid.js tierWord(), which turns a band back into a word for
#     the spec chips.
#
# IMPORTANT: skill_level() must be called on the RAW percentile (before this
# banding), since its 0.35 / 0.6 cut points don't align to band edges.
# ---------------------------------------------------------------------------

PERCENTILE_BANDS = 20


def coarsen_percentile(p, bands=PERCENTILE_BANDS):
    """Midpoint of the band `p` falls in. 20 bands -> 0.025, 0.075 ... 0.975."""
    if p is None:
        return None
    p = min(max(float(p), 0.0), 1.0)
    # min() guards p == 1.0, which would otherwise index one band past the end.
    i = min(int(p * bands), bands - 1)
    return round((i + 0.5) / bands, 4)


def band_midpoints(bands=PERCENTILE_BANDS):
    """Every legal output of coarsen_percentile — used to generate the allow-list
    validate.mjs checks against, so the two can never drift."""
    return [round((i + 0.5) / bands, 4) for i in range(bands)]


def rank_percentile(values):
    """Map raw measurements to 0-1 percentiles by rank within this catalog.

    Used for Spin (RPM), which the export gives as a raw number with no
    percentile column of its own. Ties share a percentile (average rank), so two
    paddles measured at the same RPM always score the same. Returns a dict keyed
    by the raw value.
    """
    present = sorted(v for v in values if v is not None)
    if not present:
        return {}
    n = len(present)
    out = {}
    i = 0
    while i < n:
        j = i
        while j + 1 < n and present[j + 1] == present[i]:
            j += 1
        # Average rank of the tied run, expressed 0-1.
        out[present[i]] = ((i + j) / 2) / (n - 1) if n > 1 else 0.5
        i = j + 1
    return out


# ---------------------------------------------------------------------------
# Step 5 — skill-level tagging.
#
# There is no "skill level" column in the source data — this is derived
# from three specs that actually correlate with who a paddle suits:
# forgiveness (twist weight percentile — a bigger sweet spot is easier to
# learn on), core thickness (very thick = quieter/more forgiving, very thin
# = more specialized/poppy — deliberately ignores the 14-16mm range, which
# is ~85% of the market and not a meaningful signal on its own), and paddle
# type (Control paddles reward learning placement before power; Power
# paddles reward players who already make consistent contact).
#
# Calibrated against the July 2026 export: this exact rule gives a
# 130 Beginner / 159 Intermediate / 197 Advanced split (the skew toward
# Advanced reflects the real market, which leans toward power-oriented
# designs — it's not an artifact of bad thresholds). Verified to reproduce
# the skillLevel already stored in assets/paddles.json for all 486 paddles
# with zero mismatches before this script was written; re-verify the same
# way after any threshold change (see PADDLE_DATA_SETUP.md).
#
# Note: this only reads Twist Weight Percentile, Core Thickness, and Paddle
# Type — it never reads "Firepower" (Z-score/percentile/tier) or any other
# column not listed in REQUIRED_COLUMNS above. Firepower is one of
# PickleballEffect's own proprietary composite metrics (see PADDLE_DATA_
# SETUP.md's Data licensing section) and simply isn't part of this
# pipeline's input at all — there's no "handling" of it to worry about
# because main() never selects that column out of the row in the first
# place.
# ---------------------------------------------------------------------------


def skill_level(twist_weight_percentile, core_thickness_mm, paddle_type):
    points = 0
    forgiveness = twist_weight_percentile if twist_weight_percentile is not None else 0.5
    if forgiveness >= 0.6:
        points += 1
    elif forgiveness <= 0.35:
        points -= 1
    if core_thickness_mm is not None:
        if core_thickness_mm >= 17:
            points += 1
        elif core_thickness_mm <= 13:
            points -= 1
    if paddle_type == "Control":
        points += 1
    elif paddle_type == "Power":
        points -= 1
    if points >= 1:
        return "Beginner"
    if points <= -1:
        return "Advanced"
    return "Intermediate"


# ---------------------------------------------------------------------------
# Step 6 — vendor links.
#
# Never carry forward the source file's own "Link to Paddle" column — those
# are PickleballEffect's own affiliate short-links (short.gy), and
# reproducing them would route clicks (and any commission) to them instead
# of you. paddle-vendor-map.json instead maps each brand to its own
# official site, split into two tiers:
#   - vendorUrl: the brand's real homepage/shop, always safe to link to.
#   - searchVerified: true only for brands where {origin of vendorUrl}
#     /search?q= was directly fetched and confirmed to return real product
#     results (not a 404, not a bot-block, not a wrong-department result).
#     Brands without this get a plain vendorUrl link instead of a guessed
#     search URL — see PADDLE_DATA_SETUP.md for the full list of what
#     failed and why (Adidas/Franklin/Head/Vulcan/Wilson blocked automated
#     verification; Callaway/Element6 confirmed 404; Versix had an expired
#     TLS cert at verification time).
# ---------------------------------------------------------------------------


def load_vendor_map():
    return json.loads(VENDOR_MAP_PATH.read_text())


def vendor_fields(brand, vendor_map):
    """Returns (vendorUrl, vendorSearchBase) for a brand, or (None, None) if
    the brand has no entry in paddle-vendor-map.json at all."""
    vendor = vendor_map.get(brand)
    if vendor is None:
        return None, None
    vendor_url = vendor["vendorUrl"]
    search_base = None
    if vendor.get("searchVerified"):
        # The verified search route is always at the domain root (e.g.
        # https://www.babolat.com/search?q=), even when vendorUrl itself
        # points at a specific collection/category page (e.g.
        # https://www.babolat.com/us/pickleball/paddles.html) — so this
        # must come from vendorUrl's *origin*, not vendorUrl with a suffix
        # appended.
        origin = urlparse(vendor_url)
        search_base = f"{origin.scheme}://{origin.netloc}/search?q="
    return vendor_url, search_base


# ---------------------------------------------------------------------------
# Manually-added paddles — the durability layer.
#
# The PickleballEffect export doesn't carry every prominent brand (it's missing
# Onix, Yonex, Legacy, Electrum, Recess, Prince, Nettie, Master Athletics, …).
# Those paddles were researched from the manufacturers' own sites and live in
# scripts/manual-paddles.json. Without this merge, every rebuild would wipe them.
#
# manual-paddles.json holds ONLY raw manufacturer facts — name, brand, price,
# shape, type, core thickness, weight, grip dims, year, USA-Pickleball approval.
# It deliberately carries NONE of PickleballEffect's lab-tested fields (twist/
# power/spin/swing percentiles, balance point, impact feel), because these
# paddles genuinely haven't been through that bench — the site already renders
# them as "specs only" (see assets/paddle-model.js hasLab()). So there's no
# licensing question here: nothing proprietary is being reproduced.
#
# A manual paddle whose id the export ALSO produces is dropped in favour of the
# export's row — if PickleballEffect later tests one of these, its real lab data
# wins automatically and the manual stub steps aside with no edit needed.
# ---------------------------------------------------------------------------


def load_manual_paddles():
    """Parsed scripts/manual-paddles.json, or [] if it's absent. Shape: a list
    of {"brand", "officialSite"?, "paddles": [ {name, shape, paddleType,
    coreThicknessMm, weightOz, gripLengthIn, gripSizeIn, price, yearReleased,
    approvalBody} ]}. Any missing/null spec is simply omitted from the record,
    exactly as the export path drops nulls."""
    if not MANUAL_PADDLES_PATH.exists():
        return []
    return json.loads(MANUAL_PADDLES_PATH.read_text())


def build_manual_records(manual_groups, vendor_map, export_ids):
    """Turn manual-paddles.json's raw facts into paddle records in the SAME
    shape (and field order) main() emits for export rows. Skips any paddle whose
    id already came from the export. skillLevel is derived with a neutral
    (unknown) twist weight — these paddles have no measured forgiveness — via the
    same skill_level() the export path uses; every lab field is left absent."""
    seen = {}
    records = []
    for group in manual_groups:
        brand = clean_brand(group["brand"])
        vendor_url, search_base = vendor_fields(brand, vendor_map)
        for pin in group.get("paddles", []):
            name = clean_name(pin.get("name")) or "Unnamed paddle"
            base_id = slugify(f"{brand} {name}")
            if base_id in export_ids:
                # The export already carries this exact paddle (with real lab
                # data). Don't shadow it with a spec-only manual copy.
                continue
            paddle_id = base_id
            n = 1
            while paddle_id in seen:
                n += 1
                paddle_id = f"{base_id}--dup{n}"
            seen[paddle_id] = True

            core = num(pin.get("coreThicknessMm"), 1)
            paddle_type = pin.get("paddleType")
            paddle = {
                "id": paddle_id,
                "name": name,
                "brand": brand,
                "price": num(pin.get("price"), 2),
                "approvalBody": pin.get("approvalBody"),
                "shape": pin.get("shape"),
                "paddleType": paddle_type,
                "coreThicknessMm": core,
                "weightOz": num(pin.get("weightOz"), 2),
                "skillLevel": skill_level(None, core, paddle_type),
                "gripLengthIn": num(pin.get("gripLengthIn"), 2),
                "gripSizeIn": num(pin.get("gripSizeIn"), 2),
                "yearReleased": whole(pin.get("yearReleased")),
            }
            paddle = {k: v for k, v in paddle.items() if v is not None}
            if vendor_url:
                paddle["vendorUrl"] = vendor_url
                if search_base:
                    paddle["vendorSearchBase"] = search_base
            records.append(paddle)
    return records


def merge_manual_into_catalog(paddles, manual_records):
    """Insert manual records into the export-built catalog, keeping brand groups
    contiguous. A brand already in the export gets its manual paddles appended;
    a brand new to the catalog is inserted as a fresh group at its
    case-insensitive-alphabetical position (matching the export's own brand
    order). Within a brand, manual paddles are ordered by name so the output is
    deterministic run to run."""
    groups = []
    for p in paddles:
        if groups and groups[-1][0] == p["brand"]:
            groups[-1][1].append(p)
        else:
            groups.append([p["brand"], [p]])

    by_brand = {}
    for r in manual_records:
        by_brand.setdefault(r["brand"], []).append(r)

    existing_brands = {b for b, _ in groups}
    for brand, recs in by_brand.items():
        recs = sorted(recs, key=lambda r: r["name"].lower())
        if brand in existing_brands:
            for g in groups:
                if g[0] == brand:
                    g[1].extend(recs)
                    break
        else:
            idx = len(groups)
            for i, (b, _) in enumerate(groups):
                if brand.lower() < b.lower():
                    idx = i
                    break
            groups.insert(idx, [brand, recs])

    return [p for _, lst in groups for p in lst]


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    numbers_path = sys.argv[1]

    raw_rows = load_rows(numbers_path)
    vendor_map = load_vendor_map()

    seen_ids = {}
    paddles = []
    unmapped_brands = set()

    # Spin arrives as a raw RPM measurement with no percentile column, so rank
    # it within the catalog first and band the result. This is the single
    # biggest granularity win in the refresh: the "Spin Rating" word column has
    # four values, so 349 paddles previously shared four spin scores.
    spin_rank = rank_percentile([num(r.get("Spin (RPM)")) for r in raw_rows])

    for row in raw_rows:
        brand = clean_brand(row["Brand"])
        name = clean_name(row["Paddle Name"]) or "Unnamed paddle"

        paddle_id = dedupe_id(slugify(f"{brand} {name}"), seen_ids)

        core_thickness = num(row["Core Thickness (mm)"], 1)
        twist_weight_pct = num(row["Twist Weight Percentile"], 2)
        power_pct = num(row["Power Percentile"], 2)
        swing_weight_pct = num(row["Swing Weight Percentile"], 2)
        paddle_type = row["Paddle Type"] or None
        spin_rpm = num(row.get("Spin (RPM)"))
        spin_pct = spin_rank.get(spin_rpm) if spin_rpm is not None else None

        paddle = {
            "id": paddle_id,
            "name": name,
            "brand": brand,
            "price": num(row["Price"], 2),
            "approvalBody": row["Approval Body"] or None,
            "shape": row["Shape"] or None,
            "paddleType": paddle_type,
            "impactFeel": row["Impact Feel"] or None,
            "coreThicknessMm": core_thickness,
            "weightOz": num(row["Weight (oz)"], 2),
            # Banded before storage — skill_level below still reads the raw
            # twist_weight_pct (see coarsen_percentile).
            "twistWeightPercentile": coarsen_percentile(twist_weight_pct),
            "balancePointMm": num(row["Balance Point (mm)"], 0),
            "spinRating": row["Spin Rating"] or None,
            # Banded rank of the raw RPM measurement. spinRating (the four-word
            # column) is kept alongside it because the grid's spec chip shows a
            # word, and because a paddle can carry the word with no RPM reading.
            "spinPercentile": coarsen_percentile(spin_pct),
            "powerPercentile": coarsen_percentile(power_pct),
            # The real measurement, replacing the balance-point-plus-static-weight
            # approximation assets/paddle-quiz.js used to compute at runtime.
            "swingWeightPercentile": coarsen_percentile(swing_weight_pct),
            "skillLevel": skill_level(twist_weight_pct, core_thickness, paddle_type),
            # Raw manufacturer specs — safe to store and show.
            "gripLengthIn": num(row.get("Grip Length (in)"), 2),
            "gripSizeIn": num(row.get("Grip Size (in)"), 2),
            "yearReleased": whole(row.get("Year Released")),
        }
        # Drop keys with no value rather than shipping nulls — the file is
        # fetched on every quiz page load, and the site's rule is to say nothing
        # rather than render an empty spec (see assets/paddle-grid.js cardHtml).
        paddle = {k: v for k, v in paddle.items() if v is not None}

        vendor_url, search_base = vendor_fields(brand, vendor_map)
        if vendor_url is None:
            unmapped_brands.add(brand)
        else:
            paddle["vendorUrl"] = vendor_url
            if search_base:
                paddle["vendorSearchBase"] = search_base

        paddles.append(paddle)

    # Merge the manufacturer-sourced paddles the export doesn't carry (Onix,
    # Yonex, …). Done before the unmapped-brand warning so a manual brand with
    # no vendor-map entry is surfaced the same way an export brand would be.
    export_ids = {p["id"] for p in paddles}
    manual_groups = load_manual_paddles()
    for group in manual_groups:
        if clean_brand(group["brand"]) not in vendor_map:
            unmapped_brands.add(clean_brand(group["brand"]))
    manual_records = build_manual_records(manual_groups, vendor_map, export_ids)
    paddles = merge_manual_into_catalog(paddles, manual_records)

    if unmapped_brands:
        print(
            f"WARNING: {len(unmapped_brands)} brand(s) have no entry in "
            f"scripts/paddle-vendor-map.json and got no vendor link at all: "
            f"{sorted(unmapped_brands)}\n"
            f"See PADDLE_DATA_SETUP.md step 5 to research and add them "
            f"before shipping.",
            file=sys.stderr,
        )

    # Compact, single-line JSON — matches the existing format (keeps the
    # payload small for a file every quiz page-load fetches).
    OUTPUT_PATH.write_text(json.dumps(paddles, separators=(",", ":"), ensure_ascii=False))

    from collections import Counter

    paddle_count = len(paddles)
    searchable_count = sum(1 for p in paddles if "vendorSearchBase" in p)
    print(f"Wrote {paddle_count} paddles to {OUTPUT_PATH} ({len(manual_records)} merged from manual-paddles.json)")
    print(f"Skill level distribution: {dict(Counter(p['skillLevel'] for p in paddles))}")
    print(f"Paddles with a verified on-site search link: {searchable_count}/{paddle_count}")


if __name__ == "__main__":
    main()
