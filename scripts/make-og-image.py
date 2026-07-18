#!/usr/bin/env python3
"""Generate assets/logo/og-image.png — the 1200x630 social-share card used by
og:image / twitter:image. Re-run after a brand change:
    python3 scripts/make-og-image.py

Brand is the sage-pin site icon (assets/logo/favicon.svg): a sage map pin with
a cream pickleball knocked out of the head. The pin is redrawn here in PIL from
the same 64x64 path geometry as the SVG — keep the two in sync by hand if the
mark ever changes.
"""
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
CREAM = (247, 242, 231)  # #f7f2e7 — tile bg + ball
SAGE = (85, 102, 95)     # #55665f — pin
INK = (21, 33, 31)       # #15211f — brand text
MUTED = (99, 112, 107)   # ink softened toward cream, for the tagline

SS = 4  # supersample factor for the vector mark

OUT = Path(__file__).resolve().parent.parent / "assets" / "logo" / "og-image.png"


def font(size, bold=True):
    for path, idx in [("/System/Library/Fonts/Helvetica.ttc", 1 if bold else 0),
                      ("/System/Library/Fonts/SFNS.ttf", 0)]:
        try:
            return ImageFont.truetype(path, size, index=idx)
        except Exception:
            continue
    return ImageFont.load_default()


def arc_points(cx, cy, r, a0, a1, n=64):
    """Sample a circular arc from a0 to a1 degrees (SVG y-down space)."""
    return [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / n)),
             cy + r * math.sin(math.radians(a0 + (a1 - a0) * i / n)))
            for i in range(n + 1)]


def bezier_points(p0, p1, p2, p3, n=64):
    """Sample a cubic bezier."""
    out = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        out.append((u**3 * p0[0] + 3 * u**2 * t * p1[0] + 3 * u * t**2 * p2[0] + t**3 * p3[0],
                    u**3 * p0[1] + 3 * u**2 * t * p1[1] + 3 * u * t**2 * p2[1] + t**3 * p3[1]))
    return out


def pin_mark(size):
    """Render the sage pin + cream ball on transparent bg, `size` px square.

    Geometry mirrors favicon.svg's 64x64 viewBox:
      path M32 6 a19 19 0 0 1 19 19 c0 13-19 33-19 33 s-19-20-19-33 a19 19 0 0 1 19-19 z
    """
    s = size * SS
    k = s / 64.0  # viewBox units -> px
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Pin outline: top arc right -> bezier down to tip -> bezier up -> arc back.
    pts = []
    pts += arc_points(32, 25, 19, -90, 0)                              # (32,6) -> (51,25)
    pts += bezier_points((51, 25), (51, 38), (32, 58), (32, 58))       # right flank -> tip
    pts += bezier_points((32, 58), (32, 58), (13, 38), (13, 25))       # tip -> left flank
    pts += arc_points(32, 25, 19, 180, 270)                            # (13,25) -> (32,6)
    d.polygon([(x * k, y * k) for x, y in pts], fill=SAGE)

    def circle(cx, cy, r, fill):
        d.ellipse([(cx - r) * k, (cy - r) * k, (cx + r) * k, (cy + r) * k], fill=fill)

    circle(32, 25, 12, CREAM)  # ball
    for hx, hy in [(32, 25), (39.5, 25), (24.5, 25), (35.8, 18.6),
                   (28.2, 18.6), (35.8, 31.4), (28.2, 31.4)]:
        circle(hx, hy, 2.5, SAGE)  # 7-hole pattern

    return img.resize((size, size), Image.LANCZOS)


img = Image.new("RGB", (W, H), CREAM)
d = ImageDraw.Draw(img)

# top accent bar
d.rectangle([0, 0, W, 12], fill=SAGE)

# the mark on the right
mark = pin_mark(340)
img.paste(mark, (830, 130), mark)

# wordmark
d.text((80, 150), "Pickleball", font=font(98, bold=True), fill=INK)
d.text((80, 258), "Bay Area", font=font(98, bold=True), fill=SAGE)

# tagline
sub = font(40, bold=False)
d.text((84, 402), "Find a court near you — 42 Bay Area", font=sub, fill=MUTED)
d.text((84, 452), "cities, 200+ public courts.", font=sub, fill=MUTED)

# url
d.text((84, 542), "pickleball-bay-area.com", font=font(30, bold=True), fill=SAGE)

OUT.parent.mkdir(parents=True, exist_ok=True)
img.save(OUT, "PNG")
print(f"wrote {OUT} ({img.size[0]}x{img.size[1]})")
