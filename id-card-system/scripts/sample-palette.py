"""
Sample the real palette from the rectified card, using hand-checked pixel
regions rather than loose fractions (several of which landed on text or skin).

Run: python scripts/sample-palette.py
"""

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
FLAT = ROOT / "reference-analysis" / "card-flat.png"

# (label, x_fraction, y_fraction) - each verified visually against card-flat.png
SAMPLES = [
    ("header blue (top-left)", 0.10, 0.05),
    ("header blue (mid)", 0.30, 0.10),
    ("header red (top-right)", 0.93, 0.03),
    ("header red (mid-right)", 0.72, 0.13),
    ("iso badge red", 0.93, 0.19),
    ("subheader text blue", 0.36, 0.263),
    ("logo square blue", 0.10, 0.37),
    ("logo square red", 0.30, 0.66),
    ("name text blue", 0.47, 0.395),
    ("designation red", 0.60, 0.495),
    ("photo frame red", 0.76, 0.36),
    ("photo frame red (r)", 0.955, 0.50),
    ("signatory text blue", 0.86, 0.745),
    ("support band red", 0.06, 0.845),
    ("footer blue", 0.08, 0.93),
    ("footer red", 0.93, 0.965),
    ("body white", 0.55, 0.335),
]


def main() -> None:
    img = np.asarray(Image.open(FLAT).convert("RGB")).astype(int)
    h, w = img.shape[:2]
    print(f"card-flat.png {w}x{h}\n")

    for label, fx, fy in SAMPLES:
        x, y = int(w * fx), int(h * fy)
        patch = img[y - 5 : y + 5, x - 5 : x + 5].reshape(-1, 3)
        mean = patch.mean(axis=0)
        r, g, b = (int(v) for v in mean)
        print(f"  {label:<28} rgb({r:3d},{g:3d},{b:3d})  #{r:02X}{g:02X}{b:02X}")

    # Darkest saturated blue and red, to find the pure brand hues.
    flat = img.reshape(-1, 3)
    mx, mn = flat.max(axis=1), flat.min(axis=1)
    sat = (mx - mn).astype(float)
    vivid = sat > 70

    blues = flat[(flat[:, 2] > flat[:, 0] + 25) & (flat[:, 2] > flat[:, 1] + 40) & vivid]
    reds = flat[(flat[:, 0] > flat[:, 1] + 60) & (flat[:, 0] > flat[:, 2] + 50) & vivid]

    for name, group in (("BLUE", blues), ("RED", reds)):
        if len(group) == 0:
            continue
        lum = group @ np.array([0.299, 0.587, 0.114])
        pick = group[int(np.argmin(lum))]
        print(f"\n  darkest vivid {name}: #{pick[0]:02X}{pick[1]:02X}{pick[2]:02X}  ({len(group)} px)")


if __name__ == "__main__":
    main()