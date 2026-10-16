import { test, expect } from "@playwright/test";
test("arrival starts at entrance and reduced motion has text without ribbons", async ({page}) => {
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.goto("/?renderer=webgl");
  // Check the transient arrival before waiting on the slow software-WebGL ready
  // signal; the welcome is intentionally short after the first visible paint.
  await expect(page.locator(".home-welcome")).toContainText("welcome to MuKo’s home", {timeout: 120000});
  await expect(page.locator(".home-welcome i")).toHaveCount(0);
  await page.locator("#panel-toggle").click();
  await expect(page.locator(".home-welcome")).toHaveCount(0);
  await page.waitForFunction(() => window.homePresentation?.getState().ready);
  await expect(page.locator(".ghost-look-joystick")).toBeVisible();
  expect(await page.evaluate(() => window.homePresentation.getGhostWalkState().active)).toBe(true);
  const model = await page.evaluate(() => window.homePresentation.getModel());
  expect(model.presentation.defaultView).toBe("entry-view");
  const camera = await page.evaluate(() => window.homePresentation.getCamera());
  expect(camera.position).toEqual([5.775,1.74,8.17]);
});
test("normal motion welcome has finite ribbons and cleans itself up", async ({page}) => {
  await page.emulateMedia({reducedMotion:"no-preference"});
  await page.addInitScript(() => {
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          const element = node instanceof Element ? node : null;
          const welcome = element?.matches(".home-welcome")
            ? element
            : element?.querySelector(".home-welcome");
          if (!welcome) continue;
          (window as any).__welcomeInsertionCapture = {
            text: welcome.textContent ?? "",
            ribbonCount: welcome.querySelectorAll("i").length,
            reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
          };
          observer.disconnect();
          return;
        }
      }
    });
    observer.observe(document, {childList:true, subtree:true});
  });
  await page.goto("/?renderer=webgl");
  await expect.poll(
    () => page.evaluate(() => Boolean((window as any).__welcomeInsertionCapture)),
    {timeout:120000},
  ).toBe(true);
  const insertion = await page.evaluate(() => (window as any).__welcomeInsertionCapture);
  expect(insertion.text).toContain("welcome to MuKo’s home");
  expect(insertion.ribbonCount).toBeGreaterThanOrEqual(24);
  expect(insertion.reducedMotion).toBe(false);
  await expect(page.locator(".home-welcome")).toHaveCount(0,{timeout:7000});
});
