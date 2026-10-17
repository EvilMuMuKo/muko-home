import * as T from "three";
import type { Collider } from "./meshes";

/** Fixed floor contact shading: no render target or per-frame work on phones. */
export function shadeFloors(floors: T.Mesh[], colliders: Collider[]) {
  const started = performance.now();
  const bodies = colliders.filter(
    (c) =>
      !c.dynamic &&
      c.min.y < 0.22 &&
      c.max.y > 0.05 &&
      !/chair|door|lamp|plant/.test(c.id),
  );
  let vertices = 0;
  for (const floor of floors) {
    floor.updateWorldMatrix(true, false);
    const positions = floor.geometry.getAttribute("position");
    const colors = new Float32Array(positions.count * 3);
    const point = new T.Vector3();
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(floor.matrixWorld);
      let distance = 0.3;
      for (const body of bodies) {
        const dx = Math.max(body.min.x - point.x, 0, point.x - body.max.x);
        const dz = Math.max(body.min.z - point.z, 0, point.z - body.max.z);
        if (dx < distance && dz < distance)
          distance = Math.min(distance, Math.hypot(dx, dz));
      }
      const falloff = 1 - distance / 0.3;
      const shade = 1 - 0.24 * falloff * falloff * (3 - 2 * falloff);
      colors.fill(shade, i * 3, i * 3 + 3);
    }
    floor.geometry.setAttribute("color", new T.BufferAttribute(colors, 3));
    vertices += positions.count;
  }
  return {
    floors: floors.length,
    vertices,
    maximumDarkening: 0.24,
    radiusMetres: 0.3,
    elapsedMs: performance.now() - started,
    dynamicExcluded: true,
  };
}
