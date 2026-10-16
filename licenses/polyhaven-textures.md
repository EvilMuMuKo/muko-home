# Texture asset credits

The following assets are distributed under [CC0](https://polyhaven.com/license).

- [White Oak Veneer](https://polyhaven.com/a/white_oak_veneer), Jenelle van Heerden.
- [Wood Floor](https://polyhaven.com/a/wood_floor), Dimitrios Savva.
- [Rough Linen](https://polyhaven.com/a/rough_linen), colormass (photography), Rico Cilliers (processing).
- [White Plaster 02](https://polyhaven.com/a/white_plaster_02), Rob Tuytel.

Local derivatives are resized/compressed to WebP. Only the wood floor has a
desktop set (`floor-*-desktop.webp`, used when the viewport is not mobile).
Oak, linen, and plaster each have one WebP set. Linen colour is neutralized and
scaled for the cream and sage tints; its normal and roughness maps keep their
channel meaning. Plaster colour is neutralized toward a warm off-white and its
scan contrast is reduced; the source normal and roughness channels are kept.
The authored stone surface in `src/mineral-surface.ts` is procedural and is not
a Poly Haven asset. Source URLs, MD5s, resolutions, and captured tile sizes are
in `materials/sources.json` and `public/materials/sources.json`. Texture maps are
served from this repository; the published site does not call Poly Haven.
