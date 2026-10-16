import { test, expect } from "@playwright/test";
import * as THREE from "three";
import baseModel from "../src/model.js";
import { createStorageDesign } from "../src/storage-design";
import { createAtmosphereDesign } from "../src/atmosphere-design";
import { createSalonDesign } from "../src/salon-design";
import { createHomeDesign } from "../src/home-design";
import { createLifeDesign } from "../src/life-design";
import {
  applyHomeMotion,
  buildHomeFurniture,
  createHomeMotion,
  homeMotionBounds,
} from "../src/home-mesh";
import {
  applyLifeMotion,
  buildLifeFurniture,
  createLifeMotion,
} from "../src/life-mesh";

function lifeModel() {
  return createLifeDesign(
    createHomeDesign(
      createSalonDesign(
        createAtmosphereDesign(createStorageDesign(baseModel as never)),
      ),
    ),
  );
}

function makeMaterials() {
  const material = new THREE.MeshStandardMaterial();
  return new Proxy({}, { get: () => material }) as Record<
    string,
    THREE.Material
  >;
}

function staticFurniture(model: any, ids: string[]) {
  const scene = new THREE.Scene(),
    homeMotion = createHomeMotion(),
    lifeMotion = createLifeMotion(),
    materials = makeMaterials();
  homeMotion.model = model;
  for (const id of ids) {
    const object = model.objects.find((candidate: any) => candidate.id === id);
    if (!object) throw new Error(`Missing model object ${id}`);
    const group = new THREE.Group();
    group.name = object.id;
    group.position.set(object.x, object.y || 0, object.z);
    group.rotation.y = -THREE.MathUtils.degToRad(object.rotation || 0);
    if (
      buildLifeFurniture(group, object, materials, lifeMotion) ||
      buildHomeFurniture(group, object, materials, homeMotion)
    )
      scene.add(group);
  }
  return { scene, homeMotion, lifeMotion };
}

function modelRect(object: any) {
  const angle = THREE.MathUtils.degToRad(object.rotation || 0),
    c = Math.abs(Math.cos(angle)),
    s = Math.abs(Math.sin(angle)),
    halfX = (c * object.w + s * object.d) / 2,
    halfZ = (s * object.w + c * object.d) / 2;
  return {
    minX: object.x - halfX,
    maxX: object.x + halfX,
    minZ: object.z - halfZ,
    maxZ: object.z + halfZ,
  };
}

function overlap(a: any, b: any) {
  return (
    Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX) > 0.001 &&
    Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ) > 0.001
  );
}

test("V10 reclassifies the kitchen and keeps the new living/bar dependencies resolvable", () => {
  const source = structuredClone(baseModel),
    model = lifeModel(),
    get = (id: string) => model.objects.find((object: any) => object.id === id);
  expect(baseModel).toEqual(source);
  expect(model.version).toBe("10.0.0");
  expect(new Set(model.objects.map((object: any) => object.id)).size).toBe(
    model.objects.length,
  );
  expect(model.rooms.find((room: any) => room.id === "kitchen").polygon).toEqual(
    [[0, 3.4], [3.5, 3.4], [3.5, 5.68], [0, 5.68]],
  );
  expect(model.walls.find((wall: any) => wall.id === "kitchen-side")).toMatchObject({
    a: [3.5, 3.4],
    b: [3.5, 5.68],
    thickness: 0.18,
  });
  expect(get("kitchen-fridge")).toMatchObject({
    x: 4.045,
    z: 4.05,
    w: 0.91,
    d: 0.75,
    rotation: 90,
    accessFace: "+x",
  });
  expect(get("kitchen-hob")).toMatchObject({ x: 1.25, z: 3.815 });
  expect(get("kitchen-sink")).toMatchObject({ x: 0.45, z: 4.7 });
  expect(get("bar-window-worktop")).toBeUndefined();
  expect(get("bar-window-worktop-connector")).toBeUndefined();
  for (const fixture of model.lighting.fixtures) {
    if (fixture.anchor)
      expect(get(fixture.anchor) || model.objects.some((o: any) => o.id === fixture.anchor),
        `fixture ${fixture.id} has stale anchor ${fixture.anchor}`).toBeTruthy();
  }
  for (const scene of model.lighting.scenes) {
    if (scene.viewId)
      expect(model.presentation.interiorViews.some((view: any) => view.id === scene.viewId),
        `${scene.id} refers to missing view ${scene.viewId}`).toBeTruthy();
  }
});

test("living dining modes keep the full table, chairs and sofa modules inside their intended poses", () => {
  const model = lifeModel(),
    get = (id: string) => model.objects.find((object: any) => object.id === id),
    table = get("dining-table"),
    left = get("dining-chair-left"),
    right = get("dining-chair-right"),
    scene = new THREE.Scene(),
    homeMotion = createHomeMotion(),
    materials = makeMaterials();
  homeMotion.model = model;
  for (const id of ["living-sofa", "living-tv", "dining-table", "dining-chair-left", "dining-chair-right"]) {
    const object = get(id),
      group = new THREE.Group();
    group.name = object.id;
    group.position.set(object.x, object.y || 0, object.z);
    group.rotation.y = -THREE.MathUtils.degToRad(object.rotation || 0);
    if (buildHomeFurniture(group, object, materials, homeMotion)) scene.add(group);
  }
  const expectedUse = model.homeDesign.dining.usePositions;
  expect(expectedUse.table).toMatchObject({ x: 9.3, z: 7.8 });
  expect(expectedUse.chairs.map((chair: any) => [chair.x, chair.z])).toEqual([
    [8.5, 7.8],
    [10.1, 7.8],
  ]);
  expect(table).toMatchObject({ x: 11.0, z: 9.06, w: 1.1, d: 0.7 });
  expect(left).toMatchObject({ x: 8.27, z: 8.78 });
  expect(right).toMatchObject({ x: 8.27, z: 9.03 });

  applyHomeMotion(homeMotion, { dining: 0, sofa: 0, activity: 0, tv: 0, gate: 0, dishwasher: 0 });
  const parked = homeMotionBounds(homeMotion),
    parkedTable = parked.find((item) => item.id === "dining-table")!;
  expect(parkedTable.max[2]).toBeLessThanOrEqual(9.35);
  expect(parkedTable.max[2] - parkedTable.min[2]).toBeLessThanOrEqual(0.2);

  applyHomeMotion(homeMotion, { dining: 1, sofa: 0, activity: 0, tv: 0, gate: 0, dishwasher: 0 });
  const meal = homeMotionBounds(homeMotion),
    deployedTable = meal.find((item) => item.id === "dining-table")!,
    tableDepth = deployedTable.max[2] - deployedTable.min[2];
  expect(deployedTable.max[0] - deployedTable.min[0]).toBeCloseTo(1.1, 1);
  expect(tableDepth).toBeCloseTo(0.7, 1);
  expect(deployedTable.min[0]).toBeGreaterThanOrEqual(8.0);
  expect(deployedTable.max[0]).toBeLessThanOrEqual(11.65);
  expect(deployedTable.min[2]).toBeGreaterThanOrEqual(4.4);
  expect(deployedTable.max[2]).toBeLessThanOrEqual(9.35);

  applyHomeMotion(homeMotion, { dining: 0, sofa: 0, activity: 1, tv: 0, gate: 0, dishwasher: 0 });
  const activity = homeMotionBounds(homeMotion),
    modules = activity.filter((item) => item.id.startsWith("sofa-module-"));
  expect(modules).toHaveLength(2);
  expect(modules.map((item) => (item.min[2] + item.max[2]) / 2)).toEqual([
    5.575,
    5.575,
  ]);
  for (const module of modules) {
    expect(module.min[0]).toBeGreaterThanOrEqual(6.9);
    expect(module.max[0]).toBeLessThanOrEqual(11.65);
    expect(module.min[2]).toBeGreaterThanOrEqual(4.4);
    expect(module.max[2]).toBeLessThanOrEqual(9.35);
  }
});

test("guest drinks fridge has a clear open-door envelope and reading nook objects do not overlap", () => {
  const model = lifeModel(),
    get = (id: string) => model.objects.find((object: any) => object.id === id),
    fridge = get("guest-drinks-fridge"),
    bed = model.homeDesign.guestBed.openEnvelope,
    wardrobe = modelRect(get("guest-wardrobe")),
    unit = staticFurniture(model, ["guest-drinks-fridge"]),
    group = unit.scene.getObjectByName("guest-drinks-fridge")!;
  applyLifeMotion(unit.lifeMotion, { miniFridge: 1, fridge: 0, shower: 0 });
  group.updateWorldMatrix(true, true);
  const openedDoorBounds = new THREE.Box3().setFromObject(group),
    doorRect = {
      minX: openedDoorBounds.min.x,
      maxX: openedDoorBounds.max.x,
      minZ: openedDoorBounds.min.z,
      maxZ: openedDoorBounds.max.z,
    };
  expect(fridge).toMatchObject({ x: 3.45, z: 0.55, w: 0.48, d: 0.52, rotation: 180 });
  expect(overlap(doorRect, { minX: bed.x - bed.w / 2, maxX: bed.x + bed.w / 2, minZ: bed.z - bed.d / 2, maxZ: bed.z + bed.d / 2 })).toBe(false);
  expect(overlap(doorRect, wardrobe)).toBe(false);

  const chair = get("reading-chair"),
    records = get("reading-records"),
    side = get("reading-side"),
    lamp = get("reading-lamp");
  expect(model.homeDesign.readingNook).toMatchObject({ mainDining: false, windowUncovered: true });
  expect(overlap(modelRect(chair), modelRect(records))).toBe(false);
  expect(overlap(modelRect(chair), modelRect(side))).toBe(false);
  expect(overlap(modelRect(side), modelRect(lamp))).toBe(false);
  expect(records.room).toBe("bar");
  expect(model.homeDesign.dining.role).toBe("living_normal_height_daily_dining");
});
