import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";

const url = process.argv[2] || "http://localhost:4173/?renderer=webgl";
const out = resolve(process.argv[3] || "../../outputs/r7-implementation/screenshots");
await mkdir(out, { recursive: true });
const report = { url, time: new Date().toISOString(), status: "FAIL", pageErrors: [], consoleErrors: [], missing: [], shots: [] };
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  args: ["--enable-unsafe-webgpu", "--ignore-gpu-blocklist"],
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: "no-preference" });
  page.on("pageerror", (e) => report.pageErrors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") report.consoleErrors.push(m.text()); });
  page.on("response", (r) => { if (r.status() >= 400) report.missing.push([r.status(), r.url()]); });
  await page.goto(url);
  await page.waitForFunction(() => window.homePresentation?.getState().ready, null, { timeout: 120000 });
  await page.waitForFunction(() => window.homePresentation.getPerformance().renders > 0);
  await page.locator(".home-welcome").waitFor({ state: "detached", timeout: 15000 });
  const views = await page.evaluate(() => window.homePresentation.getInteriorViews());
  const byId = new Map(views.map((v) => [v.id, v]));
  const need = (id) => {
    if (!byId.has(id)) throw new Error(`interior view ${id} is not in the model`);
    return id;
  };
  const shot = async (name, view, light) => {
    need(view);
    const before = await page.evaluate(() => window.homePresentation.getPerformance().renders);
    await page.evaluate((id) => window.homePresentation.setLightingScene(id), light);
    await page.evaluate((id) => window.homePresentation.setInteriorView(id), view);
    await page.evaluate(() => window.homePresentation.whenVisualReady());
    await page.waitForFunction(({ before, view, light }) => {
      const h = window.homePresentation, p = h.getPerformance(), s = h.getState();
      return p.renders > before && !p.pending && s.activePoint === view && s.lightScene === light;
    }, { before, view, light }, { timeout: 60000 });
    const state = await page.evaluate((id) => {
      const s = window.homePresentation.getState();
      const camera = window.homePresentation.getInteriorViews().find((v) => v.id === id);
      return { activePoint: s.activePoint, lightScene: s.lightScene, night: s.night, kitchenProgress: s.kitchenProgress, renders: window.homePresentation.getPerformance().renders, camera };
    }, view);
    const path = resolve(out, name + ".png");
    await page.screenshot({ path });
    report.shots.push({ name, path, view, light, state });
  };
  await shot("bar-cabinet-day", need("salon-bar-seat"), "day-public");
  await page.evaluate(() => window.homePresentation.setStorageOpen(false));
  await shot("bar-glass-closed", need("salon-bar-seat"), "day-public");
  await page.evaluate(() => window.homePresentation.setStorageOpen(true));
  await shot("bar-glass-open", need("salon-bar-seat"), "day-public");
  await page.evaluate(() => window.homePresentation.setStorageOpen(false));
  await shot("sign-day", need("r4-bar-from-living"), "day-public");
  await shot("sign-night", need("r4-bar-from-living"), "aperitif");
  await page.evaluate(() => window.homePresentation.releaseKitchenHold());
  await page.evaluate(() => window.homePresentation.setKitchenOpen(false));
  await page.waitForFunction(() => window.homePresentation.getState().kitchenProgress < 0.05);
  await shot("kitchen-closed", need("kitchen-main"), "day-public");
  await page.evaluate(() => window.homePresentation.setKitchenOpen(true));
  await page.waitForFunction(() => {
    const p = window.homePresentation.getState().kitchenProgress;
    return p > 0.2 && p < 0.8;
  });
  const mid = await page.evaluate(() => window.homePresentation.holdKitchenProgress(window.homePresentation.getState().kitchenProgress));
  assert(mid > 0.2 && mid < 0.8, `kitchen mid progress ${mid}`);
  await shot("kitchen-mid", need("kitchen-main"), "day-public");
  await page.evaluate(() => window.homePresentation.releaseKitchenHold());
  await page.evaluate(() => window.homePresentation.setKitchenOpen(true));
  await page.waitForFunction(() => window.homePresentation.getState().kitchenProgress > 0.98);
  await shot("kitchen-open", need("kitchen-main"), "day-public");
  await shot("living-day", need("living-main"), "day-public");
  await shot("living-night", need("living-main"), "aperitif");
  await shot("master-day", need("master-main"), "day-public");
  await shot("master-work", need("master-work"), "day-public");
  await shot("cinema-bed", need("guest-main"), "day-public");
  await shot("cinema-desk", need("study-work"), "day-public");
  await page.setViewportSize({ width: 800, height: 450 });
  await shot("small-bar", need("salon-bar-seat"), "day-public");
  await shot("small-living", need("living-main"), "aperitif");
  report.status = "PASS";
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.consoleErrors, []);
  assert.deepEqual(report.missing, []);
} catch (error) {
  report.error = String(error);
  report.status = "FAIL";
  process.exitCode = 1;
} finally {
  await browser.close();
  await writeFile(resolve(out, "r7-visual-audit.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, error: report.error, shots: report.shots.length }, null, 2));
}
