"""README copies of the store images, with rounded corners (GitHub ignores CSS on images).

Run from the repository root after regenerating the store images:
    python docs/store/readme-images.py
The store files stay square: the stores want them without transparency.
"""
from pathlib import Path

from PIL import Image, ImageDraw

STORE = Path("docs/store")
OUT = STORE / "readme"
IMAGES = [
    "promo-marquee-1400x560.png",
    "screenshot-1-saved-searches.png",
    "screenshot-2-filters.png",
    "screenshot-3-blacklist.png",
]
SCALE = 4  # Draw the mask large and shrink it, for smooth corners.

OUT.mkdir(exist_ok=True)
for name in IMAGES:
    image = Image.open(STORE / name).convert("RGBA")
    radius = round(image.width * 0.022)
    mask = Image.new("L", (image.width * SCALE, image.height * SCALE), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, *mask.size), radius=radius * SCALE, fill=255)
    image.putalpha(mask.resize(image.size, Image.LANCZOS))
    image.save(OUT / name, optimize=True)
    print(OUT / name, image.size, f"radius {radius}px")
