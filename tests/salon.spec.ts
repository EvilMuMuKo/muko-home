import { test, expect } from "@playwright/test";
import * as THREE from "three";
import original from "../src/model.js";
import {
  createStorageDesign,
  storageCapacity,
  type DesignInput,
  type StorageUnit,
} from "../src/storage-design";
import { createAtmosphereDesign } from "../src/atmosphere-design";
import { createSalonDesign } from "../src/salon-design";
import { buildSalonArchitecture, buildSalonFurniture } from "../src/salon-mesh";
import { buildStorageUnit, type StorageDoor } from "../src/storage-mesh";
function model() {
  return createSalonDesign(
    createAtmosphereDesign(
      createStorageDesign(original as unknown as DesignInput),
    ),
  );
}

test("salon composition preserves the storage programme and keeps the original passage width", () => {
  const base = createAtmosphereDesign(
      createStorageDesign(original as unknown as DesignInput),
    ),
    next = createSalonDesign(base);
  expect(base.version).toBe("7.0.0");
  expect(next.version).toBe("8.0.0");
  expect(
    storageCapacity(
      next.objects.filter(
        (o) => o.type === "wall_storage",
      ) as unknown as StorageUnit[],
    ),
  ).toEqual(
    storageCapacity(
      base.objects.filter(
        (o) => o.type === "wall_storage",
      ) as unknown as StorageUnit[],
    ),
  );
  const routes = next.presentationScenarios as {
    id: string;
    people: { points: number[][]; radius: number }[];
  }[];
  const route = routes.find((s) => s.id === "ps5-balcony")!.people[0];
  expect(route.radius).toBe(0.45);
  expect(route.points[0][1]).toBe(5.4);
  expect(next.objects.find((o) => o.id === "dining-chair-left")!.type).toBe(
    "salon_banquette",
  );
  expect(
    next.objects.find((o) => o.id === "dining-chair-left")!.h,
  ).toBeLessThan(0.9);
});

test("new architectural frames and barrel shells clear all upper cabinet door sweeps", () => {
  const material = new THREE.MeshStandardMaterial(),
    materials = new Proxy({}, { get: () => material }) as Record<
      string,
      THREE.Material
    >;
  const scene = new THREE.Scene(),
    architecture = buildSalonArchitecture(scene, materials, () => {}),
    units = model().objects.filter(
      (o) => o.type === "wall_storage",
    ) as unknown as StorageUnit[];
  for (const solid of architecture.solids)
    expect(solid.max[1], solid.name).toBeLessThan(2.7);
  for (const unit of units) {
    const g = new THREE.Group();
    g.position.set(unit.x, unit.y, unit.z);
    g.rotation.y = (-unit.rotation * Math.PI) / 180;
    const doors: StorageDoor[] = [];
    buildStorageUnit(g, unit, materials, doors);
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      for (const door of doors) {
        door.pivot.rotation[door.axis ?? "y"] =
          door.axis === "x"
            ? door.openAngle! * t
            : ((-door.sign * Math.PI) / 2) * t;
      }
      g.updateMatrixWorld(true);
      for (const door of doors)
        for (const solid of architecture.solids.filter(
          (s) => s.room === unit.room,
        )) {
          const a = new THREE.Box3().setFromObject(door.pivot),
            b = new THREE.Box3(
              new THREE.Vector3(...solid.min),
              new THREE.Vector3(...solid.max),
            );
          const overlap = new THREE.Vector3(
            Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x),
            Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y),
            Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z),
          );
          expect(
            Math.min(overlap.x, overlap.y, overlap.z),
            `${unit.id} at ${t} collides with ${solid.name}`,
          ).toBeLessThanOrEqual(0.001);
        }
    }
  }
  const routes = model().presentationScenarios as {
    room: string;
    id: string;
    people: { points: number[][]; radius: number; height: number }[];
  }[];
  for (const route of routes.filter((s) => s.room === "guest"))
    for (const person of route.people)
      for (let i = 1; i < person.points.length; i++)
        for (let step = 0; step <= 100; step++) {
          const x =
            person.points[i - 1][0] +
            ((person.points[i][0] - person.points[i - 1][0]) * step) / 100;
          const z =
            person.points[i - 1][1] +
            ((person.points[i][1] - person.points[i - 1][1]) * step) / 100;
          for (const solid of architecture.solids.filter(
            (s) => s.room === "guest" && s.min[1] < person.height,
          )) {
            const dx = Math.max(solid.min[0] - x, 0, x - solid.max[0]);
            const dz = Math.max(solid.min[2] - z, 0, z - solid.max[2]);
            expect(
              Math.hypot(dx, dz),
              `${route.id} vs ${solid.name}`,
            ).toBeGreaterThanOrEqual(person.radius);
          }
        }
  material.dispose();
});

test("bespoke furniture stays inside its planned envelope", () => {
  const material = new THREE.MeshStandardMaterial(),
    materials = new Proxy({}, { get: () => material }) as Record<
      string,
      THREE.Material
    >;
  for (const o of model().objects) {
    const g = new THREE.Group(),
      moving = { chairs: [] };
    if (!buildSalonFurniture(g, o as never, materials, moving)) continue;
    g.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(g);
    expect(b.min.y, o.id).toBeGreaterThanOrEqual(-0.008);
    expect(b.max.y, o.id).toBeLessThanOrEqual(Number(o.h) + 0.012);
    expect(b.max.x - b.min.x, o.id).toBeLessThanOrEqual(Number(o.w) + 0.015);
    expect(b.max.z - b.min.z, o.id).toBeLessThanOrEqual(Number(o.d) + 0.015);
  }
  material.dispose();
});

test("new table and seating preserve the PS5 balcony route with a 0.45 m avatar", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?renderer=webgl");
  await page.waitForFunction(() => window.homePresentation?.getState().ready);
  const result = await page.evaluate(() => {
    const api = window.homePresentation,
      report = api.getSpatialDesign();
    const route = report.routes.find((s) => s.id === "ps5-balcony").people[0];
    const obstacles = api
      .getObjectBounds()
      .filter(
        (o) =>
          o.min &&
          o.min.every(Number.isFinite) &&
          o.min[1] < 1.7 &&
          o.max[1] > 0.15 &&
          [
            "living-sofa",
            "salon-coffee-table",
            "living-tv-console",
            "plant-living",
            "side-table",
            "living-lamp",
          ].includes(o.id),
      );
    const collisions = [];
    for (let i = 1; i < route.points.length; i++)
      for (let t = 0; t <= 100; t++) {
        const x =
            route.points[i - 1][0] +
            ((route.points[i][0] - route.points[i - 1][0]) * t) / 100,
          z =
            route.points[i - 1][1] +
            ((route.points[i][1] - route.points[i - 1][1]) * t) / 100;
        for (const o of obstacles) {
          const dx = Math.max(o.min[0] - x, 0, x - o.max[0]),
            dz = Math.max(o.min[2] - z, 0, z - o.max[2]);
          if (Math.hypot(dx, dz) < route.radius - 0.005) collisions.push(o.id);
        }
      }
    return {
      collisions: [...new Set(collisions)],
      version: api.getState().version,
      report,
    };
  });
  expect(result.version).toBe("10.0.0");
  expect(result.collisions).toEqual([]);
  expect(result.report.groups).toEqual(["bar", "living", "guest"]);
  const placed = Object.fromEntries(
    result.report.furniture.map((item: { id: string }) => [item.id, item]),
  );
  expect(placed["dining-table"]).toMatchObject({
    x: 11.0,
    z: 9.06,
    w: 1.1,
    d: 0.7,
    h: 0.74,
    rotation: 0,
  });
  expect(placed["dining-chair-left"]).toMatchObject({
    x: 8.27,
    z: 8.78,
    w: 0.5,
    d: 0.55,
    h: 0.88,
    rotation: 0,
  });
  expect(placed["dining-chair-right"]).toMatchObject({
    x: 8.27,
    z: 9.03,
    w: 0.5,
    d: 0.55,
    h: 0.88,
    rotation: 0,
  });
  await page.evaluate(() => {
    window.homePresentation.setLightingScene("cinema");
    window.homePresentation.setCompositionStudy(true);
  });
  await page.waitForFunction(
    () => !window.homePresentation.getPerformance().pending,
  );
  await page.evaluate(() => window.homePresentation.setCompositionStudy(false));
  expect(errors).toEqual([]);
});
