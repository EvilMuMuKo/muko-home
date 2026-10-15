import {
  PlaneGeometry,
  Mesh,
  DoubleSide,
  Vector3,
  type Material,
  type Group,
} from "three";
type Link = [number, number, number];
/** Small Verlet cloth: pinned rail, structural/shear constraints, floor/wall contacts. */
export class Curtain {
  mesh: Mesh;
  private p: Float32Array;
  private previous: Float32Array;
  private rest: Float32Array;
  private links: Link[] = [];
  private columns = 9;
  private rows = 19;
  constructor(
    parent: Group,
    material: Material,
    x: number,
    z: number,
    private wallSign: number,
  ) {
    const geometry = new PlaneGeometry(
      0.26,
      2.36,
      this.columns - 1,
      this.rows - 1,
    );
    this.p = geometry.attributes.position.array as Float32Array;
    for (let j = 0; j < this.rows; j++)
      for (let i = 0; i < this.columns; i++) {
        const k = (j * this.columns + i) * 3;
        this.p[k] += x;
        this.p[k + 1] = 2.44 - (j / (this.rows - 1)) * 2.36;
        this.p[k + 2] =
          z + Math.sin((i / (this.columns - 1)) * Math.PI * 8) * 0.022;
      }
    this.rest = this.p.slice();
    this.previous = this.p.slice();
    for (let j = 0; j < this.rows; j++)
      for (let i = 0; i < this.columns; i++) {
        const k = j * this.columns + i;
        for (const [di, dj] of [
          [1, 0],
          [0, 1],
          [1, 1],
          [-1, 1],
        ])
          if (i + di >= 0 && i + di < this.columns && j + dj < this.rows) {
            const n = (j + dj) * this.columns + i + di;
            this.links.push([
              k,
              n,
              Math.hypot(
                this.p[k * 3] - this.p[n * 3],
                this.p[k * 3 + 1] - this.p[n * 3 + 1],
                this.p[k * 3 + 2] - this.p[n * 3 + 2],
              ),
            ]);
          }
      }
    const linen = material.clone();
    linen.side = DoubleSide;
    this.mesh = new Mesh(geometry, linen);
    this.mesh.name = "simulated-curtain";
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    parent.add(this.mesh);
    geometry.computeVertexNormals();
  }
  step(
    dt: number,
    time: number,
    spheres: { position: Vector3; radius: number }[] = [],
  ) {
    const p = this.p,
      old = this.previous;
    for (let k = this.columns * 3; k < p.length; k += 3) {
      const x = p[k],
        y = p[k + 1],
        z = p[k + 2];
      p[k] += (x - old[k]) * 0.985 + Math.sin(time * 0.9 + y) * 0.18 * dt * dt;
      p[k + 1] += (y - old[k + 1]) * 0.985 - 9.81 * dt * dt;
      p[k + 2] +=
        (z - old[k + 2]) * 0.985 +
        (Math.sin(time * 1.3 + x * 2) + 0.25) * 0.7 * dt * dt;
      old[k] = x;
      old[k + 1] = y;
      old[k + 2] = z;
    }
    for (let pass = 0; pass < 6; pass++) {
      for (const [a, b, length] of this.links) {
        const ai = a * 3,
          bi = b * 3,
          dx = p[bi] - p[ai],
          dy = p[bi + 1] - p[ai + 1],
          dz = p[bi + 2] - p[ai + 2];
        const distance = Math.hypot(dx, dy, dz) || 1;
        const wa = a < this.columns ? 0 : 1,
          wb = b < this.columns ? 0 : 1;
        if (!wa && !wb) continue;
        const f = (distance - length) / distance / (wa + wb);
        p[ai] += dx * f * wa;
        p[ai + 1] += dy * f * wa;
        p[ai + 2] += dz * f * wa;
        p[bi] -= dx * f * wb;
        p[bi + 1] -= dy * f * wb;
        p[bi + 2] -= dz * f * wb;
      }
      for (let k = this.columns * 3; k < p.length; k += 3) {
        p[k + 1] = Math.max(0.035, p[k + 1]);
        // Curtain cannot cross the window/wall plane, local to its rail group.
        p[k + 2] =
          this.wallSign < 0
            ? Math.min(-0.105, p[k + 2])
            : Math.max(0.105, p[k + 2]);
        for (const sphere of spheres) {
          const dx = p[k] - sphere.position.x,
            dy = p[k + 1] - sphere.position.y,
            dz = p[k + 2] - sphere.position.z;
          const d = Math.hypot(dx, dy, dz),
            r = sphere.radius + 0.012;
          if (d < r && d > 1e-6) {
            p[k] = sphere.position.x + (dx * r) / d;
            p[k + 1] = sphere.position.y + (dy * r) / d;
            p[k + 2] = sphere.position.z + (dz * r) / d;
          }
        }
      }
      p.set(this.rest.subarray(0, this.columns * 3));
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
    this.mesh.geometry.computeBoundingSphere();
  }
}
