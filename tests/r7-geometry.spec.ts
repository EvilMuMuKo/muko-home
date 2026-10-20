import { test, expect } from "@playwright/test";
import * as THREE from "three";
import { createServer } from "vite";
import { r2CabinetPanels } from "../src/r2-cabinet-mesh";
import { buildR7PassWindow, poseR7Pass, r7FoldPoints, r7WalkerInSweep } from "../src/r7-mesh";
import { ensureR7Materials } from "../src/r7-finish";

let server: Awaited<ReturnType<typeof createServer>>;
let model: any;
test.beforeAll(async () => {
  server = await createServer({ configFile: false, root: process.cwd(), server: { middlewareMode: true }, appType: "custom" });
  ({ finalModel: model } = await server.ssrLoadModule("/src/final-design.ts"));
});
test.afterAll(async () => { await server?.close(); });

test("R7 keeps the R6 plan, switches and the beer floor opening", () => {
  expect(model.version).toBe("17.0.0");
  expect(model.homeDesign.r6Revision.switchPoints).toBe(16);
  expect(model.homeDesign.r6Revision.lightingCriteria.fixtureCount).toBe(43);
  expect(model.rooms.map((r: any) => r.id)).toContain("kitchen");
  const water = model.objects.find((o: any) => o.id === "r2-waterbar");
  expect(water.w).toBeCloseTo(3.51);
  expect(water.d).toBeCloseTo(0.75);
  expect(water.h).toBeCloseTo(2.7);
  const beer = water.r2Cabinet.bays.find((b: any) => b.purpose === "beer" && b.y === 0);
  expect(beer.h).toBeCloseTo(0.915);
  expect(beer.door).toBe("open");
  const keg = model.objects.find((o: any) => o.id === "kegerator");
  expect(keg.y).toBe(0);
  expect(keg.h).toBeCloseTo(0.85);
  const panels = r2CabinetPanels(water);
  const kick = panels.filter((p) => p.y < 0.09 && p.h < 0.12);
  const beerX = beer.x;
  expect(kick.some((p) => Math.abs(p.x - beerX) < beer.w / 2 - 0.05 && p.w > beer.w * 0.5)).toBe(false);
  const glassBays = water.r2Cabinet.bays.filter((b: any) => b.material === "r7BlackGlass");
  expect(glassBays).toHaveLength(1);
  expect(glassBays[0].door).toBe("solid");
  expect(glassBays[0].shelves).toHaveLength(3);
  expect(glassBays[0].w).toBeCloseTo(0.55, 2);
  const lip = model.objects.find((o: any) => o.id === "r7-pass-lip");
  expect(lip.y + lip.h).toBeCloseTo(0.95, 3);
  expect(lip.h).toBeCloseTo(0.03, 3);
  expect(model.objects.find((o: any) => o.id === "coffee-machine").y).toBeCloseTo(0.95);
  expect(model.homeDesign.electrical.points.filter((p: any) => p.kind === "switch")).toHaveLength(16);
});

test("fold leaves match the A12 samples and stay inside the sweep", () => {
  const scene = new THREE.Scene();
  const materials: Record<string, THREE.Material> = {
    glass: new THREE.MeshStandardMaterial({ name: "glass" }),
    charcoal: new THREE.MeshStandardMaterial({ name: "charcoal" }),
  };
  const opening = model.openings.find((o: any) => o.id === "kitchen-pass-window");
  expect(opening.r2Glazing).toBeUndefined();
  const root = buildR7PassWindow(scene, opening, materials);
  expect(root.getObjectByName("kitchen-pass-window:leaf:0")).toBeUndefined();
  const sweep = opening.sweep;
  for (const p of [0, 0.25, 0.5, 0.75, 1]) {
    poseR7Pass(root, p);
    const sample = r7FoldPoints(p);
    for (let g = 0; g < 2; g++) {
      const A = new THREE.Vector3();
      const B = new THREE.Vector3();
      const C = new THREE.Vector3();
      root.getObjectByName(`r7-fold-upper-${g}`)!.getWorldPosition(A);
      root.getObjectByName(`r7-fold-lower-${g}`)!.getWorldPosition(B);
      root.getObjectByName(`r7-fold-tip-${g}`)!.getWorldPosition(C);
      expect(A.y).toBeCloseTo(sample.A.y, 3);
      expect(A.z).toBeCloseTo(sample.A.z, 3);
      expect(B.y).toBeCloseTo(sample.B.y, 3);
      expect(B.z).toBeCloseTo(sample.B.z, 3);
      expect(C.y).toBeCloseTo(sample.C.y, 3);
      expect(C.z).toBeCloseTo(sample.C.z, 3);
    }
    const cap = root.getObjectByName("r7-header-cap") as THREE.Mesh;
    const hb = new THREE.Box3().setFromObject(cap);
    expect(hb.min.y).toBeLessThan(2.61);
    expect(hb.max.y).toBeGreaterThan(2.61);
    expect(hb.max.z).toBeLessThanOrEqual(5.82);
    root.traverse((node) => {
      if (!(node instanceof THREE.Mesh) || !node.name.startsWith("r7-")) return;
      if (node.name.startsWith("r7-header") || node.name.startsWith("r7-fixed") || node.name.startsWith("r7-corner") || node.name.startsWith("r7-hinge")) return;
      const box = new THREE.Box3().setFromObject(node);
      expect(box.min.x).toBeGreaterThanOrEqual(sweep.x0 - 0.03);
      expect(box.max.x).toBeLessThanOrEqual(sweep.x1 + 0.03);
      expect(box.min.z).toBeGreaterThanOrEqual(sweep.z0 - 0.04);
      expect(box.max.z).toBeLessThanOrEqual(sweep.z1 + 0.02);
      expect(box.min.y).toBeGreaterThanOrEqual(sweep.y0 - 0.04);
      expect(box.max.y).toBeLessThanOrEqual(sweep.y1 + 0.04);
    });
  }
  const sign = model.objects.find((o: any) => o.id === "r2-bar-sign");
  expect(sign.z + sign.d / 2).toBeLessThanOrEqual(sweep.z0);
  const signBox = new THREE.Box3(
    new THREE.Vector3(sign.x - sign.w / 2, sign.y, sign.z - sign.d / 2),
    new THREE.Vector3(sign.x + sign.w / 2, sign.y + sign.h, sign.z + sign.d / 2),
  );
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh) || !node.name.startsWith("r7-header")) return;
    expect(new THREE.Box3().setFromObject(node).intersectsBox(signBox)).toBe(false);
  });
  expect(r7WalkerInSweep(1.4, 6.2, sweep)).toBe(true);
  expect(r7WalkerInSweep(4.5, 7.2, sweep)).toBe(false);
});

test("R7 materials stay distinct and share one tile map", () => {
  const m: Record<string, THREE.Material> = {
    cabinetPaint: new THREE.MeshStandardMaterial({ color: "#fff", roughness: 0.7 }),
    oak: new THREE.MeshStandardMaterial({ color: "#fff", roughness: 1 }),
    linen: new THREE.MeshStandardMaterial({ color: "#ddd", roughness: 0.9 }),
    upperPaint: new THREE.MeshStandardMaterial({ color: "#fff", roughness: 0.7 }),
    sage: new THREE.MeshStandardMaterial({ color: "#888", roughness: 0.9 }),
  };
  ensureR7Materials(m);
  ensureR7Materials(m);
  const tile = m.r7Tile as THREE.MeshStandardMaterial;
  const pale = m.r7Pale as THREE.MeshStandardMaterial;
  const steel = m.r7Brushed as THREE.MeshStandardMaterial;
  expect(tile.map).toBeTruthy();
  expect(tile.map).not.toBe(pale.map || null);
  expect(steel.metalness).toBeGreaterThan(0.5);
  expect(steel.roughness).toBe(1);
  expect(steel.normalMap).toBeTruthy();
  expect((tile.roughnessMap!.image.data as Uint8Array)[0]).toBeGreaterThan(150);
  const nv = tile.normalMap!.image.data as Uint8Array;
  let tilted = false;
  for (let i = 0; i < nv.length; i += 4) if (Math.abs(nv[i] - 128) > 4 || Math.abs(nv[i + 1] - 128) > 4) tilted = true;
  expect(tilted).toBe(true);
  expect(tile.map!.repeat.x).toBe(10);
  expect(pale.metalness).toBeLessThan(0.1);
  expect((m.r7BlackGlass as THREE.MeshStandardMaterial).transparent).toBe(true);
  expect((m.r7BlackGlass as THREE.MeshStandardMaterial).opacity).toBeLessThan(0.5);
});

test("a walker inside the pass sweep cannot start the fold", async ({ page }) => {
  await page.goto("/?renderer=webgl");
  await page.waitForFunction(() => (window as any).homePresentation?.getState().ready, null, { timeout: 120000 });
  const version = await page.evaluate(() => (window as any).homePresentation.getState().version);
  expect(version).toBe("17.0.0");
  const blocked = await page.evaluate(() => {
    const home = (window as any).homePresentation;
    home.startGhostWalk({ position: [1.4, 1.74, 6.2], target: [1.4, 1.5, 5.9] });
    return home.setKitchenOpen(false);
  });
  expect(blocked.accepted).toBe(false);
  expect(blocked.reason).toBe("walker-in-pass-sweep");
  const progress = await page.evaluate(() => (window as any).homePresentation.getState().kitchenProgress);
  expect(progress).toBeGreaterThan(0.9);
  const held = await page.evaluate(() => (window as any).homePresentation.holdKitchenProgress(0));
  expect(held).toBeCloseTo(progress, 2);
});

test("room visibility filters the tagged pass, and the kitchen button refuses the sweep", async ({ page }) => {
  await page.goto("/?renderer=webgl");
  await page.waitForFunction(() => (window as any).homePresentation?.getState().ready, null, { timeout: 120000 });
  const vis = async (room: string, checked: boolean) => {
    await page.evaluate(([id, on]) => {
      const input = document.querySelector<HTMLInputElement>(`#room-visibility input[data-room="${id}"]`);
      if (!input) throw new Error(id);
      input.checked = on;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, [room, checked] as const);
  };
  for (const room of ["guest", "master", "living", "bath", "balcony", "hall"]) await vis(room, false);
  await vis("kitchen", true);
  await vis("bar", true);
  expect(await page.evaluate(() => (window as any).homePresentation.getR7PassPose().visible)).toBe(true);
  await vis("kitchen", false);
  await vis("bar", false);
  await vis("guest", true);
  await vis("master", true);
  expect(await page.evaluate(() => (window as any).homePresentation.getR7PassPose().visible)).toBe(false);
  await page.evaluate(() => document.querySelector<HTMLButtonElement>("#show-all")?.click());
  expect(await page.evaluate(() => (window as any).homePresentation.getR7PassPose().visible)).toBe(true);
  await page.evaluate(() => (window as any).homePresentation.startGhostWalk({ position: [1.4, 1.74, 6.2], target: [1.4, 1.5, 5.9] }));
  const before = await page.evaluate(() => (window as any).homePresentation.getState().kitchenProgress);
  await page.evaluate(() => document.querySelector<HTMLButtonElement>("#kitchen-toggle")?.click());
  const after = await page.evaluate(() => (window as any).homePresentation.getState().kitchenProgress);
  expect(after).toBeCloseTo(before, 2);
});

test("closed fold leaves stop a walking person and the display door opens", async ({ page }) => {
  test.setTimeout(120000);
  await page.goto("/?renderer=webgl");
  await page.waitForFunction(() => (window as any).homePresentation?.getState().ready, null, { timeout: 120000 });
  await page.evaluate(() => (window as any).homePresentation.stopGhostWalk?.());
  const closed = await page.evaluate(() => (window as any).homePresentation.setKitchenOpen(false));
  expect(closed.accepted).toBe(true);
  await page.waitForFunction(() => (window as any).homePresentation.getState().kitchenProgress < 0.05);
  await page.evaluate(() => (window as any).homePresentation.startGhostWalk({ position: [1.4, 1.74, 6.9], target: [1.4, 1.5, 5.2] }));
  await page.keyboard.down("w");
  await page.waitForTimeout(1200);
  await page.keyboard.up("w");
  const z = await page.evaluate(() => (window as any).homePresentation.getGhostWalkState().position[2]);
  expect(z).toBeGreaterThan(6.0);
  await page.evaluate(() => (window as any).homePresentation.stopGhostWalk());
  await page.evaluate(() => (window as any).homePresentation.setStorageOpen(true));
  const door = await page.evaluate(() => (window as any).homePresentation.getStorageDoors().find((d: any) => d.unitId === "r2-waterbar" && String(d.name).includes(":door:8:")));
  expect(Math.abs(door.angle)).toBeGreaterThan(1.4);
  const pulls = await page.evaluate(() => {
    const root = document;
    void root;
    return (window as any).homePresentation.getStorageDoors().filter((d: any) => d.unitId === "r2-waterbar" && /:door:(0|12):/.test(d.name)).map((d: any) => d.name);
  });
  expect(pulls.length).toBeGreaterThanOrEqual(2);
});
