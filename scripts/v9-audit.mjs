import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { chromium } from "@playwright/test";

const args = new Map();
for (let i = 2; i < process.argv.length; i++) {
  const [key, inline] = process.argv[i].split("=", 2);
  if (!key.startsWith("--")) throw new Error(`Unexpected argument: ${key}`);
  args.set(
    key.slice(2),
    inline ?? (process.argv[i + 1]?.startsWith("--") ? "true" : process.argv[++i]),
  );
}

const baseURL = args.get("url");
if (!baseURL) {
  throw new Error(
    "Pass --url=http://127.0.0.1:4173 to an already running Vite preview server.",
  );
}
const label = args.get("label") ?? "candidate";
const performanceOnly = args.get("performance-only") === "true";
const outputDir = resolve(args.get("out-dir") ?? `/tmp/muko-home-v9-audit/${label}`);
const executablePath =
  process.env.CHROMIUM_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const reportPath = resolve(outputDir, `${label}-audit.json`);
await mkdir(outputDir, { recursive: true });
const modelOut = args.get("model-out") ? resolve(args.get("model-out")) : null;
const designOut = args.get("design-out") ? resolve(args.get("design-out")) : null;
const modelAuditOut = args.get("audit-out") ? resolve(args.get("audit-out")) : null;
for (const target of [modelOut, designOut, modelAuditOut].filter(Boolean))
  await mkdir(dirname(target), { recursive: true });

const browser = await chromium.launch({
  executablePath,
  args: [
    "--no-sandbox",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--disable-dev-shm-usage",
  ],
});
const results = {
  label,
  baseURL,
  executablePath,
  capturedAt: new Date().toISOString(),
  note:
    "Playwright Chromium with SwiftShader. Device profiles and pointer gestures are emulated; this is comparable local evidence, not physical-phone FPS or GPU validation. renderMs is synchronous JavaScript render-call duration; frameMs is requestAnimationFrame interval during the automated gesture, not GPU timestamp-query time.",
  runs: [],
};

const percentile = (values, p) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)];
};
const summarize = (values) => ({
  samples: values.length,
  p50: percentile(values, 0.5),
  p95: percentile(values, 0.95),
  max: values.length ? Math.max(...values) : null,
});

try {
  for (const profile of [
    { id: "desktop", viewport: { width: 1440, height: 900 }, dpr: 1, touch: false },
    { id: "mobile-landscape", viewport: { width: 844, height: 390 }, dpr: 2, touch: true },
  ]) {
    let welcomeCapture = null;
    const context = await browser.newContext({
      viewport: profile.viewport,
      deviceScaleFactor: profile.dpr,
      isMobile: profile.touch,
      hasTouch: profile.touch,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    if (!performanceOnly) await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(baseURL, { waitUntil: performanceOnly ? "networkidle" : "domcontentloaded" });
    if (!performanceOnly) {
      // On this same scene page, wait for the transient greeting before the
      // software-WebGL ready checks can consume its short display interval.
      await page.locator(".home-welcome").waitFor({ state: "visible", timeout: 120_000 });
      await page.waitForFunction(() => {
        const text = document.querySelector(".home-welcome p");
        return text && Number.parseFloat(getComputedStyle(text).opacity) > 0.9;
      }, { timeout: 5_000 });
      const welcomeScreenshot = resolve(outputDir, `${label}-${profile.id}-welcome-entry.png`);
      const welcomeText = await page.locator(".home-welcome p").textContent();
      const ribbonCount = await page.locator(".home-welcome i").count();
      await page.screenshot({ path: welcomeScreenshot });
      await page.waitForFunction(() => window.homePresentation?.getState().ready, { timeout: 120_000 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      const expectedRibbons = profile.touch ? 24 : 40;
      if (ribbonCount !== expectedRibbons)
        throw new Error(`Welcome ribbon count mismatch for ${profile.id}: expected ${expectedRibbons}, got ${ribbonCount}`);
      welcomeCapture = {
        screenshot: welcomeScreenshot,
        text: welcomeText,
        ribbonCount,
        camera: await page.evaluate(() => window.homePresentation.getCamera()),
        pageErrors,
      };
    }
    await page.waitForFunction(() => window.homePresentation?.getState().ready, {
      timeout: 120_000,
    });
    await page.waitForFunction(
      () => window.homePresentation.getPerformance().renders > 0,
    );

    const runtime = await page.evaluate(() => {
      const canvas = document.querySelector("#scene");
      const gl = canvas?.getContext("webgl2") ?? canvas?.getContext("webgl");
      const extension = gl?.getExtension("WEBGL_debug_renderer_info");
      return {
        userAgent: navigator.userAgent,
        viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
        renderer: window.homePresentation.getState().renderer,
        quality: window.homePresentation.getPerformance().qualityProfile,
        gpu: extension
          ? {
              vendor: gl.getParameter(extension.UNMASKED_VENDOR_WEBGL),
              renderer: gl.getParameter(extension.UNMASKED_RENDERER_WEBGL),
            }
          : null,
      };
    });

    const design = await page.evaluate(() => {
      const api = window.homePresentation;
      const home = typeof api.getHomeDesign === "function" ? api.getHomeDesign() : null;
      const model = typeof api.getModel === "function" ? api.getModel() : null;
      const modelAudit = typeof api.getModelAudit === "function" ? api.getModelAudit() : null;
      const spatial = typeof api.getSpatialDesign === "function" ? api.getSpatialDesign() : null;
      return { home, model, modelAudit, spatial };
    });
    if (profile.id === "desktop") {
      if (modelOut && design.model)
        await writeFile(modelOut, `${JSON.stringify(design.model, null, 2)}\n`);
      if (designOut && design.home)
        await writeFile(designOut, `${JSON.stringify(design.home, null, 2)}\n`);
      if (modelAuditOut && design.modelAudit)
        await writeFile(modelAuditOut, `${JSON.stringify(design.modelAudit, null, 2)}\n`);
    }
    const views = [
      { id: "salon-bar-seat", light: "aperitif" },
      { id: "living-lounge", light: "game" },
      { id: "cinema-seat", light: "cinema" },
    ];
    const profileRun = { profile: profile.id, runtime, design, welcomeCapture, captures: [], extraCaptures: [], pageErrors };

    for (const view of views) {
      const viewReady = await page.evaluate(({ id, light }) => {
        const api = window.homePresentation;
        if (typeof api.setInteriorView !== "function") return false;
        api.setLightingScene(light);
        api.setInteriorView(id);
        return true;
      }, view);
      if (!viewReady) throw new Error("Presentation view API is unavailable.");
      await page.waitForFunction(
        () => !window.homePresentation.getPerformance().pending,
        { timeout: 10_000 },
      ).catch(() => {});
      await page.waitForTimeout(300);

      const screenshot = resolve(
        outputDir,
        `${label}-${profile.id}-${view.id}-${view.light}.png`,
      );
      await page.screenshot({ path: screenshot, animations: "disabled" });

      const before = await page.evaluate(() => {
        const perf = window.homePresentation.getPerformance();
        return { renders: perf.renderMs.length, frames: perf.frameMs.length };
      });
      const box = await page.locator("#scene").boundingBox();
      if (box) {
        const x = box.x + box.width * 0.5;
        const y = box.y + box.height * 0.5;
        await page.mouse.move(x, y);
        await page.mouse.down();
        for (let i = 1; i <= 16; i++) {
          await page.mouse.move(x + i * 3, y + Math.sin(i / 3) * 2, { steps: 1 });
          await page.waitForTimeout(35);
        }
        await page.mouse.up();
        await page.waitForTimeout(150);
      }
      const perf = await page.evaluate((start) => {
        const api = window.homePresentation;
        const report = api.getPerformance();
        const renderMs = report.renderMs.slice(start.renders);
        const frameMs = report.frameMs.slice(start.frames);
        return {
          state: api.getState(),
          camera: api.getCamera?.() ?? null,
          drawCalls: report.drawCalls,
          triangles: report.triangles,
          geometries: report.geometries,
          lightCount: report.lightCount,
          pixelRatio: report.pixelRatio,
          renderMs,
          frameMs,
          batching: report.roomBatching,
          materialDetail: report.materialDetail,
        };
      }, before);
      profileRun.captures.push({
        view: view.id,
        lighting: view.light,
        screenshot,
        performance: {
          renderMs: summarize(perf.renderMs),
          frameMs: summarize(perf.frameMs),
          drawCalls: perf.drawCalls,
          triangles: perf.triangles,
          geometries: perf.geometries,
          lightCount: perf.lightCount,
          pixelRatio: perf.pixelRatio,
        },
        state: perf.state,
        camera: perf.camera,
        batching: perf.batching,
        materialDetail: perf.materialDetail,
      });
    }

    const captureExtra = async (id, prepare) => {
      await prepare();
      await page.waitForFunction(
        () => !window.homePresentation.getPerformance().pending,
        { timeout: 10_000 },
      );
      await page.waitForTimeout(120);
      const screenshot = resolve(outputDir, `${label}-${profile.id}-extra-${id}.png`);
      await page.screenshot({ path: screenshot, animations: "disabled" });
      const snapshot = await page.evaluate(() => ({
        state: (() => {
          const state = window.homePresentation.getState();
          return {
            version: state.version,
            active: state.active,
            viewMode: state.viewMode,
            activePoint: state.activePoint,
            lightScene: state.lightScene,
            fridgeAngle: state.fridgeAngle,
            diningProgress: state.diningProgress,
            hatchProgress: state.hatchProgress,
            dishwasherProgress: state.dishwasherProgress,
          };
        })(),
        performance: (() => {
          const perf = window.homePresentation.getPerformance();
          return {
            drawCalls: perf.drawCalls,
            triangles: perf.triangles,
            geometries: perf.geometries,
            pixelRatio: perf.pixelRatio,
            qualityProfile: perf.qualityProfile,
          };
        })(),
        camera: window.homePresentation.getCamera?.() ?? null,
      }));
      profileRun.extraCaptures.push({ id, screenshot, ...snapshot });
    };
    const waitProgress = async (key, expected) => {
      await page.waitForFunction(
        ({ stateKey, value }) =>
          Math.abs(window.homePresentation.getState()[stateKey] - value) < 0.01,
        { stateKey: key, value: expected },
        { timeout: 10_000 },
      );
    };
    const setView = async (view, light = "day-public") => {
      await page.evaluate(
        ({ viewId, lighting }) => {
          const api = window.homePresentation;
          api.setLightingScene(lighting);
          api.setInteriorView(viewId);
        },
        { viewId: view, lighting: light },
      );
    };
    const overview = async () => {
      const panel = page.locator("#control-panel");
      await page.evaluate(() => window.homePresentation.setLightingScene("day-public"));
      if (await panel.evaluate((node) => node.hidden))
        await page.locator("#panel-toggle").click();
      await page.locator("#tab-space").click();
      await page.locator("#overview-view").click();
      if (!(await panel.evaluate((node) => node.hidden)))
        await page.locator("#panel-close").click();
      await page.waitForTimeout(250);
    };

    // Geometry/state coverage beyond the three timed performance views.
    if (!performanceOnly) {
      await captureExtra("overview", overview);
      await captureExtra("ghost-fridge-interaction-open", async () => {
        await page.evaluate(() => window.homePresentation.startGhostWalk({
          position: [3.25, 1.74, 4.05],
          target: [4.25, 1.15, 4.05],
        }));
        await page.waitForFunction(
          () => window.homePresentation.getGhostWalkState().nearestId === "walk-fridge",
          { timeout: 5_000 },
        );
        await page.locator(".ghost-interact").click();
        await page.waitForFunction(
          () => Math.abs(window.homePresentation.getState().fridgeAngle) > 0.5,
          { timeout: 5_000 },
        );
      });
      await page.evaluate(() => window.homePresentation.stopGhostWalk());
      await page.waitForTimeout(100);
      await captureExtra("ghost-fridge-open-view", async () => {
        await page.evaluate(() => window.homePresentation.startGhostWalk({
          position: [2.1, 1.74, 4.05],
          target: [4.25, 1.0, 4.05],
        }));
        await page.waitForFunction(
          () => window.homePresentation.getGhostWalkState().active,
          { timeout: 5_000 },
        );
      });
      await page.evaluate(() => window.homePresentation.stopGhostWalk());
      await page.waitForTimeout(100);
      await captureExtra("hatch-closed", async () => {
        await setView("two-entries");
        await page.evaluate(() => window.homePresentation.setHatchOpen(false));
        await waitProgress("hatchProgress", 0);
      });
      await captureExtra("hatch-open", async () => {
        await setView("two-entries");
        await page.evaluate(() => window.homePresentation.setHatchOpen(true));
        await waitProgress("hatchProgress", 1);
      });
      await captureExtra("dining-stowed", async () => {
        await setView("salon-bar-seat");
        await page.evaluate(() => window.homePresentation.setDiningOpen(false));
        await waitProgress("diningProgress", 0);
      });
      await captureExtra("dining-deployed", async () => {
        await setView("salon-bar-seat");
        await page.evaluate(() => window.homePresentation.setDiningOpen(true));
        await waitProgress("diningProgress", 1);
      });
      await captureExtra("tv-default-pose", async () => {
        await setView("living-main");
        await page.evaluate(() => window.homePresentation.setMobileTVAlternative(false));
        await waitProgress("tvProgress", 0);
      });
      await captureExtra("tv-alternate-pose", async () => {
        await setView("living-main");
        await page.evaluate(() => window.homePresentation.setMobileTVAlternative(true));
        await waitProgress("tvProgress", 1);
      });
      await captureExtra("sofa-joined", async () => {
        await setView("living-main");
        await page.evaluate(() => window.homePresentation.setSofaSeparated(false));
        await waitProgress("sofaProgress", 0);
      });
      await captureExtra("sofa-separated", async () => {
        await setView("living-main");
        await page.evaluate(() => window.homePresentation.setSofaSeparated(true));
        await waitProgress("sofaProgress", 1);
      });
      for (const view of [
        ["master-main", "master"],
        ["master-work", "master-work-pegboard"],
        ["kitchen-main", "kitchen"],
        ["bath-main", "bath"],
        ["balcony-main", "balcony"],
        ["guest-bay", "bay-guest"],
        ["master-bay", "bay-master"],
        ["entry-storage", "entry-pegboard"],
      ]) {
        await captureExtra(view[1], () => setView(view[0]));
      }
    }
    results.runs.push(profileRun);
    await writeFile(reportPath, `${JSON.stringify(results, null, 2)}\n`);
    await context.close();
  }
} finally {
  await browser.close();
}

await writeFile(reportPath, `${JSON.stringify(results, null, 2)}\n`);
console.log(JSON.stringify({ reportPath, profiles: results.runs.map((r) => r.profile) }, null, 2));
