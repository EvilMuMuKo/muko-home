import { test, expect } from "@playwright/test";
import { createServer, type ViteDevServer } from "vite";
import * as THREE from "three";

let fixtureServer: ViteDevServer;
let finalModel: any;
let baseModel: any;
let preR2Model: any;
let r2CabinetPanels: (object: any) => Array<{ x: number; y: number; z: number; w: number; h: number; d: number; material: string }>;
let buildR2Cabinet: (group: THREE.Group, object: any, materials: Record<string, THREE.Material>, doors: any[]) => boolean;

test.beforeAll(async () => {
  fixtureServer = await createServer({
    configFile: false,
    root: process.cwd(),
    appType: "custom",
    server: { middlewareMode: true },
  });
  ({ finalModel } = await fixtureServer.ssrLoadModule("/src/final-design.ts"));
  ({ default: baseModel } = await fixtureServer.ssrLoadModule("/src/model.js"));
  ({ r2CabinetPanels, buildR2Cabinet } = await fixtureServer.ssrLoadModule("/src/r2-cabinet-mesh.ts"));
  const { createStorageDesign } = await fixtureServer.ssrLoadModule("/src/storage-design.ts");
  const { createAtmosphereDesign } = await fixtureServer.ssrLoadModule("/src/atmosphere-design.ts");
  const { createSalonDesign } = await fixtureServer.ssrLoadModule("/src/salon-design.ts");
  const { createHomeDesign } = await fixtureServer.ssrLoadModule("/src/home-design.ts");
  const { createLifeDesign } = await fixtureServer.ssrLoadModule("/src/life-design.ts");
  const { createSpaceRevision } = await fixtureServer.ssrLoadModule("/src/space-revision.ts");
  preR2Model = createSpaceRevision(createLifeDesign(createHomeDesign(createSalonDesign(createAtmosphereDesign(createStorageDesign(structuredClone(baseModel)))))));
});

test.afterAll(async () => { await fixtureServer?.close(); });

const get = (id: string, model = finalModel) => model.objects.find((object: any) => object.id === id);

test("R2 keeps the surveyed-relational shell, opens kitchen boundaries, and preserves named furniture sizes", () => {
  const beforeColumn = get("column-handdrawn", preR2Model);
  const afterColumn = get("column-handdrawn");
  for (const key of ["x", "z", "w", "d", "h", "rotation"]) expect(afterColumn[key]).toBe(beforeColumn[key]);

  const guestDoor = finalModel.openings.find((opening: any) => opening.id === "guest-door");
  expect(guestDoor).toMatchObject({ wallId: "guest-west", type: "door", center: [4.35, 3.4], hinge: [3.92, 3.4], rotation: 0, openAngle: 90 });
  const guestWall = finalModel.walls.find((wall: any) => wall.id === "guest-west");
  expect(guestWall).toMatchObject({ a: [0, 3.4], b: [4.8, 3.4] });

  for (const [openingId, wallId] of [["kitchen-glass-boundary", "kitchen-side"], ["kitchen-counter-boundary", "kitchen-west"]]) {
    const opening = finalModel.openings.find((candidate: any) => candidate.id === openingId);
    const wall = finalModel.walls.find((candidate: any) => candidate.id === wallId);
    const wallLength = Math.hypot(wall.b[0] - wall.a[0], wall.b[1] - wall.a[1]);
    expect(opening.type).toBe("open");
    expect(opening.height).toBeCloseTo(wall.height, 6);
    expect(opening.width).toBeCloseTo(wallLength, 6);
  }
  expect(finalModel.openings.some((opening: any) => opening.id === "kitchen-door" && opening.r2Glazing === "side")).toBe(true);
  expect(finalModel.openings.some((opening: any) => opening.id === "kitchen-pass-window" && opening.r2Glazing === "counter")).toBe(true);

  const revision = finalModel.homeDesign.r2Revision;
  expect(revision.alignment.fridgeFrontAndColumnFarFaceZ).toBe(4.31);
  expect(revision.alignment.livingCabinetAndColumnNearFaceZ).toBe(4.81);
  expect(revision.clearances).toMatchObject({ mainKitchenM: 1.11, fridgeZoneM: 1.19 });
  const column = get("column-handdrawn");
  expect(get("kitchen-fridge").z + get("kitchen-fridge").d / 2).toBeCloseTo(4.31, 6);
  expect(get("r2-living-shallow").z + get("r2-living-shallow").d / 2).toBeCloseTo(4.81, 6);
  expect(column.z - column.d / 2).toBeCloseTo(4.31, 6);
  expect(column.z + column.d / 2).toBeCloseTo(4.81, 6);

  expect(get("master-mattress")).toMatchObject({ w: 1.8, d: 2 });
  expect(get("pc-desk")).toMatchObject({ w: 1.4, d: 0.75 });
  expect(get("mac-desk")).toMatchObject({ w: 1.2, d: 0.75 });
  expect(finalModel.homeDesign.mobileTV.screen.w).toBe(1.65);
  expect(finalModel.homeDesign.modularSofa.moduleDimensions.w).toBe(1.275);
  expect(get("living-sofa").w).toBe(2.55);
});

test("R2 cabinets retain outer panels, open bays, three display shelves, and single-purpose ownership", () => {
  const kitchen = get("r2-kitchen-peninsula");
  expect(kitchen).toMatchObject({ w: 2.61, d: 0.65, h: 0.915 });
  expect(kitchen.r2Cabinet.bays.filter((bay: any) => bay.door === "open")).toHaveLength(2);
  const kitchenPanels = r2CabinetPanels(kitchen);
  expect(kitchenPanels.some((panel) => panel.w === 0.018 && panel.h > 0.7)).toBe(true);
  expect(kitchenPanels.some((panel) => panel.h === 0.018 && panel.d === kitchen.d)).toBe(true);
  const kitchenDoors: any[] = [];
  const materials = Object.fromEntries(["oak", "cabinetPaint", "cabinetInterior", "bronze", "steel", "linen", "cream"].map((name) => [name, new THREE.MeshBasicMaterial()]));
  expect(buildR2Cabinet(new THREE.Group(), kitchen, materials, kitchenDoors)).toBe(true);
  expect(kitchenDoors.length).toBeGreaterThan(0);
  expect(kitchenDoors.every((door) => door.pivot.name.includes(":door:0:"))).toBe(true);

  const waterbar = get("r2-waterbar");
  const displayBay = waterbar.r2Cabinet.bays.find((bay: any) => bay.purpose === "display" && bay.y > 1.6);
  expect(displayBay).toMatchObject({ door: "open", shelves: [0.1, 0.42, 0.74] });
  const displayBays = waterbar.r2Cabinet.bays.filter((bay: any) => bay.purpose === "display");
  expect(displayBays).toHaveLength(3);
  expect(new Set(displayBays.map((bay: any) => `${bay.x}:${bay.w}`)).size).toBe(1);

  const entry = get("r2-entry");
  const bench = entry.r2Cabinet.bays.find((bay: any) => bay.purpose === "bench");
  expect(bench.w).toBe(0.7);
  expect(bench.y + bench.h).toBeCloseTo(0.44, 6);
  const pegboard = entry.r2Cabinet.bays.find((bay: any) => bay.purpose === "pegboard");
  expect(pegboard.w).toBe(0.7);

  const ids = new Set(finalModel.objects.map((object: any) => object.id));
  for (const retired of ["wet-bar", "s02-bar-coffee", "s02-bar-prep", "s02-bar-beer", "s02-bar-storage", "upper-bar-coffee", "upper-bar-display", "upper-entry", "upper-entry-display", "entry-worn-again"]) {
    expect(ids.has(retired), `${retired} should have been retired`).toBe(false);
  }
  expect(finalModel.homeDesign.suspendedBarRack).toBe(false);
  expect(finalModel.homeDesign.collection.displayUnitId).toBe("r2-waterbar");
  expect(finalModel.objects.filter((object: any) => object.room === "bar" && object.type === "wall_storage").map((object: any) => object.id)).toEqual(["r2-waterbar"]);
  expect(finalModel.homeDesign.r2Revision.removedIds).toContain("upper-bar-display");
});
