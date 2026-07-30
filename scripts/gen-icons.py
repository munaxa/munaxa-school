#!/usr/bin/env python3
"""Generate the Munaxa favicons and app icons from the brand-system source art.

Per the brand system:
  - Favicon (browser tab, tiny UI) -> the M symbol mark (docs/design-system/favicon.png),
    transparent, padded onto a square.
  - App Icon (mobile / desktop / PWA) -> the teal app-icon tile (docs/design-system/app-icon.png),
    made opaque (teal bleeds to the corners; the platform applies its own rounding/mask).

Writes:
  Web -- each Next app's src/app/ (admin, demo, landing):
    favicon.ico   (16/32/48/64) + icon.png (512)  = M symbol, transparent
    apple-icon.png (180)                           = app-icon tile, opaque
  Mobile launcher (apps/mobile/assets/icon/):
    ic_launcher.png (1024, opaque tile) ; ic_launcher_foreground.png (1024, M symbol, transparent)

Usage:  python3 scripts/gen-icons.py   (requires Pillow)
"""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SYMBOL = Image.open(os.path.join(ROOT, "docs/design-system/favicon.png")).convert("RGBA")
TILE = Image.open(os.path.join(ROOT, "docs/design-system/app-icon.png")).convert("RGBA")


def _dominant_teal(img):
    """Average the opaque pixels -> the tile's teal, used to bleed the icon background."""
    small = img.resize((48, 48))
    px = [p for p in small.getdata() if p[3] > 200]
    n = max(1, len(px))
    return (sum(p[0] for p in px) // n, sum(p[1] for p in px) // n, sum(p[2] for p in px) // n, 255)


def pad(mark, size, frac, bg=None):
    """Center `mark` on a size×size canvas, scaled so its longest side is `frac` of the canvas."""
    ss = 4
    s = size * ss
    canvas = Image.new("RGBA", (s, s), bg if bg else (0, 0, 0, 0))
    scale = (frac * s) / max(mark.size)
    m = mark.resize((max(1, int(mark.width * scale)), max(1, int(mark.height * scale))), Image.LANCZOS)
    canvas.alpha_composite(m, ((s - m.width) // 2, (s - m.height) // 2))
    out = canvas.resize((size, size), Image.LANCZOS)
    return out.convert("RGB") if bg else out


TEAL = _dominant_teal(TILE)


def write(img, *paths, **kw):
    for p in paths:
        full = os.path.join(ROOT, p)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        img.save(full, **kw)
        print("wrote", p)


web = ["apps/admin/src/app", "munaxademo/src/app", "landing/src/app"]
# Favicon + PWA icon = the M symbol, transparent.
write(pad(SYMBOL, 512, 0.86), *[f"{d}/icon.png" for d in web])
write(pad(SYMBOL, 256, 0.90), *[f"{d}/favicon.ico" for d in web],
      sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
# apple-touch icon = the app-icon tile, opaque (teal bleeds to the corners).
write(pad(TILE, 180, 0.98, bg=TEAL), *[f"{d}/apple-icon.png" for d in web])

# Mobile launcher: opaque tile + a transparent M-symbol adaptive foreground.
write(pad(TILE, 1024, 0.98, bg=TEAL), "apps/mobile/assets/icon/ic_launcher.png")
write(pad(SYMBOL, 1024, 0.60), "apps/mobile/assets/icon/ic_launcher_foreground.png")
