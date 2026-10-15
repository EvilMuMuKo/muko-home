import { test, expect } from "@playwright/test";
import * as THREE from "three";
import original from "../src/model.js";
import {
  createStorageDesign,
  upperStorage,
  storageCapacity,
  type DesignInput,
} from "../src/storage-design";
import { buildStorageUnit, type StorageDoor } from "../src/storage-mesh";

test("storage covers every room without mutating the original design", () => {
  const model = createStorageDesign(original as unknown as DesignInput);
  expect(original.version).toBe("5.0.0");
  expect(model.version).toBe("6.0.0");
  for (const room of [
    "kitchen",
    "bar",
    "master",
    "guest",
    "living",
    "hall",
    "bath",
    "balcony",
  ])
    expect(upperStorage.filter((u) => u.room === room).length).toBeGreaterThan(
      0,
    );
  expect(model.objects.some((o) => o.id === "s02-open-ceiling-frame")).toBe(
    false,
  );
  expect(model.objects.some((o) => o.id === "bath-mirror")).toBe(false);
  expect(new Set(model.objects.map((o) => o.id)).size).toBe(
    model.objects.length,
  );
  const capacity = storageCapacity();
  expect(capacity.closedLitres).toBeGreaterThan(4000);
  expect(capacity.displayLitres).toBeGreaterThan(500);
  expect(capacity.method).toContain("未扣实际五金");
  for (const unit of capacity.units) {
    expect(unit.top).toBeLessThanOrEqual(2.601);
    expect(unit.closedLitres + unit.displayLitres).toBeGreaterThan(0);
  }
});
test("cabinet doors have real pivots, remain below ceiling and avoid the extractor sweep", () => {
  const material = new THREE.MeshStandardMaterial();
  const materials = new Proxy({}, { get: () => material }) as Record<
    string,
    THREE.Material
  >;
  const hood = new THREE.Box3(
    new THREE.Vector3(0.85, 1.65, 3.565),
    new THREE.Vector3(1.65, 2.245, 4.065),
  );
  const groups: THREE.Group[] = [];
  for (const unit of upperStorage) {
    const group = new THREE.Group();
    group.position.set(unit.x, unit.y, unit.z);
    group.rotation.y = (-unit.rotation * Math.PI) / 180;
    const doors: StorageDoor[] = [];
    buildStorageUnit(group, unit, materials, doors);
    groups.push(group);
    for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
      for (const door of doors) {
        if (door.axis === "x")
          door.pivot.rotation.x = door.openAngle! * fraction;
        else door.pivot.rotation.y = ((-door.sign * Math.PI) / 2) * fraction;
      }
      group.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(group);
      expect(bounds.max.y).toBeLessThan(2.7);
      if (unit.room === "kitchen")
        for (const door of doors)
          expect(
            new THREE.Box3().setFromObject(door.pivot).intersectsBox(hood),
            `${unit.id} opens through hood`,
          ).toBe(false);
    }
  }
  for (const group of groups)
    group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
  material.dispose();
});
test("new storage controls expose contents, textures load and desktop work area opens upward", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.waitForFunction(() => window.homePresentation?.getState().ready);
  expect(
    await page.evaluate(
      () => window.homePresentation.getPerformance().materialDetail.loaded,
    ),
  ).toBe(9);
  const conflicts = await page.evaluate(() => {
    const bounds = window.homePresentation
      .getObjectBounds()
      .filter(
        (o) =>
          o.min && o.min.every(Number.isFinite) && o.max.every(Number.isFinite),
      );
    const contents = /^s02-(bottle|cup|stemware)-/;
    const conflicts = [];
    for (const upper of bounds.filter((o) => o.id.startsWith("upper-")))
      for (const other of bounds) {
        if (other.id === upper.id || contents.test(other.id)) continue;
        if (other.id.startsWith("upper-") && other.id < upper.id) continue;
        if (
          [0, 1, 2].every(
            (i) =>
              Math.min(upper.max[i], other.max[i]) -
                Math.max(upper.min[i], other.min[i]) >
              0.003,
          )
        )
          conflicts.push([upper.id, other.id]);
      }
    return conflicts;
  });
  expect(conflicts).toEqual([]);
  await page.click("#panel-toggle");
  await page.click("#tab-storage");
  await expect(page.locator("#storage-summary")).toContainText("24 组");
  await page.click('[data-storage-room="master"]');
  expect(
    await page.evaluate(() => window.homePresentation.getState().activePoint),
  ).toBe("master-upper-review");
  await page.evaluate(() => window.homePresentation.setStorageOpen(true));
  await page.waitForFunction(() =>
    window.homePresentation
      .getStorageDoors()
      .filter((d) => d.unitId === "upper-master-work")
      .every((d) => Math.abs(d.angle) > 1),
  );
  expect(
    await page.evaluate(
      () => window.homePresentation.getStorage().units.length,
    ),
  ).toBe(24);
  await page.evaluate(() => window.homePresentation.setStorageOpen(false));
  await page.waitForFunction(() =>
    window.homePresentation
      .getStorageDoors()
      .every((d) => Math.abs(d.angle) < 0.001),
  );
  expect(errors).toEqual([]);
});
