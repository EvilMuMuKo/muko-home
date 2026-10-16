import { test, expect } from "@playwright/test";

test("compact control panel has only space, light and action; no route or physics demo UI", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => window.homePresentation?.getState().ready);
  await page.click("#panel-toggle");

  const tabs = await page.locator('[role="tab"]').evaluateAll((elements) =>
    elements.map((element) => element.id),
  );
  expect(tabs).toEqual(["tab-space", "tab-light", "tab-action"]);
  await expect(page.locator("#tab-storage")).toHaveCount(0);
  await expect(page.locator("#theme-moments")).toBeHidden();
  for (const id of [
    "#scenario-run",
    "#scenario-stop",
    "#physics-drop",
    "#atmosphere-toggle",
  ])
    await expect(page.locator(id)).toBeHidden();
  await expect(page.getByRole("button", { name: /生活动线|结束动线|碰撞演示|微风与水波/ })).toBeHidden();
});

test("three light presets keep the selected camera; room viewpoints use a dropdown", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => window.homePresentation?.getState().ready);
  await page.click("#panel-toggle");
  await page.click("#tab-space");
  await page.locator('.room-tabs [data-view="master"]').click();
  await page.click("#panel-toggle");
  const viewpoint = page.locator("#viewpoint-select");
  await expect(viewpoint).toBeVisible();
  expect(await viewpoint.locator("option").count()).toBeGreaterThan(1);
  const options = await viewpoint.locator("option").evaluateAll((elements) =>
    elements.map((element) => (element as HTMLOptionElement).value),
  );
  const initialView = await viewpoint.inputValue();
  const nextView = options.find((value) => value && value !== initialView);
  expect(nextView).toBeTruthy();
  await viewpoint.selectOption(nextView!);
  await page.waitForTimeout(120);

  const beforeLighting = await page.evaluate(() => ({
    view: (document.querySelector("#viewpoint-select") as HTMLSelectElement).value,
    camera: window.homePresentation.getCamera().position,
  }));
  await page.click("#panel-toggle");
  await page.click("#tab-light");
  const presetIds = await page.locator("#lighting-presets [data-light-preset]").evaluateAll((elements) =>
    elements.map((element) => (element as HTMLElement).dataset.lightPreset),
  );
  expect([...presetIds].sort()).toEqual(["day-public", "aperitif", "cinema"].sort());

  for (const preset of ["day-public", "aperitif", "cinema"]) {
    await page.locator(`[data-light-preset="${preset}"]`).click();
    await page.waitForFunction(() => !window.homePresentation.getPerformance().pending);
    const after = await page.evaluate(() => ({
      view: (document.querySelector("#viewpoint-select") as HTMLSelectElement).value,
      camera: window.homePresentation.getCamera().position,
    }));
    expect(after.view).toBe(beforeLighting.view);
    expect(after.camera[0]).toBeCloseTo(beforeLighting.camera[0], 4);
    expect(after.camera[1]).toBeCloseTo(beforeLighting.camera[1], 4);
    expect(after.camera[2]).toBeCloseTo(beforeLighting.camera[2], 4);
  }
});
