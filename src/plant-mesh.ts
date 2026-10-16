import * as THREE from "three";

type Materials = Record<string, THREE.Material>;
export interface PlantEnvelope {
  w: number;
  d: number;
  h: number;
  [key: string]: unknown;
}

const geometryCache = new Map<
  string,
  {
    pot: THREE.LatheGeometry;
    soil: THREE.CircleGeometry;
    stems: THREE.BufferGeometry;
    leaves: THREE.BufferGeometry;
  }
>();

function cacheKey(o: PlantEnvelope) {
  return [o.w, o.d, o.h].map((value) => value.toFixed(4)).join(":");
}

function pushTaperedTube(
  positions: number[],
  indices: number[],
  a: THREE.Vector3,
  b: THREE.Vector3,
  r0: number,
  r1: number,
  sides = 5,
) {
  const axis = b.clone().sub(a).normalize();
  let u = new THREE.Vector3(0, 1, 0).cross(axis);
  if (u.lengthSq() < 1e-5) u = new THREE.Vector3(1, 0, 0).cross(axis);
  u.normalize();
  const v = axis.clone().cross(u).normalize();
  const ring = (center: THREE.Vector3, radius: number) => {
    for (let i = 0; i < sides; i++) {
      const theta = (i * Math.PI * 2) / sides;
      const point = center
        .clone()
        .addScaledVector(u, Math.cos(theta) * radius)
        .addScaledVector(v, Math.sin(theta) * radius);
      positions.push(point.x, point.y, point.z);
    }
  };
  const start = positions.length / 3;
  ring(a, r0);
  ring(b, r1);
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    indices.push(
      start + i,
      start + j,
      start + sides + j,
      start + i,
      start + sides + j,
      start + sides + i,
    );
  }
}

function appendRibbonLeaf(
  positions: number[],
  colors: number[],
  indices: number[],
  base: THREE.Vector3,
  direction: THREE.Vector3,
  radialReach: number,
  length: number,
  halfWidth: number,
  baseColor: THREE.Color,
  segments = 7,
) {
  const side = new THREE.Vector3(-direction.z, 0, direction.x).normalize();
  const firstVertex = positions.length / 3;
  const colorStops = [
    new THREE.Color("#4f5e43"),
    baseColor,
    new THREE.Color("#98a47c"),
  ];
  for (let step = 0; step <= segments; step++) {
    const t = step / segments;
    const width = halfWidth * Math.pow(Math.sin(Math.PI * t), 0.78);
    const radial = 0.008 + radialReach * (t * 0.34 + t * t * 0.66);
    const rise = length * 0.92 * (t * 0.35 + Math.pow(t, 0.78) * 0.65);
    const center = base
      .clone()
      .addScaledVector(direction, radial)
      .add(new THREE.Vector3(0, rise + 0.009 * Math.sin(Math.PI * t), 0));
    const ridge = center
      .clone()
      .add(new THREE.Vector3(0, 0.0025 * Math.sin(Math.PI * t), 0));
    const left = center.clone().addScaledVector(side, width);
    const right = center.clone().addScaledVector(side, -width);
    positions.push(
      left.x,
      left.y,
      left.z,
      ridge.x,
      ridge.y,
      ridge.z,
      right.x,
      right.y,
      right.z,
    );
    const shadeT = t < 0.52 ? t / 0.52 : (t - 0.52) / 0.48;
    const shade =
      t < 0.52
        ? colorStops[0].clone().lerp(colorStops[1], shadeT)
        : colorStops[1].clone().lerp(colorStops[2], shadeT);
    for (let vertex = 0; vertex < 3; vertex++)
      colors.push(shade.r, shade.g, shade.b);
  }
  for (let step = 0; step < segments; step++) {
    const row = firstVertex + step * 3;
    const next = row + 3;
    // Two slightly folded, paper-thin faces per ribbon segment. DoubleSide material renders both sides.
    indices.push(row, next, next + 1, row, next + 1, row + 1);
    indices.push(row + 1, next + 1, next + 2, row + 1, next + 2, row + 2);
  }
}

function finishGeometry(
  positions: number[],
  colors?: number[],
  indices?: number[],
) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  if (colors)
    g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  if (indices) g.setIndex(indices);
  g.computeVertexNormals();
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

function plantGeometry(o: PlantEnvelope) {
  const key = cacheKey(o);
  const existing = geometryCache.get(key);
  if (existing) return existing;

  const half = Math.min(o.w, o.d) / 2;
  const potH = Math.min(o.h * 0.22, 0.2);
  const topR = half * 0.55;
  const baseR = half * 0.45;
  const potProfile = [
    new THREE.Vector2(baseR * 0.82, 0),
    new THREE.Vector2(baseR, potH * 0.08),
    new THREE.Vector2(topR * 0.96, potH * 0.78),
    new THREE.Vector2(topR, potH * 0.91),
    new THREE.Vector2(topR * 1.04, potH * 0.97),
    new THREE.Vector2(topR * 0.98, potH),
    new THREE.Vector2(topR * 0.83, potH * 0.98),
    new THREE.Vector2(topR * 0.82, potH * 0.9),
    new THREE.Vector2(baseR * 0.72, potH * 0.13),
    new THREE.Vector2(baseR * 0.66, potH * 0.09),
    new THREE.Vector2(baseR * 0.82, 0),
  ];
  const pot = new THREE.LatheGeometry(potProfile, 12);
  pot.computeBoundingBox();
  const soil = new THREE.CircleGeometry(topR * 0.79, 12);
  soil.rotateX(-Math.PI / 2);
  soil.translate(0, potH * 0.91, 0);
  soil.computeBoundingBox();

  const stemPositions: number[] = [];
  const stemIndices: number[] = [];
  const root = new THREE.Vector3(0, potH * 0.93, 0);
  const crownY = potH + o.h * 0.3;
  pushTaperedTube(
    stemPositions,
    stemIndices,
    root,
    new THREE.Vector3(0, crownY, 0),
    0.005,
    0.0022,
  );
  const leaves: number[] = [];
  const leafColors: number[] = [];
  const leafIndices: number[] = [];
  const shades = ["#526247", "#687753", "#7d8a65"];
  const count = 10;
  for (let i = 0; i < count; i++) {
    const angle = i * 2.399963229728653;
    const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const upper = i >= count / 2;
    const startY = potH + o.h * (upper ? 0.18 : 0.055) + (i % 3) * o.h * 0.012;
    const tipY = o.h * (upper ? 0.955 : 0.69) - (i % 3) * o.h * 0.018;
    const base = direction
      .clone()
      .multiplyScalar(half * 0.12)
      .setY(startY);
    const tipRise = Math.max(0.05, tipY - startY);
    const radialReach = half * (upper ? 0.68 : 0.77);
    const stemJoint = new THREE.Vector3(0, Math.min(crownY, startY), 0);
    const stemMid = stemJoint
      .clone()
      .lerp(base, 0.56)
      .add(new THREE.Vector3(0, 0.012, 0));
    pushTaperedTube(
      stemPositions,
      stemIndices,
      stemJoint,
      stemMid,
      0.0032,
      0.0025,
      5,
    );
    pushTaperedTube(
      stemPositions,
      stemIndices,
      stemMid,
      base,
      0.0025,
      0.0015,
      5,
    );
    appendRibbonLeaf(
      leaves,
      leafColors,
      leafIndices,
      base,
      direction,
      radialReach,
      tipRise,
      half * 0.16,
      new THREE.Color(shades[i % shades.length]),
      6,
    );
  }
  const stems = finishGeometry(stemPositions, undefined, stemIndices);
  const leafGeometry = finishGeometry(leaves, leafColors, leafIndices);
  leafGeometry.userData.surfaceOnly = true;
  leafGeometry.userData.leafletCount = count;
  leafGeometry.computeBoundingBox();
  const result = { pot, soil, stems, leaves: leafGeometry };
  geometryCache.set(key, result);
  return result;
}

function sharedMaterial(
  materials: Materials,
  key: string,
  base: string,
  tint: string,
  options: { vertexColors?: boolean; side?: THREE.Side } = {},
) {
  const existing = materials[key] as THREE.MeshStandardMaterial | undefined;
  if (existing?.isMeshStandardMaterial) return existing;
  const source = materials[base] as THREE.MeshStandardMaterial | undefined;
  const material = source?.clone() ?? new THREE.MeshStandardMaterial();
  material.color.set(options.vertexColors ? "#ffffff" : tint);
  material.vertexColors = !!options.vertexColors;
  material.side = options.side ?? THREE.FrontSide;
  material.transparent = false;
  material.opacity = 1;
  material.roughness = options.vertexColors ? 0.94 : 0.88;
  material.metalness = 0;
  material.needsUpdate = true;
  materials[key] = material;
  return material;
}

function plantSurfaceMaterial(
  materials: Materials,
  key: string,
  sourceKey: string,
  tint: string,
  roughness: number,
) {
  const existing = materials[key] as THREE.MeshStandardMaterial | undefined;
  if (existing?.isMeshStandardMaterial) return existing;
  const source = materials[sourceKey] as THREE.MeshStandardMaterial | undefined;
  const material = source?.clone() ?? new THREE.MeshStandardMaterial();
  material.color.set(tint);
  material.map = null;
  material.normalMap = null;
  material.bumpMap = null;
  material.roughnessMap = null;
  material.metalnessMap = null;
  material.aoMap = null;
  material.vertexColors = false;
  material.transparent = false;
  material.opacity = 1;
  material.metalness = 0;
  material.roughness = roughness;
  material.needsUpdate = true;
  materials[key] = material;
  return material;
}

/** Build an opaque, low-poly potted plant using curved, thin leaf surfaces. */
export function buildPlant(
  group: THREE.Group,
  o: PlantEnvelope,
  materials: Materials,
): void {
  if (![o.w, o.d, o.h].every((value) => Number.isFinite(value) && value > 0))
    return;
  const geometry = plantGeometry(o);
  // Plant vessels and soil are intentionally flat, matte finishes. Reusing the
  // room's linen/clay or timber materials would carry fabric/wood maps onto them.
  const potMaterial = plantSurfaceMaterial(
    materials,
    "homePlantPot",
    materials.stone ? "stone" : "cream",
    "#a96f58",
    0.82,
  );
  const soilMaterial = plantSurfaceMaterial(
    materials,
    "homePlantSoil",
    materials.stone ? "stone" : "cream",
    "#463c30",
    0.98,
  );
  const leafMaterial = sharedMaterial(
    materials,
    "homePlantLeaves",
    "sage",
    "#ffffff",
    {
      vertexColors: true,
      side: THREE.DoubleSide,
    },
  );
  const stemMaterial = sharedMaterial(
    materials,
    "homePlantStems",
    "sage",
    "#586548",
  );
  const attach = (
    name: string,
    g: THREE.BufferGeometry,
    material: THREE.Material,
  ) => {
    const mesh = new THREE.Mesh(g, material);
    mesh.name = `plant:${name}`;
    mesh.userData.plantPart = name;
    mesh.castShadow = name === "leaves" || name === "stems";
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  attach("pot", geometry.pot, potMaterial);
  attach("soil", geometry.soil, soilMaterial);
  attach("stems", geometry.stems, stemMaterial);
  attach("leaves", geometry.leaves, leafMaterial);
}
