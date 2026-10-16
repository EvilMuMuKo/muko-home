import { test, expect } from "@playwright/test";
test("arrival starts at entrance and reduced motion has text without ribbons", async ({page}) => {
  await page.goto("/");
  await page.waitForFunction(() => window.homePresentation?.getState().ready);
  const model = await page.evaluate(() => window.homePresentation.getModel());
  expect(model.presentation.defaultView).toBe("entry-view");
  const camera = await page.evaluate(() => window.homePresentation.getCamera());
  expect(camera.position).toEqual([5.775,1.74,8.17]);
  await expect(page.locator(".home-welcome")).toContainText("welcome to MuKo’s home");
  await expect(page.locator(".home-welcome i")).toHaveCount(0);
  await page.locator("#panel-toggle").click();
  await expect(page.locator(".home-welcome")).toHaveCount(0);
});
test("normal motion welcome has finite ribbons and cleans itself up", async ({page}) => {
  await page.emulateMedia({reducedMotion:"no-preference"});
  await page.goto("/");
  await expect(page.locator(".home-welcome p")).toHaveText("welcome to MuKo’s home");
  expect(await page.locator(".home-welcome i").count()).toBeGreaterThanOrEqual(24);
  await expect(page.locator(".home-welcome")).toHaveCount(0,{timeout:7000});
});
