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
  await page.goto("/?renderer=webgl");
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
  await page.evaluate(() => window.homePresentation.setLightingScene("warm"));
  await page.click('[data-light-preset="day-public"]');
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
  await page.goto("/?renderer=webgl");
  await expect(page.locator("#fallback")).toBeVisible();
  expect(
    await page.locator("#fallback").evaluate((image) => image.naturalWidth),
  ).toBeGreaterThan(1000);
});
test("default requests WebGPU and produces a working scene or bounded compatibility recovery", async ({
  page,
}) => {
  await page.goto("/");
  await ready(page);
  const requested = await page.evaluate(() => window.homePresentation.getPerformance().rendering.requested);
  expect(["webgpu", "webgl"]).toContain(requested);
  if (requested === "webgl") expect(new URL(page.url()).searchParams.get("gpuFallback")).toBe("1");
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
test("failed entrance shader preparation removes walk controls and presents the static preview", async ({page}) => {
  let injected = false;
  await page.route("**/assets/index-*.js", async route => {
    const response = await route.fetch();
    const source = await response.text();
    const body = source.replace(/await ([\w$]+)\.compileAsync\(/, (_, name) => {
      injected = true;
      return `await ${name}.__rejectedCompileForTest(`;
    });
    await route.fulfill({response,body});
  });
  await page.goto("/?renderer=webgl");
  await expect(page.locator("#fallback")).toBeVisible({timeout:120000});
  expect(injected).toBe(true);
  await expect(page.locator("#scene")).toBeHidden();
  await expect(page.locator(".ghost-walk-controls")).toHaveCount(0);
  await expect(page.locator(".home-welcome")).toHaveCount(0);
  await expect(page.locator("#panel-toggle")).toBeHidden();
  expect(await page.evaluate(()=>window.homePresentation.getState().ready)).toBe(false);
});
test("optional physics loads on demand, conserves water and pauses cleanly", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?renderer=webgl");
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
