# Handoff: Site icon & favicon — Pickleball Bay Area

## Overview
Production favicon/site-icon set for pickleball-bay-area.com: a sage map pin with a pickleball (7-hole pattern) knocked out of the pin head in brand cream. Encodes "find courts near you" in one mark. Chosen as option 3a from the design exploration.

## About the files
Unlike a UI handoff, **these assets are production-ready** — copy them into the site as-is. `Icon Options.dc.html` in the parent project is the design exploration (HTML reference only, not needed for implementation).

## Task for Claude Code
1. Copy every file below (except this README) into the site's static root (e.g. `public/` or wherever `/assets` is served — files must be reachable at the paths used in the tags, adjust paths if you place them elsewhere, e.g. `/assets/logo/`).
2. Remove any existing favicon `<link>` tags, then add to `<head>` of every page/layout:

```html
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
```

3. Create `/site.webmanifest` (skip if one exists — then just merge the `icons` array):

```json
{
  "name": "Pickleball Bay Area",
  "short_name": "PB Bay Area",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "theme_color": "#f7f2e7",
  "background_color": "#f7f2e7",
  "display": "browser"
}
```

4. Optional: update `<meta name="theme-color">` from `#ffffff` to `#f7f2e7` to match.

## Files
- `favicon.svg` — master vector, 64×64 viewBox, rounded-corner tile baked in (rx 14/64). Source of truth; all PNGs were rendered from it.
- `favicon.ico` — 16/32/48 multi-size (PNG-compressed entries).
- `favicon-16.png`, `favicon-32.png` — raster fallbacks if you prefer explicit `<link sizes>` tags over .ico.
- `apple-touch-icon.png` — 180×180, **square corners** (iOS applies its own mask; don't use the rounded tile here).
- `icon-192.png`, `icon-512.png` — manifest icons, rounded tile.
- `icon-maskable-512.png` — square, artwork scaled to 82% so the pin tip survives Android's circular mask.

## Design tokens
- Cream (tile bg + ball + holes-knockout): `#f7f2e7`
- Sage (pin): `#55665f`
- Ink `#15211f` — not used in this mark, but is the brand's text color.
- Tile corner radius: 14/64 ≈ 22% of icon size.

## Mark geometry (from favicon.svg, 64×64 grid)
- Pin: head circle r19 centered (32, 25), tail tapering to tip at (32, 58).
- Ball: cream circle r12 at (32, 25).
- Holes: 7 sage circles r2.5 — center (32, 25); mid ring (24.5, 25), (39.5, 25); upper (28.2, 18.6), (35.8, 18.6); lower (28.2, 31.4), (35.8, 31.4).

## Regenerating other sizes
Render `favicon.svg` at any size (it scales losslessly). For maskable variants, draw the square version (rx 0) at 82% scale centered on a cream field.
