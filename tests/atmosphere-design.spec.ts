import { test, expect } from "@playwright/test";
import * as THREE from "three";
import original from "../src/model.js";
import {
  createStorageDesign,
  storageCapacity,
  type DesignInput,
  type StorageUnit,
} from "../src/storage-design";
import {
  createAtmosphereDesign,
  roomPalette,
  themeMoments,
} from "../src/atmosphere-design";
import { finishWall } from "../src/room-finish";

test("room redesign preserves storage and furniture clearances while fitting the 83-inch screen", () => {
  const base = createStorageDesign(original as unknown as DesignInput),
    model = createAtmosphereDesign(base);
  expect(base.version).toBe("6.0.0");
  expect(model.version).toBe("7.0.0");
  const before = base.objects.filter(
      (o) => o.type === "wall_storage",
    ) as unknown as StorageUnit[],
    after = model.objects.filter(
      (o) => o.type === "wall_storage",
    ) as unknown as StorageUnit[];
  expect(storageCapacity(after)).toEqual(storageCapacity(before));
  for (const object of base.objects.filter((o) => o.id !== "guest-tv")) {
    const updated = model.objects.find((o) => o.id === object.id)!;
    for (const key of ["x", "y", "z", "w", "h", "d", "rotation"])
      expect(updated[key], `${object.id}:${key}`).toEqual(object[key]);
  }
  const tv = model.objects.find((o) => o.id === "guest-tv")!,
    upper = model.objects.find((o) => o.id === "upper-guest-media")!;
  expect(Number(tv.y) + Number(tv.h)).toBeLessThan(Number(upper.y) - 0.1);
  expect(Math.hypot(Number(tv.w), Number(tv.h)) / 0.0254).toBeCloseTo(83, 0);
  expect(
    new Set((model.lighting.scenes as { id: string }[]).map((s) => s.id)).size,
  ).toBe((model.lighting.scenes as unknown[]).length);
});

test("wall finishes colour the two physical faces independently without recolouring neighbours", () => {
  const shared = new THREE.BoxGeometry(1, 2.7, 0.18),
    mesh = new THREE.Mesh(shared, new THREE.MeshStandardMaterial());
  const material = new THREE.MeshStandardMaterial({ vertexColors: true });
  finishWall(
    mesh,
    "guest-west",
    [
      { sign: 1, ids: ["kitchen"] },
      { sign: -1, ids: ["guest"] },
    ],
    { roomPlaster: material },
  );
  expect(mesh.geometry).not.toBe(shared);
  expect(shared.getAttribute("color")).toBeUndefined();
  const normals = mesh.geometry.getAttribute("normal"),
    colors = mesh.geometry.getAttribute("color");
  for (let i = 0; i < normals.count; i++) {
    const expected = new THREE.Color(
      mesh.geometry.getAttribute("position").getZ(i) > 0
        ? roomPalette.paper
        : roomPalette.cinemaFront,
    );
    expect(colors.getX(i)).toBeCloseTo(expected.r, 5);
    expect(colors.getY(i)).toBeCloseTo(expected.g, 5);
    expect(colors.getZ(i)).toBeCloseTo(expected.b, 5);
  }
  mesh.geometry.dispose();
  shared.dispose();
  material.dispose();
});

test("theme controls coordinate lights, darkening, door, shutters and the convertible guest bed", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.waitForFunction(() => window.homePresentation?.getState().ready);
  expect(
    await page.evaluate(() => window.homePresentation.getState().version),
  ).toBe("8.0.0");
  await page.click("#panel-toggle");
  await expect(page.locator("[data-moment]")).toHaveCount(themeMoments.length);
  await page.click('[data-moment="coffee"]');
  await page.waitForFunction(
    () => !window.homePresentation.getPerformance().pending,
  );
  expect(
    await page.evaluate(() => window.homePresentation.getState().night),
  ).toBe(false);
  expect(
    await page.evaluate(() => window.homePresentation.getState().activePoint),
  ).toBe("bar-ritual");
  await page.evaluate(() => window.homePresentation.setStorageOpen(true));
  await page.click("#panel-toggle");
  await page.click('[data-moment="cinema"]');
  await page.waitForFunction(
    () => !window.homePresentation.getPerformance().pending,
  );
  const cinema = await page.evaluate(() => ({
    state: window.homePresentation.getState(),
    theme: window.homePresentation.getAtmosphereDesign(),
    doors: window.homePresentation.getStorageDoors(),
  }));
  expect(cinema.theme.blackoutClosed).toBe(true);
  expect(cinema.theme.doorOpen).toBe(false);
  expect(cinema.state.bedProgress).toBe(0);
  expect(cinema.doors.every((d) => Math.abs(d.angle) < 0.001)).toBe(true);
  for (const id of ["storage-guest-task", "guest-wall-cove"]) {
    expect(
      cinema.state.lighting.fixtures.find((f) => f.id === id).intensity,
    ).toBe(0);
    expect(
      cinema.state.lighting.allocated.map((f) => f.sourceId),
    ).not.toContain(id);
  }
  await page.click("#panel-toggle");
  await page.click('[data-moment="guest-stay"]');
  await page.waitForFunction(
    () => window.homePresentation.getState().bedProgress === 1,
  );
  await page.click("#panel-toggle");
  await page.click("#tab-action");
  await page.click("#cinema-door-review");
  expect(
    await page.evaluate(() => window.homePresentation.getState().activePoint),
  ).toBe("cinema-door-review");
  await page.click("#panel-toggle");
  await page.click("#tab-action");
  await page.click("#cinema-door-toggle");
  expect(
    await page.evaluate(
      () => window.homePresentation.getAtmosphereDesign().doorOpen,
    ),
  ).toBe(true);
  await page.click("#panel-close");
  await page.evaluate(() => window.homePresentation.setLightingScene("game"));
  await page.waitForFunction(
    () => !window.homePresentation.getPerformance().pending,
  );
  expect(
    await page.evaluate(() => window.homePresentation.getState().active),
  ).toBe("living");
  expect(
    await page.evaluate(
      () => window.homePresentation.getPerformance().materialDetail.loaded,
    ),
  ).toBe(9);
  expect(errors).toEqual([]);
});
