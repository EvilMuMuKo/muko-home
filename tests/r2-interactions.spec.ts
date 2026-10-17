import { test, expect } from "@playwright/test";

test("R2 glass travel updates dynamic collision geometry; waterbar doors reach both endpoints", async ({ page }) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("http://localhost:4173/?renderer=webgl");
  await page.waitForFunction(() => window.homePresentation?.getState().ready, undefined, { timeout: 90_000 });
  expect(await page.evaluate(() => window.homePresentation.getState().version)).toBe("13.0.0");
  expect(await page.evaluate(() => window.homePresentation.getR2Revision().version)).toBe(12);
  await page.evaluate(() => window.homePresentation.startGhostWalk());

  const audit = await page.evaluate(() => window.homePresentation.getWalkCollisionAudit());
  expect(audit?.movingOpenings).toContain("opening:kitchen-door");
  expect(audit?.movingOpenings).toContain("opening:kitchen-pass-window");

  await page.evaluate(() => window.homePresentation.setWalkDoorOpen("kitchen-door", false));
  await page.waitForFunction(() => window.homePresentation.getState().kitchenProgress < 0.01, undefined, { timeout: 5_000 });
  const closed = await page.evaluate(() => ({
    progress: window.homePresentation.getState().kitchenProgress,
    leaves: window.homePresentation.getMovingPartTransforms().kitchen,
    polygons: window.homePresentation.getWalkNavigationSnapshot().polygons,
  }));

  await page.evaluate(() => window.homePresentation.setWalkDoorOpen("kitchen-door", true));
  const intermediate = await sampleIntermediateKitchen(page);
  await page.waitForFunction(() => window.homePresentation.getState().kitchenProgress > 0.99, undefined, { timeout: 5_000 });
  const opened = await snapshotKitchen(page);

  expect(closed.leaves).toHaveLength(7);
  expect(opened.progress).toBeGreaterThan(0.99);
  expect(opened.leaves.slice(0, 3)).not.toEqual(closed.leaves.slice(0, 3));
  expect(opened.leaves.slice(3)).not.toEqual(closed.leaves.slice(3));
  expect(opened.polygons).not.toEqual(closed.polygons);
  if (intermediate) {
    expect(intermediate.progress).toBeGreaterThan(0.05);
    expect(intermediate.progress).toBeLessThan(0.95);
    expect(intermediate.leaves.slice(0, 3)).not.toEqual(closed.leaves.slice(0, 3));
    expect(intermediate.leaves.slice(0, 3)).not.toEqual(opened.leaves.slice(0, 3));
    expect(intermediate.leaves.slice(3)).not.toEqual(closed.leaves.slice(3));
    expect(intermediate.leaves.slice(3)).not.toEqual(opened.leaves.slice(3));
    expect(intermediate.polygons).not.toEqual(closed.polygons);
    expect(intermediate.polygons).not.toEqual(opened.polygons);
  }

  await page.evaluate(() => window.homePresentation.setStorageOpen(false));
  await page.waitForFunction(() => {
    const angles = window.homePresentation.getStorageDoors().filter((door) => door.unitId === "r2-waterbar").map((door) => door.angle);
    return angles.length > 0 && angles.every((angle) => Math.abs(angle) < 0.01);
  }, undefined, { timeout: 5_000 });
  const closedCabinet = await page.evaluate(() => window.homePresentation.getStorageDoors()
    .filter((door) => door.unitId === "r2-waterbar").map((door) => door.angle));
  await page.evaluate(() => window.homePresentation.setStorageOpen(true));
  await page.waitForFunction(() => {
    const angles = window.homePresentation.getStorageDoors().filter((door) => door.unitId === "r2-waterbar").map((door) => door.angle);
    return angles.length > 0 && angles.every((angle) => Math.abs(angle) > 1.45);
  }, undefined, { timeout: 5_000 });
  const openCabinet = await page.evaluate(() => window.homePresentation.getStorageDoors()
    .filter((door) => door.unitId === "r2-waterbar").map((door) => door.angle));
  expect(openCabinet.length).toBeGreaterThan(0);
  expect(closedCabinet.every((angle) => Math.abs(angle) < 0.01)).toBe(true);
  expect(openCabinet.every((angle) => Math.abs(angle) > 1.45)).toBe(true);

  test.info().annotations.push({
    type: "intermediate-kitchen-glass",
    description: intermediate ? `PASS: sampled progress=${intermediate.progress.toFixed(3)}` : "NOT RUN: active build did not expose a sampled intermediate kitchen-glass frame within 3 seconds",
  });
  test.info().annotations.push({
    type: "intermediate-waterbar-door",
    description: "NOT RUN: setStorageOpen exposes endpoints only; it applies zero-duration state changes",
  });
});

async function snapshotKitchen(page: import("@playwright/test").Page) {
  return page.evaluate(() => ({
    progress: window.homePresentation.getState().kitchenProgress,
    leaves: window.homePresentation.getMovingPartTransforms().kitchen,
    polygons: window.homePresentation.getWalkNavigationSnapshot().polygons,
  }));
}

async function sampleIntermediateKitchen(page: import("@playwright/test").Page) {
  return page.evaluate(() => new Promise<{
    progress: number;
    leaves: number[][];
    polygons: number[][][];
  } | null>((resolve) => {
    const deadline = performance.now() + 4_000;
    const sample = () => {
      const progress = window.homePresentation.getState().kitchenProgress;
      if (progress > 0.05 && progress < 0.95) {
        resolve({
          progress,
          leaves: window.homePresentation.getMovingPartTransforms().kitchen,
          polygons: window.homePresentation.getWalkNavigationSnapshot().polygons,
        });
      } else if (performance.now() >= deadline) {
        resolve(null);
      } else {
        requestAnimationFrame(sample);
      }
    };
    requestAnimationFrame(sample);
  }));
}

declare global {
  interface Window {
    homePresentation: {
      getState(): { ready: boolean; version: string; kitchenProgress: number };
      getR2Revision(): { version: number };
      startGhostWalk(): void;
      getWalkCollisionAudit(): { movingOpenings: string[] } | null;
      setWalkDoorOpen(id: string, open: boolean): void;
      getMovingPartTransforms(): { kitchen: number[][] };
      getWalkNavigationSnapshot(): { polygons: number[][][] };
      setStorageOpen(open: boolean): void;
      getStorageDoors(): Array<{ unitId: string; angle: number }>;
    };
  }
}
