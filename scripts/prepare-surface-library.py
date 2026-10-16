"""Prepare pinned Poly Haven plaster and desktop floor texture derivatives.

Run from any directory with Python 3, Pillow, and curl available. Existing mobile
materials are deliberately left untouched. Source MD5s are pinned in
public/materials/sources.json and checked before processing.
"""
import hashlib
import json
import subprocess
import tempfile
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
MATERIALS = ROOT / "public/materials"
SOURCES = json.loads((MATERIALS / "sources.json").read_text())


def fetch(entry, target):
    subprocess.run(["curl", "-fsSL", entry["source"], "-o", str(target)], check=True)
    digest = hashlib.md5(target.read_bytes()).hexdigest()
    if digest != entry["sourceMD5"]:
        raise ValueError(f"Pinned source MD5 mismatch: {entry['source']}")
    image = Image.open(target).convert("RGB")
    size = entry["resolution"]
    if image.size != (size, size):
        image = image.resize((size, size), Image.Resampling.LANCZOS)
    return image


def save_map(image, path, channel, desktop=False):
    if channel in ("normal", "roughness") and not desktop:
        image.save(path, "WEBP", lossless=True, method=6)
    else:
        image.save(path, "WEBP", quality=90 if channel in ("normal", "roughness") else 86, method=6)


with tempfile.TemporaryDirectory(prefix="muko-surfaces-") as temporary:
    temp = Path(temporary)
    for channel, entry in SOURCES["plaster"]["maps"].items():
        image = fetch(entry, temp / f"plaster-{channel}.jpg")
        if channel == "color":
            # Clean painted lime finish: retain only subtle scan variation,
            # rather than importing weathered albedo stains into a new home.
            gray = ImageOps.grayscale(image)
            image = Image.merge("RGB", tuple(gray.point(
                lambda value, base=base: max(0, min(255, round(base + (value - 128) * 0.08)))
            ) for base in (239, 237, 230)))
        save_map(image, MATERIALS / f"plaster-{channel}.webp", channel)

    for channel, entry in SOURCES["floor"]["desktopMaps"].items():
        image = fetch(entry, temp / f"floor-desktop-{channel}.jpg")
        save_map(image, MATERIALS / f"floor-{channel}-desktop.webp", channel, desktop=True)

print("Prepared plaster-color/normal/roughness and floor-color/normal/roughness-desktop.")
