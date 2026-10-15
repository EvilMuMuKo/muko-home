import type { BufferGeometry } from "three";
/** Local metric UVs: a texture tile always covers the same number of metres.
 * Dominant-face projection keeps rounded box bevels compatible with PBR maps.
 */
export function metricUV(geometry: BufferGeometry) {
  const p = geometry.getAttribute("position"),
    n = geometry.getAttribute("normal"),
    uv = geometry.getAttribute("uv");
  if (!p || !n || !uv) return geometry;
  for (let i = 0; i < p.count; i++) {
    const x = Math.abs(n.getX(i)),
      y = Math.abs(n.getY(i)),
      z = Math.abs(n.getZ(i));
    if (y >= x && y >= z) uv.setXY(i, p.getX(i), p.getZ(i));
    else if (x > z) uv.setXY(i, p.getZ(i), p.getY(i));
    else uv.setXY(i, p.getX(i), p.getY(i));
  }
  uv.needsUpdate = true;
  return geometry;
}
