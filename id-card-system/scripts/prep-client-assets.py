"""
Prepare the client's newly supplied brand assets.

  1. NEW LOGO  - the red circular "पूर्ण कबीरा सब धर्म सहायता समिति / बागपत /
     रजिस्ट्रेशन सं० 29/2024" emblem. Its outer margin is plain white, so a
     border flood-fill removes it cleanly while preserving the white disc inside
     the emblem (which is not connected to the border).

  2. NEW STAMP - the "Punam Kabira Sarv Dharam Sahayata Trust / Founder President"
     rubber stamp, photographed on pale green paper. A flood fill cannot be used
     here: the paper is textured and unevenly lit, so instead alpha is derived
     from how far each pixel sits from the paper colour. Only genuinely inked
     pixels stay opaque, which lifts the green paper off completely.

Outputs
  src/assets/org/logo-client.png   tight, transparent background
  src/assets/org/stamp-client.png  circular, transparent paper

Run: python scripts/prep-client-assets.py
"""

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ORG = ROOT / "src" / "assets" / "org"
DL = Path.home() / "Downloads"

LOGO_SRC = DL / "WhatsApp Image 2026-10-09 at 9.54.55 AM.jpeg"
STAMP_SRC = DL / "WhatsApp Image 2026-10-09 at 10.08.19 AM.jpeg"


# ---------------------------------------------------------------------------
# Logo: border flood-fill to transparent, then trim
# ---------------------------------------------------------------------------

def flood_to_transparent(img: Image.Image, tolerance: int = 42) -> Image.Image:
    img = img.convert("RGBA")
    w, h = img.size
    px = img.load()
    seen = bytearray(w * h)
    q: deque[tuple[int, int]] = deque()

    def push(x, y):
        i = y * w + x
        if not seen[i]:
            seen[i] = 1
            q.append((x, y))

    def is_bg(p):
        r, g, b, a = p
        return a == 0 or (r >= 255 - tolerance and g >= 255 - tolerance and b >= 255 - tolerance)

    for x in range(w):
        push(x, 0); push(x, h - 1)
    for y in range(h):
        push(0, y); push(w - 1, y)

    while q:
        x, y = q.popleft()
        if not is_bg(px[x, y]):
            continue
        px[x, y] = (255, 255, 255, 0)
        if x > 0: push(x - 1, y)
        if x < w - 1: push(x + 1, y)
        if y > 0: push(x, y - 1)
        if y < h - 1: push(x, y + 1)

    return img


def trim(img: Image.Image, pad: int = 4) -> Image.Image:
    box = img.getbbox()
    if not box:
        return img
    l, t, r, b = box
    return img.crop((
        max(0, l - pad), max(0, t - pad),
        min(img.width, r + pad), min(img.height, b + pad),
    ))


def prepare_logo() -> None:
    img = Image.open(LOGO_SRC)
    print(f"logo source {img.size}")
    out = trim(flood_to_transparent(img))
    out = out.resize((700, round(out.height * 700 / out.width)), Image.LANCZOS)
    path = ORG / "logo-client.png"
    out.save(path, "PNG", optimize=True)
    print(f"  -> {path.name}  {out.width}x{out.height}")


# ---------------------------------------------------------------------------
# Stamp: alpha from distance from the paper colour
# ---------------------------------------------------------------------------

def prepare_stamp() -> None:
    img = Image.open(STAMP_SRC).convert("RGB")
    print(f"stamp source {img.size}")
    arr = np.asarray(img).astype(float)
    h, w = arr.shape[:2]

    # Estimate the paper from the outer margin, where there is no ink.
    margin = np.concatenate([
        arr[: int(h * 0.08)].reshape(-1, 3),
        arr[:, : int(w * 0.08)].reshape(-1, 3),
    ])
    paper = np.median(margin, axis=0)
    paper_luma = float(0.299 * paper[0] + 0.587 * paper[1] + 0.114 * paper[2])
    # Paper is green-biased; the ink is purple (red + blue), so greenness is
    # positive for paper and strongly negative for ink. Shadows keep the paper's
    # hue ratio, which is exactly what lets this separate them.
    paper_green = float(paper[1] - (paper[0] + paper[2]) / 2)
    print(f"  paper luma {paper_luma:.1f}  greenness {paper_green:+.1f}")

    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    luma = 0.299 * r + 0.587 * g + 0.114 * b
    greenness = g - (r + b) / 2

    darkness = (1 - luma / paper_luma) * 100          # 0 for paper, high for ink
    non_green = np.maximum(0.0, paper_green - greenness) * 2

    ink = darkness + non_green
    # Shadows reach ~34, paper texture ~6, ink runs far higher. The gap between
    # them is what keeps folds and creases out of the result.
    lo, hi = 45.0, 110.0
    alpha = np.clip((ink - lo) / (hi - lo), 0, 1) ** 0.9

    # The stamp ink photographs pale on paper and washes out completely when
    # placed on the card's white area. Deepen it so it reads like fresh ink:
    # scale each channel down and lift the difference between the channels so
    # the violet stays violet instead of turning grey.
    rgb = arr.copy()
    rgb *= 0.68                                     # deepen
    spread = rgb.max(axis=2, keepdims=True) - rgb.min(axis=2, keepdims=True)
    rgb += spread * 0.30                            # re-saturate
    rgb = np.clip(rgb, 0, 255)

    rgba = np.dstack([
        rgb.astype(np.uint8),
        (alpha * 255).astype(np.uint8),
    ])
    out = Image.fromarray(rgba, "RGBA")

    # Crop to real ink only: ignore the near-transparent halo when measuring.
    solid = alpha >= 0.5
    ys, xs = np.nonzero(solid)
    if len(xs):
        pad = 6
        out = out.crop((
            max(0, int(xs.min()) - pad), max(0, int(ys.min()) - pad),
            min(out.width, int(xs.max()) + pad), min(out.height, int(ys.max()) + pad),
        ))
        print(f"  ink bbox x {xs.min()}-{xs.max()}  y {ys.min()}-{ys.max()}")

    # Keep the stamp RECTANGULAR. The client's signature runs out to the right of
    # the circular ink, so a round mask would clip the signature off. The card
    # reserves a rectangular slot for it instead.
    size = 620
    scale = size / out.width
    out = out.resize((size, max(1, round(out.height * scale))), Image.LANCZOS)

    path = ORG / "stamp-client.png"
    out.save(path, "PNG", optimize=True)
    print(f"  -> {path.name}  {out.width}x{out.height}  (rectangular, signature intact)")


if __name__ == "__main__":
    prepare_logo()
    prepare_stamp()