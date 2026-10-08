"""
The reference photo has a strong blue colour cast: the card's white body
samples as #D1DDF3, which is not white. Sampling brand colours straight from
the raw pixels therefore overstates the blue.

This script estimates a grey-world white balance from the known-white regions
of the card, applies it, and re-reports the palette.

Run: python scripts/white-balance.py
"""

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
FLAT = ROOT / "reference-analysis" / "card-flat.png"
BALANCED = ROOT / "reference-analysis" / "card-balanced.png"

# Regions verified to be white paper on the card (blank margins / gaps).
WHITE_REGIONS = [
    (0.40, 0.330),  # gap above the name
    (0.30, 0.760),  # left of "All India"
    (0.62, 0.660),  # right of the validity line
    (0.20, 0.790),  # under the logo block
    (0.90, 0.320),  # far right of the sub-header
]


def main() -> None:
    img = Image.open(FLAT).convert("RGB")
    arr = np.asarray(img).astype(float)

    refs = []
    for fx, fy in WHITE_REGIONS:
        x, y = int(arr.shape[1] * fx), int(arr.shape[0] * fy)
        refs.append(arr[y - 6 : y + 6, x - 6 : x + 6].reshape(-1, 3).mean(axis=0))
    white = np.mean(refs, axis=0)
    print(f"measured white point: {white.round(1)}  -> #{int(white[0]):02X}{int(white[1]):02X}{int(white[2]):02X}")

    gains = 255.0 / white
    print(f"channel gains:       {gains.round(3)}")

    out = np.clip(arr * gains, 0, 255).astype(np.uint8)
    Image.fromarray(out).save(BALANCED)
    print(f"\nwrote {BALANCED.name}")

    flat = out.reshape(-1, 3)
    mx, mn = flat.max(axis=1), flat.min(axis=1)
    sat = (mx - mn).astype(float)

    blues = flat[(flat[:, 2] > flat[:, 0] + 30) & (flat[:, 2] > flat[:, 1] + 45) & (sat > 80)]
    reds = flat[(flat[:, 0] > flat[:, 1] + 70) & (flat[:, 0] > flat[:, 2] + 55) & (sat > 80)]

    for name, group in (("BLUE", blues), ("RED", reds)):
        if len(group) == 0:
            continue
        lum = group @ np.array([0.299, 0.587, 0.114])
        # Darkest is the most saturated, but take a robust 10th percentile so a
        # single shadowed pixel cannot define the palette.
        cut = np.percentile(lum, 10)
        pick = group[lum <= cut].mean(axis=0)
        r, g, b = (int(v) for v in pick.round())
        print(f"  {name:<5} #{r:02X}{g:02X}{b:02X}   rgb({r},{g},{b})   ({len(group)} px)")


if __name__ == "__main__":
    main()