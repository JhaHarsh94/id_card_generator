"""
Extract the deity photograph (the circular portrait at the centre of the
organisation logo) so it can be placed in the card header.

The card's top-centre circle is the same portrait, without the surrounding
text ring, so it is cropped from the logo rather than supplied separately.

Run: python scripts/extract-portrait.py
"""

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src" / "assets" / "org" / "logo.png"
OUT = ROOT / "src" / "assets" / "org" / "portrait.png"


def main() -> None:
    img = Image.open(SRC).convert("RGBA")
    w, h = img.size
    arr = np.asarray(img).astype(int)
    print(f"logo.png {w}x{h}")

    # Centre and radius of the portrait disc, measured from the logo artwork.
    # The ring of text sits outside this circle, so anything larger clips red.
    cx, cy, radius = 313, 301, 186

    pad = radius
    box = (cx - pad, cy - pad, cx + pad, cy + pad)
    crop = img.crop(box)

    # Circular alpha mask so it drops straight into the card's round frame.
    crop = crop.resize((512, 512), Image.LANCZOS)
    mask = Image.new("L", (512, 512), 0)
    from PIL import ImageDraw

    ImageDraw.Draw(mask).ellipse((0, 0, 511, 511), fill=255)
    crop.putalpha(mask)

    crop.save(OUT, "PNG", optimize=True)
    print(f"wrote {OUT.relative_to(ROOT)} ({crop.width}x{crop.height}) "
          f"from box {box} r={radius}")


if __name__ == "__main__":
    main()