#!/usr/bin/env python3
"""Seamless herringbone color, normal, and roughness maps for the living floor.

Orthogonal stage: planks are 1:4 rectangles. Horizontal and vertical planks
alternate so each short end lands on the long side of a perpendicular plank.
Lattice (verified, zero overlap, full cover aside from the seam inset):
  pair k, copy m: origin = k*(L+W, L-W) + m*(-W, W)
  horizontal plank at the origin, vertical plank on its right end.
The bitmap is then rotated 45 degrees. Grain follows each plank's long axis.
Normal XY rotates with that plank and with the final 45-degree turn.
Roughness uses the same lattice, the same along/across sample, and the same
seam pixels. It is a scalar, so it is not rotated as a vector.
"""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OAK_COLOR = ROOT / "public/materials/oak-color.webp"
OAK_NORMAL = ROOT / "public/materials/oak-normal.webp"
OAK_ROUGH = ROOT / "public/materials/oak-roughness.webp"
OUT_COLOR = ROOT / "public/materials/r7-herringbone-color.webp"
OUT_NORMAL = ROOT / "public/materials/r7-herringbone-normal.webp"
OUT_ROUGH = ROOT / "public/materials/r7-herringbone-roughness.webp"

# One image is 1.7 m on the floor. 64 px plank width -> about 106 mm, length 4x.
PW = 64
LENGTH = 4 * PW
GAP = 1  # ~1.7 mm at 1024 px / 1.7 m
PERIOD = 2 * LENGTH  # 8 plank-widths, see module note
SIZE = PERIOD * 2  # two periods, 1024
SEAM_ROUGH = 242


def plank_rects():
    rects = []
    # Cover the period with a margin so seams at the border wrap cleanly.
    for m in range(-2, 12):
        for k in range(-2, 12):
            x = k * (LENGTH + PW) + m * (-PW)
            y = k * (LENGTH - PW) + m * PW
            rects.append((x, y, LENGTH, PW, 0))
            rects.append((x + LENGTH, y, PW, LENGTH, 1))
    return rects


def wrap_rects(rects, size):
    wrapped = []
    for x, y, w, h, vertical in rects:
        for ox in (-size, 0, size):
            for oy in (-size, 0, size):
                wrapped.append((x + ox, y + oy, w, h, vertical))
    return wrapped


def build_labels():
    """Raster of one orthogonal period. Value is None or (vertical, along, across)."""
    labels = [[None] * PERIOD for _ in range(PERIOD)]
    for x0, y0, w, h, vertical in wrap_rects(plank_rects(), PERIOD):
        x1 = max(0, x0 + GAP)
        y1 = max(0, y0 + GAP)
        x2 = min(PERIOD, x0 + w - GAP)
        y2 = min(PERIOD, y0 + h - GAP)
        if x2 <= x1 or y2 <= y1:
            continue
        long_axis = h if vertical else w
        for y in range(y1, y2):
            row = labels[y]
            for x in range(x1, x2):
                along = ((y - y0) if vertical else (x - x0)) / long_axis
                across = ((x - x0) if vertical else (y - y0)) / PW
                row[x] = (vertical, along, across)
    return labels


LABELS = None


def classify(ox: float, oy: float):
    x = int(math.floor(ox)) % PERIOD
    y = int(math.floor(oy)) % PERIOD
    return LABELS[y][x]


def paint(size: int, color: bool):
    oak_c = Image.open(OAK_COLOR).convert("RGB") if color else None
    oak_n = Image.open(OAK_NORMAL).convert("RGB")
    oak_r = Image.open(OAK_ROUGH).convert("L") if color else None
    cw, ch = (oak_c or oak_n).size
    nw, nh = oak_n.size
    rw, rh = oak_r.size if oak_r else (1, 1)
    pix_c = oak_c.load() if oak_c else None
    pix_n = oak_n.load()
    pix_r = oak_r.load() if oak_r else None
    img_c = Image.new("RGB", (size, size), (28, 22, 18))
    img_n = Image.new("RGB", (size, size), (128, 128, 255))
    img_r = Image.new("L", (size, size), SEAM_ROUGH)
    out_c = img_c.load()
    out_n = img_n.load()
    out_r = img_r.load()
    # 45-degree view of the orthogonal lattice. A step of `size` pixels lands on a period.
    scale = PERIOD / size
    c45, s45 = math.cos(math.pi / 4), math.sin(math.pi / 4)
    for j in range(size):
        for i in range(size):
            ox = (i - j) * scale
            oy = (i + j) * scale
            hit = classify(ox, oy)
            if hit is None:
                continue
            vertical, along, across = hit
            sx = int(along * cw * 4) % cw
            sy = int(across * ch * 2) % ch
            if color and pix_c and pix_r:
                out_c[i, j] = pix_c[sx, sy]
                out_r[i, j] = pix_r[int(along * rw * 4) % rw, int(across * rh * 2) % rh]
            else:
                out_c[i, j] = (220, 170, 90) if vertical else (70, 110, 160)
            nx, ny, nz = pix_n[sx % nw, sy % nh]
            fx = (nx / 255) * 2 - 1
            fy = (ny / 255) * 2 - 1
            if vertical:
                fx, fy = -fy, fx
            rx, ry = c45 * fx - s45 * fy, s45 * fx + c45 * fy
            out_n[i, j] = (
                int(max(0, min(255, round((rx * 0.5 + 0.5) * 255)))),
                int(max(0, min(255, round((ry * 0.5 + 0.5) * 255)))),
                nz,
            )
    return img_c, img_n, img_r


def assert_tile(size: int, name: str):
    scale = PERIOD / size
    err = 0
    for j in range(size):
        a = classify((0 - j) * scale, (0 + j) * scale)
        b = classify((size - j) * scale, (size + j) * scale)
        if (a is None) != (b is None) or (a and b and a[0] != b[0]):
            err += 1
    for i in range(size):
        a = classify((i - 0) * scale, (i + 0) * scale)
        b = classify((i - size) * scale, (i + size) * scale)
        if (a is None) != (b is None) or (a and b and a[0] != b[0]):
            err += 1
    if err:
        raise SystemExit(f"{name} is not seamless ({err} edge pixels differ)")


def assert_topology(im: Image.Image):
    px = im.load()
    blues = reds = dark = 0
    w, h = im.size
    for y in range(0, h, 3):
        for x in range(0, w, 3):
            r, g, b = px[x, y]
            if r < 40 and g < 40 and b < 40:
                dark += 1
            elif b > r and b > g:
                blues += 1
            else:
                reds += 1
    if blues < 100 or reds < 100:
        raise SystemExit(f"topology missing a direction blue={blues} red={reds}")
    if dark > blues:  # seams are 1 px, not a field of gaps
        raise SystemExit(f"seams too heavy dark={dark} blue={blues}")


def assert_roughness_shares_seams(color: Image.Image, rough: Image.Image):
    if color.size != rough.size:
        raise SystemExit("roughness size differs from color")
    cp, rp = color.load(), rough.load()
    seams = planks = mismatch = 0
    values = set()
    w, h = color.size
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            seam = cp[x, y] == (28, 22, 18)
            if seam:
                seams += 1
                if rp[x, y] != SEAM_ROUGH:
                    mismatch += 1
            else:
                planks += 1
                if rp[x, y] == SEAM_ROUGH:
                    mismatch += 1
                values.add(rp[x, y])
    if seams < 100 or planks < 1000:
        raise SystemExit(f"seam sample too small seams={seams} planks={planks}")
    if mismatch:
        raise SystemExit(f"roughness seams diverge from color ({mismatch})")
    if len(values) < 8:
        raise SystemExit(f"roughness grain is flat ({len(values)} levels)")


def main():
    global LABELS
    LABELS = build_labels()
    filled = sum(cell is not None for row in LABELS for cell in row)
    if filled < PERIOD * PERIOD * 0.9:
        raise SystemExit(f"orthogonal cover too low {filled}")
    topo, _, _ = paint(SIZE, color=False)
    assert_topology(topo)
    assert_tile(SIZE, "topology")
    color, normal, rough = paint(SIZE, color=True)
    assert_tile(SIZE, "color")
    assert_roughness_shares_seams(color, rough)
    color.save(OUT_COLOR, quality=86, method=6)
    normal.save(OUT_NORMAL, quality=86, method=6)
    rough.save(OUT_ROUGH, quality=86, method=6)
    print(f"wrote {OUT_COLOR.name} {OUT_NORMAL.name} {OUT_ROUGH.name} {color.size}")


if __name__ == "__main__":
    main()
