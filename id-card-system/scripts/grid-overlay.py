"""
Overlay a labelled measurement grid on the reference photo so the card's
corners and internal layout can be read off precisely.

The automatic mask in analyze-reference.py is unreliable here because the card
has large WHITE regions and the photo background is a warm brown wall, so
saturation-based detection misses the card's left edge. Rather than keep tuning
thresholds, we measure the corners visually from this grid and then feed those
coordinates back into analyze-reference.py.

Writes: reference-analysis/grid.png

Run:  python scripts/grid-overlay.py
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SRC = Path.home() / "Downloads" / "WhatsApp Image 2026-10-06 at 8.50.43 PM (1).jpeg"
OUT = ROOT / "reference-analysis"

# Region of interest: the card sits roughly in the upper-middle of the frame.
X0, Y0, X1, Y1 = 0, 150, 1204, 900
SCALE = 2
STEP = 50  # source pixels between gridlines
MAJOR = 100


def load_font(size: int = 22):
    for candidate in (
        "C:/Windows/Fonts/arialbd.ttf",
        "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/segoeui.ttf",
    ):
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


def main() -> None:
    OUT.mkdir(exist_ok=True)
    img = Image.open(SRC).convert("RGB")

    crop = img.crop((X0, Y0, X1, Y1))
    canvas = crop.resize((crop.width * SCALE, crop.height * SCALE), Image.LANCZOS)
    draw = ImageDraw.Draw(canvas)
    font = load_font()

    def label(text: str, x: int, y: int) -> None:
        draw.text(
            (x, y),
            text,
            font=font,
            fill=(0, 0, 0),
            stroke_width=3,
            stroke_fill=(255, 255, 255),
        )

    for sx in range(X0, X1 + 1, STEP):
        x = (sx - X0) * SCALE
        is_major = sx % MAJOR == 0
        draw.line([(x, 0), (x, canvas.height)],
                  fill=(0, 190, 0) if is_major else (0, 235, 0),
                  width=3 if is_major else 1)
        if is_major:
            label(str(sx), x + 4, 4)

    for sy in range(Y0, Y1 + 1, STEP):
        y = (sy - Y0) * SCALE
        is_major = sy % MAJOR == 0
        draw.line([(0, y), (canvas.width, y)],
                  fill=(0, 190, 0) if is_major else (0, 235, 0),
                  width=3 if is_major else 1)
        if is_major:
            label(str(sy), 4, y + 4)

    canvas.save(OUT / "grid.png")
    print(f"wrote {OUT / 'grid.png'} ({canvas.width}x{canvas.height})")
    print("Gridline labels are SOURCE image pixel coordinates.")


if __name__ == "__main__":
    main()