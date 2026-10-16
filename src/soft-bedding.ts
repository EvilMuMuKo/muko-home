import * as THREE from "three";
import { metricUV } from "./texture-mapping";

export type SoftBeddingMaterials = {
  linen: THREE.Material;
  sage: THREE.Material;
  piping?: THREE.Material;
};

/** Low-poly, asymmetric superellipsoid cushion with a flattened mattress contact face. */
export function createPillowGeometry(width = 0.7, depth = 0.43) {
  const around = 32, rings = 20, exponent = 0.62;
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  const signedPow = (v: number) => Math.sign(v) * Math.pow(Math.abs(v), exponent);
  for (let j = 0; j <= rings; j++) {
    const phi = -Math.PI / 2 + Math.PI * j / rings;
    const sy = Math.sin(phi), ring = Math.pow(Math.max(0, Math.cos(phi)), exponent) * (1 - 0.025 * Math.exp(-((sy / 0.12) ** 2)));
    const y = sy <= -0.75
      ? -0.05
      : sy < 0
        ? -0.05 + 0.05 * signedPow((sy + 0.75) / 0.75)
        : 0.08 * signedPow(sy);
    for (let i = 0; i <= around; i++) {
      const theta = 2 * Math.PI * i / around;
      positions.push(width * 0.5 * ring * signedPow(Math.cos(theta)), y,
        depth * 0.5 * ring * signedPow(Math.sin(theta)));
      uvs.push(i / around, j / rings);
    }
  }
  for (let j = 0; j < rings; j++) for (let i = 0; i < around; i++) {
    const a = j * (around + 1) + i, b = a + around + 1;
    indices.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  metricUV(g);
  g.computeBoundingBox();
  return g;
}

/** Soft sage runner, with shallow surface undulation and a short draped foot. */
export function createRunnerGeometry(width: number, mattressDepth: number) {
  const xSegments = 24, zSegments = 16;
  const z0 = 0.19, z1 = mattressDepth / 2 + 0.035;
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  const front = mattressDepth / 2, cornerRadius = 0.065;
  const dropStart = front - cornerRadius;
  for (let j = 0; j <= zSegments; j++) {
    const v = j / zSegments, z = z0 + (z1 - z0) * v;
    // Follow the mattress's rounded front corner rather than cutting through it.
    const cornerX = THREE.MathUtils.clamp(z - dropStart, 0, cornerRadius);
    const drape = z <= dropStart ? 0 : z <= front
      ? -cornerRadius + Math.sqrt(Math.max(0, cornerRadius ** 2 - cornerX ** 2))
      : -cornerRadius - (0.12 - cornerRadius) * (z - front) / 0.035;
    for (let i = 0; i <= xSegments; i++) {
      const u = i / xSegments, x = (u - 0.5) * width;
      const edge = Math.pow(Math.abs(2 * u - 1), 2);
      const wave = (0.004 * (1 + Math.sin(v * Math.PI * 5 + u * 1.7)) * edge +
        0.008 * (1 + Math.sin(u * Math.PI * 3.5 + v * 1.1)) * Math.sin(Math.PI*u)) * Math.sin(Math.PI * v);
      positions.push(x, wave + drape, z);
      uvs.push(x, z);
    }
  }
  for (let j = 0; j < zSegments; j++) for (let i = 0; i < xSegments; i++) {
    const a = j * (xSegments + 1) + i, b = a + xSegments + 1;
    indices.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  metricUV(g);
  g.computeBoundingBox();
  return g;
}

function createPiping(width: number, depth: number) {
  const points: THREE.Vector3[] = [];
  const e = 0.62, signedPow = (v: number) => Math.sign(v) * Math.pow(Math.abs(v), e);
  for (let i = 0; i < 48; i++) {
    const a = 2 * Math.PI * i / 48;
    points.push(new THREE.Vector3(
      width * 0.5 * 0.985 * signedPow(Math.cos(a)),
      -0.003,
      depth * 0.5 * 0.985 * signedPow(Math.sin(a)),
    ));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, true), 48, 0.0013, 4, true);
}

/** Adds removable, non-structural bedding geometry without changing the mattress. */
export function buildSoftBedding(
  parent: THREE.Object3D,
  bed: { w: number; d: number; h: number },
  materials: SoftBeddingMaterials,
) {
  const pillows: THREE.Mesh[] = [];
  const targetW = Math.min(0.7, Math.max(0.02, bed.w - 0.94));
  const targetD = Math.min(0.43, Math.max(0.02, bed.d - 1.36));
  const pillowMaterial = materials.linen;
  for (const x of [-0.47, 0.47]) {
    const cushion = new THREE.Mesh(createPillowGeometry(targetW, targetD), pillowMaterial);
    cushion.position.set(x, bed.h + 0.05, -0.68);
    cushion.name = "soft-bedding:pillow";
    cushion.castShadow = true;
    cushion.receiveShadow = true;
    parent.add(cushion);
    const pipingMaterial = materials.piping ?? materials.linen;
    const seam = new THREE.Mesh(createPiping(targetW, targetD), pipingMaterial);
    seam.position.copy(cushion.position);
    seam.name = "soft-bedding:pillow-piping";
    // A 1.3mm stitched seam is below the sun-shadow texel budget. Its own
    // material/geometry supplies the seam; a separate hard shadow would crawl.
    seam.castShadow = false;
    parent.add(seam);
    pillows.push(cushion);
  }
  const runnerMaterial = materials.sage.clone();
  runnerMaterial.side = THREE.DoubleSide;
  const runnerGeometry = createRunnerGeometry(bed.w + 0.01, bed.d);
  const runner = new THREE.Mesh(runnerGeometry, runnerMaterial);
  runner.position.y = bed.h + 0.003;
  runner.name = "soft-bedding:runner";
  runner.castShadow = true;
  runner.receiveShadow = true;
  parent.add(runner);
  return { pillows, runner, triangleCount: parent.children.filter((o) => o.name.startsWith("soft-bedding:")).reduce((sum, o) => sum + ((o as THREE.Mesh).geometry as THREE.BufferGeometry).index!.count / 3, 0) };
}
