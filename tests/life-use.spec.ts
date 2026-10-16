import { test, expect } from "@playwright/test";
import * as THREE from "three";
import baseModel from "../src/model.js";
import { createStorageDesign } from "../src/storage-design";
import { createAtmosphereDesign } from "../src/atmosphere-design";
import { createSalonDesign } from "../src/salon-design";
import { createHomeDesign } from "../src/home-design";
import { createLifeDesign } from "../src/life-design";
import {
  applyLifeMotion,
  buildLifeFurniture,
  createLifeMotion,
} from "../src/life-mesh";
import {
  applyHomeMotion,
  buildHomeFurniture,
  createHomeMotion,
  homeMotionBounds,
} from "../src/home-mesh";

function model() {
  return createLifeDesign(
    createHomeDesign(
      createSalonDesign(
        createAtmosphereDesign(createStorageDesign(baseModel as never)),
      ),
    ),
  );
}

function materials() {
  const material = new THREE.MeshStandardMaterial();
  return new Proxy({}, { get: () => material }) as Record<
    string,
    THREE.Material
  >;
}

function lifeObject(m: any, id: string) {
  const object = m.objects.find((candidate: any) => candidate.id === id);
  if (!object) throw new Error(`Missing model object ${id}`);
  const group = new THREE.Group();
  group.name = object.id;
  group.position.set(object.x, object.y || 0, object.z);
  group.rotation.y = -THREE.MathUtils.degToRad(object.rotation || 0);
  const motion = createLifeMotion();
  expect(buildLifeFurniture(group, object, materials(), motion)).toBe(true);
  return { object, group, motion };
}

function worldBounds(group: THREE.Object3D) {
  group.updateWorldMatrix(true, true);
  return new THREE.Box3().setFromObject(group);
}

function visibleMeshBounds(root: THREE.Object3D) {
  const bounds: THREE.Box3[] = [];
  root.updateWorldMatrix(true, true);
  root.traverse((node) => {
    if (node.visible && (node as THREE.Mesh).isMesh) {
      const mesh = node as THREE.Mesh;
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      bounds.push(new THREE.Box3().setFromObject(mesh));
    }
  });
  return bounds;
}

function visibleBoundsOverlap(a: THREE.Object3D, b: THREE.Object3D, toleranceM = 0.002) {
  const aa = visibleMeshBounds(a), bb = visibleMeshBounds(b);
  for (let i = 0; i < aa.length; i++) for (let j = 0; j < bb.length; j++) {
    const one = aa[i], two = bb[j];
    if (
      one.min.x <= two.max.x + toleranceM && one.max.x + toleranceM >= two.min.x &&
      one.min.y <= two.max.y + toleranceM && one.max.y + toleranceM >= two.min.y &&
      one.min.z <= two.max.z + toleranceM && one.max.z + toleranceM >= two.min.z
    ) return { a: one, b: two, aMesh: i, bMesh: j };
  }
  return null;
}

test("French-door fridge opens toward the corridor with the real door leaves", () => {
  const m = model(), { object, group, motion } = lifeObject(m, "kitchen-fridge");
  expect(object).toMatchObject({
    x: 4.045,
    z: 4.05,
    w: 0.91,
    d: 0.75,
    h: 1.85,
    rotation: 90,
    accessFace: "+x",
    doorLayout: "french_double",
  });

  applyLifeMotion(motion, { fridge: 0, drawer: 0, miniFridge: 0, shower: 0 });
  const closed = worldBounds(group);
  applyLifeMotion(motion, { fridge: 1, drawer: 0, miniFridge: 0, shower: 0 });
  const opened = worldBounds(group);
  expect(closed.max.x).toBeLessThan(4.8);
  // Door leaves are articulated mesh children. Their complete open envelope
  // extends beyond the former alcove boundary into the hall, as intended.
  expect(opened.max.x).toBeGreaterThan(4.8);
  expect(opened.max.x).toBeLessThan(5.2);
  expect(opened.min.z).toBeGreaterThan(3.4);
  expect(opened.max.z).toBeLessThan(4.8);
});

test("bevel shower uses the actual cut floor and inward-hinged leaf", () => {
  const m = model(), { object, group, motion } = lifeObject(m, "shower");
  expect(object.enclosure).toMatchObject({
    kind: "bevel_corner",
    cutM: 0.5,
    doorClearWidthM: 0.65,
    hingedInward: true,
  });
  const expectedDoorLeaf = Math.hypot(0.4, 0.55) - 0.016;
  expect(expectedDoorLeaf).toBeGreaterThan(0.65);
  expect(group.userData.shower.visibleFloorAreaM2).toBeCloseTo(0.82, 6);
  const articulation = motion.showers[0];
  const doorPanel = articulation.pivot.children[0];
  expect((doorPanel as THREE.Mesh).isMesh).toBe(true);
  let fullOpenAngle = 0;
  for (let step = 0; step <= 100; step++) {
    const progress = step / 100;
    applyLifeMotion(motion, { fridge: 0, drawer: 0, miniFridge: 0, shower: progress });
    // Check the actual glass panel against the envelope. The hinge and grab
    // bar have a 7mm hardware radius; allow 4mm for the 1mm rounded glass
    // corners and Float32 vertex bounds at the corner hinge.
    const bounds = worldBounds(doorPanel);
    fullOpenAngle = Math.abs(articulation.pivot.rotation.y - articulation.baseAngle);
    const meshToleranceM = 0.004;
    expect(bounds.min.x).toBeGreaterThanOrEqual(object.x - object.w / 2 - meshToleranceM);
    expect(bounds.max.x).toBeLessThanOrEqual(object.x + object.w / 2 + meshToleranceM);
    expect(bounds.min.z).toBeGreaterThanOrEqual(object.z - object.d / 2 - meshToleranceM);
    expect(bounds.max.z).toBeLessThanOrEqual(object.z + object.d / 2 + meshToleranceM);
  }
  expect(fullOpenAngle).toBeGreaterThan(1.3);
});

test("reading equipment clears the modeled sill and chair fronts the record console", () => {
  const m = model(), console = lifeObject(m, "reading-records"),
    chair = lifeObject(m, "reading-chair");
  const consoleBounds = worldBounds(console.group),
    sill = console.object.windowSillM;
  expect(console.object.accessFace).toBe("+x");
  expect(console.object.rotation).toBe(90);
  expect(chair.object.rotation).toBe(-90);
  expect(consoleBounds.max.y).toBeCloseTo(0.765, 2);
  expect(sill - consoleBounds.max.y).toBeGreaterThanOrEqual(0.12);
  expect(m.homeDesign.readingNook.windowHandleAndTurntableLid).toBe(
    "site_and_product_confirmation",
  );
});

test("deployed dining chair seats meet the actual table edge and parking stays within the living envelope", () => {
  const m = model(), homeMotion = createHomeMotion(), mat = materials();
  homeMotion.model = m;
  const scene = new THREE.Scene();
  for (const id of [
    "living-tv",
    "living-sofa",
    "dining-table",
    "dining-chair-left",
    "dining-chair-right",
  ]) {
    const object = m.objects.find((candidate: any) => candidate.id === id)!;
    const group = new THREE.Group();
    group.name = object.id;
    group.position.set(object.x, object.y || 0, object.z);
    group.rotation.y = -THREE.MathUtils.degToRad(object.rotation || 0);
    if (buildHomeFurniture(group, object, mat, homeMotion)) scene.add(group);
  }

  applyHomeMotion(homeMotion, {
    dining: 1,
    diningRetreat: 0,
    sofa: 0,
    activity: 0,
    tv: 0,
    gate: 0,
    dishwasher: 0,
  });
  const used = homeMotionBounds(homeMotion),
    table = used.find((item) => item.id === "dining-table")!,
    chairs = used.filter((item) => item.id.startsWith("dining-chair-"));
  expect(chairs).toHaveLength(2);
  const tableLeft = table.min[0], tableRight = table.max[0];
  const leftChair = chairs.find((item) => item.id.endsWith("left"))!,
    rightChair = chairs.find((item) => item.id.endsWith("right"))!;
  // A few centimetres of horizontal seat projection under the tabletop is
  // deliberate tuck-under, with separate vertical bounds keeping the solids apart.
  expect(tableLeft - leftChair.max[0]).toBeGreaterThanOrEqual(-0.06);
  expect(tableLeft - leftChair.max[0]).toBeLessThanOrEqual(0.06);
  expect(rightChair.min[0] - tableRight).toBeGreaterThanOrEqual(-0.06);
  expect(rightChair.min[0] - tableRight).toBeLessThanOrEqual(0.06);

  applyHomeMotion(homeMotion, {
    dining: 0,
    diningRetreat: 0,
    sofa: 0,
    activity: 0,
    tv: 0,
    gate: 0,
    dishwasher: 0,
  });
  const parked = homeMotionBounds(homeMotion),
    tablePark = parked.find((item) => item.id === "dining-table")!;
  expect(tablePark.max[2]).toBeLessThanOrEqual(9.35);
  expect(tablePark.max[2] - tablePark.min[2]).toBeLessThanOrEqual(0.2);
  for (const chair of parked.filter((item) => item.id.startsWith("dining-chair-"))) {
    expect(chair.max[2]).toBeLessThanOrEqual(9.35);
    expect(chair.min[0]).toBeGreaterThanOrEqual(6.9);
    expect(chair.max[0]).toBeLessThanOrEqual(11.65);
  }
});

test("101 rendered dining, activity, sofa and TV transition poses have no visible-mesh AABB intersections", () => {
  const m = model(), homeMotion = createHomeMotion(), mat = materials();
  homeMotion.model = m;
  const scene = new THREE.Scene();
  for (const id of [
    "living-tv",
    "living-sofa",
    "dining-table",
    "dining-chair-left",
    "dining-chair-right",
  ]) {
    const object = m.objects.find((candidate: any) => candidate.id === id)!;
    const group = new THREE.Group();
    group.name = object.id;
    group.position.set(object.x, object.y || 0, object.z);
    group.rotation.y = -THREE.MathUtils.degToRad(object.rotation || 0);
    if (buildHomeFurniture(group, object, mat, homeMotion)) scene.add(group);
  }

  const staticPairs = [
    ["dining-table", "living-tv"],
    ["dining-table", "sofa-module-1"],
    ["dining-table", "sofa-module-2"],
    ["dining-table", "dining-chair-left"],
    ["dining-table", "dining-chair-right"],
    ["dining-chair-left", "dining-chair-right"],
    ["dining-chair-left", "living-tv"],
    ["dining-chair-right", "living-tv"],
  ] as const;
  const targets = () => {
    const groups = new Map<string, THREE.Object3D>();
    groups.set("living-tv", homeMotion.mobileTV!.group);
    groups.set("dining-table", homeMotion.table!.group);
    homeMotion.chairs.forEach((chair) => groups.set(chair.group.name, chair.group));
    homeMotion.sofaModules.forEach((module) => groups.set(module.name, module));
    return groups;
  };
  const movablePairs = [
    ...staticPairs,
    ["living-tv", "sofa-module-1"],
    ["living-tv", "sofa-module-2"],
    ["dining-chair-left", "sofa-module-1"],
    ["dining-chair-left", "sofa-module-2"],
    ["dining-chair-right", "sofa-module-1"],
    ["dining-chair-right", "sofa-module-2"],
  ] as const;

  const transitions = [
    { name: "relax-to-dining", state: (p: number) => ({ dining: p, activity: 0, sofa: 0, tv: 0 }) },
    { name: "dining-to-relax", state: (p: number) => ({ dining: 1 - p, activity: 0, sofa: 0, tv: 0 }) },
    { name: "relax-to-activity", state: (p: number) => ({ dining: 0, activity: p, sofa: 0, tv: 0 }) },
    { name: "activity-to-relax", state: (p: number) => ({ dining: 0, activity: 1 - p, sofa: 0, tv: 0 }) },
    { name: "sofa-combine-to-separate", state: (p: number) => ({ dining: 0, activity: 0, sofa: p, tv: 0 }) },
    { name: "tv-default-to-alternative", state: (p: number) => ({ dining: 0, activity: 0, sofa: 0, tv: p }) },
  ];
  for (const transition of transitions) {
    for (let step = 0; step <= 100; step++) {
      const progress = step / 100;
      applyHomeMotion(homeMotion, {
        ...transition.state(progress),
        gate: 0,
        dishwasher: 0,
        diningRetreat: 0,
      });
      scene.updateMatrixWorld(true);
      const groupMap = targets();
      for (const [a, b] of movablePairs) {
        const intersection = visibleBoundsOverlap(groupMap.get(a)!, groupMap.get(b)!);
        expect(
          intersection,
          `${transition.name} at ${step}/100: ${a} intersects ${b} under per-visible-mesh 3D AABB checks (2mm tolerance): ${intersection ? JSON.stringify({ aMesh: intersection.aMesh, bMesh: intersection.bMesh, a: [intersection.a.min.toArray(), intersection.a.max.toArray()], b: [intersection.b.min.toArray(), intersection.b.max.toArray()] }) : "none"}`,
        ).toBeNull();
      }
    }
  }
});
