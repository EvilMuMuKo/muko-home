/** Flat-bed 2-D Saint-Venant solver: U=(h,hu,hv), Rusanov flux, reflective walls.
 * Units: metres, seconds. CFL substeps bound explicit integration; drag removes
 * momentum, never water. This is a shallow-water surface model, not 3-D CFD.
 */
export class ShallowWater {
  readonly state: Float64Array;
  private next: Float64Array;
  private fx: Float64Array;
  private fz: Float64Array;
  readonly dx: number;
  readonly dz: number;
  time = 0;
  constructor(
    readonly nx = 24,
    readonly nz = 30,
    readonly width = 0.38,
    readonly depth = 0.48,
    readonly restDepth = 0.055,
  ) {
    this.dx = width / nx;
    this.dz = depth / nz;
    this.state = new Float64Array(nx * nz * 3);
    this.next = this.state.slice();
    this.fx = new Float64Array((nx + 1) * nz * 3);
    this.fz = new Float64Array(nx * (nz + 1) * 3);
    for (let k = 0; k < this.state.length; k += 3) this.state[k] = restDepth;
  }
  get volume() {
    let total = 0;
    for (let k = 0; k < this.state.length; k += 3) total += this.state[k];
    return total * this.dx * this.dz;
  }
  disturb(x = 0.5, z = 0.5, strength = 0.005) {
    // Momentum impulse conserves water volume exactly.
    for (let j = 0; j < this.nz; j++)
      for (let i = 0; i < this.nx; i++) {
        const rx = (i + 0.5) / this.nx - x,
          rz = (j + 0.5) / this.nz - z;
        const weight = Math.exp(-(rx * rx + rz * rz) * 100);
        const k = (j * this.nx + i) * 3;
        this.state[k + 1] += rx * weight * strength;
        this.state[k + 2] += rz * weight * strength;
      }
  }
  private flux(
    a: number,
    b: number,
    axis: 1 | 2,
    output: Float64Array,
    offset: number,
  ) {
    const q = this.state,
      hL = q[a],
      hR = q[b];
    const uL = q[a + axis] / hL,
      uR = q[b + axis] / hR;
    const speed = Math.max(
      Math.abs(uL) + Math.sqrt(9.81 * hL),
      Math.abs(uR) + Math.sqrt(9.81 * hR),
    );
    for (let c = 0; c < 3; c++) {
      const fL =
        c === 0
          ? q[a + axis]
          : q[a + c] * uL + (c === axis ? 4.905 * hL * hL : 0);
      const fR =
        c === 0
          ? q[b + axis]
          : q[b + c] * uR + (c === axis ? 4.905 * hR * hR : 0);
      output[offset + c] = 0.5 * (fL + fR - speed * (q[b + c] - q[a + c]));
    }
  }
  step(dt: number) {
    let remaining = Math.min(Math.max(dt, 0), 0.05);
    while (remaining > 1e-9) {
      let speed = 0;
      for (let k = 0; k < this.state.length; k += 3) {
        const h = this.state[k];
        speed = Math.max(
          speed,
          Math.abs(this.state[k + 1] / h) +
            Math.abs(this.state[k + 2] / h) +
            Math.sqrt(9.81 * h),
        );
      }
      const sub = Math.min(
        remaining,
        (0.35 * Math.min(this.dx, this.dz)) / Math.max(speed, 1e-6),
      );
      for (let j = 0; j < this.nz; j++)
        for (let i = 0; i <= this.nx; i++) {
          const offset = (j * (this.nx + 1) + i) * 3;
          if (i === 0 || i === this.nx) {
            const k = (j * this.nx + (i === 0 ? 0 : this.nx - 1)) * 3,
              h = this.state[k];
            this.fx[offset] = 0;
            this.fx[offset + 1] = 4.905 * h * h;
            this.fx[offset + 2] = 0;
          } else
            this.flux(
              (j * this.nx + i - 1) * 3,
              (j * this.nx + i) * 3,
              1,
              this.fx,
              offset,
            );
        }
      for (let j = 0; j <= this.nz; j++)
        for (let i = 0; i < this.nx; i++) {
          const offset = (j * this.nx + i) * 3;
          if (j === 0 || j === this.nz) {
            const k = ((j === 0 ? 0 : this.nz - 1) * this.nx + i) * 3,
              h = this.state[k];
            this.fz[offset] = 0;
            this.fz[offset + 1] = 0;
            this.fz[offset + 2] = 4.905 * h * h;
          } else
            this.flux(
              ((j - 1) * this.nx + i) * 3,
              (j * this.nx + i) * 3,
              2,
              this.fz,
              offset,
            );
        }
      for (let j = 0; j < this.nz; j++)
        for (let i = 0; i < this.nx; i++)
          for (let c = 0; c < 3; c++) {
            const k = (j * this.nx + i) * 3 + c;
            const value =
              this.state[k] -
              (sub / this.dx) *
                (this.fx[(j * (this.nx + 1) + i + 1) * 3 + c] -
                  this.fx[(j * (this.nx + 1) + i) * 3 + c]) -
              (sub / this.dz) *
                (this.fz[((j + 1) * this.nx + i) * 3 + c] -
                  this.fz[(j * this.nx + i) * 3 + c]);
            this.next[k] = c === 0 ? value : value * Math.exp(-2 * sub);
          }
      this.state.set(this.next);
      remaining -= sub;
      this.time += sub;
    }
  }
}
