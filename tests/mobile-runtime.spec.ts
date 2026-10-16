import { test, expect } from "@playwright/test";

test("phone runtime never starts a second room capture and keeps a stable paced raster", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 3,
    hasTouch: true,
    isMobile: true,
    reducedMotion: "reduce",
  });
  try {
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("http://localhost:4173/?renderer=webgl", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => (window as any).homePresentation?.getState().ready &&
      document.querySelector("#loading")?.classList.contains("done"));
    await page.evaluate(() => (window as any).homePresentation.whenVisualReady());
    const before = await page.evaluate(() => (window as any).homePresentation.getPerformance());
    expect(before.qualityProfile.mobile).toBe(true);
    expect(before.qualityProfile.maxDpr).toBeLessThanOrEqual(1.5);
    expect(before.qualityProfile.roomReflections).toBe(false);
    expect(before.roomRadiance.captureCount).toBe(0);
    expect(before.mirror.enabled).toBe(false);
    expect(before.materialDetail.loaded).toBe(12);
    expect(before.frameCap).toBe(30);
    expect(await page.evaluate(() => (window as any).homePresentation.getGhostWalkState().active)).toBe(true);

    await page.keyboard.down("l");
    await page.waitForTimeout(1200);
    await page.keyboard.up("l");
    const turning = await page.evaluate(() => (window as any).homePresentation.getPerformance());
    expect(turning.renders).toBeGreaterThan(before.renders);
    expect(turning.renders - before.renders).toBeLessThanOrEqual(42);
    expect(turning.pixelRatio).toBe(before.pixelRatio);
    expect(turning.drawingBuffer).toEqual(before.drawingBuffer);
    expect(turning.shadowUpdates).toBe(before.shadowUpdates);
    expect(turning.roomRadiance.captureCount).toBe(0);
    for (const view of ["master-main", "bath-main", "living-main"]) {
      await page.evaluate(id => (window as any).homePresentation.setInteriorView(id), view);
      await page.evaluate(() => (window as any).homePresentation.whenVisualReady());
    }
    await page.evaluate(() => (window as any).homePresentation.setLightingScene("aperitif"));
    await page.evaluate(() => (window as any).homePresentation.whenVisualReady());
    expect(await page.evaluate(() => (window as any).homePresentation.getPerformance().roomRadiance.captureCount)).toBe(0);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
