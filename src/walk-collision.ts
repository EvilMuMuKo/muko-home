import * as THREE from "three";

export type WalkPoint = readonly [number, number];
export type WalkModel = {
  shell?: number[][];
  walls: Array<{
    id: string;
    a: number[];
    b: number[];
    thickness: number;
    height: number;
  }>;
  openings: Array<{
    id: string;
    type: string;
    wallId?: string;
    center?: number[];
    width: number;
    height?: number;
    sill?: number;
  }>;
  objects: Array<{ id: string; type: string; y?: number; h?: number }>;
};

export type WalkCollision = {
  move(from: WalkPoint, to: WalkPoint): [number, number];
  navigationSnapshot(): { radiusM: number; shell: number[][]; polygons: Polygon[] };
  audit: {
    radiusM: number;
    eyeHeightM: number;
    bodyHeightM: number;
    wallSegments: number;
    staticGroups: string[];
    movingOpenings: string[];
    missingGroups: string[];
    notes: string[];
  };
};

const PERSON_RADIUS = 0.22;
const BODY_HEIGHT = 1.88;
const MAX_STEP = 0.055;
const FLOOR_TYPES = new Set([
  "column",
  "counter_stool",
  "cabinet_frame",
  "wall_storage",
  "fridge",
  "dishwasher",
  "bin",
  "kegerator",
  "round_table",
  "dining_chair",
  "mattress",
  "desk",
  "office_chair",
  "sofa_bed",
  "sofa",
  "modular_sofa",
  "mobile_tv",
  "folding_table",
  "folding_chair",
  "side_table",
  "floor_lamp",
  "washer",
  "dryer",
  "basket",
  "drying_rack",
  "shower",
  "toilet",
  "bench",
  "robot",
  "vacuum",
  "plant",
  "wet_bar",
  "door_leaf",
  "door_panel",
  "gate_panel",
  "lounge_chair",
  "record_console",
  "ventilated_rail",
  "counter_appliance",
  "folding_shelf",
]);
const DYNAMIC_OPENING_TYPES = new Set(["door", "sliding_door", "gate"]);

type Point = [number, number];
type Rect = {
  x: number;
  z: number;
  ux: number;
  uz: number;
  halfX: number;
  halfZ: number;
};
type Polygon = Point[];

function wallRects(model: WalkModel) {
  const rects: Rect[] = [];
  for (const wall of model.walls) {
    const dx = wall.b[0] - wall.a[0];
    const dz = wall.b[1] - wall.a[1];
    const length = Math.hypot(dx, dz);
    if (length < 1e-6 || wall.height <= 0) continue;
    const ux = dx / length;
    const uz = dz / length;
    const holes = model.openings
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
      cuts.push(Math.max(0, along - opening.width / 2));
      cuts.push(Math.min(length, along + opening.width / 2));
    }
    cuts.sort((a, b) => a - b);
    const add = (a: number, b: number, bottom: number, top: number) => {
      if (b - a < 1e-4 || top - bottom < 1e-4 || bottom >= BODY_HEIGHT) return;
      rects.push({
        x: wall.a[0] + ux * ((a + b) / 2),
        z: wall.a[1] + uz * ((a + b) / 2),
        ux,
        uz,
        halfX: (b - a) / 2,
        halfZ: wall.thickness / 2,
      });
    };
    for (let i = 1; i < cuts.length; i++) {
      const a = cuts[i - 1];
      const b = cuts[i];
      const along = (a + b) / 2;
      const hole = holes.find(
        ({ opening, along: center }) =>
          along > center - opening.width / 2 &&
          along < center + opening.width / 2,
      )?.opening;
      if (!hole) {
        add(a, b, 0, wall.height);
        continue;
      }
      const sill = hole.type === "window" ? (hole.sill ?? 0.9) : 0;
      add(a, b, 0, sill);
      add(a, b, sill + (hole.height ?? 2.08), wall.height);
    }
  }
  return rects;
}

function pointRectDistanceSquared(x: number, z: number, rect: Rect) {
  const dx = x - rect.x;
  const dz = z - rect.z;
  const along = dx * rect.ux + dz * rect.uz;
  const across = -dx * rect.uz + dz * rect.ux;
  const cx = Math.max(-rect.halfX, Math.min(rect.halfX, along));
  const cz = Math.max(-rect.halfZ, Math.min(rect.halfZ, across));
  return (along - cx) ** 2 + (across - cz) ** 2;
}

function rectPushOptions(x: number, z: number, rect: Rect): Point[] {
  const dx = x - rect.x;
  const dz = z - rect.z;
  const along = dx * rect.ux + dz * rect.uz;
  const across = -dx * rect.uz + dz * rect.ux;
  const cx = Math.max(-rect.halfX, Math.min(rect.halfX, along));
  const cz = Math.max(-rect.halfZ, Math.min(rect.halfZ, across));
  let nx = along - cx;
  let nz = across - cz;
  const distance = Math.hypot(nx, nz);
  if (distance >= PERSON_RADIUS) return [];
  if (distance > 1e-8) {
    nx /= distance;
    nz /= distance;
    const amount = PERSON_RADIUS - distance + 1e-5;
    return [
      [
        (nx * rect.ux - nz * rect.uz) * amount,
        (nx * rect.uz + nz * rect.ux) * amount,
      ],
    ];
  }
  const xFace = rect.halfX - Math.abs(along);
  const zFace = rect.halfZ - Math.abs(across);
  return [
    [-1, 1].map(
      (sign) =>
        [
          rect.ux * sign * (xFace + PERSON_RADIUS + 1e-5),
          rect.uz * sign * (xFace + PERSON_RADIUS + 1e-5),
        ] as Point,
    ),
    [-1, 1].map(
      (sign) =>
        [
          -rect.uz * sign * (zFace + PERSON_RADIUS + 1e-5),
          rect.ux * sign * (zFace + PERSON_RADIUS + 1e-5),
        ] as Point,
    ),
  ]
    .flat()
    .sort((a, b) => Math.hypot(...a) - Math.hypot(...b));
}

function convexHull(points: Point[]): Polygon {
  const sorted = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (sorted.length <= 2) return sorted;
  const cross = (o: Point, a: Point, b: Point) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Point[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower.at(-2)!, lower.at(-1)!, p) <= 0)
      lower.pop();
    lower.push(p);
  }
  const upper: Point[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper.at(-2)!, upper.at(-1)!, p) <= 0)
      upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function pointSegmentDistanceSquared(p: Point, a: Point, b: Point) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const t = Math.max(
    0,
    Math.min(
      1,
      ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz || 1),
    ),
  );
  return (p[0] - (a[0] + dx * t)) ** 2 + (p[1] - (a[1] + dz * t)) ** 2;
}

function insidePolygon(p: Point, polygon: Polygon) {
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

function circleHitsPolygon(x: number, z: number, polygon: Polygon) {
  const p: Point = [x, z];
  if (insidePolygon(p, polygon)) return true;
  for (let i = 0; i < polygon.length; i++) {
    if (
      pointSegmentDistanceSquared(
        p,
        polygon[i],
        polygon[(i + 1) % polygon.length],
      ) <=
      PERSON_RADIUS ** 2
    )
      return true;
  }
  return false;
}

function polygonPushOptions(x: number, z: number, polygon: Polygon): Point[] {
  const p: Point = [x, z];
  let closest: Point | null = null;
  let distanceSquared = Infinity;
  let edge: Point = [0, 0];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const t = Math.max(
      0,
      Math.min(
        1,
        ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1),
      ),
    );
    const q: Point = [a[0] + dx * t, a[1] + dz * t];
    const d2 = (x - q[0]) ** 2 + (z - q[1]) ** 2;
    if (d2 < distanceSquared) {
      distanceSquared = d2;
      closest = q;
      edge = [dx, dz];
    }
  }
  const distance = Math.sqrt(distanceSquared);
  const inside = insidePolygon(p, polygon);
  if (!inside && distance >= PERSON_RADIUS) return [];
  if (distance > 1e-8 && !inside) {
    return [
      [
        ((x - closest![0]) / distance) * (PERSON_RADIUS - distance + 1e-5),
        ((z - closest![1]) / distance) * (PERSON_RADIUS - distance + 1e-5),
      ],
    ];
  }
  const options: Point[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const length = Math.hypot(dx, dz) || 1;
    // Convex hulls are counter-clockwise; their right-hand normal points out.
    const nx = dz / length;
    const nz = -dx / length;
    const edgeDistance = Math.abs((x - a[0]) * nx + (z - a[1]) * nz);
    const amount = edgeDistance + PERSON_RADIUS + 1e-5;
    options.push([nx * amount, nz * amount]);
  }
  return options.sort((a, b) => Math.hypot(...a) - Math.hypot(...b));
}

function floorContainsCircle(x: number, z: number, shell?: number[][]) {
  if (!shell || shell.length < 3) return true;
  const polygon = shell as Polygon;
  const p: Point = [x, z];
  if (!insidePolygon(p, polygon)) return false;
  for (let i = 0; i < polygon.length; i++)
    if (
      pointSegmentDistanceSquared(
        p,
        polygon[i],
        polygon[(i + 1) % polygon.length],
      ) <
      PERSON_RADIUS ** 2 - 1e-8
    )
      return false;
  return true;
}

function floorPushOptions(x: number, z: number, shell?: number[][]): Point[] {
  if (!shell || shell.length < 3 || floorContainsCircle(x, z, shell)) return [];
  const polygon = shell as Polygon;
  const p: Point = [x, z];
  const inside = insidePolygon(p, polygon);
  const options: Point[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const lengthSquared = dx * dx + dz * dz || 1;
    const t = Math.max(
      0,
      Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / lengthSquared),
    );
    const q: Point = [a[0] + dx * t, a[1] + dz * t];
    if (inside) {
      const distance = Math.hypot(x - q[0], z - q[1]);
      if (distance > 1e-8)
        options.push([
          ((x - q[0]) / distance) * (PERSON_RADIUS - distance + 1e-5),
          ((z - q[1]) / distance) * (PERSON_RADIUS - distance + 1e-5),
        ]);
    } else {
      const ccw =
        polygon.reduce((area, point, index) => {
          const next = polygon[(index + 1) % polygon.length];
          return area + point[0] * next[1] - next[0] * point[1];
        }, 0) > 0;
      const nx = (ccw ? -dz : dz) / Math.sqrt(lengthSquared);
      const nz = (ccw ? dx : -dx) / Math.sqrt(lengthSquared);
      const amount = Math.hypot(x - q[0], z - q[1]) + PERSON_RADIUS + 1e-5;
      options.push([q[0] + nx * amount - x, q[1] + nz * amount - z]);
    }
  }
  return options.sort((a, b) => Math.hypot(...a) - Math.hypot(...b));
}

type MeshHullCacheEntry = {
  matrix: number[];
  geometry: THREE.BufferGeometry;
  polygon: Polygon | null;
};

function currentMeshFootprints(
  group: THREE.Object3D,
  cache: WeakMap<THREE.Mesh, MeshHullCacheEntry>,
): Polygon[] {
  const boxes: Polygon[] = [];
  const v = new THREE.Vector3();
  group.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || !mesh.visible || !mesh.geometry || mesh.userData.physicsBody === false) return;
    for (let parent = mesh.parent; parent; parent = parent.parent)
      if (!parent.visible) return;
    const geometry = mesh.geometry;
    const matrix = mesh.matrixWorld.elements;
    const cached = cache.get(mesh);
    if (
      cached &&
      cached.geometry === geometry &&
      matrix.every((value, index) => value === cached.matrix[index])
    ) {
      if (cached.polygon) boxes.push(cached.polygon);
      return;
    }
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    const bounds = geometry.boundingBox;
    if (!bounds) {
      cache.set(mesh, { matrix: Array.from(matrix), geometry, polygon: null });
      return;
    }
    // Transform each mesh's own box so a swung door follows its real current pose.
    const corners: Point[] = [];
    let minY = Infinity;
    let maxY = -Infinity;
    for (const x of [bounds.min.x, bounds.max.x])
      for (const y of [bounds.min.y, bounds.max.y])
        for (const z of [bounds.min.z, bounds.max.z]) {
          v.set(x, y, z).applyMatrix4(mesh.matrixWorld);
          corners.push([v.x, v.z]);
          minY = Math.min(minY, v.y);
          maxY = Math.max(maxY, v.y);
        }
    if (maxY <= 0 || minY >= BODY_HEIGHT) {
      cache.set(mesh, { matrix: Array.from(matrix), geometry, polygon: null });
      return;
    }
    const hull = convexHull(corners);
    const polygon = hull.length >= 3 ? hull : null;
    cache.set(mesh, { matrix: Array.from(matrix), geometry, polygon });
    if (polygon) boxes.push(polygon);
  });
  return boxes;
}

/** A deterministic 2-D capsule footprint, refreshed from live mesh transforms on each move. */
export function createWalkCollision(
  model: WalkModel,
  scene: THREE.Scene,
): WalkCollision {
  const walls = wallRects(model);
  const staticGroups: string[] = [];
  const dynamicOpenings: string[] = [];
  const missingGroups: string[] = [];
  const obstacles: {
    id: string;
    group: THREE.Object3D;
    kind: "object" | "opening";
  }[] = [];
  const meshHullCache = new WeakMap<THREE.Mesh, MeshHullCacheEntry>();
  const addGroup = (id: string, kind: "object" | "opening") => {
    const group = scene.getObjectByName(id);
    if (!group) {
      missingGroups.push(id);
      return;
    }
    obstacles.push({ id, group, kind });
    (kind === "opening" ? dynamicOpenings : staticGroups).push(id);
  };
  for (const object of model.objects) {
    if (!FLOOR_TYPES.has(object.type)) continue;
    if (
      object.type === "door_leaf" ||
      object.type === "door_panel" ||
      object.type === "gate_panel"
    )
      continue;
    addGroup(object.id, "object");
  }
  for (const opening of model.openings)
    if (DYNAMIC_OPENING_TYPES.has(opening.type))
      addGroup(`opening:${opening.id}`, "opening");

  const audit = {
    radiusM: PERSON_RADIUS,
    eyeHeightM: 1.74,
    bodyHeightM: BODY_HEIGHT,
    wallSegments: walls.length,
    staticGroups,
    movingOpenings: dynamicOpenings,
    missingGroups,
    notes: [
      "2-D circular footprint; walls retain door and window cuts, with windows blocked below the sill.",
      "An optional model shell keeps the full circular footprint over the modeled floor.",
      "Visible mesh bounds are checked in the current world transform; unchanged mesh matrices reuse cached hulls.",
      "Main floor furniture and columns are included; upper cabinetry and small decorations are excluded by type or vertical clearance.",
    ],
  };

  const wallBlocked = (x: number, z: number) => {
    for (const wall of walls)
      if (pointRectDistanceSquared(x, z, wall) <= PERSON_RADIUS ** 2)
        return true;
    return false;
  };
  const meshBlocked = (x: number, z: number, meshes: Polygon[][]) => {
    for (const polygons of meshes)
      for (const polygon of polygons)
        if (circleHitsPolygon(x, z, polygon)) return true;
    return false;
  };
  const blocked = (x: number, z: number, meshes: Polygon[][]) =>
    !floorContainsCircle(x, z, model.shell) ||
    wallBlocked(x, z) ||
    meshBlocked(x, z, meshes);
  const isSafe = (x: number, z: number, meshes: Polygon[][]) =>
    !blocked(x, z, meshes);
  const overlapCount = (x: number, z: number, meshes: Polygon[][]) => {
    let count = floorContainsCircle(x, z, model.shell) ? 0 : 1;
    for (const wall of walls)
      if (pointRectDistanceSquared(x, z, wall) < PERSON_RADIUS ** 2) count++;
    for (const polygons of meshes)
      for (const polygon of polygons)
        if (circleHitsPolygon(x, z, polygon)) count++;
    return count;
  };
  const hardPathClear = (x: number, z: number, nx: number, nz: number) => {
    const dx = nx - x;
    const dz = nz - z;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / MAX_STEP));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const px = x + dx * t;
      const pz = z + dz * t;
      if (!floorContainsCircle(px, pz, model.shell) || wallBlocked(px, pz))
        return false;
    }
    return true;
  };

  function move(from: WalkPoint, to: WalkPoint): [number, number] {
    // Update only collision roots and their descendants. A forced scene-wide
    // update traverses render-only foliage, lights, and architecture on every
    // joystick frame; updateWorldMatrix still follows animated ancestors.
    for (const { group } of obstacles) group.updateWorldMatrix(true, true);
    const meshes = obstacles.map(({ group }) =>
      currentMeshFootprints(group, meshHullCache),
    );
    let x = from[0];
    let z = from[1];
    // Doors, drawers, and pulled-out furniture can advance into a stationary walker.
    // Resolve overlaps only through paths that stay over floor and clear of walls.
    for (let pass = 0; pass < 12; pass++) {
      const currentOverlap = overlapCount(x, z, meshes);
      if (currentOverlap === 0) break;
      const pushes = floorPushOptions(x, z, model.shell);
      for (const wall of walls) pushes.push(...rectPushOptions(x, z, wall));
      for (const polygons of meshes)
        for (const polygon of polygons)
          pushes.push(...polygonPushOptions(x, z, polygon));
      pushes.sort((a, b) => Math.hypot(...a) - Math.hypot(...b));
      let next: Point | null = null;
      for (const push of pushes) {
        const nx = x + push[0];
        const nz = z + push[1];
        if (!hardPathClear(x, z, nx, nz)) continue;
        if (isSafe(nx, nz, meshes)) {
          next = [nx, nz];
          break;
        }
        if (overlapCount(nx, nz, meshes) < currentOverlap && !next)
          next = [nx, nz];
      }
      if (!next) return [from[0], from[1]];
      x = next[0];
      z = next[1];
    }
    if (!isSafe(x, z, meshes)) return [from[0], from[1]];
    const dx = to[0] - from[0];
    const dz = to[1] - from[1];
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / MAX_STEP));
    const sx = dx / steps;
    const sz = dz / steps;
    for (let i = 0; i < steps; i++) {
      const nx = x + sx;
      const nz = z + sz;
      if (!blocked(nx, nz, meshes)) {
        x = nx;
        z = nz;
        continue;
      }
      // Resolve each axis independently to keep the free tangential component.
      if (Math.abs(sx) >= Math.abs(sz)) {
        if (!blocked(x + sx, z, meshes)) x += sx;
        if (!blocked(x, z + sz, meshes)) z += sz;
      } else {
        if (!blocked(x, z + sz, meshes)) z += sz;
        if (!blocked(x + sx, z, meshes)) x += sx;
      }
    }
    return [x, z];
  }

  function navigationSnapshot() {
    for (const { group } of obstacles) group.updateWorldMatrix(true, true);
    const polygons = walls.map(wall => {
      const corners: Polygon = [];
      for (const [sx,sz] of [[-1,-1],[1,-1],[1,1],[-1,1]])
        corners.push([
          wall.x + sx*wall.halfX*wall.ux - sz*wall.halfZ*wall.uz,
          wall.z + sx*wall.halfX*wall.uz + sz*wall.halfZ*wall.ux,
        ]);
      return corners;
    });
    for (const {group} of obstacles)
      polygons.push(...currentMeshFootprints(group,meshHullCache));
    return {radiusM:PERSON_RADIUS,shell:model.shell || [],polygons};
  }
  return { move, audit, navigationSnapshot };
}
