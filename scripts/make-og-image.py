#!/usr/bin/env python3
"""Generate assets/logo/og-image.png — the 1200x630 social-share card used by
og:image / twitter:image. Re-run after a brand change:
    python3 scripts/make-og-image.py
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
BG = (18, 50, 64)        # --bay-deep
OPTIC = (215, 233, 75)   # --optic (lime)
WHITE = (255, 255, 255)
MUTED = (183, 201, 208)

OUT = Path(__file__).resolve().parent.parent / "assets" / "logo" / "og-image.png"


def font(size, bold=True):
    for path, idx in [("/System/Library/Fonts/Helvetica.ttc", 1 if bold else 0),
                      ("/System/Library/Fonts/SFNS.ttf", 0)]:
        try:
            return ImageFont.truetype(path, size, index=idx)
        except Exception:
            continue
    return ImageFont.load_default()


img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)

# top accent bar
d.rectangle([0, 0, W, 12], fill=OPTIC)

# pickleball motif on the right — a lime paddle-ball with holes
cx, cy, r = 985, 300, 150
d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=OPTIC)
hole_r = 13
for gx in range(-2, 3):
    for gy in range(-2, 3):
        px, py = cx + gx * 50, cy + gy * 50
        if (px - cx) ** 2 + (py - cy) ** 2 <= (r - 26) ** 2:
            d.ellipse([px - hole_r, py - hole_r, px + hole_r, py + hole_r], fill=BG)

# wordmark
d.text((80, 150), "Pickleball", font=font(98, bold=True), fill=WHITE)
d.text((80, 258), "Bay Area", font=font(98, bold=True), fill=OPTIC)

# tagline
sub = font(40, bold=False)
d.text((84, 402), "Find a court near you — 42 Bay Area", font=sub, fill=MUTED)
d.text((84, 452), "cities, 200+ public courts.", font=sub, fill=MUTED)

# url
d.text((84, 542), "pickleball-bay-area.com", font=font(30, bold=True), fill=OPTIC)

OUT.parent.mkdir(parents=True, exist_ok=True)
img.save(OUT, "PNG")
print(f"wrote {OUT} ({img.size[0]}x{img.size[1]})")
