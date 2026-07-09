# Pickleball Bay Area — logo export

Final direction: **Golden Gate Ball (2a)** — the perforated pickleball as
the sun rising between two bridge towers, in the site's own court palette
(bay-deep background, poppy towers, optic-yellow ball).

## Files

| File | Use |
|---|---|
| `mark.svg` | The icon. Vector, scales to any size. Use for the site header logo. |
| `favicon.svg` | Same mark, modern SVG favicon (Chrome/Firefox/Safari 16+). |
| `favicon-16.png` / `favicon-32.png` | PNG favicon fallback for browsers/contexts that don't support SVG favicons. |
| `apple-touch-icon-180.png` | iOS home-screen / bookmark icon. |
| `icon-512.png` | Android/PWA manifest icon, social preview fallback. |
| `header-snippet.html` | Copy-paste-ready header markup showing the icon + wordmark lockup, matching the site's existing `.brand` pattern. |

## HTML head tags

```html
<link rel="icon" href="/assets/logo/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/assets/logo/favicon-32.png" sizes="32x32" type="image/png">
<link rel="icon" href="/assets/logo/favicon-16.png" sizes="16x16" type="image/png">
<link rel="apple-touch-icon" href="/assets/logo/apple-touch-icon-180.png">
```

## Header usage

```html
<a class="brand" href="/">
  <img src="/assets/logo/mark.svg" width="32" height="32" alt="Pickleball Bay Area">
  <span>Pickleball Bay Area</span>
</a>
```

The wordmark is plain text in `--font-display` (Space Grotesk, already
loaded site-wide) — not baked into the SVG — so it stays sharp and
theme-consistent with zero extra font loading.

## Colors used (all existing tokens, no new hex values)

- Background — `--bay-deep` `#123240`
- Towers / deck line — `--poppy` `#b54b2c`
- Ball — `--optic` `#d7e94b`
- Ball perforations — `--optic-deep` `#9aa81e`
- Ball "hole" center dot — `--bay-deep` `#123240`
- Base fog wash — `--fog` `#f5f7f6` at 55% opacity

## Minimum size

Legible down to 24px. Below that the towers compress into the tile edge and
the ball reads as a plain dot on navy — still on-brand, just less detailed.
Favicon sizes (16/32px) rely on this fallback reading, which is expected.
