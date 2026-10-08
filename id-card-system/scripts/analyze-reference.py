"""
Reference-card analysis helper.

The reference ID card was photographed at a slight angle against a wall, so
before reproducing it in HTML/CSS we need:
  1. the card detected and de-skewed (perspective corrected) to a flat CR80 ratio
  2. exact brand colours sampled from the rectified result
  3. layout guides (element bounding boxes) so the CSS matches the original

Writes to  reference-analysis/  which is NOT part of the app bundle.

Run:  python scripts/analyze-reference.py
"""

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = Path.home() / "Downloads" / "WhatsApp Image 2026-10-06 at 8.50.43 PM (1).jpeg"
OUT = ROOT / "reference-analysis"

# CR80 smart-card: 85.60 x 53.98 mm  ->  ratio 1.5854
CARD_RATIO = 85.60 / 53.98
TARGET_W = 1712  # 2x of 856 for crisp inspection
TARGET_H = round(TARGET_W / CARD_RATIO)


def detect_corners(img: Image.Image) -> np.ndarray:
    """Find the card quad by isolating saturated (non-wall) pixels."""
    rgb = np.asarray(img.convert("RGB")).astype(np.int16)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx = rgb.max(axis=2)
    mn = rgb.min(axis=2)
    sat = mx - mn
    # Card = strongly red OR strongly blue. Wall is low-saturation beige.
    red = (r > 110) & (r - g > 55) & (r - b > 55)
    blue = (b - r > 25) & (b - g > 45)
    mask = (red | blue).astype(np.uint8)

    ys, xs = np.nonzero(mask)
    if len(xs) == 0:
        raise SystemExit("card not detected")

    left, right = int(xs.min()), int(xs.max())
    top, bottom = int(ys.min()), int(ys.max())
    print(f"mask bbox: x {left}-{right}, y {top}-{bottom}")

    # A diagonal-extreme test is only valid for a quad whose diagonals are
    # roughly axis-aligned. This photo is rotated the other way, so instead
    # solve for each edge directly: take the extreme pixel in a thin band along
    # each side of the bbox, which correctly recovers the skewed corners.
    w_span, h_span = right - left, bottom - top
    band_y = max(2, int(h_span * 0.04))
    band_x = max(2, int(w_span * 0.03))

    def extreme_in(band, want_max_x, key_y):
        sub_x, sub_y = xs[band], ys[band]
        idx = int(np.argmax(sub_x) if want_max_x else np.argmin(sub_x))
        return int(sub_x[idx]), int(sub_y[idx])

    top_b = ys <= top + band_y
    bot_b = ys >= bottom - band_y

    tl = extreme_in(top_b, False, None)
    tr = extreme_in(top_b, True, None)
    bl = extreme_in(bot_b, False, None)
    br = extreme_in(bot_b, True, None)

    # Sanity check: the quad must be convex-ish and roughly the right size.
    def dist(a, b):
        return float(np.hypot(a[0] - b[0], a[1] - b[1]))

    top_w, bot_w = dist(tl, tr), dist(bl, br)
    left_h, right_h = dist(tl, bl), dist(tr, br)
    print(
        f"edge lengths: top={top_w:.0f} bottom={bot_w:.0f} "
        f"left={left_h:.0f} right={right_h:.0f}"
    )
    if not (0.6 * top_w < bot_w < 1.6 * top_w) or not (
        0.6 * left_h < right_h < 1.6 * left_h
    ):
        raise SystemExit(f"implausible quad: tl={tl} tr={tr} br={br} bl={bl}")

    return {"top_left": tl, "top_right": tr, "bottom_right": br, "bottom_left": bl}


def order_quad(c: dict) -> list[tuple[int, int]]:
    return [c["top_left"], c["top_right"], c["bottom_right"], c["bottom_left"]]


def main() -> None:
    OUT.mkdir(exist_ok=True)
    img = Image.open(SRC)
    print("source size:", img.size)

    corners = detect_corners(img)
    print("detected corners:", corners)

    # PIL wants the destination quad as the 4 corners in TL, TR, BR, BL order.
    dest = [(0, 0), (TARGET_W - 1, 0), (TARGET_W - 1, TARGET_H - 1), (0, TARGET_H - 1)]

    # Compute the perspective coefficients ourselves (new -> old mapping).
    src_quad = order_quad(corners)
    A = []
    B = []
    for (sx, sy), (dx, dy) in zip(src_quad, dest):
        A.append([dx, dy, 1, 0, 0, 0, -sx * dx, -sx * dy])
        B.append(sx)
        A.append([0, 0, 0, dx, dy, 1, -sy * dx, -sy * dy])
        B.append(sy)
    coeffs = np.linalg.solve(np.array(A, dtype=np.float64), np.array(B, dtype=np.float64))

    flat = img.convert("RGB").transform(
        (TARGET_W, TARGET_H), Image.PERSPECTIVE, coeffs, resample=Image.BICUBIC
    )
    flat.save(OUT / "card-rectified.png")
    print(f"rectified -> {TARGET_W}x{TARGET_H} (ratio {TARGET_W / TARGET_H:.4f})")

    # ---- sample dominant colours on horizontal bands -------------------------
    arr = np.asarray(flat).astype(int)
    bands = {
        "header": (0.02, 0.16),
        "subheader": (0.19, 0.23),
        "body": (0.30, 0.60),
        "support_band": (0.68, 0.74),
        "footer": (0.80, 0.96),
    }
    for name, (a, b) in bands.items():
        y0, y1 = int(TARGET_H * a), int(TARGET_H * b)
        strip = arr[y0:y1].reshape(-1, 3)
        # cluster roughly by bucketing
        q = (strip // 24) * 24
        uniq, counts = np.unique(q, axis=0, return_counts=True)
        top = uniq[counts.argsort()[::-1][:4]]
        palette = ["#%02X%02X%02X" % tuple(int(v) for v in c) for c in top]
        print(f"  {name:<14} {palette}")


if __name__ == "__main__":
    main()