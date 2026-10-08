"""
One-off asset preparation for the organization branding.

The source files are WhatsApp JPEGs with large white margins. This script:
  1. Converts near-white background pixels to transparent using a border flood-fill
     (so interior white text inside the logo ring is PRESERVED)
  2. Trims the result to its tight bounding box
  3. Writes a high-resolution PNG

Run:  python scripts/prep-assets.py
"""

from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ORG = ROOT / "src" / "assets" / "org"

# Tolerance for "is this pixel background white?" (0-255, per channel)
TOLERANCE = 38


def is_background(pixel: tuple[int, int, int, int], tolerance: int = TOLERANCE) -> bool:
    r, g, b, a = pixel
    if a == 0:
        return True
    return r >= 255 - tolerance and g >= 255 - tolerance and b >= 255 - tolerance


def flood_fill_background(image: Image.Image) -> Image.Image:
    """Set border-connected near-white pixels to transparent, leaving interior white intact."""
    image = image.convert("RGBA")
    width, height = image.size
    pixels = image.load()

    visited = bytearray(width * height)
    queue: deque[int] = deque()

    def push(x: int, y: int) -> None:
        idx = y * width + x
        if not visited[idx]:
            visited[idx] = 1
            queue.append(idx)

    # Seed from every border pixel
    for x in range(width):
        push(x, 0)
        push(x, height - 1)
    for y in range(height):
        push(0, y)
        push(width - 1, y)

    while queue:
        idx = queue.popleft()
        x, y = idx % width, idx // width
        if not is_background(pixels[x, y]):
            continue
        pixels[x, y] = (255, 255, 255, 0)
        if x > 0:
            push(x - 1, y)
        if x < width - 1:
            push(x + 1, y)
        if y > 0:
            push(x, y - 1)
        if y < height - 1:
            push(x, y + 1)

    return image


def trim(image: Image.Image, padding: int = 6) -> Image.Image:
    bbox = image.getbbox()
    if not bbox:
        return image
    left, top, right, bottom = bbox
    left = max(0, left - padding)
    top = max(0, top - padding)
    right = min(image.width, right + padding)
    bottom = min(image.height, bottom + padding)
    return image.crop((left, top, right, bottom))


def process(source: Path, target: Path, max_width: int) -> None:
    image = Image.open(source)
    image = flood_fill_background(image)
    image = trim(image)

    if image.width > max_width:
        ratio = max_width / image.width
        new_size = (max_width, round(image.height * ratio))
        image = image.resize(new_size, Image.LANCZOS)

    # Fully transparent canvas is safe to save as optimized PNG
    image.save(target, "PNG", optimize=True)
    print(f"{target.relative_to(ROOT)}  ->  {image.width}x{image.height}")


if __name__ == "__main__":
    process(ORG / "logo-original.jpeg", ORG / "logo.png", max_width=900)
    process(ORG / "signature-stamp-original.jpeg", ORG / "signature.png", max_width=700)