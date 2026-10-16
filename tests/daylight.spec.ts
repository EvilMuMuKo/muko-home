import { test, expect } from "@playwright/test";
import { daylightStudy, sunDirection } from "../src/daylight";
test("daylight vector follows the declared south-east orientation and remains a concept study", () => {
  const direction = sunDirection();
  expect(Math.hypot(...direction)).toBeCloseTo(1, 12);
  expect(direction[0]).toBeGreaterThan(0);
  expect(direction[1]).toBeGreaterThan(0);
  expect(direction[2]).toBeLessThan(0);
  expect(sunDirection(0, 0)).toEqual([-1, 0, -0]);
  expect(daylightStudy.missingInputs).toContain("surveyed_true_north");
});
test("daylight keeps an invisible roof shadow and does not turn clear glazing into an opaque blocker", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => window.homePresentation?.getState().ready);
  const result = await page.evaluate(() => ({
    state: window.homePresentation.getState(),
    daylight: window.homePresentation.getHomeDesign().daylight,
  }));
  expect(result.state.night).toBe(false);
  expect(result.daylight.roofProxyPresent).toBe(true);
  expect(result.daylight.transparentShadowCasters).toBe(0);
  expect(result.daylight.status).toContain("not_site_simulation");
});
