import * as THREE from "three";

export interface StaticOcclusionObject {
  id: string;
  type: string;
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  y?: number;
  rotation?: number;
  collisionParts?: Array<{
    x: number;
    z: number;
    w: number;
    d: number;
    y: number;
    h: number;
    rotation?: number;
  }>;
}

export interface StaticOcclusionWall {
  id: string;
  a: number[];
  b: number[];
  thickness: number;
  height: number;
}

export interface StaticOcclusionOpening {
  id: string;
  type: string;
  wallId?: string;
  center?: number[];
  width: number;
  height?: number;
  sill?: number;
}

export interface StaticOcclusionModel {
  objects: StaticOcclusionObject[];
  walls: StaticOcclusionWall[];
  openings: StaticOcclusionOpening[];
}

export interface StaticOcclusionAudit {
  textureSize: { width: number; height: number };
  staticParticipantIds: string[];
  dynamicExcludedIds: string[];
  affectedFloorCount: number;
  elapsedMs: number;
  maximumDarkening: number;
  status: "baked" | "no_floors";
}

type Point = [number, number];
type Obstacle = { id: string; polygon: Point[] };

const STATIC_TYPES = new Set([
  "column",
  "cabinet_frame",
  "wardrobe",
  "wall_storage",
  "island",
  "bed",
  "mattress",
  "desk",
  "bench",
  "sofa",
  "kegerator",
  "washer",
  "dryer",
  "toilet",
  "shower",
]);

const DYNAMIC_TYPES = new Set([
  "mobile_tv",
  "modular_sofa",
  "sofa_bed",
  "folding_table",
  "folding_chair",
  "dining_chair",
  "office_chair",
  "round_table",
  "fridge",
  "dishwasher",
  "door_leaf",
  "door_panel",
  "gate_panel",
]);

// Half-strength AO falls to zero at this world-space distance.
const AO_RADIUS_M = 0.48;
const MAX_DARKENING = 0.32;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function distanceToSegmentSquared(p: Point, a: Point, b: Point) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const t = clamp(
    ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz || 1),
    0,
    1,
  );
  return (p[0] - (a[0] + dx * t)) ** 2 + (p[1] - (a[1] + dz * t)) ** 2;
}

function insidePolygon(p: Point, polygon: Point[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}

function polygonDistance(p: Point, polygon: Point[]) {
  if (insidePolygon(p, polygon)) return 0;
  let distanceSquared = Infinity;
  for (let i = 0; i < polygon.length; i++)
    distanceSquared = Math.min(
      distanceSquared,
      distanceToSegmentSquared(p, polygon[i], polygon[(i + 1) % polygon.length]),
    );
  return Math.sqrt(distanceSquared);
}

function rectangle(
  centerX: number,
  centerZ: number,
  width: number,
  depth: number,
  rotationDeg = 0,
): Point[] {
  const radians = THREE.MathUtils.degToRad(rotationDeg);
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return [
    [-width / 2, -depth / 2],
    [width / 2, -depth / 2],
    [width / 2, depth / 2],
    [-width / 2, depth / 2],
  ].map(([x, z]) => [centerX + c * x - s * z, centerZ + s * x + c * z]);
}

function wallPolygon(wall: StaticOcclusionWall, from: number, to: number): Point[] {
  const dx = wall.b[0] - wall.a[0];
  const dz = wall.b[1] - wall.a[1];
  const length = Math.hypot(dx, dz);
  const ux = dx / length;
  const uz = dz / length;
  const px = -uz * wall.thickness / 2;
  const pz = ux * wall.thickness / 2;
  const start = [wall.a[0] + ux * from, wall.a[1] + uz * from];
  const end = [wall.a[0] + ux * to, wall.a[1] + uz * to];
  return [
    [start[0] + px, start[1] + pz],
    [end[0] + px, end[1] + pz],
    [end[0] - px, end[1] - pz],
    [start[0] - px, start[1] - pz],
  ];
}

function wallObstacles(
  walls: StaticOcclusionWall[],
  openings: StaticOcclusionOpening[],
): Obstacle[] {
  const result: Obstacle[] = [];
  for (const wall of walls) {
    const dx = wall.b[0] - wall.a[0];
    const dz = wall.b[1] - wall.a[1];
    const length = Math.hypot(dx, dz);
    if (length <= 1e-6 || wall.height <= 0 || wall.thickness <= 0) continue;
    const holes = openings
      .filter((opening) => opening.wallId === wall.id && opening.center)
      .map((opening) => ({
        opening,
        along:
          ((opening.center![0] - wall.a[0]) * dx +
            (opening.center![1] - wall.a[1]) * dz) /
          length,
      }));
    const cuts = [0, length];
    for (const { opening, along } of holes) {
      cuts.push(clamp(along - opening.width / 2, 0, length));
      cuts.push(clamp(along + opening.width / 2, 0, length));
    }
    cuts.sort((a, b) => a - b);
    for (let i = 1; i < cuts.length; i++) {
      const from = cuts[i - 1];
      const to = cuts[i];
      if (to - from < 1e-4) continue;
      const middle = (from + to) / 2;
      const opening = holes.find(
        ({ opening: candidate, along }) =>
          middle > along - candidate.width / 2 &&
          middle < along + candidate.width / 2,
      )?.opening;
      // Doors and sliders have floor-level openings; windows retain their solid sill.
      const bottomWallHeight = opening?.type === "window" ? (opening.sill ?? 0.9) : opening ? 0 : wall.height;
      if (bottomWallHeight <= 0.025) continue;
      result.push({
        id: `wall:${wall.id}:${i}`,
        polygon: wallPolygon(wall, from, to),
      });
    }
  }
  return result;
}

function collisionPartObstacles(object: StaticOcclusionObject): Obstacle[] {
  const parts = object.collisionParts ?? [];
  return parts.flatMap((part, index) => {
    if (part.y > 0.22 || part.y + part.h <= 0.015 || part.w <= 0 || part.d <= 0)
      return [];
    return [{
      id: `${object.id}:part:${index}`,
      polygon: rectangle(part.x, part.z, part.w, part.d, part.rotation ?? 0),
    }];
  });
}

function visibleNearFloorMeshObstacles(
  scene: THREE.Scene,
  object: StaticOcclusionObject,
): Obstacle[] {
  const group = scene.getObjectByName(object.id);
  if (!group) return [];
  const points = new THREE.Vector3();
  const obstacles: Obstacle[] = [];
  group.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || !mesh.visible || !mesh.geometry) return;
    for (let parent = mesh.parent; parent; parent = parent.parent)
      if (!parent.visible) return;
    const geometry = mesh.geometry;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    if (!box) return;
    let minY = Infinity;
    let maxY = -Infinity;
    const corners: Point[] = [];
    for (const x of [box.min.x, box.max.x])
      for (const y of [box.min.y, box.max.y])
        for (const z of [box.min.z, box.max.z]) {
          points.set(x, y, z).applyMatrix4(mesh.matrixWorld);
          corners.push([points.x, points.z]);
          minY = Math.min(minY, points.y);
          maxY = Math.max(maxY, points.y);
        }
    if (minY > 0.22 || maxY <= 0.015) return;
    const hull = convexHull(corners);
    if (hull.length >= 3)
      obstacles.push({ id: object.id, polygon: hull });
  });
  return obstacles;
}

function convexHull(points: Point[]): Point[] {
  const sorted = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (sorted.length <= 2) return sorted;
  const cross = (o: Point, a: Point, b: Point) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Point[] = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower.at(-2)!, lower.at(-1)!, point) <= 0)
      lower.pop();
    lower.push(point);
  }
  const upper: Point[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const point = sorted[i];
    while (upper.length >= 2 && cross(upper.at(-2)!, upper.at(-1)!, point) <= 0)
      upper.pop();
    upper.push(point);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function pointInTriangle(point: Point, a: Point, b: Point, c: Point) {
  const denominator =
    (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
  if (Math.abs(denominator) < 1e-12) return false;
  const u =
    ((b[1] - c[1]) * (point[0] - c[0]) +
      (c[0] - b[0]) * (point[1] - c[1])) /
    denominator;
  const v =
    ((c[1] - a[1]) * (point[0] - c[0]) +
      (a[0] - c[0]) * (point[1] - c[1])) /
    denominator;
  const w = 1 - u - v;
  return u >= -1e-6 && v >= -1e-6 && w >= -1e-6;
}

function markTriangle(
  mask: Uint8Array,
  size: number,
  a: Point,
  b: Point,
  c: Point,
) {
  const minX = clamp(Math.floor(Math.min(a[0], b[0], c[0]) * size), 0, size - 1);
  const maxX = clamp(Math.ceil(Math.max(a[0], b[0], c[0]) * size), 0, size - 1);
  const minY = clamp(Math.floor(Math.min(a[1], b[1], c[1]) * size), 0, size - 1);
  const maxY = clamp(Math.ceil(Math.max(a[1], b[1], c[1]) * size), 0, size - 1);
  for (let y = minY; y <= maxY; y++)
    for (let x = minX; x <= maxX; x++)
      if (pointInTriangle([(x + 0.5) / size, (y + 0.5) / size], a, b, c))
        mask[y * size + x] = 1;
}

function floorMask(geometry: THREE.BufferGeometry, uv1: THREE.BufferAttribute, size: number) {
  const mask = new Uint8Array(size * size);
  const index = geometry.getIndex();
  const count = index?.count ?? uv1.count;
  const point = (vertex: number): Point => [uv1.getX(vertex), uv1.getY(vertex)];
  for (let i = 0; i + 2 < count; i += 3) {
    const ia = index ? index.getX(i) : i;
    const ib = index ? index.getX(i + 1) : i + 1;
    const ic = index ? index.getX(i + 2) : i + 2;
    markTriangle(mask, size, point(ia), point(ib), point(ic));
  }
  return mask;
}

function paintObstacle(
  data: Uint8Array,
  mask: Uint8Array,
  size: number,
  bounds: { minX: number; minZ: number; width: number; depth: number },
  polygon: Point[],
) {
  const minWorldX = Math.min(...polygon.map((point) => point[0])) - AO_RADIUS_M;
  const maxWorldX = Math.max(...polygon.map((point) => point[0])) + AO_RADIUS_M;
  const minWorldZ = Math.min(...polygon.map((point) => point[1])) - AO_RADIUS_M;
  const maxWorldZ = Math.max(...polygon.map((point) => point[1])) + AO_RADIUS_M;
  const minX = clamp(Math.floor(((minWorldX - bounds.minX) / bounds.width) * size), 0, size - 1);
  const maxX = clamp(Math.ceil(((maxWorldX - bounds.minX) / bounds.width) * size), 0, size - 1);
  const minY = clamp(Math.floor(((minWorldZ - bounds.minZ) / bounds.depth) * size), 0, size - 1);
  const maxY = clamp(Math.ceil(((maxWorldZ - bounds.minZ) / bounds.depth) * size), 0, size - 1);
  const radiusSquared = AO_RADIUS_M * AO_RADIUS_M;
  for (let y = minY; y <= maxY; y++) {
    const worldZ = bounds.minZ + ((y + 0.5) / size) * bounds.depth;
    for (let x = minX; x <= maxX; x++) {
      const pixel = y * size + x;
      if (!mask[pixel]) continue;
      const worldX = bounds.minX + ((x + 0.5) / size) * bounds.width;
      const distanceSquared = polygonDistance([worldX, worldZ], polygon) ** 2;
      if (distanceSquared >= radiusSquared) continue;
      const distance = Math.sqrt(distanceSquared);
      const t = 1 - distance / AO_RADIUS_M;
      const falloff = t * t * (3 - 2 * t);
      const darkening = MAX_DARKENING * falloff;
      const value = Math.round(255 * (1 - darkening));
      const offset = pixel * 4;
      data[offset] = Math.min(data[offset], value);
    }
  }
}

function rasterFloor(
  scene: THREE.Scene,
  mesh: THREE.Mesh,
  model: StaticOcclusionModel,
  size: number,
  obstacles: Obstacle[],
) {
  const geometry = mesh.geometry.clone();
  const position = geometry.getAttribute("position");
  const existingUV = geometry.getAttribute("uv");
  if (!position || !existingUV || position.count < 3) {
    geometry.dispose();
    return false;
  }
  const worldPositions: THREE.Vector3[] = [];
  const vertex = new THREE.Vector3();
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < position.count; i++) {
    vertex.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
    worldPositions.push(vertex.clone());
    minX = Math.min(minX, vertex.x);
    maxX = Math.max(maxX, vertex.x);
    minZ = Math.min(minZ, vertex.z);
    maxZ = Math.max(maxZ, vertex.z);
  }
  const width = maxX - minX;
  const depth = maxZ - minZ;
  if (width < 1e-4 || depth < 1e-4) {
    geometry.dispose();
    return false;
  }
  const uv1Array = new Float32Array(position.count * 2);
  for (let i = 0; i < worldPositions.length; i++) {
    uv1Array[i * 2] = clamp((worldPositions[i].x - minX) / width, 0, 1);
    uv1Array[i * 2 + 1] = clamp((worldPositions[i].z - minZ) / depth, 0, 1);
  }
  const uv1 = new THREE.Float32BufferAttribute(uv1Array, 2);
  geometry.setAttribute("uv1", uv1);
  const mask = floorMask(geometry, uv1, size);
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const offset = i * 4;
    data[offset] = data[offset + 1] = data[offset + 2] = data[offset + 3] = 255;
  }
  const bounds = { minX, minZ, width, depth };
  for (const obstacle of obstacles)
    paintObstacle(data, mask, size, bounds, obstacle.polygon);

  const texture = new THREE.DataTexture(
    data,
    size,
    size,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  );
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  texture.name = `ao:${mesh.name}`;

  const sourceMaterial = mesh.material;
  const withAO = (material: THREE.Material) => {
    const clone = material.clone() as THREE.MeshStandardMaterial;
    if ("aoMap" in clone) {
      clone.aoMap = texture;
      clone.aoMap.channel = 1;
      clone.aoMapIntensity = 1;
    }
    return clone;
  };
  mesh.material = Array.isArray(sourceMaterial)
    ? sourceMaterial.map(withAO)
    : withAO(sourceMaterial);
  mesh.geometry = geometry;
  return true;
}

/** Bake subtle, static near-contact AO into each horizontal floor's second UV set. */
export function bakeStaticFloorOcclusion(
  scene: THREE.Scene,
  model: StaticOcclusionModel,
  options: { size?: number } = {},
): StaticOcclusionAudit {
  const started = performance.now();
  const size = Math.max(16, Math.floor(options.size ?? 512));
  scene.updateMatrixWorld(true);

  const obstacles = wallObstacles(model.walls ?? [], model.openings ?? []);
  const participants = new Set(obstacles.map((obstacle) => obstacle.id.split(":").slice(0, 2).join(":")));
  const dynamicExcluded = new Set<string>();
  for (const object of model.objects ?? []) {
    if (DYNAMIC_TYPES.has(object.type) || object.id.startsWith("opening:")) {
      dynamicExcluded.add(object.id);
      continue;
    }
    if (!STATIC_TYPES.has(object.type) || (object.y ?? 0) > 0.22) continue;
    const objectObstacles = object.collisionParts?.length
      ? collisionPartObstacles(object)
      : visibleNearFloorMeshObstacles(scene, object);
    if (objectObstacles.length) {
      participants.add(object.id);
      obstacles.push(...objectObstacles);
    }
  }
  for (const opening of model.openings ?? [])
    if (["door", "sliding_door", "gate"].includes(opening.type))
      dynamicExcluded.add(`opening:${opening.id}`);

  const floors: THREE.Mesh[] = [];
  scene.traverse((node) => {
    if (node instanceof THREE.Mesh && node.name.startsWith("floor:"))
      floors.push(node);
  });
  let affectedFloorCount = 0;
  for (const floor of floors)
    if (rasterFloor(scene, floor, model, size, obstacles)) affectedFloorCount++;

  return {
    textureSize: { width: size, height: size },
    staticParticipantIds: [...participants].sort(),
    dynamicExcludedIds: [...dynamicExcluded].sort(),
    affectedFloorCount,
    elapsedMs: performance.now() - started,
    maximumDarkening: MAX_DARKENING,
    status: affectedFloorCount ? "baked" : "no_floors",
  };
}
