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

test("cinema and guest-stay state APIs coordinate room lighting, doors and the convertible guest bed", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?renderer=webgl");
  await page.waitForFunction(() => window.homePresentation?.getState().ready);
  expect(
    await page.evaluate(() => window.homePresentation.getState().version),
  ).toBe("9.0.0");
  await page.click("#panel-toggle");
  await page.evaluate(() => window.homePresentation.setStorageOpen(true));
  await page.evaluate(() => window.homePresentation.setLightingScene("cinema"));
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
  await page.click("#tab-space");
  await page.click('[data-view="guest"]');
  await page.click("#panel-toggle");
  await page.click("#tab-action");
  await page.click("#bed-state");
  await page.waitForFunction(
    () => window.homePresentation.getState().bedProgress === 1,
  );
  await page.evaluate(() => window.homePresentation.setLightingScene("guest-stay"));
  await page.waitForFunction(
    () => !window.homePresentation.getPerformance().pending,
  );
  const guestStay = await page.evaluate(() => ({
    state: window.homePresentation.getState(),
    atmosphere: window.homePresentation.getAtmosphereDesign(),
  }));
  expect(guestStay.state.bedProgress).toBe(1);
  expect(guestStay.atmosphere.doorOpen).toBe(false);
  expect(guestStay.atmosphere.blackoutClosed).toBe(true);
  expect(
    await page.evaluate(
      () => window.homePresentation.getPerformance().materialDetail.loaded,
    ),
  ).toBe(12);
  expect(errors).toEqual([]);
});

test("master wallcover stays on its own physical wall face", () => {
  const plaster = new THREE.MeshStandardMaterial({vertexColors:true});
  const wallpaper = plaster.clone();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2,2.7,.18),plaster);
  finishWall(mesh,"master-bearing",[{sign:-1,ids:["living"]},{sign:1,ids:["master"]}],{roomPlaster:plaster,masterWallcover:wallpaper});
  expect(mesh.material).toEqual([plaster,wallpaper]);
  const normal=mesh.geometry.getAttribute("normal");
  for (const group of mesh.geometry.groups) {
    for (let i=group.start;i<group.start+group.count;i++) {
      const vertex=mesh.geometry.index!.getX(i);
      expect(group.materialIndex === 1).toBe(normal.getZ(vertex) > .5);
    }
  }
  expect(mesh.geometry.groups.length).toBeLessThanOrEqual(3);
  mesh.geometry.dispose();plaster.dispose();wallpaper.dispose();
});
