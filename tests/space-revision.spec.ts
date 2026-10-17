import { test, expect } from "@playwright/test";
import baseModel from "../src/model.js";
import { createStorageDesign } from "../src/storage-design";
import { createAtmosphereDesign } from "../src/atmosphere-design";
import { createSalonDesign } from "../src/salon-design";
import { createHomeDesign } from "../src/home-design";
import { createLifeDesign } from "../src/life-design";
import { createSpaceRevision } from "../src/space-revision";

function revisedModel() {
  return createSpaceRevision(
    createLifeDesign(
      createHomeDesign(
        createSalonDesign(
          createAtmosphereDesign(createStorageDesign(structuredClone(baseModel) as never)),
        ),
      ),
    ),
  );
}

const byId = (model: any, id: string) => {
  const value = model.objects.find((object: any) => object.id === id);
  if (!value) throw new Error(`Missing object ${id}`);
  return value;
};
const rect = (object: any) => {
  const angle = ((object.rotation || 0) * Math.PI) / 180,
    c = Math.abs(Math.cos(angle)), s = Math.abs(Math.sin(angle)),
    hx = (c * object.w + s * object.d) / 2,
    hz = (s * object.w + c * object.d) / 2;
  return { minX: object.x - hx, maxX: object.x + hx, minZ: object.z - hz, maxZ: object.z + hz };
};
const partRect = (part: any) => rect(part);
const overlaps = (a: any, b: any) =>
  Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX) > 0.001 &&
  Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ) > 0.001;
const obbCorners = (box: any) => {
  const angle = ((box.rotation || 0) * Math.PI) / 180,
    c = Math.cos(angle), s = Math.sin(angle);
  return [[-1,-1],[-1,1],[1,-1],[1,1]].map(([sx, sz]) => ({
    x: box.x + sx * box.w / 2 * c - sz * box.d / 2 * s,
    z: box.z + sx * box.w / 2 * s + sz * box.d / 2 * c,
  }));
};
const obbsOverlap = (a: any, b: any) => {
  const ac = obbCorners(a), bc = obbCorners(b),
    axes = [a.rotation || 0, (a.rotation || 0) + 90, b.rotation || 0, (b.rotation || 0) + 90];
  return axes.every((degrees) => {
    const radians = degrees * Math.PI / 180, axis = { x: Math.cos(radians), z: Math.sin(radians) },
      pa = ac.map((p) => p.x * axis.x + p.z * axis.z), pb = bc.map((p) => p.x * axis.x + p.z * axis.z);
    return Math.min(...pa) < Math.max(...pb) - 0.001 && Math.min(...pb) < Math.max(...pa) - 0.001;
  });
};
const circleObbClearance = (circle: any, box: any) => {
  const angle = (box.rotation || 0) * Math.PI / 180,
    dx = circle.x - box.x, dz = circle.z - box.z,
    localX = dx * Math.cos(angle) + dz * Math.sin(angle),
    localZ = -dx * Math.sin(angle) + dz * Math.cos(angle),
    excessX = Math.max(Math.abs(localX) - box.w / 2, 0),
    excessZ = Math.max(Math.abs(localZ) - box.d / 2, 0);
  return Math.hypot(excessX, excessZ) - circle.r;
};
const circlePairClearance = (a: any, b: any) => Math.hypot(a.x - b.x, a.z - b.z) - a.r - b.r;
const segmentDistance = (point: any, a: any, b: any) => {
  const vx = b.x - a.x, vz = b.z - a.z, lengthSq = vx * vx + vz * vz,
    t = Math.max(0, Math.min(1, ((point.x - a.x) * vx + (point.z - a.z) * vz) / lengthSq));
  return Math.hypot(point.x - (a.x + t * vx), point.z - (a.z + t * vz));
};

// Geometry checks intentionally derive bounds from the returned model so a
// regression in the revision overlay cannot pass by matching a frozen report.
test("space revision aligns structural column and bearing-wall finished faces and preserves shell bounds", () => {
  const model = revisedModel(), source = createLifeDesign(
      createHomeDesign(createSalonDesign(createAtmosphereDesign(createStorageDesign(structuredClone(baseModel) as never)))),
    ),
    column = byId(model, "column-handdrawn"),
    wall = model.walls.find((candidate: any) => candidate.id === "master-bearing");
  expect(model.version).toBe("11.0.0");
  expect(wall, "the column must reference a real master-bearing wall").toBeTruthy();
  const wallCenterZ = (wall.a[1] + wall.b[1]) / 2;
  expect(column.z - column.d / 2).toBeCloseTo(wallCenterZ - wall.thickness / 2, 6);

  const bounds = (walls: any[]) => ({
    minX: Math.min(...walls.flatMap((w: any) => [w.a[0], w.b[0]])),
    maxX: Math.max(...walls.flatMap((w: any) => [w.a[0], w.b[0]])),
    minZ: Math.min(...walls.flatMap((w: any) => [w.a[1], w.b[1]])),
    maxZ: Math.max(...walls.flatMap((w: any) => [w.a[1], w.b[1]])),
  });
  expect(bounds(model.walls)).toEqual(bounds(source.walls));
  const exteriorWallIds = ["east", "north", "south-master", "balcony-east", "balcony-south", "balcony-west", "step", "west-left", "west-right"];
  for (const id of exteriorWallIds) {
    expect(model.walls.find((candidate: any) => candidate.id === id), `${id} shell wall`).toEqual(
      source.walls.find((candidate: any) => candidate.id === id),
    );
  }
});

test("entry island matches the column, seats two, and keeps an open south passage", () => {
  const model = revisedModel(), column = byId(model, "column-handdrawn"),
    island = byId(model, "s02-entry-return"),
    kitchen = model.rooms.find((room: any) => room.id === "kitchen"),
    stools = model.objects.filter((object: any) => object.type === "counter_stool");
  expect(island.w).toBeCloseTo(column.w, 6);
  expect(island.d).toBeGreaterThanOrEqual(1.6);
  const islandRect = rect(island), kitchenSouthFace = Math.max(...kitchen.polygon.map((point: number[]) => point[1]));
  expect(islandRect.minZ - kitchenSouthFace).toBeGreaterThanOrEqual(0.9);
  expect(stools).toHaveLength(2);
  expect(island.kneeVoid.depthM).toBeGreaterThan(0);
  const knee = {
    minX: island.kneeVoid.faceX,
    maxX: island.kneeVoid.faceX + island.kneeVoid.depthM,
    minZ: island.z - island.d / 2 + 0.018,
    maxZ: island.z + island.d / 2 - 0.018,
  };
  for (const part of island.collisionParts) {
    if ((part.y || 0) >= 0.65) continue;
    expect(overlaps(knee, partRect(part)), `island solid blocks its knee void`).toBe(false);
  }
  for (const stool of stools) {
    expect(stool.rotation).toBe(90);
    const stoolRect = rect(stool);
    for (const object of model.objects) {
      for (const part of object.collisionParts || []) {
        if (part.h < 0.45) continue;
        expect(overlaps(stoolRect, partRect(part)), `${stool.id} overlaps ${object.id} solid`).toBe(false);
      }
    }
  }
  for (const seat of model.homeDesign.entryIslandDining.seats) {
    const stool = byId(model, seat.id), pulled = { ...stool, x: seat.pulledCenter[0], z: seat.pulledCenter[1] },
      pulledRect = rect(pulled), rearBar = byId(model, "s02-bar-storage");
    expect(pulledRect.maxX).toBeLessThanOrEqual(island.x - island.w / 2);
    expect(pulledRect.minX).toBeGreaterThanOrEqual(rearBar.x + rearBar.w / 2);
  }
  const hatch = model.homeDesign.hatch;
  expect(hatch.enabled).toBe(false);
  expect(model.openings.some((opening: any) => opening.id === "hall-gate")).toBe(false);
});

test("closed kitchen has a sink window and a usable external refrigerator envelope", () => {
  const model = revisedModel(), kitchen = model.rooms.find((room: any) => room.id === "kitchen"),
    sink = byId(model, "kitchen-sink"), fridge = byId(model, "kitchen-fridge"),
    window = model.openings.find((opening: any) => opening.id === "kitchen-window");
  expect(kitchen.polygon.length).toBeGreaterThanOrEqual(4);
  expect(window).toBeTruthy();
  expect(window.wallId).toBe("north");
  expect(window.center[1]).toBeCloseTo(sink.z, 6);
  expect(sink.x).toBeGreaterThanOrEqual(0.2);
  expect(sink.x).toBeLessThanOrEqual(0.7);
  // With the sink rotated 90 degrees, its width projects along the north wall's z axis.
  expect(Math.abs(sink.z - window.center[1]) + sink.w / 2).toBeLessThanOrEqual(window.width / 2);
  expect(fridge.room).not.toBe("kitchen");
  expect(rect(fridge).minX).toBeGreaterThan(Math.max(...kitchen.polygon.map((point: number[]) => point[0])));
  expect(fridge.useEnvelope.w).toBeGreaterThan(0);
  expect(fridge.useEnvelope.d).toBeGreaterThan(0);
});

test("relocated upper sink cabinet clears the kitchen window in world space", () => {
  const model = revisedModel(), cabinet = byId(model, "upper-kitchen-sink"),
    window = model.openings.find((opening: any) => opening.id === "kitchen-window"),
    cabinetBounds = rect(cabinet),
    cabinetY = { min: cabinet.y, max: cabinet.y + cabinet.h },
    windowX = { min: -0.09, max: 0.09 },
    windowY = { min: window.sill, max: window.sill + window.height },
    windowZ = { min: window.center[1] - window.width / 2, max: window.center[1] + window.width / 2 };
  const overlaps = (a: any, b: any) => a.min < b.max && a.max > b.min;
  expect(overlaps(cabinetBounds, windowX) && overlaps(cabinetY, windowY) && overlaps(
    { min: cabinetBounds.minZ, max: cabinetBounds.maxZ }, windowZ,
  )).toBe(false);
});

test("upper bath mirror sits against the bath side wall", () => {
  const model = revisedModel(), mirror = byId(model, "upper-bath-mirror"),
    wall = model.walls.find((candidate: any) => candidate.id === "bath-side"),
    mirrorBounds = rect(mirror), wallRoomFaceX = wall.a[0] - wall.thickness / 2;
  expect(wall.b[0]).toBeCloseTo(wall.a[0], 6);
  expect(mirrorBounds.maxX).toBeLessThanOrEqual(wallRoomFaceX + 0.001);
  expect(wallRoomFaceX - mirrorBounds.maxX).toBeLessThanOrEqual(0.05);
});

test("master door moves farther from the bath and its opening fits its wall", () => {
  const model = revisedModel(), previous = createLifeDesign(
    createHomeDesign(createSalonDesign(createAtmosphereDesign(createStorageDesign(structuredClone(baseModel) as never)))),
  ),
    door = model.openings.find((opening: any) => opening.id === "master-door"),
    oldDoor = previous.openings.find((opening: any) => opening.id === "master-door"),
    bath = model.rooms.find((room: any) => room.id === "bath"),
    oldBath = previous.rooms.find((room: any) => room.id === "bath"),
    distance = (opening: any, room: any) => Math.min(...room.polygon.map((point: number[]) =>
      Math.hypot(point[0] - opening.center[0], point[1] - opening.center[1])));
  expect(distance(door, bath)).toBeGreaterThan(distance(oldDoor, oldBath));
  const wall = model.walls.find((candidate: any) => candidate.id === door.wallId);
  expect(wall).toBeTruthy();
  const wallLength = Math.hypot(wall.b[0] - wall.a[0], wall.b[1] - wall.a[1]);
  const along = Math.abs((door.center[0] - wall.a[0]) * (wall.b[0] - wall.a[0]) +
    (door.center[1] - wall.a[1]) * (wall.b[1] - wall.a[1])) / wallLength;
  expect(along - door.width / 2).toBeGreaterThanOrEqual(-0.001);
  expect(along + door.width / 2).toBeLessThanOrEqual(wallLength + 0.001);
});

test("master door completes its swing clear of storage and desks with a 440 mm route past the open leaf", () => {
  const model = revisedModel(), door = model.openings.find((opening: any) => opening.id === "master-door"),
    wardrobe = byId(model, "master-wardrobe"), obstacles = [wardrobe, byId(model, "pc-desk"), byId(model, "mac-desk")];
  const solids = obstacles.flatMap((object: any) => (object.collisionParts || [object]).map((part: any) => ({
    ...part,
    y: part.y ?? object.y ?? 0,
    h: part.h ?? object.h,
  })));
  const verticalOverlap = (a: any, b: any) => a.y < b.y + b.h && b.y < a.y + a.h;
  const samples = Array.from({ length: 19 }, (_, index) => 90 - index * 5);
  for (const sceneYaw of samples) {
    // Scene door groups rotate around y by -opening.rotation - openAngle;
    // local +x therefore maps to (cos(yaw), -sin(yaw)) in the floor plane.
    const yaw = sceneYaw * Math.PI / 180,
      center = { x: door.hinge[0] + Math.cos(yaw) * door.width / 2, z: door.hinge[1] - Math.sin(yaw) * door.width / 2 },
      leaf = { ...center, w: door.width, d: door.thickness || 0.04, rotation: -sceneYaw, y: 0, h: door.height };
    for (const solid of solids) {
      if (verticalOverlap(leaf, solid))
        expect(obbsOverlap(leaf, solid), `door swing at scene yaw ${sceneYaw} intersects a room solid`).toBe(false);
    }
  }
  const openLeaf = { x: door.hinge[0] + door.width / 2, z: door.hinge[1], w: door.width, d: door.thickness || 0.04, rotation: 0 },
    deskParts = [byId(model, "pc-desk"), byId(model, "mac-desk")].flatMap((desk: any) => desk.collisionParts || [desk]),
    deskMinZ = Math.min(...deskParts.map((part: any) => rect(part).minZ)),
    leafSouthEdge = rect(openLeaf).minZ,
    bodyCorridor = leafSouthEdge - deskMinZ;
  expect(bodyCorridor).toBeGreaterThanOrEqual(0.44);
});

test("simultaneous kitchen and entry-island use fits 600 mm body envelopes in the modeled clearances", async ({}, testInfo) => {
  const model = revisedModel(), body = (x: number, z: number) => ({ x, z, r: 0.3, y: 0, h: 1.88 }),
    kitchenTypes = new Set(["cabinet_frame", "base_cabinet", "wall_storage", "sink", "hob", "dishwasher", "counter_appliance", "oven", "bin"]),
    kitchenSolids = model.objects.filter((object: any) => object.room === "kitchen" && kitchenTypes.has(object.type))
      .flatMap((object: any) => (object.collisionParts?.length ? object.collisionParts : [object]).map((part: any) => ({
        ...part, y: part.y ?? object.y ?? 0, h: part.h ?? object.h, owner: object.id,
      })))
      .filter((part: any) => part.y < 1.88 && part.y + part.h > 0);
  const kitchenUse = [
    { name: "sink-side cook", body: body(1.1, 4.7) },
    { name: "hob-side cook", body: body(1.8, 4.5) },
  ];
  const cookClearances = kitchenUse.map((cook) => ({
    name: cook.name,
    nearestSolidClearanceM: Math.min(...kitchenSolids.map((solid: any) => circleObbClearance(cook.body, solid))),
  }));
  const cookPairClearance = circlePairClearance(kitchenUse[0].body, kitchenUse[1].body);
  const prepBody = body(3.1, 4.8),
    prepClearance = Math.min(...kitchenSolids.map((solid: any) => circleObbClearance(prepBody, solid)));

  const dining = model.homeDesign.entryIslandDining,
    seated = dining.seats.map((seat: any) => body(seat.center[0], seat.center[1])),
    pulled = dining.seats.map((seat: any) => body(seat.pulledCenter[0], seat.pulledCenter[1])),
    barOperator = body(2.925, 7.0),
    seatedPairClearance = circlePairClearance(seated[0], seated[1]),
    pulledPairClearance = circlePairClearance(pulled[0], pulled[1]),
    barToSeatedClearance = Math.min(...seated.map((seat: any) => circlePairClearance(barOperator, seat))),
    barToPulledClearance = Math.min(...pulled.map((seat: any) => circlePairClearance(barOperator, seat))),
    rearBar = byId(model, "s02-bar-storage"),
    barClearances = pulled.map((person: any) => circleObbClearance(person, rearBar));
  // The door opening admits a 600 mm wide centered route along z from the kitchen
  // opening to the island tip; keep the bartender and both seated/retreat states out.
  const routeA = { x: 2.35, z: dining.routingCorridor.minZ },
    routeB = { x: 2.35, z: dining.routingCorridor.maxZ },
    routeBodyClearances = [barOperator, ...seated, ...pulled].map((person: any) =>
      segmentDistance(person, routeA, routeB) - person.r - 0.3),
    audit = {
      body: { diameterM: 0.6, heightM: 1.88 },
      cookPairClearanceM: cookPairClearance,
      cookSolidClearancesM: cookClearances,
      prepSolidClearanceM: prepClearance,
      seatedPairClearanceM: seatedPairClearance,
      pulledPairClearanceM: pulledPairClearance,
      bartenderToSeatedClearanceM: barToSeatedClearance,
      bartenderToPulledClearanceM: barToPulledClearance,
      retreatToRearBarClearancesM: barClearances,
      occupiedMainRouteClearancesM: routeBodyClearances,
    };
  console.log("SPACE_REVISION_JOINT_USE", JSON.stringify(audit));
  await testInfo.attach("space-revision-joint-use.json", {
    body: Buffer.from(JSON.stringify(audit, null, 2)), contentType: "application/json",
  });
  expect(cookClearances.every((item: any) => item.nearestSolidClearanceM >= 0), JSON.stringify(audit)).toBe(true);
  expect(cookPairClearance, JSON.stringify(audit)).toBeGreaterThanOrEqual(0);
  expect(prepClearance, JSON.stringify(audit)).toBeGreaterThanOrEqual(0);
  expect(seatedPairClearance, JSON.stringify(audit)).toBeGreaterThanOrEqual(0);
  expect(pulledPairClearance, JSON.stringify(audit)).toBeGreaterThanOrEqual(0);
  expect(barToSeatedClearance, JSON.stringify(audit)).toBeGreaterThanOrEqual(0);
  expect(barToPulledClearance, JSON.stringify(audit)).toBeGreaterThanOrEqual(0);
  expect(barClearances.every((clearance: number) => clearance >= 0), JSON.stringify(audit)).toBe(true);
  expect(routeBodyClearances.every((clearance: number) => clearance >= 0), JSON.stringify(audit)).toBe(true);
});

test("exterior bays do not enlarge the indoor walking polygons", () => {
  const model = revisedModel(), baseline = createLifeDesign(
    createHomeDesign(createSalonDesign(createAtmosphereDesign(createStorageDesign(structuredClone(baseModel) as never)))),
  );
  for (const bay of model.homeDesign.bayWindows) {
    const before = baseline.rooms.find((room: any) => room.id === bay.roomId),
      after = model.rooms.find((room: any) => room.id === bay.roomId);
    expect(after.polygon, `${bay.roomId} walking polygon must not include the exterior bay`).toEqual(before.polygon);
    expect(bay.retainedWalkingPolygon).toBe(true);
  }
});
