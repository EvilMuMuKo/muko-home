import { test, expect } from "@playwright/test";
import * as THREE from "three";
import original from "../src/model.js";
import { createStorageDesign } from "../src/storage-design";
import { createAtmosphereDesign } from "../src/atmosphere-design";
import { createSalonDesign } from "../src/salon-design";
import { createHomeDesign } from "../src/home-design";
import {
  applyHomeMotion,
  buildHomeArchitecture,
  buildHomeFurniture,
  createHomeMotion,
} from "../src/home-mesh";

function fixture() {
  const v8 = createSalonDesign(
      createAtmosphereDesign(createStorageDesign(original as never)),
    ),
    model: any = createHomeDesign(v8),
    motion = createHomeMotion(),
    scene = new THREE.Scene(),
    material = new THREE.MeshStandardMaterial(),
    materials = new Proxy({}, { get: () => material }) as Record<
      string,
      THREE.Material
    >;
  for (const object of model.objects) {
    const group = new THREE.Group();
    group.name = object.id;
    group.position.set(object.x, object.y || 0, object.z);
    group.rotation.y = -THREE.MathUtils.degToRad(object.rotation || 0);
    if (buildHomeFurniture(group, object, materials, motion)) scene.add(group);
  }
  buildHomeArchitecture(scene, model, materials, () => {}, motion);
  const bounds = (object: THREE.Object3D) => {
    object.updateWorldMatrix(true, true);
    return new THREE.Box3().setFromObject(object);
  };
  return { model, motion, scene, bounds, material };
}

function boxForPart(part: any) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(part.w, part.h, part.d),
  );
  mesh.position.set(part.x, part.y + part.h / 2, part.z);
  mesh.rotation.y = -THREE.MathUtils.degToRad(part.rotation || 0);
  mesh.updateWorldMatrix(true, false);
  return new THREE.Box3().setFromObject(mesh);
}

function overlap3d(a: THREE.Box3, b: THREE.Box3, tolerance = 0.002) {
  return (
    Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x) > tolerance &&
    Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y) > tolerance &&
    Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z) > tolerance
  );
}

function visibleMeshBounds(group: THREE.Object3D) {
  group.updateWorldMatrix(true, true);
  const result: { id: string; bounds: THREE.Box3 }[] = [];
  let index = 0;
  group.traverse((node) => {
    if (!(node as THREE.Mesh).isMesh) return;
    let visible = node.visible;
    for (let parent = node.parent; parent; parent = parent.parent)
      visible = visible && parent.visible;
    if (!visible) return;
    result.push({
      id: node.name || `mesh-${index++}`,
      bounds: new THREE.Box3().setFromObject(node),
    });
  });
  return result;
}

function groupHitsParts(group: THREE.Object3D, parts: THREE.Box3[]) {
  return visibleMeshBounds(group).flatMap(({ id, bounds }) =>
    parts.map((part, index) => overlap3d(bounds, part) ? { mesh: id, index } : null)
      .filter((hit): hit is { mesh: string; index: number } => hit !== null),
  );
}

function objectBox(object: any) {
  const angle = THREE.MathUtils.degToRad(object.rotation || 0),
    c = Math.abs(Math.cos(angle)),
    s = Math.abs(Math.sin(angle)),
    w = object.w * c + object.d * s,
    d = object.d * c + object.w * s;
  return new THREE.Box3(
    new THREE.Vector3(object.x - w / 2, object.y || 0, object.z - d / 2),
    new THREE.Vector3(object.x + w / 2, (object.y || 0) + object.h, object.z + d / 2),
  );
}

function barObstacleParts(model: any, omitted: string[] = []) {
  const omit = new Set(omitted),
    result: { id: string; box: THREE.Box3 }[] = [];
  for (const object of model.objects.filter((o: any) =>
    (o.room === "bar" || o.id === "kitchen-door-leaf" || o.id === "kitchen-slider-panel") &&
    !omit.has(o.id) && !o.rendererHidden,
  )) {
    const parts = object.collisionParts?.length ? object.collisionParts : [object];
    for (let i = 0; i < parts.length; i++)
      result.push({ id: `${object.id}:${i}`, box: object.collisionParts?.length ? boxForPart(parts[i]) : objectBox(parts[i]) });
  }
  return result;
}

test("V9 regression: visible folding-chair meshes clear entry return and bar service throughout parking/use motion", () => {
  const { model, motion } = fixture(),
    service = model.objects.find((o: any) => o.id === "s02-bar-service"),
    worktop = model.objects.find((o: any) => o.id === "bar-window-worktop"),
    connector = model.objects.find((o: any) => o.id === "bar-window-worktop-connector"),
    serviceParts = service.collisionParts.map(boxForPart),
    counterParts = [...worktop.collisionParts, ...connector.collisionParts].map(boxForPart),
    allFixedBarParts = barObstacleParts(model, ["dining-table", "dining-chair-left", "dining-chair-right"]),
    island = model.objects.find((o: any) => o.id === "s02-entry-return"),
    islandParts = island.collisionParts.map(boxForPart),
    hits: { p: number; chair: string; service: unknown[]; counter: unknown[]; island: unknown[]; furniture: unknown[]; minY: number }[] = [];
  for (let step = 0; step <= 100; step++) {
    const p = step / 100;
    applyHomeMotion(motion, { dining: p, gate: 1, dishwasher: 0 });
    const tableMeshes = visibleMeshBounds(motion.table!.group);
    for (let chairIndex = 0; chairIndex < motion.chairs.length; chairIndex++) {
      const chair = motion.chairs[chairIndex].group,
        parts = visibleMeshBounds(chair),
        serviceHits = groupHitsParts(chair, serviceParts),
        counterHits = groupHitsParts(chair, counterParts),
        otherFixedHits = visibleMeshBounds(chair).flatMap(({ id, bounds }) => allFixedBarParts.flatMap((fixed) =>
          overlap3d(bounds, fixed.box) ? [{ mesh: id, fixed: fixed.id }] : [])),
        islandHits = groupHitsParts(chair, islandParts),
        otherChairParts = visibleMeshBounds(motion.chairs[1 - chairIndex].group),
        furnitureHits = [
          ...parts.flatMap(({ id, bounds: chairPart }) => tableMeshes.flatMap((tablePart) => overlap3d(chairPart, tablePart.bounds) ? [{ chairMesh: id, tableMesh: tablePart.id }] : [])),
          ...parts.flatMap(({ id, bounds: chairPart }) => otherChairParts.flatMap((other) => overlap3d(chairPart, other.bounds) ? [{ chairMesh: id, otherChairMesh: other.id }] : [])),
        ],
        minY = Math.min(...parts.map(({ bounds: b }) => b.min.y));
      if (serviceHits.length || counterHits.length || otherFixedHits.length || islandHits.length || furnitureHits.length || minY < -0.002)
        hits.push({ p, chair: `dining-chair-${chairIndex === 0 ? "left" : "right"}`, service: serviceHits, counter: counterHits, island: islandHits, furniture: [...furnitureHits, ...otherFixedHits], minY });
    }
  }
  console.log("SPACE_REGRESSION chairs", JSON.stringify({
    threshold: "zero visible mesh intersection with all room-bar static object bounds/parts, window counter/table/other chair; 2 mm tolerance; no floor penetration >2 mm",
    sampledStates: 101,
    failureCount: hits.length,
    firstFailures: hits.slice(0, 6),
    status: hits.length ? "FAIL" : "PASS_component_geometry_only",
    humanUseAndServiceItemReach: "NOT_CHECKED",
  }));
  expect(hits.length, JSON.stringify(hits.slice(0, 6))).toBe(0);
});

test("V9 regression: two-leaf pullout clears solid cabinet boards and column through all 101 states", () => {
  const { model, motion, bounds } = fixture(),
    island = model.objects.find((o: any) => o.id === "s02-entry-return"),
    service = model.objects.find((o: any) => o.id === "s02-bar-service"),
    column = model.objects.find((o: any) => o.id === "column-handdrawn"),
    islandParts = island.collisionParts.map(boxForPart),
    serviceParts = service.collisionParts.map(boxForPart),
    pillarBox = objectBox(column),
    hatch = motion.hatch!,
    movingComponents = [
      ["leaves", hatch.leaves],
      ["rails", hatch.rails],
      ["front", hatch.front],
    ] as const,
    hits: { step: number; component: string; cabinetBoards: unknown[]; service: unknown[]; column: string[] }[] = [];
  expect(model.homeDesign.hatch.kind).toBe("two_leaf_drawer_pullout");
  for (let step = 0; step <= 100; step++) {
    applyHomeMotion(motion, { dining: 0, gate: step / 100, dishwasher: 0 });
    for (const [id, group] of movingComponents) {
      const meshParts = visibleMeshBounds(group),
        boardHits = groupHitsParts(group, islandParts),
        serviceHits = groupHitsParts(group, serviceParts),
        pillarHits = meshParts.flatMap(({ id: mesh, bounds }) =>
          overlap3d(bounds, pillarBox) ? [mesh] : [],
        );
      if (boardHits.length || serviceHits.length || pillarHits.length)
        hits.push({ step, component: id, cabinetBoards: boardHits, service: serviceHits, column: pillarHits });
    }
  }
  // The stored mechanism is inside the cabinet's legal empty pocket, so its
  // enclosing AABB overlaps the island AABB. Solid collisionParts above are
  // the correct collision surface; the cabinet shell is not a solid block.
  applyHomeMotion(motion, { dining: 0, gate: 1, dishwasher: 0 });
  const stowedBounds = bounds(hatch.group),
    islandBounds = objectBox(island);
  expect(stowedBounds.intersectsBox(islandBounds)).toBe(true);
  expect(groupHitsParts(hatch.front, islandParts).length).toBe(0);
  
  const kitchenNorthEdge = 4.8,
    columnNorthFace = column.z - column.d / 2,
    rawGap = columnNorthFace - kitchenNorthEdge,
    dishwasher = model.objects.find((o: any) => o.id === "kitchen-dishwasher"),
    fridge = model.objects.find((o: any) => o.id === "kitchen-fridge");
  console.log("SPACE_AUDIT thresholds", JSON.stringify({
    columnNorthFace: +columnNorthFace.toFixed(3),
    kitchenEdgeReference: kitchenNorthEdge,
    rawStaticGap: +rawGap.toFixed(3),
    targetRawGap: 0.9,
    humanRadiusUsed: false,
    hatch: { kind: model.homeDesign.hatch.kind, worktop: [model.homeDesign.hatch.depthM, model.homeDesign.hatch.spanM], samples: 101, componentGroups: movingComponents.map(([id]) => id), emptyCabinetAabbOverlapWhenStowed: stowedBounds.intersectsBox(islandBounds), failureCount: hits.length, firstFailures: hits.slice(0, 6) },
    dishwasherPose: { x: dishwasher.x, z: dishwasher.z, rotation: dishwasher.rotation, openTravelVerifiedInExistingMotionSpec: true },
    fridgePose: { x: fridge.x, z: fridge.z, rotation: fridge.rotation, articulatedDoorAndDrawerEnvelopeJointlyChecked: false },
    kitchenTwoPersonAndDoorJointState: "BLOCKED_not_modeled_or_tested",
  }));
  expect(rawGap).toBeCloseTo(1.125, 3);
  expect(model.homeDesign.hatch.kind).toBe("two_leaf_drawer_pullout");
  expect(hits.length, JSON.stringify(hits.slice(0, 6))).toBe(0);
});

test("space audit: bedroom static envelopes do not establish door, storage, bedding, or simultaneous-user clearance", () => {
  const { model } = fixture(),
    bed = model.objects.find((o: any) => o.id === "master-mattress"),
    guestState = model.homeDesign.guestBed,
    master = model.homeDesign.masterBedroom;
  const restoredBed = { widthX: bed.w, depthZ: bed.d },
    guestFolded = guestState.foldedEnvelope,
    guestOpen = guestState.openEnvelope;
  console.log("SPACE_AUDIT bedroom", JSON.stringify({
    masterBed: { center: [bed.x, bed.z], mattress: [bed.w, bed.d], worldFootprint: restoredBed, wardrobeGapM: master.geometry.wardrobeToBedGapM, chairToBedM: master.geometry.pcChairToBedFrameGapM },
    masterProofLevel: "static geometry only; no door-leaf/wardrobe-open/two-person swept test",
    guestBed: { folded: guestFolded, open: guestOpen, mattress: guestState.mechanismNominalMattress, guestDoorWidthM: model.openings.find((o: any) => o.id === "guest-door").width, actualBeddingAndStorageClearance: false },
    guestProofLevel: "static envelope only; sofa-bed is not articulated or sampled with door, wardrobe, bedding, or person",
  }));
  expect(restoredBed).toEqual({ widthX: 1.8, depthZ: 2 });
  expect(guestOpen.d).toBe(2.1);
  expect(model.homeDesign.guestBed.simultaneousDoorStorageState).toBe("not_verified");
});

test("V9 dining: sample every chair-retreat step at full furniture scale", () => {
  const { model, motion } = fixture(),
    service = model.objects.find((o: any) => o.id === "s02-bar-service"),
    island = model.objects.find((o: any) => o.id === "s02-entry-return"),
    serviceParts = service.collisionParts.map(boxForPart),
    islandParts = island.collisionParts.map(boxForPart),
    hits: unknown[] = [],
    retreat = model.homeDesign.dining.sequence.chairRetreatM;
  let endpoints: { id: string; x: number; z: number; dx: number; width: number; depth: number }[] = [];
  for (let step = 0; step <= 100; step++) {
    const p = step / 100;
    applyHomeMotion(motion, { dining: 1, diningRetreat: p, gate: 1, dishwasher: 0 });
    const chairParts = motion.chairs.map((chair) => visibleMeshBounds(chair.group));
    for (let i = 0; i < motion.chairs.length; i++) {
      const meshParts = chairParts[i],
        a = motion.chairs[i].group.position,
        serviceHit = groupHitsParts(motion.chairs[i].group, serviceParts),
        islandHit = groupHitsParts(motion.chairs[i].group, islandParts),
        otherHit = meshParts.flatMap(({ id, bounds }) => chairParts[1 - i].flatMap((other) =>
          overlap3d(bounds, other.bounds) ? [{ mesh: id, other: other.id }] : [])),
        tableHit = meshParts.flatMap(({ id, bounds }) => visibleMeshBounds(motion.table!.group).flatMap((table) =>
          overlap3d(bounds, table.bounds) ? [{ mesh: id, table: table.id }] : []));
      if (serviceHit.length || islandHit.length || otherHit.length || tableHit.length)
        hits.push({ step, chair: i, serviceHit, islandHit, otherHit, tableHit });
      if (step === 100) {
        const o = motion.chairs[i].object;
        endpoints.push({
          id: o.id,
          x: +a.x.toFixed(3),
          z: +a.z.toFixed(3),
          dx: +Math.abs(a.x - model.homeDesign.dining.usePositions.chairs[i].x).toFixed(3),
          width: o.w,
          depth: o.d,
        });
      }
    }
  }
  console.log("SPACE_AUDIT dining-retreat", JSON.stringify({
    fixedHumanCylinder: { radiusM: 0.45, heightM: 1.88, usedForChairClearance: false },
    requestedRetreatM: retreat,
    endpoints,
    sampledStates: 101,
    visibleMeshCollisionsWith: ["table", "other chair", "s02-bar-service", "s02-entry-return", "bar-window-worktop", "bar-window-worktop-connector"],
    collisionCount: hits.length,
    firstCollisions: hits.slice(0, 6),
    result: hits.length ? "FAIL_static_mesh_intersection" : "PASS_component_geometry_only",
    userReachAndSimultaneousSitting: "NOT_CHECKED",
  }));
  expect(retreat).toBe(0.35);
  expect(endpoints.every((e) => Math.abs(e.dx - retreat) < 0.005)).toBe(true);
  expect(hits, JSON.stringify(hits.slice(0, 6))).toHaveLength(0);
});

test("V9 dining: the full-size vertical table park pose and 101-step move clear bar fixtures", () => {
  const { model, motion } = fixture(),
    fixtureParts = barObstacleParts(model, ["dining-table", "dining-chair-left", "dining-chair-right"]),
    hits: { p: number; tableMesh: string; fixture: string }[] = [],
    tableZ = { min: Infinity, max: -Infinity };
  for (let step = 0; step <= 100; step++) {
    const p = step / 100;
    applyHomeMotion(motion, { dining: p, diningRetreat: 0, gate: 1, dishwasher: 0 });
    for (const { id, bounds } of visibleMeshBounds(motion.table!.group)) {
      tableZ.min = Math.min(tableZ.min, bounds.min.z);
      tableZ.max = Math.max(tableZ.max, bounds.max.z);
      for (const fixed of fixtureParts)
        if (overlap3d(bounds, fixed.box)) hits.push({ p, tableMesh: id, fixture: fixed.id });
    }
  }
  const table = model.objects.find((o: any) => o.id === "dining-table");
  console.log("SPACE_AUDIT table-transfer", JSON.stringify({
    parkPose: { x: table.x, z: table.z, rotation: table.rotation, fullDeployedDiameterM: table.w, foldedEnvelope: model.homeDesign.dining.table.parkedEnvelope },
    sampledStates: 101,
    sampledWorldZBounds: { min: +tableZ.min.toFixed(3), max: +tableZ.max.toFixed(3), assumedRoomNorthBoundaryM: 8.45 },
    fixtures: [...new Set(fixtureParts.map((part) => part.id.split(":")[0]))],
    collisionCount: hits.length,
    firstCollisions: hits.slice(0, 8),
    result: hits.length ? "FAIL_visible_component_intersection" : "PASS_component_geometry_only",
    mechanismEvidence: "concept animation, not vendor CAD; human carrying/handling path is not modeled",
  }));
  expect([table.w, table.d, table.h]).toEqual([0.96, 0.96, 0.74]);
  expect(tableZ.max).toBeLessThan(8.45);
  expect(hits, JSON.stringify(hits.slice(0, 8))).toHaveLength(0);
});

test("V9 circulation: search fixed 450 mm-radius route around the column with parked furniture", () => {
  const { model, motion } = fixture(),
    radius = 0.45,
    start = { x: 5.7, z: 5.4 },
    goal = { x: 3.2, z: 6.4 },
    step = 0.025,
    requiredClearance = radius + 0.002;
  applyHomeMotion(motion, { dining: 0, diningRetreat: 0, gate: 1, dishwasher: 0 });
  const obstacles: { id: string; box: THREE.Box3 }[] = [];
  for (const object of [
    model.objects.find((o: any) => o.id === "column-handdrawn"),
  ].filter(Boolean)) {
    const parts = object.collisionParts?.length ? object.collisionParts : [object];
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i], box = object.collisionParts?.length ? boxForPart(part) : objectBox(part);
      if (box.min.y < 1.88 && box.max.y > 0) obstacles.push({ id: `${object.id}:${i}`, box });
    }
  }
  obstacles.push(...barObstacleParts(model, ["dining-table", "dining-chair-left", "dining-chair-right"]));
  for (const [id, group] of [
    ["folding-table", motion.table!.group],
    ["folding-chair-0", motion.chairs[0].group],
    ["folding-chair-1", motion.chairs[1].group],
    ["temporary-stool", motion.hatch!.stool],
    ["hatch", motion.hatch!.group],
  ] as const) {
    for (const { id: meshId, bounds } of visibleMeshBounds(group))
      if (bounds.min.y < 1.88 && bounds.max.y > 0)
        obstacles.push({ id: `${id}/${meshId}`, box: bounds });
  }
  const minX = 0.45, maxX = 6.2, minZ = 4.5, maxZ = 8.4,
    nx = Math.round((maxX - minX) / step) + 1,
    nz = Math.round((maxZ - minZ) / step) + 1,
    index = (ix: number, iz: number) => iz * nx + ix,
    toGrid = (p: { x: number; z: number }) => ({ ix: Math.round((p.x - minX) / step), iz: Math.round((p.z - minZ) / step) }),
    s = toGrid(start), g = toGrid(goal),
    offsets = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const free = (active: typeof obstacles, x: number, z: number) => active.every(({ box }) => {
      const dx = Math.max(box.min.x - x, 0, x - box.max.x), dz = Math.max(box.min.z - z, 0, z - box.max.z);
      return Math.hypot(dx, dz) >= requiredClearance;
    }),
    search = (active: typeof obstacles) => {
      const queue: number[] = [index(s.ix, s.iz)], parent = new Int32Array(nx * nz).fill(-1), visited = new Uint8Array(nx * nz);
      let head = 0, found = -1;
      if (free(active, start.x, start.z) && free(active, goal.x, goal.z)) {
        visited[index(s.ix, s.iz)] = 1;
        while (head < queue.length) {
          const current = queue[head++], ix = current % nx, iz = Math.floor(current / nx);
          if (ix === g.ix && iz === g.iz) { found = current; break; }
          for (const [dx, dz] of offsets) {
            const ax = ix + dx, az = iz + dz;
            if (ax < 0 || ax >= nx || az < 0 || az >= nz) continue;
            const next = index(ax, az), x = minX + ax * step, z = minZ + az * step;
            if (visited[next] || !free(active, x, z)) continue;
            if (dx && dz && (!free(active, minX + (ix + dx) * step, minZ + iz * step) || !free(active, minX + ix * step, minZ + (iz + dz) * step))) continue;
            visited[next] = 1; parent[next] = current; queue.push(next);
          }
        }
      }
      const route: { x: number; z: number }[] = [];
      if (found >= 0) {
        for (let at = found; at >= 0; at = parent[at]) {
          route.push({ x: +(minX + (at % nx) * step).toFixed(3), z: +(minZ + Math.floor(at / nx) * step).toFixed(3) });
          if (at === index(s.ix, s.iz)) break;
        }
        route.reverse();
      }
      let closestReached = -1, closestDistance = Infinity;
      for (let at = 0; at < visited.length; at++) if (visited[at]) {
        const x = minX + (at % nx) * step, z = minZ + Math.floor(at / nx) * step,
          distance = Math.hypot(x - goal.x, z - goal.z);
        if (distance < closestDistance) { closestDistance = distance; closestReached = at; }
      }
      return {
        found,
        route,
        closestReached: closestReached < 0 ? null : {
          x: +(minX + (closestReached % nx) * step).toFixed(3),
          z: +(minZ + Math.floor(closestReached / nx) * step).toFixed(3),
          distanceToGoalM: +closestDistance.toFixed(3),
        },
      };
    },
    full = search(obstacles), withoutStool = search(obstacles.filter(({ id }) => !id.startsWith("temporary-stool/")));
  const blockersAt = (active: typeof obstacles, point: { x: number; z: number }) => active.flatMap(({ id, box }) => {
    const dx = Math.max(box.min.x - point.x, 0, point.x - box.max.x),
      dz = Math.max(box.min.z - point.z, 0, point.z - box.max.z), distance = Math.hypot(dx, dz);
    return distance < requiredClearance ? [{ id, distanceM: +distance.toFixed(3), shortByM: +(requiredClearance - distance).toFixed(3) }] : [];
  });
  console.log("SPACE_AUDIT dining-route", JSON.stringify({
    start,
    goal,
    personCylinder: { radiusM: radius, heightM: 1.88, scaleChanged: false },
    clearanceRule: "circle-to-AABB horizontal gap >= 452 mm; obstacle vertical interval intersects [0,1.88 m]",
    searchedGridM: { resolution: step, bounds: [minX, minZ, maxX, maxZ], diagonalCornerCutting: false },
    obstacles: obstacles.length,
    routeFound: full.found >= 0,
    blockersAtStart: blockersAt(obstacles, start),
    blockersAtGoal: blockersAt(obstacles, goal),
    routeWithStoolTemporarilyRemoved: withoutStool.found >= 0,
    closestReachedWithoutStool: withoutStool.closestReached,
    routeWithoutStoolWaypoints: withoutStool.route.length ? [withoutStool.route[0], ...withoutStool.route.filter((_, i) => i % 10 === 0).slice(1), withoutStool.route[withoutStool.route.length - 1]] : [],
    sampledRoutePoints: full.route.length,
    routeWaypoints: full.route.length ? [full.route[0], ...full.route.filter((_, i) => i % 10 === 0).slice(1), full.route[full.route.length - 1]] : [],
    closestColumnNorthPassageNeed: "column north face at z=5.925; radius-expanded boundary z<=5.473",
    limitations: "concept object envelopes only; no door leaves, human posture/turning, dropped items, or measured as-built geometry",
  }));
  // Audit outcome stays explicit in the log without freezing an unresolved layout failure.
  expect(obstacles.length).toBeGreaterThan(0);
  expect(full.found, "The 450 mm-radius route must remain clear with default furniture parked").toBeGreaterThanOrEqual(0);
});

test("V9 bedroom: sample both full-size 350 mm chair retreats against bed, wardrobe, and door-edge geometry", () => {
  const { model } = fixture(),
    byId = (id: string) => model.objects.find((o: any) => o.id === id),
    bed = objectBox(byId("master-bed")),
    wardrobe = objectBox(byId("master-wardrobe")),
    opening = model.openings.find((o: any) => o.id === "master-door"),
    [hingeX, hingeZ] = opening.hinge,
    doorWidth = opening.width,
    // Conservative plan envelope for either side of the modeled 90-degree leaf swing.
    doorSweep = new THREE.Box3(
      new THREE.Vector3(hingeX - doorWidth, 0, hingeZ),
      new THREE.Vector3(hingeX + doorWidth, opening.height, hingeZ + doorWidth),
    ),
    chairs = [byId("pc-chair"), byId("mac-chair")],
    desks = [byId("pc-desk"), byId("mac-desk")],
    obstacles = [
      { id: "bed-frame", box: bed },
      { id: "master-wardrobe", box: wardrobe },
      { id: "master-door-edge-sweep-aabb", box: doorSweep },
    ],
    hits: { step: number; chair: string; obstacle: string; overlapX: number; overlapZ: number }[] = [],
    minimumClearances: Record<string, number> = {};
  let minimumChairGap = Infinity;
  for (const chair of chairs) {
    expect(chair.retreat.distanceM).toBeCloseTo(0.35, 3);
    expect(chair.w).toBe(0.67);
    expect(chair.d).toBe(0.65);
  }
  expect(desks.map((desk: any) => [desk.x, desk.z, desk.w, desk.d, desk.rotation])).toEqual([
    [8.6, 3.98, 1.4, 0.75, 0],
    [9.9, 3.98, 1.2, 0.75, 0],
  ]);
  for (let step = 0; step <= 100; step++) {
    const p = step / 100,
      chairBoxes = chairs.map((chair: any) => {
        const box = objectBox(chair);
        box.translate(new THREE.Vector3(
          (chair.retreat.x - chair.x) * p,
          0,
          (chair.retreat.z - chair.z) * p,
        ));
        return { id: chair.id, box };
      });
    const a = chairBoxes[0].box, b = chairBoxes[1].box,
      gap = Math.max(0, Math.max(a.min.x - b.max.x, b.min.x - a.max.x));
    minimumChairGap = Math.min(minimumChairGap, gap);
    for (const chair of chairBoxes) for (const obstacle of obstacles) {
      const ox = Math.min(chair.box.max.x, obstacle.box.max.x) - Math.max(chair.box.min.x, obstacle.box.min.x),
        oz = Math.min(chair.box.max.z, obstacle.box.max.z) - Math.max(chair.box.min.z, obstacle.box.min.z);
      if (ox > 0.002 && oz > 0.002)
        hits.push({ step, chair: chair.id, obstacle: obstacle.id, overlapX: +ox.toFixed(3), overlapZ: +oz.toFixed(3) });
      const key = `${chair.id}:${obstacle.id}`,
        clearance = Math.max(0, Math.max(
          obstacle.box.min.x - chair.box.max.x,
          chair.box.min.x - obstacle.box.max.x,
          obstacle.box.min.z - chair.box.max.z,
          chair.box.min.z - obstacle.box.max.z,
        ));
      minimumClearances[key] = Math.min(minimumClearances[key] ?? Infinity, clearance);
    }
    if (a.intersectsBox(b)) {
      const ox = Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x),
        oz = Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z);
      if (ox > 0.002 && oz > 0.002)
        hits.push({ step, chair: `${chairBoxes[0].id}+${chairBoxes[1].id}`, obstacle: "other-chair", overlapX: +ox.toFixed(3), overlapZ: +oz.toFixed(3) });
    }
  }
  const pc = chairs[0], mac = chairs[1],
    bedNorthEdge = bed.max.z,
    chairSouthEdge = Math.min(pc.retreat.z - pc.d / 2, mac.retreat.z - mac.d / 2),
    chairToBedGap = chairSouthEdge - bedNorthEdge,
    deskRun = { minX: desks[0].x - desks[0].w / 2, maxX: desks[1].x + desks[1].w / 2 },
    chairCentersSpacing = Math.abs(pc.retreat.x - mac.retreat.x),
    pairClearWidth = chairCentersSpacing - Math.max(pc.w, mac.w);
  console.log("SPACE_AUDIT master-bedroom-inline", JSON.stringify({
    selectedDeskRun: { ...deskRun, z: desks[0].z, widthM: deskRun.maxX - deskRun.minX, depthM: desks[0].d },
    preservedFullBed: { center: [byId("master-bed").x, byId("master-bed").z], mattress: [byId("master-mattress").w, byId("master-mattress").d], frameWorldBounds: { min: bed.min.toArray(), max: bed.max.toArray() } },
    chairRetreatM: [pc.retreat.distanceM, mac.retreat.distanceM],
    chairCentersSpacingM: +chairCentersSpacing.toFixed(3),
    chairPairPlanGapM: +pairClearWidth.toFixed(3),
    chairToBedFrameGapM: +chairToBedGap.toFixed(3),
    conservativeDoorSweepBounds: { min: doorSweep.min.toArray(), max: doorSweep.max.toArray() },
    minimumStaticClearancesM: minimumClearances,
    sampledIntermediateStates: 101,
    collisionCount: hits.length,
    firstCollisions: hits.slice(0, 8),
    evidenceLevel: "static_plan_AABB_sampling_for_chair_retreat_paths_only",
    limitations: "no 0.45 m-radius human, chair-user body, open wardrobe, bedding, actual hinged-door animation, or two-person simultaneous-use simulation; door bounds conservatively cover either side of the opening but are not a physical sweep test",
  }));
  expect(deskRun.maxX - deskRun.minX).toBeCloseTo(2.6, 3);
  expect(chairCentersSpacing).toBeCloseTo(1.3, 3);
  expect(pairClearWidth).toBeCloseTo(0.63, 3);
  expect(chairToBedGap).toBeCloseTo(0.48, 3);
  expect(minimumChairGap).toBeGreaterThanOrEqual(0.002);
  expect(hits, JSON.stringify(hits.slice(0, 8))).toHaveLength(0);
});

test("V9 kitchen joint-use evidence: quantify existing appliance separation and dishwasher-open envelope", () => {
  const { model, motion, bounds } = fixture(),
    ids = ["kitchen-sink", "kitchen-hob", "kitchen-fridge", "kitchen-dishwasher", "kitchen-cabinet-run"],
    objects = ids.map((id) => model.objects.find((o: any) => o.id === id)).filter(Boolean),
    boxes = objects.map((o: any) => ({ id: o.id, box: objectBox(o) })),
    fridge = model.objects.find((o: any) => o.id === "kitchen-fridge"),
    dish = model.objects.find((o: any) => o.id === "kitchen-dishwasher"),
    sink = model.objects.find((o: any) => o.id === "kitchen-sink"),
    hob = model.objects.find((o: any) => o.id === "kitchen-hob");
  applyHomeMotion(motion, { dining: 0, diningRetreat: 0, gate: 1, dishwasher: 0 });
  const closed = bounds(motion.dishwasher!.group);
  applyHomeMotion(motion, { dining: 0, diningRetreat: 0, gate: 1, dishwasher: 1 });
  const open = bounds(motion.dishwasher!.group), fridgeBox = objectBox(fridge), dishBox = objectBox(dish),
    xGap = fridgeBox.min.x - dishBox.max.x,
    openDoorTravelM = open.max.z - closed.max.z;
  console.log("SPACE_AUDIT kitchen-joint", JSON.stringify({
    applianceBounds: boxes.map(({ id, box }) => ({ id, min: box.min.toArray(), max: box.max.toArray() })),
    sinkToHobCentersM: +Math.hypot(sink.x - hob.x, sink.z - hob.z).toFixed(3),
    fridgeToDishwasherNominalXGapM: +xGap.toFixed(3),
    fridgeArticulation: fridge.articulation,
    dishwasherClosedVisibleBounds: { min: closed.min.toArray(), max: closed.max.toArray() },
    dishwasherOpenVisibleBounds: { min: open.min.toArray(), max: open.max.toArray() },
    visibleDishwasherEnvelopeGrowthM: +openDoorTravelM.toFixed(3),
    fixedHumanCylinder: { radiusM: 0.45, heightM: 1.88 },
    status: "FAIL_NOT_ESTABLISHED_FOR_TWO_COOKS: fridge leaf/drawer + dishwasher + door + two standing bodies are not a joint state in model/tests",
    limitation: "appliance centers and nominal rotated envelopes are model values, not measured field geometry; this report does not infer two-person clearance from center distance",
  }));
  expect(openDoorTravelM).toBeGreaterThan(0.4);
  expect(xGap).toBeGreaterThan(0.9);
  expect(fridge.articulation.maxAngle).toBe(110);
});
