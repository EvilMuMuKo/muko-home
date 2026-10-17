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

function pushCurvedTube(
  positions: number[],
  indices: number[],
  points: THREE.Vector3[],
  radii: number[],
  sides = 5,
) {
  let transport = new THREE.Vector3(1, 0, 0);
  const frames = points.map((point, index) => {
    const next = points[Math.min(index + 1, points.length - 1)];
    const prev = points[Math.max(index - 1, 0)];
    const axis = (index < points.length - 1 ? next : point)
      .clone()
      .sub(index < points.length - 1 ? point : prev);
    if (axis.lengthSq() < 1e-10) axis.set(0, 1, 0);
    axis.normalize();
    transport = transport
      .clone()
      .sub(axis.clone().multiplyScalar(transport.dot(axis)));
    if (transport.lengthSq() < 1e-8) {
      transport = new THREE.Vector3(0, 1, 0).cross(axis);
      if (transport.lengthSq() < 1e-8)
        transport = new THREE.Vector3(1, 0, 0).cross(axis);
    }
    transport.normalize();
    return { point, axis, u: transport.clone(), radius: radii[index] };
  });
  const start = positions.length / 3;
  for (const frame of frames) {
    const v = frame.axis.clone().cross(frame.u).normalize();
    for (let i = 0; i < sides; i++) {
      const theta = (i * Math.PI * 2) / sides;
      const point = frame.point
        .clone()
        .addScaledVector(frame.u, Math.cos(theta) * frame.radius)
        .addScaledVector(v, Math.sin(theta) * frame.radius);
      positions.push(point.x, point.y, point.z);
    }
  }
  for (let ring = 0; ring < frames.length - 1; ring++) {
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      const row = start + ring * sides;
      const next = row + sides;
      indices.push(row + i, row + j, next + j, row + i, next + j, next + i);
    }
  }
}

function quadPoint(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, t: number) {
  const u = 1 - t;
  return new THREE.Vector3(
    u * u * a.x + 2 * u * t * b.x + t * t * c.x,
    u * u * a.y + 2 * u * t * b.y + t * t * c.y,
    u * u * a.z + 2 * u * t * b.z + t * t * c.z,
  );
}

/** Narrow collar, broad middle, then a long close to a single tip point. */
function leafHalfWidth(t: number, halfWidth: number) {
  const belly = Math.sin(Math.PI * Math.pow(t, 0.65));
  return halfWidth * (0.12 + 0.88 * belly) * Math.pow(1 - t, 0.85);
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
  const side = new THREE.Vector3(-direction.z, 0, direction.x);
  if (side.lengthSq() < 1e-8) side.set(1, 0, 0);
  side.normalize();
  const firstVertex = positions.length / 3;
  const colorStops = [
    new THREE.Color("#4f5e43"),
    baseColor,
    new THREE.Color("#98a47c"),
  ];
  for (let step = 0; step <= segments; step++) {
    const t = step / segments;
    const width = step === segments ? 0 : leafHalfWidth(t, halfWidth);
    const radial =
      -0.003 * (1 - t) + radialReach * (t * 0.25 + t * t * 0.75);
    const rise = length * (0.18 * t + 0.7 * Math.pow(t, 1.08));
    const arch = Math.sin(Math.PI * t) * Math.min(0.01, length * 0.045);
    const center = base
      .clone()
      .addScaledVector(direction, radial)
      .addScaledVector(side, Math.sin(Math.PI * t) * halfWidth * 0.12)
      .add(new THREE.Vector3(0, rise + arch, 0));
    const ridge = center
      .clone()
      .add(new THREE.Vector3(0, 0.0022 * Math.sin(Math.PI * t), 0));
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
  const crown = new THREE.Vector3(half * 0.03, crownY, half * 0.016);
  const caneBend = root.clone().lerp(crown, 0.55);
  caneBend.x -= half * 0.012;
  caneBend.z += half * 0.008;
  const cane = [0, 0.5, 1].map((t) => quadPoint(root, caneBend, crown, t));
  pushCurvedTube(stemPositions, stemIndices, cane, [0.0052, 0.0034, 0.002]);
  const caneAt = (y: number) => {
    let best = cane[0];
    let bestDy = Infinity;
    for (let step = 0; step <= 8; step++) {
      const point = quadPoint(root, caneBend, crown, step / 8);
      const dy = Math.abs(point.y - y);
      if (dy < bestDy) {
        bestDy = dy;
        best = point;
      }
    }
    return best.clone();
  };
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
    const stemJoint = caneAt(Math.min(crownY, startY));
    const petioleControl = stemJoint.clone().lerp(base, 0.48);
    petioleControl.y += Math.min(0.016, o.h * 0.028);
    const petiole = [0, 1 / 3, 2 / 3, 1].map((t) =>
      quadPoint(stemJoint, petioleControl, base, t),
    );
    pushCurvedTube(
      stemPositions,
      stemIndices,
      petiole,
      [0.0031, 0.0024, 0.0017, 0.00115],
    );
    appendRibbonLeaf(
      leaves,
      leafColors,
      leafIndices,
      base,
      direction,
      radialReach,
      tipRise,
      half * 0.15,
      new THREE.Color(shades[i % shades.length]),
      8,
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
  if (existing?.isMeshStandardMaterial) {
    clearTextureMaps(existing);
    return existing;
  }
  const source = materials[base] as THREE.MeshStandardMaterial | undefined;
  const material = source?.clone() ?? new THREE.MeshStandardMaterial();
  // Stems and leaves are unwrapped. A cloned sage/linen material would sample
  // fabric maps at a missing UV and tint the whole plant with one texel.
  clearTextureMaps(material);
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

function clearTextureMaps(material: THREE.MeshStandardMaterial) {
  for (const key of Object.keys(material)) {
    if (key !== "map" && !key.endsWith("Map")) continue;
    const value = (material as unknown as Record<string, unknown>)[key];
    if (value == null || (value as { isTexture?: boolean }).isTexture)
      (material as unknown as Record<string, unknown>)[key] = null;
  }
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
  clearTextureMaps(material);
  material.color.set(tint);
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
