"""
Crop the circular stamp out of the organisation's rubber stamp, for the seal
that overlaps the member photo on the card.

The source image is a rectangle: the round stamp on the left plus the signature
scribble running off to the right. The card's seal slot is circular, so only the
round part is used.

Run: python scripts/extract-stamp.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src" / "assets" / "org" / "signature.png"
OUT = ROOT / "src" / "assets" / "org" / "stamp.png"


def main() -> None:
    img = Image.open(SRC).convert("RGBA")
    w, h = img.size
    print(f"source {w}x{h}")

    # Circle of the stamp, measured from the artwork.
    cx, cy, r = 272, 198, 178

    crop = img.crop((cx - r, cy - r, cx + r, cy + r)).resize((420, 420), Image.LANCZOS)

    mask = Image.new("L", (420, 420), 0)
    ImageDraw.Draw(mask).ellipse((2, 2, 417, 417), fill=255)
    crop.putalpha(mask)

    crop.save(OUT, "PNG", optimize=True)
    print(f"wrote {OUT.relative_to(ROOT)} 420x420 from box "
          f"({cx - r},{cy - r})-({cx + r},{cy + r})")


if __name__ == "__main__":
    main()