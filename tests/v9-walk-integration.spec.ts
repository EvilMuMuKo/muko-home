import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
test("real home walk has proximity interaction, fixed eye height, idle suspension and reversible exit", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.waitForFunction(() => window.homePresentation?.getState().ready);
  await page.evaluate(() =>
    window.homePresentation.startGhostWalk({
      position: [3.25, 1.74, 4.05],
      target: [4.25, 1.15, 4.05],
    }),
  );
  await expect(page.locator(".ghost-joystick")).toBeVisible();
  await expect(page.locator(".ghost-interact")).toHaveAttribute(
    "data-target-id",
    "walk-fridge",
  );
  expect(
    (await page.evaluate(() => window.homePresentation.getGhostWalkState()))
      .position[1],
  ).toBe(1.74);
  expect(
    await page.evaluate(
      () => window.homePresentation.getState().ceilingVisible,
    ),
  ).toBe(true);
  await page.locator(".ghost-interact").click();
  await page.waitForFunction(
    () => Math.abs(window.homePresentation.getState().fridgeAngle) > 0.5,
  );
  await page.locator(".ghost-interact").click();
  await page.waitForFunction(
    () => Math.abs(window.homePresentation.getState().fridgeAngle) < 0.01,
  );
  const before = await page.evaluate(
    () => window.homePresentation.getCamera().position,
  );
  await page.keyboard.down("s");
  try {
    await expect
      .poll(
        async () => {
          const after = await page.evaluate(
            () => window.homePresentation.getCamera().position,
          );
          return Math.hypot(after[0] - before[0], after[2] - before[2]);
        },
        { timeout: 5_000, intervals: [100, 200, 400] },
      )
      .toBeGreaterThan(0.15);
  } finally {
    await page.keyboard.up("s");
  }
  const after = await page.evaluate(
    () => window.homePresentation.getCamera().position,
  );
  expect(
    Math.hypot(after[0] - before[0], after[2] - before[2]),
  ).toBeGreaterThan(0.15);
  await page.waitForFunction(
    () => !window.homePresentation.getPerformance().pending,
  );
  const renders = await page.evaluate(
    () => window.homePresentation.getPerformance().renders,
  );
  await page.waitForTimeout(300);
  expect(
    await page.evaluate(() => window.homePresentation.getPerformance().renders),
  ).toBe(renders);
  await page.locator(".ghost-exit").click();
  await expect(page.locator(".ghost-joystick")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => window.homePresentation.getGhostWalkState().active,
    ),
  ).toBe(false);
  expect(errors).toEqual([]);
});
test("whole-model geometry inventory has no missing object or nonfinite data", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => window.homePresentation?.getState().ready);
  const report = await page.evaluate(() =>
    window.homePresentation.getModelAudit(),
  );
  expect(report.issues).toEqual([]);
  expect(report.objects.filter((o) => o.missing)).toEqual([]);
  expect(report.checkedGeometryCount).toBeGreaterThan(100);
  expect(
    report.objects.find((o) => o.id === "s02-entry-return").accessFace,
  ).toBe("+x");
  await writeFile(
    test.info().outputPath("whole-model-audit.json"),
    JSON.stringify(report, null, 2),
  );
});
