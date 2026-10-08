"""
Rectify the reference card using corners read off reference-analysis/grid.png,
then emit exact band/element geometry and a colour palette for the CSS rebuild.

The corners below were measured from the labelled grid overlay. They are
stored as constants (rather than re-detected) because the card has large white
regions that defeat saturation-based detection.

Source: 1204 x 1600
Run:     python scripts/rectify.py
"""

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = Path.home() / "Downloads" / "WhatsApp Image 2026-10-06 at 8.50.43 PM (1).jpeg"
OUT = ROOT / "reference-analysis"

# Measured off the grid overlay, in source-image pixels.
CORNERS = {
    "top_left": (36, 187),
    "top_right": (1120, 196),
    "bottom_right": (1108, 872),
    "bottom_left": (44, 848),
}

# CR80 smart card, 85.60 x 53.98 mm.
CARD_W_MM, CARD_H_MM = 85.6, 53.98
TARGET_W = 1712
TARGET_H = round(TARGET_W * CARD_H_MM / CARD_W_MM)


def warp(img: Image.Image) -> Image.Image:
    src = [CORNERS[k] for k in ("top_left", "top_right", "bottom_right", "bottom_left")]
    dst = [
        (0, 0),
        (TARGET_W - 1, 0),
        (TARGET_W - 1, TARGET_H - 1),
        (0, TARGET_H - 1),
    ]
    a, b = [], []
    for (sx, sy), (dx, dy) in zip(src, dst):
        a.append([dx, dy, 1, 0, 0, 0, -sx * dx, -sx * dy])
        b.append(sx)
        a.append([0, 0, 0, dx, dy, 1, -sy * dx, -sy * dy])
        b.append(sy)
    coeffs = np.linalg.solve(np.array(a, float), np.array(b, float))
    return img.convert("RGB").transform(
        (TARGET_W, TARGET_H), Image.PERSPECTIVE, coeffs, resample=Image.BICUBIC
    )


def hexs(c) -> str:
    return "#%02X%02X%02X" % tuple(int(v) for v in c)


def main() -> None:
    OUT.mkdir(exist_ok=True)
    flat = warp(Image.open(SRC))
    flat.save(OUT / "card-flat.png")
    print(f"card-flat.png  {TARGET_W}x{TARGET_H}  ratio {TARGET_W / TARGET_H:.4f}")

    arr = np.asarray(flat).astype(int)
    rows = arr.mean(axis=1)
    # Row brightness: coloured bands are dark, white body is bright.
    dark = rows.mean(axis=1) < 205
    print("\ndark/red/blue bands as % of card height:")
    start = None
    for i, flag in enumerate(dark):
        if flag and start is None:
            start = i
        elif not flag and start is not None:
            if i - start > TARGET_H * 0.02:
                print(f"  {start / TARGET_H:6.1%} -> {i / TARGET_H:6.1%}")
            start = None
    if start is not None:
        print(f"  {start / TARGET_H:6.1%} -> {100.0:6.1%}")

    print("\nsampled colours:")
    spots = {
        "header blue": (0.05, 0.55),
        "header red": (0.04, 0.86),
        "subheader text blue": (0.245, 0.30),
        "name blue": (0.44, 0.60),
        "designation red": (0.575, 0.47),
        "logo square blue": (0.52, 0.12),
        "photo border red": (0.56, 0.94),
        "footer blue": (0.925, 0.20),
        "footer red": (0.93, 0.90),
    }
    for name, (fy, fx) in spots.items():
        y = int(TARGET_H * fy)
        x = int(TARGET_W * fx)
        patch = arr[y - 6 : y + 6, x - 6 : x + 6].reshape(-1, 3)
        print(f"  {name:<20} {hexs(patch.mean(axis=0))}")


if __name__ == "__main__":
    main()