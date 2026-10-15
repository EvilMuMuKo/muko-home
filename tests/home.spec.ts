import { test, expect } from "@playwright/test";
async function ready(page) {
  await page.waitForFunction(() => window.homePresentation?.getState().ready);
  await page.waitForFunction(
    () => window.homePresentation.getPerformance().renders > 0,
  );
}
test("WebGL preserves views, motion, lighting, PNG and idle suspension", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await ready(page);
  expect(
    await page.evaluate(() => window.homePresentation.getState().renderer),
  ).toBe("WebGL2");
  expect(
    await page.evaluate(
      () =>
        window.homePresentation.getPerformance().geometry.transformedVertices,
    ),
  ).toBeGreaterThan(0);
  expect(
    await page.evaluate(
      () =>
        window.homePresentation.getPerformance().roomBatching.drawCallsReduced,
    ),
  ).toBeGreaterThan(0);
  await page.click("#panel-toggle");
  await page.click('[data-view="guest"]');
  expect(
    await page.evaluate(() => window.homePresentation.getState().active),
  ).toBe("guest");
  await page.click("#panel-toggle");
  await page.click("#tab-action");
  await page.click("#bed-state");
  await page.waitForFunction(
    () => window.homePresentation.getState().bedProgress === 1,
  );
  await page.click("#tab-light");
  await page.click("#lighting");
  expect(
    await page.evaluate(() => window.homePresentation.getState().night),
  ).toBe(false);
  await page.click("#tab-space");
  await page.click("#overview-view");
  expect(
    await page.evaluate(() => window.homePresentation.getState().viewMode),
  ).toBe("overview");
  const download = page.waitForEvent("download");
  await page.click("#export");
  expect((await download).suggestedFilename()).toMatch(/\.png$/);
  await page.waitForFunction(
    () => !window.homePresentation.getPerformance().pending,
  );
  const renders = await page.evaluate(
    () => window.homePresentation.getPerformance().renders,
  );
  await page.waitForTimeout(500);
  expect(
    await page.evaluate(() => window.homePresentation.getPerformance().renders),
  ).toBe(renders);
  expect(errors).toEqual([]);
});
test("WebGPU unavailable and WASM fetch failure fall back independently", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "gpu", {
      value: { requestAdapter: async () => null },
    }),
  );
  await page.route("**/transform.wasm", (route) => route.abort());
  await page.goto("/?renderer=webgpu");
  await ready(page);
  expect(
    await page.evaluate(() => window.homePresentation.getState().renderer),
  ).toBe("WebGL2");
  expect(
    await page.evaluate(
      () => window.homePresentation.getPerformance().geometry.backend,
    ),
  ).toBe("javascript");
  await expect(page.locator("#fallback")).toBeHidden();
});
test("unsupported graphics show static preview", async ({ page }) => {
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (type === "webgl2" || type === "webgl") return null;
      return get.call(this, type, ...args);
    };
  });
  await page.goto("/");
  await expect(page.locator("#fallback")).toBeVisible();
  await expect(page.locator("#fallback")).toHaveJSProperty(
    "naturalWidth",
    1601,
  );
});
test("WebGPU request produces a working scene or recovers to WebGL after device loss", async ({
  page,
}) => {
  await page.goto("/?renderer=webgpu");
  await ready(page);
  await page.click("#panel-toggle");
  await page.click("#overview-view");
  // Dawn/SwiftShader may expose an adapter and subsequently lose it. Verify
  // recovery as a supported result, without claiming hardware GPU validation.
  await page.waitForFunction(() => {
    const api = window.homePresentation;
    return (
      api?.getState().ready &&
      api.getPerformance().renders > 0 &&
      !document.querySelector("#scene").hidden
    );
  });
  await page.waitForTimeout(1000);
  if (new URL(page.url()).searchParams.has("gpuFallback")) await ready(page);
  await expect(page.locator("#scene")).toBeVisible();
  expect(["WebGPU", "WebGL2"]).toContain(
    await page.evaluate(() => window.homePresentation.getState().renderer),
  );
});
test("optional physics loads on demand, conserves water and pauses cleanly", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await ready(page);
  expect(
    await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .some((r) => r.name.includes("atmosphere-")),
    ),
  ).toBe(false);
  await page.evaluate(() => window.homePresentation.setAtmosphereEnabled(true));
  await page.waitForFunction(
    () => window.homePresentation.getPerformance().physics.waterTime > 0.1,
  );
  const initial = await page.evaluate(
    () => window.homePresentation.getPerformance().physics,
  );
  expect(initial.curtains).toBe(6);
  expect(initial.colliders).toBeGreaterThan(50);
  await page.evaluate(() =>
    window.homePresentation.dropPhysicsBall([5.7, 1.3, 7.8]),
  );
  await page.waitForFunction(
    () => window.homePresentation.getPerformance().physics.ticks > 100,
  );
  const state = await page.evaluate(
    () => window.homePresentation.getPerformance().physics,
  );
  expect(state.waterVolume).toBeCloseTo(initial.waterVolume, 10);
  expect(state.positions[0].y).toBeGreaterThanOrEqual(0.06);
  await page.evaluate(() =>
    window.homePresentation.setAtmosphereEnabled(false),
  );
  await page.waitForFunction(
    () => !window.homePresentation.getPerformance().pending,
    {},
    { timeout: 60000 },
  );
  const ticks = await page.evaluate(
    () => window.homePresentation.getPerformance().physics.ticks,
  );
  await page.waitForTimeout(400);
  expect(
    await page.evaluate(
      () => window.homePresentation.getPerformance().physics.ticks,
    ),
  ).toBe(ticks);
  expect(errors).toEqual([]);
});
